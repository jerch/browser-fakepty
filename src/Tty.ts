import { IPipe, IDisposable, IPipeReader, IPipeWriter, PipeReader, Pipe, getLogPipe } from './Pipe';
import { ITermios, TERMIOS_COOKED, IFlags, LFlags, OFlags } from './Termios';
import { Encoder, Decoder } from './utf8';
import { ProcessMain, Process } from './Process';
import { FakeShell } from './Shell';

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
  private _pending = false;
  private _ldisc: LDisc;
  private _encoder = new Encoder();
  private _decoder = new Decoder();

  // master stuff
  private _onDataHandlers: ((data: string) => void)[] = [];
  public masterWritable = true;
  private _lineBuffer: string = '';
  public paused = false;

  constructor(public termios: ITermios) {
    this._ldisc = new LDisc(this);
  }

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

  /**
   * Master side data handling.
   */
  private _localProcessing(): void {
    // LOCAL processing

  }

  public writeToDevice(data: Uint8Array): void {
    let decoded = this._decoder.decode(data);
    // late post processing
    if (this.termios.oflags & OFlags.OPOST) {
      if (this.termios.oflags & OFlags.ONLCR) decoded = decoded.replace(/\n/g, '\r\n');
    }
    console.log('device reads', [decoded]);
    for (let i = 0; i < this._onDataHandlers.length; ++i) {
      this._onDataHandlers[i](decoded);
    }
  }

  public writeToProcess(data: Uint8Array): void {
    const decoded = this._decoder.decode(data);
    for (let i = 0; i < this._readers.length; ++i) {
      this._readers[i].handleChunk(decoded, success => {});
    }
  }

  public writeFromDevice(data: string): boolean {
    // move to ldisc
    const iflags = this.termios.iflags;
    const lflags = this.termios.lflags;
    if (iflags & IFlags.IUCLC && lflags & LFlags.IEXTEN) data = data.toLocaleLowerCase();
    this._ldisc.input(this._encoder.encode(data));

    return false;

    if (this.closed || this._lineBuffer.length > DISCARD_LIMIT) {
      this.masterWritable = false;
      throw new Error('discarding write data');
    }

    // INPUT processing
    //const iflags = this.termios.iflags;

    if (iflags & IFlags.IUCLC) data = data.toLowerCase();
    for (let i = 0; i < data.length; ++i) {
      let c = data[i];
      switch (c) {
        case '\n': if (iflags & IFlags.INLCR) c = '\r'; break;
        case '\r': if (iflags & IFlags.IGNCR) c = ''; else if (iflags & IFlags.ICRNL) c = '\n'; break;

      }
    }

    //if (iflags & IFlags.ISTRIP) { /** TODO */ }
    if (iflags & IFlags.INLCR) data = data.replace(/\n/g, '\r');
    if (iflags & IFlags.IGNCR) data = data.replace(/\r/g, '');
    if (iflags & IFlags.ICRNL) data = data.replace(/\r/g, '\n');
    if (iflags & IFlags.IUCLC) data = data.toLowerCase();
    //if (iflags & IFlags.IXON) { /** TODO */ }
    //if (iflags & IFlags.IXANY) { /** TODO */ }
    //if (iflags & IFlags.IXOFF) { /** TODO */ }
    //if (iflags & IFlags.IMAXBEL) { /** TODO */ }
    //if (iflags & IFlags.IUTF8) { /** always operating in Unicode */ }

    this._lineBuffer += data;
    this._localProcessing();

    // update writable flag
    if (this.masterWritable) {
      this.masterWritable = this._lineBuffer.length < MAX_LIMIT;
    }
    return this.masterWritable;
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
  }
  public resume(): void {
    // XON/XOFF
  }
  private _handleMasterOutput(data: string, callback: (success: boolean) => void) {
    // line discipline OUTPUT
  }

  /**
   * Slave side data handling.
   */
  private _handle(): void {
    // line discipline handling
  }

  public insertData(data: string): boolean {
    if (this.closed || this._buf.length > DISCARD_LIMIT) {
      this.writable = false;
      throw new Error('discarding write data');
    }
    this._ldisc.writeP(this._encoder.encode(data));
    return;

    // place data and schedule processing
    this._buf += data;
    if (!this._pending) {
      this._pending = true;
      setTimeout(() => this._handle(), 0);
    }

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

enum TtySignal {
  SIGINT = 2,
  SIGQUIT = 3,
  SIGTSTP = 20
}

class LDisc {
  private _buf = new Uint8Array(MAX_LIMIT);
  private _bufEcho = new Uint8Array(MAX_LIMIT);
  private _curW = 0;
  private _curR = 0;
  private _curE = 0;
  constructor(public tty: Tty) {}

  private output(): void {}

  public writeP(data: Uint8Array): void {
    const decoder = new Decoder();
    console.log('from process', [decoder.decode(data)]);
    this._bufEcho.set(data, this._curE);
    this._curE = data.length;
    this._flush();
  }

  // input from line
  public input(data: Uint8Array): void {
    if (!data.length) return;

    const iflags = this.tty.termios.iflags;
    const lflags = this.tty.termios.lflags;
    const cc = this.tty.termios.cc;
    for (let i = 0; i < data.length; ++i) {
      let c = data[i];
      if (iflags & IFlags.ISTRIP) c &= 0xFF;
      if (iflags & IFlags.IXON) {
        if (c === cc.VSTOP) {
          this.tty.pause();
          continue;
        }
        if (c === cc.VSTART) {
          this.tty.resume();
          continue;
        }
        if (this.tty.paused && iflags & IFlags.IXANY && c !== cc.VINTR && c !== cc.VQUIT && c !== cc.VSUSP) {
          this.tty.resume();
          // continue;      // FIXME: need to consume char here?
        }
      }
      if (lflags & LFlags.ISIG) {
        // FIXME: flush needed here?
        if (c === cc.VINTR) { this._flush(); this.tty.signal(TtySignal.SIGINT); continue; }
        if (c === cc.VQUIT) { this._flush(); this.tty.signal(TtySignal.SIGQUIT); continue; }
        if (c === cc.VSUSP) { this._flush(); this.tty.signal(TtySignal.SIGTSTP); continue; }
      }
      if (c === 13) {
        if (iflags & IFlags.IGNCR) continue;
        if (iflags & IFlags.ICRNL) c = 10;                  // \r -> \n
      } else if (c === 10 && iflags & IFlags.INLCR) c = 13; // \n -> \r

      if (lflags & LFlags.ICANON) {
        if (c === cc.VERASE || c === cc.VKILL || (c === cc.VWERASE && lflags & LFlags.IEXTEN)) {
          this._erase(c);
          continue;
        }

        // quickhack to get \n working
        if(c === 10) {
          this._buf[this._curW++] = c;
          this._bufEcho[0] = c;
          this.tty.writeToDevice(this._bufEcho.subarray(0, 1)); //---grrrr why disabled?
          this.tty.writeToProcess(this._buf.subarray(0, this._curW));
          this._curE = 0;
          this._curR = 0;
          this._curW = 0;
          continue;
        }

      }

      // put char into buffer
      this._buf[this._curW++] = c;
      this._bufEcho[this._curE++] = c;
    }

    this._flush();
  }

  private _erase(c: number): void {
    // erase handling from canon buffer
  }

  private _flush(): void {
    // flush pending actions like pipe writes/updates
    const decoder = new Decoder();
    console.log(['buf acess', decoder.decode(this._buf.subarray(this._curR, this._curW))]);
    const newAccess = this._curW - this._curR;
    //this._bufEcho.set(this._buf.subarray(this._curR, this._curW), this._curE);
    this.tty.writeToDevice(this._bufEcho.subarray(0, this._curE));
    //console.log(['echo sent', this._curE, decoder.decode(this._bufEcho.subarray(0, this._curE))]);
    this._curE = 0;
    //this._curE += this._curW - this._curR;
    this._curR = this._curW;
    console.log(['echo', decoder.decode(this._bufEcho)]);
    console.log(['buf', decoder.decode(this._buf)]);
  }
}


export class Pty {
  private _tty: Tty;
  private _p: Process;
  constructor(command: ProcessMain, argv: string[], opts: any) {
    const t = Object.assign({}, TERMIOS_COOKED);
    t.iflags |= IFlags.IUCLC;
    t.lflags |= LFlags.IEXTEN;
    this._tty = new Tty(t);
    this._p = new Process(command, this._tty, this._tty, this._tty);
    //p.run([], {});
  }
  public onData(h: (data: string) => void): void {
    this._tty.onDataD(h);
    this._p.run([], {});
  }
  public write(data: string): boolean {
    return this._tty.writeFromDevice(data);
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
}


//const tty = new Tty(TERMIOS_COOKED);
//tty.writeD('hello\r\x03öäü');
//const pty = new Pty(FakeShell, [], {});

//pty.write('HELLO\r\x03ttt');
//setTimeout(() => {}, 3000);
