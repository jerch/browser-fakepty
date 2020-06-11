import { IFasterPipePort, IDeferredChunk } from './Types';
import { IOpenFlags, RDWR_MASK, PIPE_CTL, POLL_EVENTS, POLL_REVENTS_MASK, PIPE_BUF } from './Constants';
import { ERRNO } from './errno';
import { FifoBuffer } from './FifoBuffer';
import { ITermios, TERMIOS_COOKED, IFlags } from './Termios';
import { LFlags, OFlags } from '../Termios';
import { MEMORY_VIEW8, CHUNK_POOL } from './Pools';
import { clockIsOverdue, clockUpdate } from './Clock';


export class TtyPort implements IFasterPipePort {
  public isReader = false;  // whether this port can read
  public isWriter = false;  // whether this port can write
  public closed = false;

  constructor(public tty: Tty, public flags: IOpenFlags) {
    // TODO: handle O_NOCTTY in process open mapper
    if ((flags & RDWR_MASK) === RDWR_MASK) {
      throw new Error('flags may contain only one of RDONLY | WRONLY | RDWR');
    }
    this.isReader = !!(((flags & RDWR_MASK) !== IOpenFlags.WRONLY) && ++this.tty.readers);
    this.isWriter = !!(((flags & RDWR_MASK) !== IOpenFlags.RDONLY) && ++this.tty.writers);
  }

  public read(buf: ArrayBuffer, offset: number, length: number, callback: (count: number, error?: any) => void): number | null {
    if (this.closed || !this.isReader) return -ERRNO.EBADF;
    return this.tty.read(buf, offset, length, callback);
  }

  public write(buf: ArrayBuffer, offset: number, length: number, callback: (count: number, error?: any) => void): number {
    if (this.closed || !this.isWriter) return -ERRNO.EBADF;
    if (!this.tty.readers) return -ERRNO.EPIPE;
    return this.tty.write(buf, offset, length, callback);
  }

  public dup(flags: IOpenFlags = this.flags): IFasterPipePort {
    return this.tty.open(flags);
  }

  public ctl(type: PIPE_CTL, ...args: any[]): any {
    // TODO: extend by all applicable fcntl/ioctl calls
    // errno handling?
    switch (type) {
      case PIPE_CTL.FIONREAD:
        return this.tty.fifoRead.size;
      //case PIPE_CTL.FIONWRITE:
      //  return this.pipe.pendingLength;
      //case PIPE_CTL.F_GETPIPE_SZ:
      //  return this.pipe.fifo.data.length;
      //case PIPE_CTL.F_SETPIPE_SZ:
      //  return this.pipe.changeFifoSize(args[0]);
      default:
        console.error('unsupported tty ctl', type);
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
      if ((events & POLL_EVENTS.POLLIN) && this.tty.fifoRead.size) revents |= POLL_EVENTS.POLLIN;
      // linux behavior: always sends POLLHUP even if there is still pending data
      // note BSD would only send POLLHUP after all data was consumed (easier to go with?)
      if ((events & POLL_EVENTS.POLLHUP) && !this.tty.writers) revents |= POLL_EVENTS.POLLHUP;
    }

    if (this.isWriter) {
      if ((events & POLL_EVENTS.POLLOUT) && !this.tty.fifoWrite.size && !this.tty.wBuffer.length) revents |= POLL_EVENTS.POLLOUT;
      if ((events & POLL_EVENTS.POLLERR) && !this.tty.readers) revents |= POLL_EVENTS.POLLERR;
    }

    // skip POLL_EVENTS.POLLPRI here (prolly needed in tty for tty_ioctl propagation)
    // skip POLL_EVENTS.POLLRDHUP

    return revents;
  }

  public close(): number {
    if (this.closed) return -ERRNO.EBADF;
    if (this.isReader) --this.tty.readers;
    if (this.isWriter) --this.tty.writers;
    this.closed = true;
    this.tty = null;
    return 0;
  }
  
  public lseek(offset: number, whence: any): number {
    return -ERRNO.ESPIPE;
  }
}

/**
 * TTY kernel device.
 * Implements basic TTY features:
 * - line discipline
 * - basic termios support
 * - pipe like endpoint for processes (slave of pty)
 * - TODO: ioctl hooks, signal handling
 */
export class Tty {
  public _readers = 0;
  public _writers = 0;
  public fifoWrite = new FifoBuffer(PIPE_BUF);  // FIXME: get buf from LDisc
  public fifoRead = new FifoBuffer(PIPE_BUF);   // FIXME: get buf from LDisc
  public pendingWriteLength = 0;               // length of pending write chunks
  public pendingReadLength = 0;               // length of pending read chunks
  public wBuffer: IDeferredChunk[] = [];  // pending write chunks
  public rBuffer: IDeferredChunk[] = [];  // pending read chunks
  private _pendingResolve = false;

  public ldisc = new LineDiscipline(this.fifoRead, this.fifoWrite);

  private _boundResolve = this._resolve.bind(this);
  private _boundScheduleResolve = (() => { clockUpdate(); this._resolve(); }).bind(this);

  public open(flags: IOpenFlags): IFasterPipePort {
    return new TtyPort(this, flags);
  }

  public get readers(): number {
    return this._readers;
  }
  public set readers(value: number) {
    this._readers = value;
  }
  public get writers(): number {
    return this._writers;
  }
  public set writers(value: number) {
    this._writers = value;
  }

  public write(buf: ArrayBuffer, offset: number, length: number, callback: (count: number, error?: any) => void): number {
    let written = 0;
    if (!this.wBuffer.length) {
      written = this.fifoWrite.write(buf, offset, length);
      if (written === length) {
        if (!this._pendingResolve) {
          this._pendingResolve = true;
          queueMicrotask(this._boundResolve);
        }
        return written;
      }
    }
    this.pendingWriteLength += length - written;

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

  public read(buf: ArrayBuffer, offset: number, length: number, callback: (count: number | null, error?: any) => void): number | null {
    // FIXME: correctly account line readers here?
    // FIXME: test for this.rBuffer.length correct here? (also fix in FasterPipe)
    if (!this._writers && !this.wBuffer.length && !this.fifoRead.size && this.rBuffer.length) {
      return null;
    }
    if (!this.rBuffer.length && this.fifoRead.size) {
      return this.fifoRead.read(buf, offset, length);
    }

    const chunk = CHUNK_POOL.create(buf, offset, length, callback);
    this.rBuffer.push(chunk);
    if (!this._pendingResolve && this.pendingWriteLength) {
      this._pendingResolve = true;
      queueMicrotask(this._boundResolve);
    }
    return 0;
  }

  /**
   * This is a mixture of pipe data handling (same as in FasterPipe) and tty ldisc processing.
   * Low level handling: FIXME!!!
   * - clock measuring to invoke event loop
   * - fifo/writer --> invoke ldisc
   * - fifo/reader --> get data from ldisc
   * - resolve/unblock served reader
   * - resolve/unblock consumed writer
   * - fill fifoWrite from pending writes
   * - on writer depletion resolve pending readers with null
   */
  private _resolve(): void {
    while (this.wBuffer.length || this.rBuffer.length) {
      if (clockIsOverdue()) {
        setTimeout(this._boundScheduleResolve, 0);
        return;
      }

      // we only handle pipe related concerns here:
      // - fifoRead --> reader
      // - writer --> fifoWrite here
      // and delegate low level buffer handling to ldisc

      // 1. serve readable data
      if (this.fifoRead.size) {
        const rChunk = this.rBuffer.shift();
        const readsize = Math.min(rChunk.length, this.fifoRead.size);
        const copied = this.fifoRead.read(rChunk.buf, rChunk.offset, readsize);
        rChunk.callback(copied);
        CHUNK_POOL.store(rChunk);
      }

      // 2. handle writable data chunks
      while (this.wBuffer.length && this.fifoWrite.size < this.fifoWrite.data.length) {
        const wChunk = this.wBuffer[0];
        const written = this.fifoWrite.write(wChunk.buf, wChunk.offset, wChunk.length);
        this.pendingWriteLength -= written;
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

      // 3. trigger ldisc processing
      this.ldisc.processBuffers();
    }
  }
}


class LineDiscipline {
  public termios: ITermios = TERMIOS_COOKED;

  /**
   * process buffers
   */
  //public fifoPRead = new FifoBuffer(4096);    // data for tty.read   (outgoing to process)
  //public fifoPWrite = new FifoBuffer(4096);   // data from tty.write (incoming from process)
  /**
   * line buffers
   */
  public fifoLRead = new FifoBuffer(4096);        // data for recv   (outgoing to line)
  public fifoLWrite = new FifoBuffer(PIPE_BUF);   // data from send  (incoming from line)
  /**
   * canon buffer
   * Line editor works on this before moving data to fifoRead.
   */
  public canonBuffer = new Uint8Array(1024); // FIXME: should this be uint32 to hold full codepoints?
  public canonCursor = 0;
  /**
   * line echo buffer
   * Aggregates changes to be read from the line.
   */
  public echoBuffer = new FifoBuffer(4096);

  private _lnext = false;

  constructor(
    public fifoPRead: FifoBuffer,   // data to be read by process (outgoing to process)
    public fifoPWrite: FifoBuffer   // data written from process (incoming from process)
  ) {}

  public processBuffers(): void {
    /**
     * Implement buffer strategy:
     * - should line data have higher priority?
     * 
     * Idea:
     * 1. clear internal buffers if possible:
     *    - deliver data to line read buffer
     *    - deliver data to tty read buffer
     * 2. read line write buffer --> process until internal buffers are full
     * 3. read tty write buffer --> process until internal buffers are full
     * 
     * 
     */

    while (true) {
      // handle incoming line data first
      // TODO: implement after pty is done
    }
  }

  // write from process
  public write(buf: ArrayBuffer, offset: number, length: number, callback: (count: number, error?: any) => void): number {
    return 0;
  }

  // read from process
  public read(buf: ArrayBuffer, offset: number, length: number, callback: (count: number | null, error?: any) => void): number | null {
    return 0;
  }

  // write from line
  public send(buf: ArrayBuffer, offset: number, length: number): number {
    // FIXME: make _process_received fully sync, thus we have to handle
    // buffer shortage and scheduling in pty

    return this._process_received(MEMORY_VIEW8.get(buf), offset, length);
  }

  // read from line
  public recv(buf: ArrayBuffer, offset: number, length: number): number | null {
    return 0;
  }

  private _process_received(data: Uint8Array, offset: number, length: number): number {
    return 0;
    /*
    if (length === 0) return 0;
    const iflags = this.termios.iflags;
    const lflags = this.termios.lflags;
    const cc = this.termios.cc;

    const end = offset + length;  // FIXME: also limit by avail buffer space here
    for (let i = offset; i < end; ++i) {
      let c = data[i];
      if (iflags & IFlags.ISTRIP) c &= 0x7F;
      if (iflags & IFlags.IXON) {
        if (c === cc.VSTOP && !this._lnext) {
          this.pause();
          continue;
        }
        if (c === cc.VSTART && !this._lnext) {
          this.resume();
          continue;
        }
        if (this.paused && iflags & IFlags.IXANY && c !== cc.VINTR && c !== cc.VQUIT && c !== cc.VSUSP) {
          this.resume();
        }
      }
      if (lflags & LFlags.ISIG && !this._lnext) {
        // FIXME: flush needed here?
        //if (c === cc.VINTR) { this._flush(); this.signal(TtySignal.SIGINT); continue; }
        //if (c === cc.VQUIT) { this._flush(); this.signal(TtySignal.SIGQUIT); continue; }
        //if (c === cc.VSUSP) { this._flush(); this.signal(TtySignal.SIGTSTP); continue; }
      }
      if (c === 13 && !this._lnext) {
        if (iflags & IFlags.IGNCR) continue;
        if (iflags & IFlags.ICRNL) c = 10;                  // \r -> \n
      } else if (c === 10 && iflags & IFlags.INLCR) c = 13; // \n -> \r

      // ICANON
      if (lflags & LFlags.ICANON) {
        if ((c === cc.VERASE || c === cc.VKILL || (c === cc.VWERASE && lflags & LFlags.IEXTEN)) && !this._lnext) {
          if ((c === cc.VERASE || c === cc.VWERASE) && (lflags & LFlags.ECHOE)) {
            this._erase(c);
            continue;
          } else if (c === cc.VKILL && (lflags & LFlags.ECHOK)) {
            this._erase(c);
            continue;
          }
        }
        // FIXME: check lnext in other branches
        if (c === cc.VLNEXT && lflags & LFlags.IEXTEN && !this._lnext) {
          if (lflags & LFlags.ECHO) {
            if (lflags & LFlags.ECHOCTL) {
              // we assume that the bytes can be written to echoBuffer (no return value check)
              this.echoBuffer.writeByte('^'.charCodeAt(0));
              this.echoBuffer.writeByte('\b'.charCodeAt(0));
              //this._bufEcho[this._curE++] = '^'.charCodeAt(0);
              //this._bufEcho[this._curE++] = '\b'.charCodeAt(0);
            }
          }
          this._lnext = true;
          continue;
        }

        if (c === cc.VREPRINT && lflags & LFlags.ECHO && lflags & LFlags.IEXTEN && !this._lnext) {
          // FIXME: ensure above in space calc, that echoBuffer always can hold current data + canon buffer
          // --> echoBuffer should always be empty when entering this call
          // this is a problem: tons of VREPRINT would insert several times the canon buffer
          // --> refactor loop to real stream handling to allow early exits
          this.echoBuffer.writeByte('^'.charCodeAt(0));
          this.echoBuffer.writeByte((c + 0x40) & 0x7F);
          this.echoBuffer.writeByte('\n'.charCodeAt(0));
          this.echoBuffer.write(this.canonBuffer.buffer, 0, this.canonCursor);
          // FIXME: how to send buffer here? (see old code)
          // --> simply insert data to fifoLRead for now
          // ensure above in space calc, that fifoLRead never can overflow here
          this.fifoLRead.write(this.echoBuffer.data.buffer, offset, this.echoBuffer.wCur);
          this.echoBuffer.reset();

          //this._bufEcho[this._curE++] = '^'.charCodeAt(0);
          //this._bufEcho[this._curE++] = (c + 0x40) & 0x7F;
          //this._bufEcho[this._curE++] = '\n'.charCodeAt(0);
          //this._bufEcho.set(this._bufOut.subarray(0, this._curO), this._curE);
          //this._curE += this._curO;
          //this._sendL(this._bufEcho.subarray(0, this._curE));
          //this._curE = 0;
          continue;
        }

        if (c === 10 && !this._lnext) {
          this.fifoPRead.writeByte(c);
          //this._buf[this._curW++] = c;
          if (lflags & LFlags.ECHO || lflags & LFlags.ECHONL) {
            // this is flaky: check whether OFlags.ONLCR gets correctly applied
            if (OFlags.ONLCR) {
              this.echoBuffer.writeByte(13);  // additional '\r' to get '\r\n'
            }
            this.echoBuffer.writeByte(c);
            this.fifoLRead.write(this.echoBuffer.data.buffer, offset, this.echoBuffer.wCur);
            // FIXME: why [0] here?
            //this._bufEcho[0] = c;
            //this._sendL(this._bufEcho.subarray(0, 1));
          }
          // -------------> hier weiter....

          this._sendP(this._buf.subarray(0, this._curW));
          this._curE = 0;
          this._curW = 0;
          this._curO = 0;
          continue;
        }

        if (c === cc.VEOF && !this._lnext) {
          if (this._curW) {
            this._sendP(this._buf.subarray(0, this._curW));
          } else {
            // indicate EOF, currently handled in the shell TODO: needs better fg/bg abstraction
            this._sendP(null);
          }
          this._curE = 0;
          this._curW = 0;
          this._curO = 0;
          continue;
        }

        if ((c === cc.VEOL || (c === cc.VEOL2 && lflags & LFlags.IEXTEN)) && !this._lnext) {
          // see https://github.com/torvalds/linux/blob/04ce9318898b294001459b5d705795085a9eac64/drivers/tty/n_tty.c#L1359
          // unclear whether EOL/EOL2 should be echoed at all
          if (lflags & LFlags.ECHO) {
            this._buf[this._curW++] = c;
            this._bufEcho[0] = c;
            this._sendL(this._bufEcho.subarray(0, 1));
          }
          this._sendP(this._buf.subarray(0, this._curW));
          this._curE = 0;
          this._curW = 0;
          this._curO = 0;
          continue;
        }

      }

      if (lflags & LFlags.ECHO) {
        // FIXME: different repr in bufOut and bufEcho?
        // FIXME: TAB should not be escaped, print (length mod 8) whitespaces instead
        if (c < 0x20 || c === 0x7F) {
          if (lflags & LFlags.ECHOCTL) {
            this._bufEcho[this._curE++] = '^'.charCodeAt(0);
            this._bufEcho[this._curE++] = (c + 0x40) & 0x7F;
          } else {
            this._bufEcho[this._curE++] = c;
          }
          if (this._lnext) {
            this._lnext = false;
            this._bufOut[this._curO++] = '^'.charCodeAt(0);
            this._bufOut[this._curO++] = (c + 0x40) & 0x7F;
          } else {
            this._bufOut[this._curO++] = c;
          }
        } else {
          this._lnext = false;
          this._bufEcho[this._curE++] = c;
          this._bufOut[this._curO++] = c;
        }
      }
      this._buf[this._curW++] = c;

    }

    this._flush();
    */
  }

  private _erase(c: number): void {}


  // interface those from tty
  public signal(sig: any): void {
    console.log('signal to send:', sig);
  }
  public resume(): void {
    this.paused = false;
    console.log('resume: not implemented');
  }
  public pause(): void {
    this.paused = true;
    console.log('pause: not implemented');
  }
  public paused = false;
}

/**
 * PTY class.
 * Kernel device 
 */
export class Pty {

}
