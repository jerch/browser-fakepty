import { higherPower2 } from './Helper';
import { clockIsOverdue, clockUpdate } from './Clock';
import { ERRNO } from './errno';
import { AsciiEncoder, AsciiDecoder, Utf8Encoder, Utf8Decoder, BinaryDecoder, BinaryEncoder, IEncoder, IDecoder, IReadWriteCounter } from './Encoding';
import { IDisposable, IPipePort } from './Types';
import { PIPE_BUF, RDWR_MASK, IOpenFlags, PIPE_CTL, POLL_EVENTS, POLL_REVENTS_MASK } from './Constants';
import { FifoBuffer } from './FifoBuffer';


/**
 * Low level byte based pipe implementation.
 * 
 * From "man 7 pipe" (linux):
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

// ANSI C - should be at least 256
const BUFSIZ = 1024;
const enum BufMode {
  /**
   * Full buffering: On output, data is written once the buffer is full (or flushed).
   * On Input, the buffer is filled when an input operation is requested and the buffer is empty.
   */
  _IOFBF,
  /**
   * Line buffering: On output, data is written when a newline character is inserted into the stream
   * or when the buffer is full (or flushed), whatever happens first. On Input, the buffer is filled up
   * to the next newline character when an input operation is requested and the buffer is empty.
   */
  _IOLBF,
  /**
   * No buffering: No buffer is used. Each I/O operation is written as soon as possible.
   * In this case, the buffer and size parameters are ignored.
   */
  _IONBF
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
 * 
 * TODO:
 * - setbuf/setvbuf
 * - correct flushing on exit/close/abort
 * 
 * Until we have separated interfaces on a higher level
 * this class is a mixture of these interfaces:
 * - low level C pipe kernel interface
 *    This will be mapped to fd abstraction later in Task/clib.
 *    Supports read/write/ioctl/poll.
 * - C stream interface analogous to FILE*
 *    This will be mapped to FILE* abstraction later in Task/clib.
 *    Supports bufvset/flush/ more to come...
 * - nodejs like interface --> move to Stream.ts
 *    This is directly implemented here, with typical events and encoding handling.
 *    Supports write/onData/onEnd more to come...
 */
export class PipePort implements IPipePort {
  public isReader = false;  // whether this port can read
  public isWriter = false;  // whether this port can write
  public closed = false;
  public id = -1;

  constructor(public pipe: Pipe, public flags: IOpenFlags) {
    if ((flags & RDWR_MASK) === RDWR_MASK) {
      throw new Error('flags may contain only one of RDONLY | WRONLY | RDWR');
    }
    this.isReader = !!(((flags & RDWR_MASK) !== IOpenFlags.WRONLY) && ++this.pipe.readers);
    this.isWriter = !!(((flags & RDWR_MASK) !== IOpenFlags.RDONLY) && ++this.pipe.writers);
    // init as fully buffered
    if (this.isWriter) {
      this._bufMode = BufMode._IOFBF;
      this._bufW = new Uint8Array(BUFSIZ);
    }
  }

  private _bufW: Uint8Array | null = null;
  private _bufMode: BufMode = BufMode._IONBF;
  private _bufPos = 0;

  public setvbuf(mode: BufMode, buffer: Uint8Array | null = null): Promise<number> {
    //await this.flush();
    //this._bufMode = mode;
    //this._bufW = buffer;
    //return 0;
    return this.flush().then(_ => {
      this._bufMode = mode;
      this._bufW = buffer;
      return 0;
    });
  }

  public flush(): Promise<number> {
    if (this.closed || !this.isWriter) return Promise.reject({error: ERRNO.EBADF});
    if (this._bufW && this._bufPos) {
      return this.pipe.write(this._bufW.buffer, 0, this._bufPos).then(_ => {
        this._bufPos = 0;
        return 0;
      });
    }
    return Promise.resolve(0);
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
  public read(target: Uint8Array): Promise<number> {
    if (this.closed || !this.isReader) return Promise.reject({error: ERRNO.EBADF});
    //if (!this.pipe.writers) return Promise.resolve(null);
    if (this.flags & IOpenFlags.NONBLOCK) {
      return this.pipe.readNonBlock(target.buffer, target.byteOffset, target.length);
    }
    return this.pipe.read(target.buffer, target.byteOffset, target.length);
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
  private _counter: IReadWriteCounter = {read: 0, written: 0};
  public write(data: Uint8Array | string): Promise<number> {
    if (this.closed || !this.isWriter) return Promise.reject({error: ERRNO.EBADF});
    if (!this.pipe.readers) return Promise.reject({error: ERRNO.EPIPE});


    //if (this._bufMode === BufMode._IOFBF) {
    //  if (typeof data === 'string') {
    //    if (this._bufW.length - this._bufPos >= data.length * 3 + 4) {
    //      this._encoder.encodeTo(data, this._bufW, this._bufPos, this._counter);
    //      this._bufPos += this._counter.written;
    //      return Promise.resolve(this._counter.written);
    //    } else {
    //      return this.flush().then(_ => {
    //        if (data.length * 3 + 4 < (this._bufW.length >> 1)) {
    //          this._encoder.encodeTo(data, this._bufW, this._bufPos, this._counter);
    //          this._bufPos += this._counter.written;
    //          return Promise.resolve(this._counter.written);
    //        }
    //        const bytes = this._encoder.encode(data);
    //        return this.pipe.write(bytes.buffer, bytes.byteOffset, bytes.length);
    //      });
    //    }
    //  }
    //}


    const bytes = (typeof data === 'string') ? this._encoder.encode(data) : data;
    if (this._bufMode === BufMode._IOFBF) {
      if (this._bufW.length - this._bufPos >= bytes.length) {
        //this._bufW.set(bytes, this._bufPos);
        //this._bufPos += bytes.length;
        for (let i = 0; i < bytes.length; ++i) this._bufW[this._bufPos++] = bytes[i];
        return Promise.resolve(bytes.length);
      } else {
        return this.flush().then(_ => {
          if (bytes.length < (this._bufW.length >> 1)) {
            //this._bufW.set(bytes, this._bufPos);
            //this._bufPos += bytes.length;
            for (let i = 0; i < bytes.length; ++i) this._bufW[this._bufPos++] = bytes[i];
            return Promise.resolve(bytes.length);
          }
          return this.pipe.write(bytes.buffer, bytes.byteOffset, bytes.length);
        });
      }
    }
    if (this._bufMode === BufMode._IOLBF) {
      // TODO...
      return Promise.reject({error: ERRNO.ENOSYS});
    }

    if (this.flags & IOpenFlags.NONBLOCK) {
      return this.pipe.writeNonBlock(bytes.buffer, bytes.byteOffset, bytes.length);
    }
    return this.pipe.write(bytes.buffer, bytes.byteOffset, bytes.length);
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
    //if (this.isWriter) await this.flush();
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
  public dup(flags: IOpenFlags = this.flags): PipePort {
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
      if ((events & POLL_EVENTS.POLLOUT) && !this.pipe.fifo.size && !this.pipe.wBuffer.length) revents |= POLL_EVENTS.POLLOUT;
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
        this._encoder = {
          encode: (_: string) => { throw new Error('no string encoding set'); },
          encodeTo: () => { throw new Error('no string encoding set'); }
        };
        this._decoder = null;
        this._encoding = null;
        break;
      default:
        throw new Error(`unsupported encoding "${value}"`);
    }
  }

  private _readHandlers: ((data: Uint8Array | string) => void)[] = [];
  private _rChunk: DeferredChunk | null = null;
  public flowMode: boolean = false;
  public isFlowing: boolean = false;
  public isPaused: boolean = false;

  public pause(): void {
    if (this.closed) throw new Error('pipe port is already closed');
    this.flowMode = false;
    this.isPaused = true;
    if (this._rChunk) {
      const res = this._rChunk.resolve;
      this.pipe.removeReadChunk(this._rChunk);
      this._rChunk = null;
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
      let count: number | null;
      let finalChunk: Uint8Array | string;
      this.isFlowing = true;

      // prealloc target? --> doubles throughput for very small chunks, but chunk will be borrowed :(
      const target = new Uint8Array(BUFSIZ);

      while (true) {
        if (!this.flowMode) break;

        // read in next chunk
        // this promise is interrupable by calling this.rResolver (needed for pause)
        //const target = new Uint8Array(PIPE_BUF);
        const readPromise = this.read(target);
        this._rChunk = this.pipe.lastReadChunk;
        count = await readPromise;

        // null - no more writers open
        // FIXME: dont call onEnd for pause calls
        // FIXME: null needs special treatment in a TTY with VTIME set
        if (count === null) {
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
        finalChunk = target.subarray(0, count);

        if (this._decoder) finalChunk = this._decoder.decode(finalChunk, {stream: true});
        if (finalChunk) {
          const handlers = this._readHandlers.slice();
          for (let i = 0; i < handlers.length; ++i) {
            handlers[i](finalChunk);
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
 * Data structure to hold needed information per chunk processing.
 * Used for read/write chunk accounting in _resolve for
 * pointer like offset calculation and promise handling.
 */
class DeferredChunk {
  public initialLength = 0;
  constructor(
    public buf: ArrayBuffer,
    public offset: number,
    public length: number,
    public resolve: (count: number) => void,
    public reject: (error: any) => void)
  {
    this.initialLength = length;
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
 * 
 * possible enhancements:
 * - split big writes into >= PIPE_BUF chunks and cycles through them
 * - priority queue?
 */
export class Pipe {
  public _readers = 0;
  public _writers = 0;
  public fifo = new FifoBuffer(PIPE_BUF);
  public wBuffer: DeferredChunk[] = [];   // pending write chunks
  public rBuffer: DeferredChunk[] = [];   // pending read chunks
  public pendingLength = 0;               // length of pending write chunks
  public lastReadChunk: DeferredChunk | null = null;
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
      if (this.wBuffer.length) {
        // we have pending writes, handle first one special
        const firstChunk = this.wBuffer[0];
        if (firstChunk.initialLength > firstChunk.length) {
          this.wBuffer.shift();
          firstChunk.resolve(firstChunk.initialLength - firstChunk.length);
        }
        // reset data structures, reject all other write chunks with EPIPE
        const rejs = this.wBuffer.map(chunk => chunk.reject);
        this.wBuffer.length = 0;
        this.pendingLength = 0;
        for (let i = 0; i < rejs.length; ++i) {
          rejs[i]({error: ERRNO.EPIPE});
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

  public get hasPendingRead(): boolean {
    return !!this.rBuffer.length;
  }

  public get hasPendingWrite(): boolean {
    return !!this.wBuffer.length;
  }

  public open(flags: IOpenFlags): PipePort {
    return new PipePort(this, flags);
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
    this.wBuffer.unshift(new DeferredChunk(tmp2.buffer, 0, tmp2.length, () => {}, () => {}));
    this.pendingLength += count2;
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
  public writeNonBlock(buf: ArrayBuffer, offset: number, length: number): Promise<number> {
    if (this.wBuffer.length || !this.fifo.space || (length <= PIPE_BUF && this.fifo.space < length)) {
      return Promise.reject({error: ERRNO.EAGAIN});
    }
    const written = this.fifo.write(buf, offset, length);
    this._resolve(true);
    return Promise.resolve(written);
  }

  /**
   * Write bytes in `data` to the pipe.
   * Writing up to PIPE_BUF bytes will not block (immediately resolved),
   * beyond `write` will block until all bytes were consumed by reads.
   * Note: The data of a blocking write gets not copied before it
   * gets consumed by `read`, thus should not be altered locally in between.
   * After unblocking the memory can be re-used.
   * Return number of written bytes.
   */
  public write(buf: ArrayBuffer, offset: number, length: number): Promise<number> {
    let written = 0;
    if (!this.wBuffer.length) {
      written = this.fifo.write(buf, offset, length);
      if (written === length) {
        this._resolve(true);
        return Promise.resolve(written);
      }
    }
    this.pendingLength += length - written;
    return new Promise((resolve, reject) => {
      const chunk = new DeferredChunk(buf, offset, length, resolve, reject);
      chunk.offset += written;
      chunk.length -= written;
      this.wBuffer.push(chunk);
      this._resolve();
    });
  }

  /**
   * Nonblocking read attempt.
   * Fails if:
   * - there are other waiting readers
   * - no data in fifo
   * 
   * Otherwise return number of read bytes.
   */
  public readNonBlock(buf: ArrayBuffer, offset: number, length: number): Promise<number> {
    if (this.hasPendingRead || !this.fifo.size) {
      return Promise.reject({error: ERRNO.EAGAIN});
    }
    const count = this.fifo.read(buf, offset, length);
    this._resolve(true);
    this.lastReadChunk = null;
    return Promise.resolve(count);
  }

  /**
   * Read up to length bytes from the pipe.
   * Blocks if no data is available, otherwise returns
   * as much as possible removing the data from the pipe.
   * Return number of read bytes.
   */
  public read(buf: ArrayBuffer, offset: number, length: number): Promise<number> {
    return new Promise((resolve, reject) => {
      this.rBuffer.push(new DeferredChunk(buf, offset, length, resolve, reject));
      this._resolve();
    });
  }

  /**
   * Unschedule a read chunk from the read chunk buffer.
   * Note: This is a hack to make the onData loop in PipePort interruptable.
   * FIXME: better way to do this?
   */
  public removeReadChunk(chunk: DeferredChunk): void {
    const pos = this.rBuffer.indexOf(chunk);
    if (~pos) {
      this.rBuffer.splice(pos, 1);
    }
    if (this.lastReadChunk === chunk) {
      this.lastReadChunk = null;
    }
  }

  /**
   * Low level handling:
   * - clock measuring to invoke event loop
   * - fifo/writer --> reader copy
   * - resolve/unblock served reader
   * - resolve/unblock consumed writer
   * - fill fifo from waiting writes
   * - on writer depletion resolve pending readers with null
   */
  private _resolve(schedule: boolean = false): void {
    if (this._pendingResolve) return;
    while ((this.pendingLength || this.fifo.size) && this.rBuffer.length) {
      if (schedule || clockIsOverdue()) {
        setTimeout(() => {
          clockUpdate();
          this._pendingResolve = false;
          this._resolve();
        }, 0);
        this._pendingResolve = true;
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
          const resolver = wChunk.resolve;
          rView.set(new Uint8Array(wChunk.buf, wChunk.offset, written), copied);
          copied += written;
          this.pendingLength -= written;
          resolveWrites.push(() => resolver(totalLength));
          this.wBuffer.shift();
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
      rChunk.resolve(copied);
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
        wChunk.resolve(written);
      } else {
        // partially copied, adjust chunk
        wChunk.offset += written;
        wChunk.length -= written;
      }
    }

    /**
     * FIXME: should we move resolving of all writers down here?
     * Difference: Currently the pipe operates in "tandem" mode, thus for any resolved
     * reader all resolved writers will unblock and continue before the next reader is served.
     * Resolving all writers late after all readers would more likely drain the pipe.
     * Main advantage would be less memory held by the pipe itself.
     * On the other hand multiple readers are not common (not very useful), thus we would not gain
     * anything here, as the late resolving would lead to the current handling anyway for just one reader.
     */

    // writer depletion:
    // writers are depleted if we have no pending data and no writers anymore
    // --> pending readers get resolved with null
    if (!this._writers && !this.wBuffer.length && !this.fifo.size && this.rBuffer.length) {
      const resolvers = this.rBuffer.map(chunk => chunk.resolve);
      this.rBuffer.length = 0;
      resolvers.forEach(res => res(null));
    }
  }
}
