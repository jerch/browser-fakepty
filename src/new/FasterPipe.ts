import { FifoBuffer } from './FifoBuffer';
import { PIPE_BUF, IOpenFlags, RDWR_MASK, PIPE_CTL, POLL_EVENTS, POLL_REVENTS_MASK } from './Constants';
import { clockIsOverdue, clockUpdate } from './Clock';
import { IFasterPipePort, IDeferredChunk } from './Types';
import { ERRNO } from './errno';
import { higherPower2 } from './Helper';
import { CHUNK_POOL } from './Pools';


// nodejs queueMicrotask shim
declare var queueMicrotask: (cb: () => void) => void;
if (typeof queueMicrotask === 'undefined') {
  var queueMicrotask = ((cb: () => void) => Promise.resolve().then(cb).catch((err: any) => setTimeout(() => { throw err }, 0))) as (cb: () => void) => void;
}


export class FasterPipePort implements IFasterPipePort {
  public isReader = false;  // whether this port can read
  public isWriter = false;  // whether this port can write
  public closed = false;

  constructor(public pipe: FasterPipe, public flags: IOpenFlags) {
    if ((flags & RDWR_MASK) === RDWR_MASK) {
      throw new Error('flags may contain only one of RDONLY | WRONLY | RDWR');
    }
    this.isReader = !!(((flags & RDWR_MASK) !== IOpenFlags.WRONLY) && ++this.pipe.readers);
    this.isWriter = !!(((flags & RDWR_MASK) !== IOpenFlags.RDONLY) && ++this.pipe.writers);
  }

  public read(buf: ArrayBuffer, offset: number, length: number, callback: (count: number, error?: any) => void): number | null {
    if (this.closed || !this.isReader) return -ERRNO.EBADF;
    return this.pipe.read(buf, offset, length, callback);
  }

  public write(buf: ArrayBuffer, offset: number, length: number, callback: (count: number, error?: any) => void): number {
    if (this.closed || !this.isWriter) return -ERRNO.EBADF;
    if (!this.pipe.readers) return -ERRNO.EPIPE;
    return this.pipe.write(buf, offset, length, callback);
  }

  public dup(flags: IOpenFlags = this.flags): IFasterPipePort {
    return this.pipe.open(flags);
  }

  public ctl(type: PIPE_CTL, ...args: any[]): any {
    // TODO: extend by all applicable fcntl/ioctl calls
    // errno handling?
    switch (type) {
      case PIPE_CTL.FIONREAD:
        return this.pipe.fifo.size;
      case PIPE_CTL.FIONWRITE:
        return this.pipe.pendingLength;
      case PIPE_CTL.F_GETPIPE_SZ:
        return this.pipe.fifo.data.length;
      case PIPE_CTL.F_SETPIPE_SZ:
        return this.pipe.changeFifoSize(args[0]);
      default:
        console.error('unsupported pipe ctl', type);
    }
  }

  public poll(events: POLL_EVENTS): POLL_EVENTS {
    // always handle POLLERR, POLLHUP, POLLNVAL
    events |= POLL_REVENTS_MASK;
    let revents = 0;

    if (this.closed) {
      // POLLNVAL should never happen here (filtered at higher "kernel/process" level)
      // we still deliver the event just in case the pipe end is stale
      if (this.closed) revents |= POLL_EVENTS.POLLNVAL;
      return revents;
    }

    if (this.isReader) {
      if ((events & POLL_EVENTS.POLLIN) && this.pipe.fifo.size) revents |= POLL_EVENTS.POLLIN;
      // linux behavior: always sends POLLHUP even if there is still pending data
      // note BSD would only send POLLHUP after all data was consumed (easier to go with?)
      if ((events & POLL_EVENTS.POLLHUP) && !this.pipe.writers) revents |= POLL_EVENTS.POLLHUP;
    }

    if (this.isWriter) {
      if ((events & POLL_EVENTS.POLLOUT) && !this.pipe.fifo.size && !this.pipe.wBuffer.length) revents |= POLL_EVENTS.POLLOUT;
      if ((events & POLL_EVENTS.POLLERR) && !this.pipe.readers) revents |= POLL_EVENTS.POLLERR;
    }

    // skip POLL_EVENTS.POLLPRI here (prolly needed in tty for tty_ioctl propagation)
    // skip POLL_EVENTS.POLLRDHUP

    return revents;
  }

  public close(): number {
    if (this.closed) return -ERRNO.EBADF;
    if (this.isReader) --this.pipe.readers;
    if (this.isWriter) --this.pipe.writers;
    this.closed = true;
    this.pipe = null;
    return 0;
  }
  
  public lseek(offset: number, whence: any): number {
    return -ERRNO.ESPIPE;
  }
}


/**
 * Callback based promise free pipe implementation.
 * 
 * Runs alot faster faster than the promise based `Pipe` class (tested with Chrome):
 * - aligned chunks :   550 - 700 MB/s    vs.   400 - 500 MB/s  --> >33% faster
 * - single byte    :   4 MB/s            vs.   1 MB/s          --> ~300% faster
 * In Firefox the difference for single bytes is >30x (bug?).
 * 
 * Interpretion:
 * Aligned chunks are only slightly faster. They always trigger a callback invocation 1:1 to the created
 * promises in `Pipe`, which should be equivalent in microtask pressure. The speedup is prolly related to
 * the promise object creation overhead.
 * Single bytes are much faster. This is prolly due to less callback invocations in write/read - if read/write can be
 * done right away, it will return `true` (write) or the number of read bytes (read) indicating a sync action,
 * while `Pipe` always returns a promise, which schedules a microtask.
 * 
 * Downsides of callback based approach:
 * 
 * The reader/writer code gets more complicated with the need of distinction of sync vs. scheduled actions and
 * correct state handling over callbacks, while the promise based approach can be written
 * with simplified async/await code.
 * --> Possible to write a promise based layer on top w'o sacrificing the perf again?
 * 
 * The sync approach is more likely to run into blocking the main thread, if the reader/writer code is not
 * written with the clock handling in mind. In fact this is always an issue, still the sync handling makes it
 * more likely to stay in a local code block.
 * --> Needs style guide / rule to correctly invoke the clock.
 * 
 * possible enhancements:
 * - split big writes into >= PIPE_BUF chunks and cycles through them?
 * - priority queue?
 */
export class FasterPipe {
  public _readers = 0;
  public _writers = 0;
  public fifo = new FifoBuffer(PIPE_BUF);
  public wBuffer: IDeferredChunk[] = [];   // pending write chunks
  public rBuffer: IDeferredChunk[] = [];   // pending read chunks
  public pendingLength = 0;               // length of pending write chunks
  private _pendingResolve = false;

  private _boundResolve = this._resolve.bind(this);
  private _boundScheduleResolve = (() => { clockUpdate(); this._resolve(); }).bind(this);

  /**
   * Open a pipe port corresponding to the pipe.
   */
  public open(flags: IOpenFlags): IFasterPipePort {
    return new FasterPipePort(this, flags);
  }

  public get readers(): number {
    return this._readers;
  }
  public set readers(value: number) {
    this._readers = value;
    // assert we are never <0
    if (this._readers < 0) throw new Error('_readers should never go below 0');
    if (!this.readers) {
      // reader depletion
      if (this.wBuffer.length) {
        // we have pending writes, handle first one special:
        // send number of written bytes if > 0, else EPIPE
        const firstChunk = this.wBuffer[0];
        if (firstChunk.initialLength > firstChunk.length) {
          this.wBuffer.shift();
          firstChunk.callback(firstChunk.initialLength - firstChunk.length);
        }
        // reset data structures, reject all other write chunks with EPIPE
        const rejs = this.wBuffer.map(chunk => chunk.callback);
        this.wBuffer.length = 0;
        this.pendingLength = 0;
        for (let i = 0; i < rejs.length; ++i) {
          rejs[i](0, {error: ERRNO.EPIPE});
        }
      }
    }
  }
  public get writers(): number {
    return this._writers;
  }
  public set writers(value: number) {
    this._writers = value;
    // assert we are never <0
    if (this._writers < 0) throw new Error('_writers should never go below 0');
    if (!this.writers) {
      // writer depletion is handled in _resolve
      this._resolve();
    }
  }

  public changeFifoSize(size: number): void {
    const newSize = higherPower2(size);
    const oldSize = this.fifo.data.length;
    if (oldSize === newSize) return;
    const newFifo = new FifoBuffer(newSize);
    if (this.fifo.size === 0) {
      // nothing in fifo, exit early
      this.fifo = newFifo;
      return;
    }
    const tmp = new Uint8Array(Math.min(oldSize, newSize));
    const count = this.fifo.read(tmp.buffer, 0, tmp.length);
    newFifo.write(tmp.buffer, 0, count);
    if (this.fifo.size === 0) {
      // we got all in new fifo, exit
      this.fifo = newFifo;
      return;
    }
    // grab remaining fifo data and unshift it to write chunk buffer
    const tmp2 = new Uint8Array(this.fifo.size);
    const count2 = this.fifo.read(tmp2.buffer, 0, tmp2.length);
    this.wBuffer.unshift(CHUNK_POOL.create(tmp2.buffer, 0, tmp2.length, () => {}));
    this.pendingLength += count2;
    this.fifo = newFifo;
  }

  /**
   * Write `length` bytes in `buf` to the pipe, starting at `offset`.
   * If possible write will be a sync action and return the number of written bytes.
   * If the amount of data to be written is bigger than the available buffer space,
   * write will immediately return 0 and schedule `callback` to be called after
   * the data was flushed.
   * If 0 is returned a writer should wait for `callback` before sending new data.
   * If a positive number is returned a writer must not wait for `callback` (gets never called).
   * The argument `count` of `callback` indicates the number of successfully written bytes,
   * which might be less than given by `length`.
   */
  public write(buf: ArrayBuffer, offset: number, length: number, callback: (count: number, error?: any) => void): number {
    let written = 0;
    if (!this.wBuffer.length) {
      written = this.fifo.write(buf, offset, length);
      if (written === length) {
        if (!this._pendingResolve) {
          this._pendingResolve = true;
          queueMicrotask(this._boundResolve);
        }
        return written;
      }
    }
    this.pendingLength += length - written;

    const chunk = CHUNK_POOL.create(buf, offset, length, callback);
    chunk.offset += written;
    chunk.length -= written;
    this.wBuffer.push(chunk);
    if (!this._pendingResolve && this.rBuffer.length) {
      this._pendingResolve = true;
      queueMicrotask(this._boundResolve);
    }
    return 0;
  }

  /**
   * Read up to `length` bytes into `buf` from the pipe, starting at `offset`.
   * If possible read will be a sync action and immediately return the number of read bytes.
   * If 0 is returned, read is scheduled to be fullfilled later, indicated by `callback`.
   * The argument `count` of `callback` indicates the number of read bytes.
   * If the return value or `count` is <null>, the pipe has no pending data and no writers left.
   * If a positive number is returned, a reader must not wait for `callback` (gets never called).
   */
  public read(buf: ArrayBuffer, offset: number, length: number, callback: (count: number | null, error?: any) => void): number | null {
    if (!this._writers && !this.wBuffer.length && !this.fifo.size && this.rBuffer.length) {
      return null;
    }
    if (!this.rBuffer.length && this.fifo.size) {
      return this.fifo.read(buf, offset, length);
    }

    const chunk = CHUNK_POOL.create(buf, offset, length, callback);
    this.rBuffer.push(chunk);
    if (!this._pendingResolve && this.pendingLength) {
      this._pendingResolve = true;
      queueMicrotask(this._boundResolve);
    }
    return 0;
  }

  /**
   * Low level handling:
   * - clock measuring to invoke event loop
   * - fifo/writer --> reader data copying
   * - resolve/unblock served reader
   * - resolve/unblock consumed writer
   * - fill fifo from pending writes
   * - on writer depletion resolve pending readers with null
   * 
   * TODO: replace Uint8Array ctors with MEMORY_VIEW8.get
   */
  private _resolve(): void {
    while ((this.pendingLength || this.fifo.size) && this.rBuffer.length) {
      if (clockIsOverdue()) {
        setTimeout(this._boundScheduleResolve, 0);
        return;
      }

      const rChunk = this.rBuffer.shift();
      const readsize = Math.min(rChunk.length, this.pendingLength + this.fifo.size);

      let copied = 0;

      if (this.fifo.size) {
        copied += this.fifo.read(rChunk.buf, rChunk.offset, readsize);
        rChunk.offset += copied;
        rChunk.length -= copied;
      }
      const rView = new Uint8Array(rChunk.buf, rChunk.offset - copied, rChunk.length + copied);
      const resolveWrites: (() => void)[] = [];
      while (copied < readsize && this.wBuffer.length) {
        const wChunk = this.wBuffer[0];
        if (wChunk.length <= readsize - copied) {
          const written = wChunk.length;
          const totalLength = wChunk.initialLength;
          const resolver = wChunk.callback;
          rView.set(new Uint8Array(wChunk.buf, wChunk.offset, written), copied);
          copied += written;
          this.pendingLength -= written;
          resolveWrites.push(() => resolver(totalLength));
          this.wBuffer.shift();
          CHUNK_POOL.store(wChunk);
        } else {
          rView.set(new Uint8Array(wChunk.buf, wChunk.offset, readsize - copied), copied);
          wChunk.offset += readsize - copied;
          wChunk.length -= readsize - copied;
          this.pendingLength -= readsize - copied;
          copied += readsize - copied;
          break;
        }
      }
      // resolve reader and writers. We resolve reader before writers
      // to avoid accumulating lots of chunks in the pipe.
      rChunk.callback(copied);
      CHUNK_POOL.store(rChunk);
      for (let i = 0; i < resolveWrites.length; ++i) {
        resolveWrites[i]();
      }
    }

    // move data into fifo buffer, possibly further unblocking writers
    while (this.wBuffer.length && this.fifo.size < this.fifo.data.length) {
      const wChunk = this.wBuffer[0];
      const written = this.fifo.write(wChunk.buf, wChunk.offset, wChunk.length);
      this.pendingLength -= written;
      if (written === wChunk.length) {
        // copied all into fifo, remove chunk and unblock writer
        this.wBuffer.shift();
        wChunk.callback(written);
        CHUNK_POOL.store(wChunk);
      } else {
        // partially copied, adjust chunk
        wChunk.offset += written;
        wChunk.length -= written;
      }
    }

    // writer depletion:
    // writers are depleted if we have no pending data and no writers anymore
    // --> pending readers get resolved with null
    if (!this._writers && !this.wBuffer.length && !this.fifo.size && this.rBuffer.length) {
      const resolvers = this.rBuffer.map(chunk => chunk.callback);
      this.rBuffer.length = 0;
      resolvers.forEach(res => res(null));
    }
    // release pending resolve lock
    this._pendingResolve = false;
  }
}
