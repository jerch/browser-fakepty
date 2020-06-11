/**
 * Low level byte based pipe implementation.
 */
import { higherPower2 } from './Helper';
import { clockIsOverdue, clockUpdate } from './Clock';
import { IOpenFlags, RDWR_MASK } from './ObjectPipe';
import { ERRNO } from './errno';
import { AsciiEncoder, AsciiDecoder, Utf8Encoder, Utf8Decoder, BinaryDecoder, BinaryEncoder, IEncoder, IDecoder } from './Encoding';
import { IDisposable } from './Types';

// some constants
// TODO: move to constants file

/**
 * PIPE_BUF - POSIX: Maximum number of bytes that is guaranteed to be atomic when writing to a pipe.
 *                   Minimum Acceptable Value: {_POSIX_PIPE_BUF} (=512 bytes)
 * 
 * Currently we simply line up all write calls and do not split big writes into smaller chunks.
 * Thus all writes are atomic and a big write would block all others. This might change in future versions.
 * We also use PIPE_BUF as default size of the internal fifo buffer of a pipe. That size gets reported
 * with F_GETPIPE_SZ and can be altered with F_SETPIPE_SZ.
 */
const PIPE_BUF = 512;

export const enum PIPE_CTL {
  /**
   * Pending bytes in internal pipe buffer. Can be read immediately.
   */
  FIONREAD,
  /**
   * Bytes of pending (blocked) writes. A read attempt might block.
   */
  FIONWRITE,
  /**
   * Get the size of the internal pipe buffer.
   */
  F_GETPIPE_SZ,
  /**
   * Set the size of the internal pipe buffer.
   */
  F_SETPIPE_SZ
}

// move to constants
const enum POLL_EVENTS {
  POLLIN = 1,     // There is data to read.
  POLLPRI = 2,    // exceptional condition on fd, tty: state change of pty slave, see ioctl_tty(2)
  POLLOUT = 4,    // Writing is now possible, larger chunk that the available space will block (unless O_NONBLOCK)
  POLLRDHUP = 8,  // socket: reader closed (not used for pipes?)
  POLLERR = 16,   // (ignored in events) some error condition, also set on writer if read end has been closed
  POLLHUP = 32,   // (ignored in events) writer hang up, there might be pending read data
  POLLNVAL = 64   // (ignored in events) invalid request: fd not open
}
const POLL_REVENTS_MASK = POLL_EVENTS.POLLERR | POLL_EVENTS.POLLHUP | POLL_EVENTS.POLLNVAL;

/**
 * From "man 7 pipe" (linux)
 * 
 * - attempts to read from an empty pipe  --> block reader
 * - attempts to write to a full pipe     --> block writer
 * - O_NONBLOCK for non blocking (fcntl F_SETFL, or pipe2)
 * - pipe is a byte stream: there is no concept of message boundaries
 * - all write fds have been closed       --> EOF on reader (read(2) will return 0)
 * - all read fds have been closed        --> SIGPIPE on writer (write causes the signal)
 *                                            ignored signal: write failes with EPIPE
 * - no lseek on a pipe
 * - query/set pipe capacity with fcntl F_GETPIPE_SZ and F_SETPIPE_SZ
 * - ioctl FIONREAD - count of the number of unread bytes - difference to FIONWRITE (see BSD manpage)?
 * - limits
 *    /proc/sys/fs/pipe-max-size          maximum size (in bytes) of a pipe, default 1048576 (1 MiB)
 *    /proc/sys/fs/pipe-user-pages-hard   hard limit of all pipes of one user (allocation beyond is denied, default is off)
 *    /proc/sys/fs/pipe-user-pages-soft   soft limit of all pipes of one user
 * 
 * - PIPE_BUF behavior
 *    POSIX:  writes < PIPE_BUF must be atomic
 *            greater may be interleaved with other writes
 *            PIPEBUF must be at least 512 bytes in size
 *    O_NONBLOCK disabled, n <= PIPE_BUF
 *      All n bytes are written atomically; write(2) may block if
 *      there is not room for n bytes to be written immediately
 *    O_NONBLOCK enabled, n <= PIPE_BUF
 *      If there is room to write n bytes to the pipe, then write(2)
 *      succeeds immediately, writing all n bytes; otherwise write(2)
 *      fails, with errno set to EAGAIN.
 *    O_NONBLOCK disabled, n > PIPE_BUF
 *      The write is nonatomic: the data given to write(2) may be
 *      interleaved with write(2)s by other process; the write(2)
 *      blocks until n bytes have been written.
 *    O_NONBLOCK enabled, n > PIPE_BUF
 *      If the pipe is full, then write(2) fails, with errno set to
 *      EAGAIN.  Otherwise, from 1 to n bytes may be written (i.e., a
 *      "partial write" may occur; the caller should check the return
 *      value from write(2) to see how many bytes were actually
 *      written), and these bytes may be interleaved with writes by
 *      other processes.
 * - Open file status flags: O_NONBLOCK, O_ASYNC
 */


/**
 * Binary fifo buffer, used as immediately available pipe buffer.
 * The size should be a power of 2 (gets automatically rounded up).
 * 
 * Note: `write` and `read` do no bound checks for provided offsets.
 */
export class FifoBuffer {
  public data: Uint8Array;
  public data32: Uint32Array;
  public mask: number;
  public mask32: number;
  public rCur: number = 0;
  public wCur: number = 0;
  public size: number = 0;

  constructor(size: number) {
    const space = higherPower2(size);
    this.data = new Uint8Array(space);
    this.data32 = new Uint32Array(this.data.buffer);
    this.mask = space - 1;
    this.mask32 = this.mask >> 2;
  }

  public get space(): number {
    return this.data.length - this .size;
  }

  private _write8(data8: Uint8Array): number {
    for (let i = 0; i < data8.length; ++i) {
      this.data[this.wCur++] = data8[i];
      this.wCur &= this.mask;
    }
    this.size += data8.length;
    return data8.length;
  }
  private _write32(data32: Uint32Array): number {
    let wCur = this.wCur >> 2;
    for (let i = 0; i < data32.length; ++i) {
      this.data32[wCur++] = data32[i];
      wCur &= this.mask32;
    }
    this.size += data32.length << 2;
    this.wCur = wCur << 2;
    return data32.length << 2;
  }
  public write(buf: ArrayBuffer, offset: number, length: number): number {
    const count = Math.min(length, this.data.length - this.size);
    if (!count) return 0;
    if ((count & 3) || (this.wCur & 3) || (offset & 3)) {
      return this._write8(new Uint8Array(buf, offset, count));
    }
    return this._write32(new Uint32Array(buf, offset, count >> 2));
  }

  private _read8(data8: Uint8Array): number {
    for (let i = 0; i < data8.length; ++i) {
      data8[i] = this.data[this.rCur++];
      this.rCur &= this.mask;
    }
    this.size -= data8.length;
    return data8.length;
  }
  private _read32(data32: Uint32Array): number {
    let rCur = this.rCur >> 2;
    for (let i = 0; i < data32.length; ++i) {
      data32[i] = this.data32[rCur++];
      rCur &= this.mask32;
    }
    this.size -= data32.length << 2;
    this.rCur = rCur << 2;
    return data32.length << 2;
  }
  public read(buf: ArrayBuffer, offset: number, length: number): number {
    const count = Math.min(length, this.size);
    if (!count) return 0;
    if ((count & 3) || (this.rCur & 3) || (offset & 3)) {
      return this._read8(new Uint8Array(buf, offset, count));
    }
    return this._read32(new Uint32Array(buf, offset, count >> 2));
  }

  public writeByte(value: number): boolean {
    if (this.size < this.data.length) {
      this.data[this.wCur++] = value;
      this.wCur &= this.mask;
      this.size++;
      return true;
    }
    return false;
  }
  public readByte(): number {
    if (this.size) {
      const value = this.data[this.rCur++];
      this.rCur &= this.mask;
      this.size--;
      return value;
    }
    return -1;
  }
}


export interface IPipePort {
  isReader: boolean;
  isWriter: boolean;
  closed: boolean;
  flags: IOpenFlags;

  // C like interface
  read(length: number): Promise<Uint8Array | null>;
  write(data: Uint8Array | string): Promise<number>;
  close(): void;

  // nodejs interface
  encoding: 'ascii' | 'utf8' | 'binary' | null;
  flowMode: boolean;
  isFlowing: boolean;
  isPaused: boolean;
  pause(): void;
  resume(): void;
  onData(handler: (data: Uint8Array | string) => void): IDisposable;
  onEnd(handler: () => void): IDisposable;
  onClose(handler: () => void): IDisposable;

  // kernel interface
  dup(flags?: IOpenFlags): IPipePort;
  ctl(type: PIPE_CTL, ...args: any[]): any;
  poll(events: POLL_EVENTS): POLL_EVENTS;
}


/**
 * Binary pipe, "userland" part.
 * 
 * Events needed:
 *  *close     pipe got closed
 *  *data      read data event
 *  *end       all data consumed
 *  error     on any error
 *  pause     when .pause() got called
 *  readable  whether data can be read
 *  resume    when .resume() got called
 *  drain     when writing can be continued
 *  finish    when .end() was called and writing data is flushed
 *  pipe/unpipe   ???
 */
export class BytePipePort implements IPipePort {
  public isReader = false;  // whether this port can read
  public isWriter = false;  // whether this port can write
  public closed = false;

  constructor(public pipe: BytePipe, public flags: IOpenFlags) {
    if ((flags & RDWR_MASK) === RDWR_MASK) {
      throw new Error('flags may contain only one of RDONLY | WRONLY | RDWR');
    }
    this.isReader = !!(((flags & RDWR_MASK) !== IOpenFlags.WRONLY) && ++this.pipe.readers);
    this.isWriter = !!(((flags & RDWR_MASK) !== IOpenFlags.RDONLY) && ++this.pipe.writers);
  }

  /**
   * Read up to `length` bytes from the pipe.
   * 
   * Returns a promise containing an Uint8Array of read bytes. A return value of `null`
   * indicates, that the pipe has been closed on writer side and nomore data is available.
   * 
   * The promise gets rejected:
   * - with EBADF if the pipe port is not opened for reading
   * - with EAGAIN if the pipe port is set to NONBLOCK and there is no data available
   */
  public read(length: number): Promise<Uint8Array | null> {
    if (this.closed || !this.isReader) return Promise.reject({error: ERRNO.EBADF});
    //if (!this.pipe.writers) return Promise.resolve(null);
    if (this.flags & IOpenFlags.NONBLOCK) {
      return this.pipe.readNonBlock(length);
    }
    return this.pipe.read(length);
  }

  /**
   * Write `data` to the pipe. `data` can either be a string or raw bytes as Uint8Array.
   * Raw bytes will be sent unchanged, string gets encoded with `encoding` beforehand.
   * If no encoding is set (encoding = null) writing string data will fail.
   * 
   * Returns a promise indicating the number of written bytes, which might be less than
   * the original data, if the reading side was closed early reading partial data only.
   *  --> FIXME: how to deal with return number if a string was provided?
   * The promise gets rejected:
   * - with EBADF if the pipe port is not opened for writing
   * - with EPIPE if reading side gets closed and no data was written yet
   * - with EAGAIN if the pipe port is set to NONBLOCK and there is no space available
   */
  public write(data: Uint8Array | string): Promise<number> {
    if (this.closed || !this.isWriter) return Promise.reject({error: ERRNO.EBADF});
    if (!this.pipe.readers) return Promise.reject({error: ERRNO.EPIPE});
    if (typeof data === 'string') {
      data = this._encoder.encode(data);
    }
    if (this.flags & IOpenFlags.NONBLOCK) {
      return this.pipe.writeNonBlock(data);
    }
    return this.pipe.write(data);
  }

  /**
   * Close the pipe port.
   * 
   * Deregisters from the underlying resource, which is important to correctly
   * propagate state changes to other open ends of the pipe.
   * 
   * FIXME: clear all handlers on close.
   */
  public close(): void {
    if (this.closed) return;
    this.pause();
    if (this.isReader) --this.pipe.readers;
    if (this.isWriter) --this.pipe.writers;
    this.closed = true;
    this.pipe = null;
    // call onClose handlers
    const handlers = this._closeHandlers.slice();
    for (let i = 0; i < handlers.length; ++i) {
      handlers[i]();
    }
  }

  /**
   * dup/dup2/dup3 kernel endpoint
   * TODO:
   * - always set CLOEXEC off unless specified in flags (see manpage dup3)
   * - proper switch RDONLY | WRONLY | RDWR
   */
  public dup(flags: IOpenFlags = this.flags): BytePipePort {
    return this.pipe.open(flags);
  }

  /**
   * ioctl/fnctl kernel endpoint
   */
  public ctl(type: PIPE_CTL, ...args: any[]): any {
    // TODO: extend by all applicable fcntl/ioctl calls
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

  /**
   * poll kernel endpoint
   */
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
      if ((events & POLL_EVENTS.POLLOUT) && !this.pipe.fifo.size && !this.pipe.buffer.length) revents |= POLL_EVENTS.POLLOUT;
      if ((events & POLL_EVENTS.POLLERR) && !this.pipe.readers) revents |= POLL_EVENTS.POLLERR;
    }

    // skip POLL_EVENTS.POLLPRI here (prolly needed in tty for tty_ioctl propagation)
    // skip POLL_EVENTS.POLLRDHUP

    return revents;
  }

  /**
   *  nodejs like stream interface
   */
  //public readable = false;  // whether it is safe to read - TODO
  //public writable = false;  // whether it is safe to write - TODO

  private _encoder: IEncoder | null = new Utf8Encoder();
  private _decoder: IDecoder | null = new Utf8Decoder();
  private _encoding: 'ascii' | 'utf8' | 'binary' | null = 'utf8';
  public get encoding(): 'ascii' | 'utf8' | 'binary' | null {
    return this._encoding;
  }
  public set encoding(value: 'ascii' | 'utf8' | 'binary' | null) {
    switch (value) {
      case 'ascii':
        this._encoder = new AsciiEncoder();
        this._decoder = new AsciiDecoder();
        this._encoding = 'ascii';
        break;
      case 'utf8':
        this._encoder = new Utf8Encoder();
        this._decoder = new Utf8Decoder();
        this._encoding = 'utf8';
        break;
      case 'binary':
        this._encoder = new BinaryEncoder();
        this._decoder = new BinaryDecoder();
        this._encoding = 'binary';
        break;
      case null:
        this._encoder = { encode: (_: string) => { throw new Error('no string encoding set'); } };
        this._decoder = null;
        this._encoding = null;
        break;
      default:
        throw new Error(`unsupported encoding "${value}"`);
    }
  }

  private _readHandlers: ((data: Uint8Array | string) => void)[] = [];
  private _rResolver: (data: Uint8Array | null) => void | null = null;
  public flowMode: boolean = false;
  public isFlowing: boolean = false;
  public isPaused: boolean = false;

  public pause(): void {
    if (this.closed) throw new Error('pipe port is already closed');
    this.flowMode = false;
    this.isPaused = true;
    if (this._rResolver) {
      const res = this._rResolver;
      this._rResolver = null;
      this.pipe.removeReadResolver(res);
      res(null);
    }
  }

  public resume(): void {
    if (this.closed) throw new Error('pipe port is already closed');
    this.isPaused = false;
    if (this.flowMode) {
      return;
    }

    this.flowMode = true;
    (async () => {
      let data: Uint8Array | string;
      this.isFlowing = true;

      while (true) {
        if (!this.flowMode) break;

        // read in next chunk
        // this promise is interrupable by calling this.rResolver (needed for pause)
        const readPromise = this.read(PIPE_BUF);
        this._rResolver = this.pipe.lastReadResolver;
        data = await readPromise;

        // null - no more writers open
        // FIXME: dont call onEnd for pause calls
        // FIXME: null needs special treatment in a TTY with VTIME set
        if (data === null) {
          // since the pipe has "ended" we pause() here, this ensures, that the stream
          // will stop even if a new writer has appeared - only resume() can restart the pipe stream
          this.pause();
          // call onEnd handlers
          const handlers = this._endHandlers.slice();
          for (let i = 0; i < handlers.length; ++i) {
            handlers[i]();
          }
          break;
        }

        if (this._decoder) data = this._decoder.decode(data, {stream: true});
        if (data) {
          const handlers = this._readHandlers.slice();
          for (let i = 0; i < handlers.length; ++i) {
            handlers[i](data);
          }
        }
      }
      this.isFlowing = false;
    })();
  }

  /**
   * data read event.
   * 
   * Note: Never mix `read` and `onData` on a pipe port. `onData` maintains
   * its own read logic, which would compete with raw read calls.
   */
  public onData(handler: (data: Uint8Array | string) => void): IDisposable {
    if (this.closed) throw new Error('pipe port is already closed');
    const handlers = this._readHandlers;
    handlers.push(handler);
    if (!this.flowMode && !this.isPaused) this.resume();
    return {
      dispose: () => {
        const idx = handlers.indexOf(handler);
        if (~idx) handlers.splice(idx, 1);
      }
    }
  }

  private _endHandlers: (() => void)[] = [];

  /**
   * pipe end event. Triggered when a reading port has no more data.
   */
  public onEnd(handler: () => void): IDisposable {
    if (this.closed) throw new Error('pipe port is already closed');
    const handlers = this._endHandlers;
    handlers.push(handler);
    if (!this.flowMode && !this.isPaused) this.resume();
    return {
      dispose: () => {
        const idx = handlers.indexOf(handler);
        if (~idx) handlers.splice(idx, 1);
      }
    }
  }

  private _closeHandlers: (() => void)[] = [];

  /**
   * pipe close event. Triggered when a pipe got closed.
   * Note that a pipe gets not automatically closed:
   * - reader:  a reader will receive `null` if there is no more data to be read
   *            and no writer open, in flow mode this is equivalent to the `onEnd` event
   * - writer:  a writer will be rejected with EPIPE if there is no reader anymore
   * 
   * These circumstances indicate an exhausted pipe, which can be closed.
   * FIXME: close pipes automatically in process abstraction
   */
  public onClose(handler: () => void): IDisposable {
    if (this.closed) throw new Error('pipe port is already closed');
    const handlers = this._closeHandlers;
    handlers.push(handler);
    if (!this.flowMode && !this.isPaused) this.resume();
    return {
      dispose: () => {
        const idx = handlers.indexOf(handler);
        if (~idx) handlers.splice(idx, 1);
      }
    }
  }
}


/**
 * Binary pipe, "kernel" part.
 * The pipe has an immediately available fifo buffer, which helps to reduce
 * context switches between readers and writers if the amount
 * of data stays far below the fifo buffer size. This gives a speed
 * advantage of >30%, although bytes going through the fifo buffer
 * have to be copied twice (writer --> fifo --> reader).
 * Writes beyond the fifo buffer size are blocking, the data is copied once
 * (writer --> reader).
 */
export class BytePipe {
  public _readers = 0;
  public _writers = 0;
  public fifo = new FifoBuffer(PIPE_BUF);
  public buffer: Uint8Array[] = [];
  public pendingLength = 0;
  public lastReadResolver: ((data: Uint8Array | null) => void) | null = null;
  private _writeResolver: ((count: number) => void)[] = [];
  private _writeRejector: ((error: any) => void)[] = [];
  private _writeLength: number[] = [];
  private _readResolver: ((data: Uint8Array | null) => void)[] = [];
  private _readTarget: (Uint8Array | null)[] = [];
  private _readLength: number[] = [];
  private _pendingResolve = false;

  public get readers(): number {
    return this._readers;
  }
  public set readers(value: number) {
    this._readers = value;
    // assert we are never <0
    if (this._readers < 0) throw new Error('_readers should never go below 0');
    if (!this.readers) {
      // reader depletion
      if (this.buffer.length) {
        // we have pending writes
        // handle first one special:
        const wRes = this._writeResolver.shift();
        const wLength = this._writeLength.shift();
        const chunk = this.buffer.shift();
        // writeLength still contains original length, use it to compare to chunk length
        // --> resolve with written length if data already got read (might wait in fifo through)
        if (chunk.length !== wLength) {
          wRes(wLength - chunk.length);
          this._writeRejector.shift();
        }
        // reset data structures, reject all other writer with EPIPE
        this.pendingLength = 0;
        this.buffer.length = 0;
        this._writeLength.length = 0;
        this._writeResolver.length = 0;
        const rejs = this._writeRejector.slice();
        this._writeRejector.length = 0;
        rejs.forEach(rej => rej({error: ERRNO.EPIPE}));
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

  public get hasPendingRead(): boolean {
    return !!this._readResolver.length;
  }

  public get hasPendingWrite(): boolean {
    return !!this._writeResolver.length;
  }

  public open(flags: IOpenFlags): BytePipePort {
    return new BytePipePort(this, flags);
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
    // grab remaining fifo data and unshift it to pending buffers
    const tmp2 = new Uint8Array(this.fifo.size);
    const count2 = this.fifo.read(tmp2.buffer, 0, tmp2.length);
    this.buffer.unshift(tmp2);
    this.pendingLength += count2;
    this._writeResolver.unshift(() => {});
    this._writeRejector.unshift(() => {});
    this._writeLength.unshift(tmp2.length);
    this.fifo = newFifo;
  }

  /**
   * Nonblocking write attempt.
   * Fails if:
   * - we have pending writes
   * - no space at all in fifo
   * - data < PIPE_BUF && space < data
   * 
   * Otherwise returns number of written bytes.
   */
  public writeNonBlock(data: Uint8Array): Promise<number> {
    if (this.buffer.length || !this.fifo.space || (data.length <= PIPE_BUF && this.fifo.space < data.length)) {
      return Promise.reject({error: ERRNO.EAGAIN});
    }
    const written = this.fifo.write(data.buffer, data.byteOffset, data.length);
    this._resolve(true);
    return Promise.resolve(written);
  }

  /**
   * Write bytes in `data` to the pipe.
   * Writing up to PIPE_BUF bytes will not block (immediately resolved),
   * beyond `write` will block until all bytes were consumed by reads.
   * Note: The data of a blocking write gets not copied before it
   * gets consumed by `read`, thus should be altered locally in between.
   * After unblocking the memory can be re-used.
   * Return number of written bytes.
   */
  public write(data: Uint8Array): Promise<number> {
    let written = 0;
    if (!this.buffer.length) {
      written = this.fifo.write(data.buffer, data.byteOffset, data.length);
      // all fits into fifo buffer, so we can unblock right away
      // Note: This gives a tiny perf benefit of ~30% due to less
      // writer <--> reader context switches needed,
      // although the fifo data gets copied twice
      if (written === data.length) {
        this._resolve(true);
        return Promise.resolve(written);
      }
    }
    // we cannot copy in one pass, thus stack up the data
    // Note: Its important to respect the blocking promise
    // since we dont copy the data yet...
    this.buffer.push(written ? data.subarray(written) : data);
    this.pendingLength += data.length - written;
    return new Promise((resolve, reject) => {
      this._writeResolver.push(resolve);
      this._writeRejector.push(reject);
      this._writeLength.push(data.length);
      this._resolve();
    });
  }

  /**
   * Nonblocking read attempt.
   * Fails if:
   * - there are other waiting readers
   * - no data in fifo
   * 
   * Otherwise return Uint8Array with available data.
   */
  public readNonBlock(length: number): Promise<Uint8Array> {
    if (this.hasPendingRead || !this.fifo.size) {
      return Promise.reject({error: ERRNO.EAGAIN});
    }
    const target = new Uint8Array(Math.min(length, this.fifo.size));
    this.fifo.read(target.buffer, 0, target.length);
    this._resolve(true);
    this.lastReadResolver = null;
    return Promise.resolve(target);
  }

  /**
   * Read up to length bytes from the pipe.
   * Blocks if no data is available, otherwise returns
   * as much as possible removing the data from the pipe.
   * Allocates new memory for the result, for a faster variant see `readTo`.
   */
  public read(length: number): Promise<Uint8Array> {
    return new Promise(resolve => {
      this.lastReadResolver = resolve;
      this._readResolver.push(resolve);
      this._readTarget.push(null);
      this._readLength.push(length);
      this._resolve();
    });
  }

  /**
   * Same as `read` providing target memory.
   * Up to 50% faster for consecutive reads reutilizing the memory.
   * If the available data is less than target can hold,
   * the returned byte array will be shorter using
   * the same underlying memory from byte offset 0.
   */
  public readTo(target: Uint8Array): Promise<Uint8Array> {
    return new Promise(resolve => {
      this.lastReadResolver = resolve;
      this._readResolver.push(resolve);
      this._readTarget.push(target);
      this._readLength.push(target.length);
      this._resolve();
    });
  }

  public removeReadResolver(res: (data: Uint8Array) => void): void {
    const pos = this._readResolver.indexOf(res);
    if (~pos) {
      this._readResolver.splice(pos, 1);
      this._readLength.splice(pos, 1);
      this._readTarget.splice(pos, 1);
    }
    if (this.lastReadResolver === res) {
      this.lastReadResolver = null;
    }
  }

  /**
   * Low level handling:
   * - clock measuring to invoke event loop
   * - fifo/writer --> reader copy
   * - resolve/unblock served reader
   * - resolve/unblock consumed writer
   * - fill fifo from waiting writes
   * 
   * FIXME: writer depletion - resolve all pending readers with null
   * 
   * FIXME: Should we split big writes into smaller chunks (>=PIPE_BUF) and cycles through them?
   */
  private _resolve(schedule: boolean = false): void {
    if (this._pendingResolve) return;
    while ((this.pendingLength || this.fifo.size) && this._readResolver.length) {
      if (schedule || clockIsOverdue()) {
        setTimeout(() => {
          clockUpdate();
          this._pendingResolve = false;
          this._resolve();
        }, 0);
        this._pendingResolve = true;
        return;
      }

      // do the writer --> reader copy
      // read() does not give us any target buffer, so we create it here
      // readTo() provides a target, which speeds up things by roughly 50%
      const readLength = this._readLength.shift();
      const avail = this.pendingLength + this.fifo.size;
      const readsize = Math.min(readLength, avail);
      let target = this._readTarget.shift() || new Uint8Array(readsize);
      if (target.length > readsize) {
        target = target.subarray(0, readsize);
      }
      let writersResolved = 0;
      let copied = 0;
      if (this.fifo.size) {
        copied += this.fifo.read(target.buffer, target.byteOffset, target.length);
      }
      while (copied < readsize) {
        const chunk = this.buffer.shift();
        if (chunk.length <= readsize - copied) {
          target.set(chunk, copied);
          copied += chunk.length;
          this.pendingLength -= chunk.length;
          writersResolved++;
        } else {
          target.set(chunk.subarray(0, readsize - copied), copied);
          this.buffer.unshift(chunk.subarray(readsize - copied));
          this.pendingLength -= readsize - copied;
          //copied += readsize - copied;
          break;
        }
      }
      // resolve readers (unblocks reader code)
      this._readResolver.shift()(target);
      // FIXME: evtually move the overdue check between readers and writers here,
      // writers wont stack up memory during event loop runs
      // --> Should we unblock writers all at once at the end?
      // resolve all handled writers (unblocks writer code)
      const writerLengths = this._writeLength.splice(0, writersResolved);
      this._writeResolver.splice(0, writersResolved).forEach((resolve, idx) => resolve(writerLengths[idx]));
      this._writeRejector.splice(0, writersResolved);
    }

    // move data into fifo buffer, possibly further unblocking writers
    while (this.buffer.length && this.fifo.size < this.fifo.data.length) {
      const chunk = this.buffer.shift();
      const written = this.fifo.write(chunk.buffer, chunk.byteOffset, chunk.length);
      this.pendingLength -= written;
      if (written === chunk.length) {
        // copied all into fifo, unblock writer
        const writeResolver = this._writeResolver.shift();
        this._writeRejector.shift();
        const writeLength = this._writeLength.shift();
        writeResolver(writeLength);
      } else {
        // partially copied, move the rest back into buffer
        this.buffer.unshift(chunk.subarray(written));
      }
    }

    // writer depletion:
    // writers are depleted if we have no pending data and no writers anymore
    // --> pending readers get resolved with null
    if (!this._writers && !this.buffer.length && !this.fifo.size && this._readResolver.length) {
      const res = this._readResolver.slice();
      this._readResolver.length = 0;
      this._readTarget.length = 0;
      this._readLength.length = 0;
      res.forEach(res => res(null));
    }
  }
}
