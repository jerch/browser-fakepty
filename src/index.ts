interface IDisposable {
  dispose(): void;
}

export interface IFakePtyOptions {
  cols?: number;
  rows?: number;
  cwd?: string;
  env?: {[key: string]: string};
  worker?: boolean;
}

export interface ReadPipe {
  on(event: 'data', cb: (data: Uint8Array | string) => void): void;
}

export interface WritePipe {
  write(data: Uint8Array | string): void;
}

export interface ProcessModule {
  platform: 'browser';
  stdin: ReadPipe;
  stdout: WritePipe;
  stderr: WritePipe;
  env: {[key: string]: string};
  cwd(): string;
  exit(code?: number): void;
  on(event: 'SIGWINCH', cb: () => void): void;
}

type ProcessMain = (args: string[], process: ProcessModule) => void;

// TODO...
class Process {
  public exitCode = -1;
  constructor(public main: (args: string[], processModule: ProcessModule) => number) {}
  public run(args: string[]): void {

  }
}

interface ITermios {
  iflags: {
    IGNBRK: true;
    BRKINT: false;
    ISTRIP: false;
    INLCR: boolean;
    IGNCR: boolean;
    ICRNL: boolean;
    IXON: boolean;
    IXANY: boolean;
    IXOFF: boolean;
    IMAXBEL: boolean;
    IUTF8: boolean;
  };
  oflags: {
    OPOST: boolean;
    ONLCR: boolean;
    OCRNL: boolean;
    ONOCR: boolean;
    ONLRET: boolean;
  };
  cflags: { /* none */ };
  lflags: {
    ISIG: boolean;
    ICANON: boolean;
    XCASE: false;
    ECHO: boolean;
    ECHOE: boolean;
    ECHOK: boolean;
    ECHONL: boolean;
    ECHOCTL: boolean;
    IEXTEN: boolean;
  };
  cc: {
    VEOF: 4,
    VEOL: 0,
    VEOL2: 0,
    VERASE: 8,
    VINTR: 3,
    VKILL: 21,
    VLNEXT: 22,
    VMIN: 1,
    VQUIT: 28,
    
  };
}

class FakeLdisc {
  private _buf = new Uint8Array(4096);
  private _cur = 0;
}

class FakePty {
  private _masterReadListener: ((data: Uint8Array | string) => void)[] = [];
  private _slaveReadListener: ((data: Uint8Array | string) => void)[] = [];
  private _signalListener: {[singal: string]: (() => void)[]} = {};
  private _cols: number;
  private _rows: number;
  private _cwd: string;
  private _env: {[key: string]: string};
  private _termios: any = {};  // TODO
  constructor(process: ProcessMain, args: string[], opts?: IFakePtyOptions) {
    this._cols = opts?.cols || 80;
    this._rows = opts?.rows || 25;
    this._cwd = opts?.cwd || '';
    this._env = opts?.env ? Object.assign({}, opts.env) : {};
    setTimeout(() => {
      try{
        process(
          args,
          {
            platform: 'browser',
            on: (event: 'SIGWINCH', callback: () => void) => {
                if (!this._signalListener[event]) {
                  this._signalListener[event] = [];
                }
                this._signalListener[event].push(callback);
            },
            stdin: {
              on: (event: 'data', callback: (data: Uint8Array | string) => void) => {
                if (event === 'data') {
                  this._slaveOnData(callback);
                }
              }
            },
            stdout: {
              write: (data: Uint8Array | string) => this._slaveWrite(data)
            },
            stderr: {
              write: (data: Uint8Array | string) => this._slaveWrite(data)
            },
            env: this._env,
            cwd: () => this._cwd,
            exit: (exitCode: number) => {
              throw new Error('exitCode:' + exitCode);
            }
          }
        );
      } catch (e) {
        if (e.message?.startsWith('exitCode:')) {
          this._slaveReadListener = [];
          this._masterReadListener = [];
        }
      };
    }, 0);
  }
  // master read
  public onData(callback: (data: Uint8Array | string) => void): IDisposable {
    this._masterReadListener.push(callback);
    return {
      dispose() {}
    }
  }
  // master write
  public write(data: Uint8Array | string): void {
    // termios rules
    if (typeof data === 'string') {
      // ONLCR
      data = data .replace(/\r/g, '\r\n');
      // VERASE in cooked mode
      data = data.replace(/\x7F/g, '\x08\x20\x08');
      // escape ESC
      data = data.replace(/\x1b/g, '^[');
    }
    for (let i = 0; i < this._slaveReadListener.length; ++i) {
      try {
        this._slaveReadListener[i](data);
      } catch (e) {
        if (e.message?.startsWith('exitCode:')) {
          this._slaveReadListener = [];
          this._masterReadListener = [];
        }
      }
    }
  }

  // how to solve blocking mode? some promise tricks possible?
  public pause(): void {}
  public resume(): void {}

  public kill(signal: 'SIGWINCH'): void {
    console.log(signal, this._signalListener[signal]);
    for (let i = 0; i < this._signalListener[signal]?.length; ++i) {
      this._signalListener[signal][i]();
    }
  }

  private _slaveOnData(callback: (data: Uint8Array | string) => void): IDisposable {
    this._slaveReadListener.push(callback);
    return {
      dispose() {}
    }
  }
  private _slaveWrite(data: Uint8Array | string): void {
    // write unmodified first
    for (let i = 0; i < this._masterReadListener.length; ++i) {
      this._masterReadListener[i](data);
    }
  }
}

export function spawn(process: ProcessMain, args: string[], opts: IFakePtyOptions): FakePty {
  return new FakePty(process, args, opts);
}


