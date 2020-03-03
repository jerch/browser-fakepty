import { Pipe, PipeReader } from './Pipe';
import { ITermios, TERMIOS_COOKED, IFlags, LFlags, OFlags, When } from './Termios';
import { Encoder, Decoder } from './utf8';
import { ProcessMain, Process } from './Process';
import { IDisposable, IPipeReader, IPipeWriter, IPipe, ILineDiscipline } from './Types';

/**
 * Schema for ttys:
 * 
 *               "line"                          "pipes"
 *                             +-------------+
 *               RECV iflags   |     TTY     |   read
 *            +---------------->             +------------->
 *   PTS/Terminal              | DISCIPLINE  |           PROCESS
 *            <----------------+   lflag     <-----------..+
 *               SEND oflags   |             |   write
 *                             +-------------+
 */

interface ITtyReader extends IPipeReader {
  onData(handler: (data: string) => void): IDisposable;
}

interface ITtyWriter extends IPipeWriter {
  write(data: string): boolean;
}

enum TtySignal {
  SIGINT = 2,
  SIGQUIT = 3,
  SIGTSTP = 20
}

class TtyWriter implements ITtyWriter {
  private _closed = false;
  constructor(private _tty: Tty) {
    this._tty.registerWriter(this);
  }
  public close(): void {
    this._tty.removeWriter(this);
    this._closed = true;
  }
  public write(data: any): boolean {
    if (this._closed) console.log('closed writer got:', [data]);
    if (this._closed) throw new Error('writer already closed');
    return this._tty.insertData(data);
  }
}

class TtyReader implements ITtyReader {
  private _paused = true;
  private _closed = false;
  private _pendingRead = false;
  private _handlers: ((data: string) => void)[] = [];
  private _chunk: string | null = null;
  private _cb: ((sucess: boolean) => void) | null = null;
  constructor(private _tty: Tty) {
    this._tty.registerReader(this);
  }
  public close(): void {
    this._tty.removeReader(this);
    this._closed = true;
    if (!this._pendingRead) {
      this._handlers = [];
    }
  }
  public onData(handler: (data: string) => void): IDisposable {
    if (this._closed) throw new Error('reader already closed');
    this._handlers.push(handler);
    this.resume();
    return {
      dispose: () => {
        const idx = this._handlers.indexOf(handler);
        if (~idx) this._handlers.splice(idx, 1);
      }
    }
  }
  public pause(): void {
    this._paused = true;
  }
  public resume(): void {
    this._paused = false;
    const data = this._chunk;
    const callback = this._cb;
    this._chunk = null;
    this._cb = null
    if (data && callback) {
      this.handleChunk(data, callback);
    }
  }
  public handleChunk(data: string, callback: (success: boolean) => void): void {
    if (!this._closed) {
      this._pendingRead = true;
      if (this._paused) {
        // we cannot handle data until resumed
        this._chunk = data;
        this._cb = callback;
      } else {
        //this._handlers.forEach(h => h(data));
        //this._handlers.slice().forEach(h => h(data));
        const handlers = this._handlers.slice();
        for (let i = 0; i < handlers.length; ++i) {
          handlers[i](data);
        }
        this._pendingRead = false;
        if (this._closed) {
          this._handlers = [];
        }
        callback(true);
      }
      return;
    }
    callback(false);
  }
}

const DISCARD_LIMIT = 16384;
const MAX_LIMIT = 8192;
const MIN_LIMIT = 1024;

class Tty implements IPipe {
  private _writers: ITtyWriter[] = [];
  private _readers: ITtyReader[] = [];
  private _closeHandlers: (() => void)[] = [];
  private _drainHandlers: (() => void)[] = [];
  private _buf: string = '';
  public closed = false;
  public writable = true;

  // master stuff
  private _onDataHandlers: ((data: string) => void)[] = [];
  public masterWritable = true;
  public paused = false;

  constructor(public newLDisc: ILineDiscipline) {}

  private _cleanup(): void {
    this._writers.length = 0;
    this._readers.length = 0;
    this._drainHandlers.length = 0;
    this._buf = '';
    this.closed = true;
  }

  public close(): void {
    if (this.closed) return;
    this._cleanup();
    const handlers = this._closeHandlers.slice();
    this._closeHandlers.length = 0;
    for (let i = 0; i < handlers.length; ++i) {
      handlers[i]();
    }
  }

  public onClose(handler: () => void): IDisposable {
    if (this.closed) throw new Error('tty already closed');
    const handlers = this._closeHandlers;
    handlers.push(handler);
    return {
      dispose: () => {
        const idx = handlers.indexOf(handler);
        if (~idx) handlers.splice(idx, 1);
      }
    }
  }

  public onDrain(handler: () => void): IDisposable {
    if (this.closed) throw new Error('pipe already closed');
    const handlers = this._drainHandlers;
    handlers.push(handler);
    return {
      dispose: () => {
        const idx = handlers.indexOf(handler);
        if (~idx) handlers.splice(idx, 1);
      }
    }
  }

  // FIXME: rework for tty
  public pipeTo(pipes: Pipe[]): void {
    if (this.closed) throw new Error('pipe already closed');
    for (let i = 0; i < pipes.length; ++i) {
      const target = pipes[i];
      const r = this.getReader();
      const w = target.getWriter();
      target.onDrain(() => r.resume());
      const d = r.onData(data => {
        if (!w.write(data)) {
          r.pause();
        };
      });
      this.onClose(() => {
        d.dispose();
        r.close();
        w.close();
      });
      target.onClose(() => {
        d.dispose();
        r.close();
        w.close();
      });
    }
  }

  public writeToProcess(data: string | null): void {
    const handlers = this._readers.slice();
    for (let i = 0; i < handlers.length; ++i) {
      handlers[i].handleChunk(data, success => {});
    }
  }

  public onDataD(handler: (data: string) => void): IDisposable {
    const handlers = this._onDataHandlers;
    handlers.push(handler);
    return {
      dispose: () => {
        const idx = handlers.indexOf(handler);
        if (~idx) handlers.splice(idx, 1);
      }
    }
  }
  public pause(): void {
    // XON/XOFF
    console.log('tty should pause');
  }
  public resume(): void {
    // XON/XOFF
    console.log('tty should resume');
  }

  public insertData(data: string): boolean {
    if (this.closed || this._buf.length > DISCARD_LIMIT) {
      this.writable = false;
      throw new Error('discarding write data');
    }
    this.newLDisc.recvP(data);
    return false; // TODO: process flow control, currently stops after one write

    // update writable flag
    if (this.writable) {
      this.writable = this._buf.length < MAX_LIMIT;
    }
    return this.writable;
  }

  public getReader(): ITtyReader {
    return new TtyReader(this);
  }
  public getWriter(): ITtyWriter {
    if (this.closed) throw new Error('pipe already closed');
    return new TtyWriter(this);
  }

  public registerReader(r: ITtyReader): void {
    this._readers.push(r);
    this.onClose(() => r.close());
  }
  public registerWriter(w: ITtyWriter): void {
    this._writers.push(w);
    this.onClose(() => w.close());
  }
  public removeReader(r: ITtyReader): void {
    const idx = this._readers.indexOf(r);
    if (~idx) {
      this._readers.splice(idx, 1);
      // last reader gone
      if (!this._readers.length && !this.closed) {
        this.close();
      }
    }
  }
  public removeWriter(w: ITtyWriter): void {
    const idx = this._writers.indexOf(w);
    if (~idx) {
      this._writers.splice(idx, 1);
      // last writer gone
      if (!this._writers.length && !this._buf.length && !this.closed) {
        this.close();
      }
    }
  }

  public signal(sig: TtySignal): void {
    // process signal
    console.log('signal to send:', TtySignal[sig]);
  }
}


/**
 * Inspired from linux n_tty
 * @see https://github.com/torvalds/linux/blob/04ce9318898b294001459b5d705795085a9eac64/drivers/tty/n_tty.c
 *
 * FIXME: missing handling for IMAXBEL, IUTF8, IGNBRK, BRKINT
 * FIXME: check missing post symbols (OLCUC, others?)
 * TODO: Should we implement any of the skipped termios symbols?
 */
class TermiosDiscipline implements ILineDiscipline {
  private _lReceiver: (data: string) => void;
  private _pReceiver: (data: string) => void;
  private _encoder = new Encoder();
  private _lDecoder = new Decoder();
  private _pDecoder = new Decoder();
  constructor(public settings: ITermios) {}

  /**
   * C lib friendly termios interface.
   */
  public tty_ioctl(): void {

  }

  /**
   * Register a line receiver. Any data from `_sendL` will be sent to that receiver.
   * This is the entry point for `Pty.onData` handler.
   * Only a single callback is currently supported.
   */
  public registerLineReceiver(handler: (data: string) => void): void {
    this._lReceiver = handler;
  }

  /**
   * Register a process receiver. Any data from `_sendP` will be sent to that receiver.
   * This is the entry point for `Tty.writeToProcess`.
   * Only a single callback is currently supported.
   */
  public registerProcessReceiver(handler: (data: string) => void): void {
    this._pReceiver = handler;
  }

  /**
   * Send data to the line.
   * Does line oflag processing and UTF8 to string conversion.
   */
  private _sendL(data: Uint8Array): void {
    let decoded = this._lDecoder.decode(data, {stream: true});
    if (this.settings.oflags & OFlags.OPOST) {
      if (this.settings.oflags & OFlags.ONLCR) decoded = decoded.replace(/\n/g, '\r\n');
    }
    this._lReceiver?.(decoded);
  }

  /**
   * Send data to processes.
   * Does UTF8 to string conversion.
   */
  private _sendP(data: Uint8Array | null): void {
    if (data !== null) {
      this._pReceiver?.(this._pDecoder.decode(data, {stream: true}));
    } else {
      this._pDecoder.decode(new Uint8Array(0), {stream: false});
      this._pReceiver?.(null);
    }
  }

  /**
   * Receive data from the line.
   * This is the entry point for `Pty.write`.
   * Does string to UTF8 conversion and line iflag processing.
   */
  public recvL(data: string): boolean {
    const iflags = this.settings.iflags;
    const lflags = this.settings.lflags;
    if (iflags & IFlags.IUCLC && lflags & LFlags.IEXTEN) data = data.toLocaleLowerCase();
    this._recv(this._encoder.encode(data));
    return true;  // TODO: buffer watermark
  }

  /**
   * Receive data from processes.
   * This is the entry point for TTY writers.
   * Writes data to echo buffer and flushes output.
   */
  public recvP(data: string): void {
    const bytes = this._encoder.encode(data);
    this._bufEcho.set(bytes, this._curE);
    this._curE += bytes.length;
    this._flush();
    /**
     * TODO: boolean return as backpressure indicator
     * - limit single chunk size above in TTY
     * - do some buffer watermarking depending on this._curE
     */
  }

  private _buf = new Uint8Array(MAX_LIMIT);
  private _bufEcho = new Uint8Array(MAX_LIMIT);
  private _bufOut = new Uint8Array(MAX_LIMIT);
  private _curW = 0;
  private _curE = 0;
  private _curO = 0;
  private _lnext = false;

  /**
   * termios flag handling.
   * This is called from `recvL` and does most iflag and lflag handling.
   */
  public _recv(data: Uint8Array): void {
    if (!data.length) return;

    const iflags = this.settings.iflags;
    const lflags = this.settings.lflags;
    const cc = this.settings.cc;
    for (let i = 0; i < data.length; ++i) {
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
        if (c === cc.VINTR) { this._flush(); this.signal(TtySignal.SIGINT); continue; }
        if (c === cc.VQUIT) { this._flush(); this.signal(TtySignal.SIGQUIT); continue; }
        if (c === cc.VSUSP) { this._flush(); this.signal(TtySignal.SIGTSTP); continue; }
      }
      if (c === 13 && !this._lnext) {
        if (iflags & IFlags.IGNCR) continue;
        if (iflags & IFlags.ICRNL) c = 10;                  // \r -> \n
      } else if (c === 10 && iflags & IFlags.INLCR) c = 13; // \n -> \r

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
              this._bufEcho[this._curE++] = '^'.charCodeAt(0);
              this._bufEcho[this._curE++] = '\b'.charCodeAt(0);
            }
          }
          this._lnext = true;
          continue;
        }

        if (c === cc.VREPRINT && lflags & LFlags.ECHO && lflags & LFlags.IEXTEN && !this._lnext) {
          this._bufEcho[this._curE++] = '^'.charCodeAt(0);
          this._bufEcho[this._curE++] = (c + 0x40) & 0x7F;
          this._bufEcho[this._curE++] = '\n'.charCodeAt(0);
          this._bufEcho.set(this._bufOut.subarray(0, this._curO), this._curE);
          this._curE += this._curO;
          this._sendL(this._bufEcho.subarray(0, this._curE));
          this._curE = 0;
          continue;
        }

        if (c === 10 && !this._lnext) {
          this._buf[this._curW++] = c;
          if (lflags & LFlags.ECHO || lflags & LFlags.ECHONL) {
            // FIXME: why [0] here?
            this._bufEcho[0] = c;
            this._sendL(this._bufEcho.subarray(0, 1));
          }
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
  }

  /**
   * Flush output buffers.
   */
  private _flush(): void {
    if (this._curE) {
      this._sendL(this._bufEcho.subarray(0, this._curE));
    }
    this._curE = 0;
    if (!(this.settings.lflags & LFlags.ICANON)) {
      if (this._curW >= this.settings.cc.VMIN) {
        const curW = this._curW;
        this._curW = 0;
        this._sendP(this._buf.subarray(0, curW));
      }
    }
  }

  /**
   * Erase handling for ICANON.
   *
   * FIXME: check https://github.com/torvalds/linux/blob/04ce9318898b294001459b5d705795085a9eac64/drivers/tty/n_tty.c#L979
   * FIXME: respect utf8 multibyte, respect self generated multibytes (^[..., ^X)
   * FIXME: simplify ECHO checks with above
   * FIXME: implement ECHOPRT
   */
  private _erase(c: number): void {
    const cc = this.settings.cc;
    const lflags = this.settings.lflags;
    switch (c) {
      case cc.VERASE:
        if (lflags & LFlags.ECHOE && this._curW) {
          if (lflags & LFlags.ECHO) {
            this._bufEcho[this._curE++] = 8;
            this._bufEcho[this._curE++] = 32;
            this._bufEcho[this._curE++] = 8;
          }
          this._curW--;
          this._curO--;
        }
        break;
      case cc.VWERASE:
        if (lflags & LFlags.ECHOE) {
          // strip any whitespace from right
          while (this._curW && isspace(this._buf[this._curW - 1])) {
            if (lflags & LFlags.ECHO) {
              this._bufEcho[this._curE++] = 8;
              this._bufEcho[this._curE++] = 32;
              this._bufEcho[this._curE++] = 8;
            }
            this._curW--;
            this._curO--;
          }
          // revert cursor before word
          while (this._curW && !isspace(this._buf[this._curW - 1])) {
            if (lflags & LFlags.ECHO) {
              this._bufEcho[this._curE++] = 8;
              this._bufEcho[this._curE++] = 32;
              this._bufEcho[this._curE++] = 8;
            }
            this._curW--;
            this._curO--;
          }
        }
        break;
      case cc.VKILL:
        if (lflags & LFlags.ECHOK) {
          while (this._curW) {
            if (lflags & LFlags.ECHO) {
              this._bufEcho[this._curE++] = 8;
              this._bufEcho[this._curE++] = 32;
              this._bufEcho[this._curE++] = 8;
            }
            this._curW--;
            this._curO--;
          }
        }
        break;
    }
  }

  // interface those from tty
  public signal(sig: TtySignal): void {
    console.log('signal to send:', TtySignal[sig]);
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
 * Early Pty stub, which tries to mimick node-pty interface.
 * TODO:
 * - resize handling
 * - onData multiplexer
 * - close event
 * - kill handling
 * - proper flow control/backpressure
 *    --> what about input chain?
 *    IXOFF is typically not implemented on ptys,
 *    the kernel instead relies on blocking/partial writes.
 *    xterm.js has no output flow control (in fact it has no means to block a user
 *    from entering more and more data), which is for typed input no problem,
 *    but might overwhelm the tty buffer for very big pasted content.
 *
 *    Workaround (in hope no one pastes GBs of data is a few seconds), roughly:
 *
 *      ```javascript
 *      xterm.onData(data => pty.write(data)); // no blocking or flow control here possible
 *
 *      pty.write(data) {
 *        if (DISCARD_LIMIT ...) // basic sanity check to avoid OOM
 *        this._internalBuffer.push(data);
 *        setTimeout(() => this._handle(), 0);
 *      }
 *      pty._handle() {
 *        if (this._ldisc.lineWritable && this._internalBuffer.length) {
 *          chunk = ...;                  // get data from buffer and adjust buffer
 *          this._ldisc.recvL(chunk);     // ldisc itself is sync code up to the process pipe (tty) and line output
 *        }
 *        if (this._internalBuffer.length) {
 *          setTimeout(() => this._handle(), 0);
 *        }
 *      }
 *      ```
 *
 *    Output chains:
 *      - process pipe: non blocking write with flow indicator as return value - `pipe.write(...): boolean`
 *      - line output: flow indicator as callback of `xterm.write(..., callback): void`
 *      - ldisc must wait on either chain and only resume if both are free to go - possible with promise resolver
 *
 *    obstacles:
 *      - bad perf, complicated model: reduce event loop invocation (setTimeout, promises)
 *      - deadlocks?
 *      - document correct usage of non blocking pipe writes (max chunks/chunksize, respect return value)
 */
export class Pty {
  private _tty: Tty;
  private _p: Process;
  private _ldisc: TermiosDiscipline;
  constructor(command: ProcessMain, private _argv: string[], private _opts: any) {
    const termios = {...TERMIOS_COOKED, cc: {...TERMIOS_COOKED.cc}};

    this._ldisc = new TermiosDiscipline(termios);

    this._tty = new Tty(this._ldisc);
    this._ldisc.registerProcessReceiver(this._tty.writeToProcess.bind(this._tty));
    this._p = new Process(command, this._tty, this._tty, this._tty);
    // FIXME: closing ptm should actually be the shell's responsibility
    this._p.afterExit(() => this.close());
  }
  public close(): void {
    // FIXME: implement SIGHUP
    console.log('should close/dispose tty/pty resources...');
    this._p = null;
    this._tty.close();
    this._tty = null;
    this._ldisc = null;
  }
  public onData(h: (data: string) => void): void {
    this._ldisc.registerLineReceiver(h);
    // TODO: multiplexer for onData
    this._p.run(this._argv, this._opts.env);
  }
  public write(data: string): boolean {
    return this._ldisc?.recvL(data);
  }
  public pause(): void {
    this._tty.pause();
  }
  public resume(): void {
    this._tty.resume();
  }
  public kill(sig: string | number): void {
    // do something with process
  }
  public resize(cols: number, rows: number, xpixels: number = 0, ypixels: number = 0): void {
    // TODO
  }
}


/**
 * Helper clib functions regarding ttys.
 */
export function isatty(channel: ITtyReader | IPipeReader | ITtyWriter | IPipeWriter): boolean {
  return (channel as any)._tty !== undefined;
}

export function tcgetattr(channel: ITtyReader | IPipeReader | ITtyWriter | IPipeWriter): ITermios {
  if (!isatty(channel)) {
    throw new Error('channel is not a tty');
  }
  const tty: Tty = (channel as any)._tty as Tty;
  if (tty.newLDisc instanceof TermiosDiscipline) {
    return {
      ...tty.newLDisc.settings,
      cc: {...tty.newLDisc.settings.cc}
    };
  }
  throw new Error('unsupported line discipline');
}

export function tcsetattr(
  channel: ITtyReader | IPipeReader | ITtyWriter | IPipeWriter,
  termios: ITermios,
  when: When = When.TCSADRAIN): boolean
{
  if (!isatty(channel)) {
    throw new Error('channel is not a tty');
  }
  const tty: Tty = (channel as any)._tty;
  // TODO: needs a setter on Tty to correctly deal with when clause
  if (tty.newLDisc instanceof TermiosDiscipline) {
    tty.newLDisc.settings = {...termios, cc: {...termios.cc}};
  } else {
    throw new Error('unsupported line discipline');
  }
  return true;
}

// TODO: make this configurable (locale dependent?)
const WHITESPACE = [9, 10, 11, 12, 13, 32];
function isspace(c: number): number {
  return ~WHITESPACE.indexOf(c);
}

// TODO: implement iscntrl, isalnum

// TODO: write ioctl interface with C headers
// TODO: limit ioctls to the minimum, use linux values
export enum TTY_IOCTL {
  TCGETS,           // Equivalent to tcgetattr(fd, argp).                   struct termios *
  TCSETS,           // Equivalent to tcsetattr(fd, TCSANOW, argp).          const struct termios *
  TCSETSW,          // Equivalent to tcsetattr(fd, TCSADRAIN, argp).        const struct termios *
  TCSETSF,          // Equivalent to tcsetattr(fd, TCSAFLUSH, argp).        const struct termios *
  //TCGETA,           // No termio support.
  //TCSETA,           // No termio support.
  //TCSETAW,          // No termio support.
  //TCSETAF,          // No termio support.
  //TIOCGLCKTRMIOS,   // Gets the locking status of the termios structure of the terminal.
  //TIOCSLCKTRMIOS,   // Sets the locking status of the termios structure of the terminal. (only root)
  TIOCGWINSZ,       // Get window size.                                     struct winsize *
  TIOCSWINSZ,       // Set window size.                                     const struct winsize *
  //TCSBRK,           // Equivalent to tcsendbreak(fd, arg).
  //TCSBRKP,          // "POSIX version" of TCSBRK. (see manpage)
  //TIOCSBRK,         // Turn break on, that is, start sending zero bits.
  //TIOCCBRK,         // Turn break off, that is, stop sending zero bits.
  //TCXONC,           // Equivalent to tcflow(fd, arg).
  //FIONREAD,         // Get the number of bytes in the input buffer.
  //TIOCINQ,          // Same as FIONREAD.
  //TIOCOUTQ,         // Get the number of bytes in the output buffer.
  //TCFLSH,           // Equivalent to tcflush(fd, arg).
  //TIOCSTI,          // Insert the given byte in the input queue.
  //TIOCCONS,         // Redirecting console output. (see manpage)
  TIOCSCTTY,        // Make the given terminal the controlling terminal of the calling process.
  TIOCNOTTY,        // If the terminal was the controlling terminal of the calling process, give it up.
  TIOCGPGRP,        // When successful, equivalent to *argp = tcgetpgrp(fd).    pid_t *
  TIOCSPGRP,        // Equivalent to tcsetpgrp(fd, *argp).                      const pid_t *
  TIOCGSID,         // Get the session ID of the given terminal.                ?? (prolly pid_t *)
  //TIOCEXCL,         // Put the terminal into exclusive mode.
  //TIOCNXCL,         // Disable exclusive mode.
  TIOCGETD,         // Get the line discipline of the terminal.                 int *
  TIOCSETD,         // Set the line discipline of the terminal.                 const int *
  //TIOCPKT,          // Enable (when *argp is nonzero) or disable packet mode. (see manpage)
  //TIOCMGET,       // No modem support.
  //TIOCMSET,       // No modem support.
  //TIOCMBIC,       // No modem support.
  //TIOCMBIS        // No modem support.
  //TIOCGSOFTCAR,   // Get the status of the CLOCAL flag. Unsupported, always assuming CLOCAL.
  //TIOCSSOFTCAR,   // Set the CLOCAL flag. Unsupported, always assuming CLOCAL.
  //TIOCLINUX,      // Unsupported.
  //TIOCTTYGSTRUCT, // Unsupported.

}

// C sequence to initialize a pty

// create new pty, returns master fd
function openpt(flag: any): number {
  // TODO: create Pty instance
  // FIXME: create duplex pipe endpoint as IReaderWriter
  // TODO: attach pty ReaderWriter to next fd
  return 0;  // -1 + ERRNO
}

// chown of pts (see manpage)
function grantpt(masterfd: number): number {
  // prolly stubbed out (no permission rule set yet)
  return 0;
}

// unlock tty (should we start locked?)
function unlockpt(masterfd: number): number {
  // prolly stubbed out (makes not much sense w'o a permission rule set)
  return 0;
}

// get corresponding slave path
function ptsname(masterfd: number): string {
  // FIXME: establish lightweight FS abstraction with open/read/close and tty flags (O_NOCTTY)
  // FIXME: write slave entry in FS
  return '';
}

/**
 * How can this work from C w'o fork/exec?
 * 
 * example:
 * 
 * ```C
 *  int main() {
 *    int master = openpt(O_RDWR | O_NOCTTY);           // sync: spawn new Pty with ReaderWriter and register in FS
 *    grantpt(master);                                  // sync: stubbed out
 *    unlockpt(master);                                 // sync: stubbed out
 *    char *slavepath = ptsname(master);                // sync: return registered FS name
 *    int slave = open(slavepath, O_RDWR | O_NOCTTY);   // sync: create new TTY ReaderWriter
 *    pid_t slave_process = fake_spawn(                 // sync: new process as session leader with controlling TTY
 *      path_to_executable, slave, slave, slave);
 *    ...
 *    // interact                                       // async: read/write interaction is always async
 *    ...
 *    // exit1
 *    close(master);                                    // async: send SIGHUP --> should notify/exit slave side
 *    // exit2
 *    kill(slave_process, 15);                          // async: request termination (9 - kill prolly not doable)
 *    wait(...);                                        // async: always async?
 *  }                                                   // sync: process exit
 *                                                      // async: after exit - close all fds (might involve signals)
 * ```
 * 
 */

interface IWinsize {
  row: number;
  col: number;
  xpixel: number;
  ypixel: number;
}
interface ISpawnPtyResult {
  pty: Pty;
  process: Process;
}
/**
 * high level function similar to forkpty + exec.
 */
function spawnpty(command: ProcessMain, argv: string[], termios: ITermios, winsize: IWinsize): ISpawnPtyResult {
  const pty = new Pty(command, argv, {termios, winsize});
  return {pty: pty, process: (pty as any)._p};
}
/**
 * in C:
 * 
 * ```C
 * pid_t forkpty(int *amaster, char *name,
 *               const struct termios *termp,
 *               const struct winsize *winp);
 * 
 * pid_t spawnpty(int *amaster, char *name,
 *                const struct termios *termp,
 *                const struct winsize *winp,
 *                const char *pathname, char *const argv[], char *const envp[]);
 * ```
 */
