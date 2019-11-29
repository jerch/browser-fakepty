export interface IPipe {
  close(): void;
  onClose(handler: () => void): IDisposable;
  getReader(): IPipeReader;
  getWriter(): IPipeWriter;
  pipeTo(pipes: IPipe[]): void;
  onDrain(handler: () => void): IDisposable;
  writable: boolean;
}

export interface IPipeReader {
  close(): void;
  onData(handler: (data: any) => void): IDisposable;
  pause(): void;
  resume(): void;
  handleChunk(data: any, callback: (success: boolean) => void): void;
}

export interface IPipeWriter {
  close(): void;
  write(data: any): boolean;
}

export interface IDisposable {
  dispose(): void;
}


const DISCARD_LIMIT = 100;
const MAX_LIMIT = 50;
const MIN_LIMIT = 20;


class PipeWriter implements IPipeWriter {
  private _closed = false;
  constructor(private _pipe: Pipe) {
    this._pipe.registerWriter(this);
  }
  public close(): void {
    this._pipe.removeWriter(this);
    this._closed = true;
  }
  public write(data: any): boolean {
    if (this._closed) throw new Error('writer already closed');
    return this._pipe.insertData(data);
  }
}


export class PipeReader implements IPipeReader {
  private _paused = true;
  private _closed = false;
  private _pendingRead = false;
  private _handlers: ((data: any) => void)[] = [];
  private _chunk: any | null = null;
  private _cb: ((sucess: boolean) => void) | null = null;
  constructor(private _pipe: Pipe) {
    this._pipe.registerReader(this);
  }
  public close(): void {
    this._pipe.removeReader(this);
    this._closed = true;
    if (!this._pendingRead) {
      this._handlers.length = 0;
    }
  }
  public onData(handler: (data: any) => void): IDisposable {
    if (this._closed) throw new Error('reader already closed');
    const handlers = this._handlers;
    handlers.push(handler);
    this.resume();
    return {
      dispose: () => {
        const idx = handlers.indexOf(handler);
        if (~idx) handlers.splice(idx, 1);
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
  public handleChunk(data: any, callback: (success: boolean) => void): void {
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
          this._handlers.length = 0;
        }
        callback(true);
      }
      return;
    }
    callback(false);
  }
}


export class Pipe implements IPipe {
  private _writers: IPipeWriter[] = [];
  private _readers: IPipeReader[] = [];
  private _closeHandlers: (() => void)[] = [];
  private _drainHandlers: (() => void)[] = [];
  private _buf: any[] = [];
  public closed = false;
  public writable = true;
  private _pending = false;

  constructor() {}

  private _cleanup(): void {
    this._writers.length = 0;
    this._readers.length = 0;
    this._drainHandlers.length = 0;
    this._buf = [];
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
    if (this.closed) throw new Error('pipe already closed');
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

  public getReader(): IPipeReader {
    if (this.closed) throw new Error('pipe already closed');
    return new PipeReader(this);
  }

  public getWriter(): IPipeWriter {
    if (this.closed) throw new Error('pipe already closed');
    return new PipeWriter(this);
  }

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


  private _handle(): void {
    this._pending = false;
    if (this.closed || !this._buf.length) return;
    this._pending = true;

    const data = this._buf.shift();

    // handle single chunk in readers as promise setTimeout chain
    Promise.all(this._readers.slice().map(el => new Promise(resolve => el.handleChunk(data, resolve)))).then(
      () => { if (this._buf.length) setTimeout(() => this._handle(), 0); else this._pending = false; },
      () => { if (this._buf.length) setTimeout(() => this._handle(), 0); else this._pending = false; }
    );

    // update writable flag
    const w = this.writable;
    if (!w) {
      this.writable = this._buf.length <= MIN_LIMIT;
      if (this.writable) {
        // drain if we fall below MIN_LIMIT
        const handlers = this._drainHandlers.slice();
        for (let i = 0; i < handlers.length; ++i) {
          // retest writable in case a handler already filled up everything again
          if (this.writable) {
            handlers[i]();
          }
        }
      }
    }
  }

  public insertData(data: any): boolean {
    if (this.closed || this._buf.length > DISCARD_LIMIT) {
      this.writable = false;
      throw new Error('discarding write data');
    }

    // place data and schedule processing
    this._buf.push(data);
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

  public registerReader(r: IPipeReader): void {
    this._readers.push(r);
    this.onClose(() => r.close());
  }
  public registerWriter(w: IPipeWriter): void {
    this._writers.push(w);
    this.onClose(() => w.close());
  }
  public removeReader(r: IPipeReader): void {
    const idx = this._readers.indexOf(r);
    if (~idx) {
      this._readers.splice(idx, 1);
      // last reader gone
      if (!this._readers.length && !this.closed) {
        this.close();
      }
    }
  }
  public removeWriter(w: IPipeWriter): void {
    const idx = this._writers.indexOf(w);
    if (~idx) {
      this._writers.splice(idx, 1);
      // last writer gone
      if (!this._writers.length && !this._buf.length && !this.closed) {
        this.close();
      }
    }
  }
}

export function getLogPipe() {
  const pipe = new Pipe();
  const reader = pipe.getReader();
  reader.onData(data => console.log(data));
  return pipe;
}
