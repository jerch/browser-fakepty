import { clockIsOverdue, clockUpdate } from './Clock';
import { lowerPower2 } from './Helper';

export const enum IOpenFlags {
  // these 3 are exclusive
  RDONLY = 0,
  WRONLY = 1,
  RDWR = 2,

  // FIXME: below fix symbol values (should match linux)
  APPEND = 2,
  //ASYNC,
  CLOEXEC = 4,
  CREAT = 8,
  DIRECT = 16,
  DIRECTORY = 32,
  DSYNC = 64,
  EXCL = 128,
  //LARGEFILE,
  NOATIME = 256,
  NOCTTY = 512,
  NOFOLLOW = 1024,
  NONBLOCK = 2048,
  //NDELAY,
  //PATH,
  SYNC = 4096,
  //TMPFILE,
  TRUNC = 8192,
}

// mask for exclusive RDONLY | WRONLY | RDWR handling
export const RDWR_MASK = IOpenFlags.RDONLY | IOpenFlags.WRONLY | IOpenFlags.RDWR;

/**
 * Pipe implementation.
 * 
 * The pipe works with JS objects as message objects (any beside null are allowed)
 * and does no data serialization or cloning. This was chosen for performance reasons
 * and will fit any "fire and forget" data usage.
 * Make sure to clone the data, if it gets used mutually.
 * 
 * `read` and `write` return a promise indicating blocking behavior.
 * 
 * write:
 * `write` will resolve immediately until the high watermark is hit, which ensures to be able
 * to write a bunch of chunks before a "context switch" is needed.
 * Either await every write call (similar to classical blocking semantics) or check
 * beforehand, that `writable` is true. Never write to a non writable pipe, it will cause
 * data losses and return a rejected promise.
 * `onDrain` will indicate, whether it is save to start writing again.
 * 
 * read:
 * `read` will return a promise resolving up to the amount of requested data.
 * `readable` indicates whether data is pending and can be read.
 * TODO: document `onData` flow mode...
 * 
 * 
 *  or NULL if the is empty
 * and has no writer anymore.
 * 
 * Supported ioctl/fcntl:
 *  FIONREAD: ioctl to request size of pending data in the pipe buffer
 *  F_GETPIPE_SZ: fcntl to request the size limit of the pipe buffer
 *  F_SETPIPE_SZ: fcntl to alter the size limit of the pipe buffer
 * 
 * Note that the size limit is a discard limit of pending JS objects in the buffer,
 * any write attempt beyond that limit will be rejected. Normally the pipe will block writes
 * much earlier (half of limit) to avoid hitting the discard limit.
 */

export const enum PIPE_CTL {
  FIONREAD,
  FIONWRITE,
  F_GETPIPE_SZ,
  F_SETPIPE_SZ
}


/**
 * Pipe limits:
 *    LIMIT       Upper discard limit, should be a power of 2 number.
 *                Writing beyond that limit will discard new data.
 *                LIMIT is used to calculate the pipe watermarks like this:
 *                  LOW - 1/4 of LIMIT: onDrain is triggered
 *                  HIGH - 1/2 of LIMIT: writing will block promise resolving
 *    MIN_LIMIT   Minimum buffer size, used instead if the number was below.
 *    MAX_LIMIT   Maximum buffer size, used instead if the number was higher.
 * 
 * Note: Due to the way LIMIT gets used to calculate the watermarks, MIN_LIMIT should
 * not be smaller than 8. A high LIMIT may have a negative impact on main thread
 * rendering cycles (fps), as it will priorize the pipe chunk handling as microtasks.
 * 
 * TODO: move it to global settings
 */
const LIMIT = 64;
const MIN_LIMIT = 8;
const MAX_LIMIT = 1024;

/**
 * Userland interface of the pipe.
 */
export class PipePort {
  public isReader = false;  // whether this port can read
  public isWriter = false;  // whether this port can write
  public readable = false;  // whether it is safe to read
  public writable = false;  // whether it is safe to write
  public closed = false;
  constructor(public pipe: Pipe, public flags: IOpenFlags) {
    if ((flags & RDWR_MASK) === RDWR_MASK) {
      throw new Error('flags may contain only one of RDONLY | WRONLY | RDWR');
    }
    this.isReader = !!(((flags & RDWR_MASK) !== IOpenFlags.WRONLY) && ++this.pipe.readers);
    this.isWriter = !!(((flags & RDWR_MASK) !== IOpenFlags.RDONLY) && ++this.pipe.writers);
  }
  public read(length: number): Promise<any[]> {
    return this.pipe?.read(length);
  }
  public write(data: any): Promise<boolean> {
    return this.pipe?.write(data);
  }

  // low level OS like stuff
  public dup(flags: IOpenFlags): PipePort {
    return this.pipe.open(flags);
  }
  public ctl(type: PIPE_CTL, ...args: any[]): any {
    switch (type) {
      case PIPE_CTL.FIONREAD:
        return this.pipe.size;
      case PIPE_CTL.F_GETPIPE_SZ:
        return this.pipe.limit;
      case PIPE_CTL.F_SETPIPE_SZ:
        if (typeof args[0] !== 'number') {
          throw new Error('F_SETPIPE_SZ arg must be a number');
        }
        this.pipe.limit = args[0];
        return;
      default:
        console.error('unsupported pipe ctl', type);
    }
  }
  /**
   * Events needed:
   *  close     pipe got closed
   *  data      read data event
   *  end       all data consumed
   *  error     on any error
   *  pause     when .pause() got called
   *  readable  whether data can be read
   *  resume    when .resume() got called
   *  drain     when writing can be continued
   *  finish    when .end() was called and writing data is flushed
   *  pipe/unpipe   ???
   *  
   */
  public onData(): void {}    // read data event
  public onEnd(): void {}     // all data consumed
  public onClose(): void {}   // pipe got closed
}


/**
 * Kernel side of the pipe.
 */
export class Pipe {
  public readers = 0;
  public writers = 0;
  private _limit = LIMIT;
  private _low = LIMIT >> 1;
  private _high = LIMIT >> 2;
  public buffer: any[] = [];
  private _writeResolver: (() => void)[] = [];
  private _readResolver: ((data: any[]) => void)[] = [];
  private _readAmount: number[] = [];
  private _pendingResolve = false;

  public open(flags: IOpenFlags): PipePort {
    return new PipePort(this, flags);
  }

  public set limit(value: number) {
    value = Math.min(Math.max(value | 0, MIN_LIMIT), MAX_LIMIT);
    let exp = (value & (value - 1)) ? 1 : 0;
    while(value >>= 1) exp++;
    this._limit = 1 << exp--;
    this._high = 1 << exp--;
    this._low = 1 << exp;
  }

  public get limit(): number {
    return this._limit;
  }

  public get size(): number {
    return this.buffer.length;
  }

  public read(length: number): Promise<any> {
    return new Promise(resolve => {
      this._readResolver.push(resolve);
      this._readAmount.push(length);
      this._resolve();
    });
  }

  public write(data: any): Promise<boolean> {
    // this should never happen...
    if (this.buffer.length > this._limit) {
      return Promise.reject('data discarded, to much pending data');
    }
    this.buffer.push(data);
    return new Promise(resolve => {
      this._writeResolver.push(resolve);
      this._resolve();
    });
  }

  private _resolve(): void {
    if (this._pendingResolve) return;
    while (this.buffer.length && this._readResolver.length) {
      if (clockIsOverdue()) {
        setTimeout(() => {
          clockUpdate();
          this._pendingResolve = false;
          this._resolve();
        }, 0);
        this._pendingResolve = true;
        return;
      }
      const data = this.buffer.splice(0, this._readAmount.shift());
      const length = data.length;
      this._readResolver.shift()(data);
      this._writeResolver.splice(0, length).forEach(resolve => resolve());
    }
    // allow writer to continue if we are below the low watermark
    if (this.buffer.length < this._low) {
      this._writeResolver.forEach(resolve => resolve());
    }
    // TODO: onDrain stuff...
  }
}
