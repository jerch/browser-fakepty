import { Pipe, IPipeReader, IPipeWriter, IDisposable, IPipe } from './Pipe';

export type ProcessMain = (args: any[], process: ProcessModule) => void;

interface ProcessModule {
  stdin: IPipeReader;
  stdout: IPipeWriter;
  stderr: IPipeWriter;
  exit(statusCode?: number): void;
  onExit(handler: () => void): IDisposable;
  env: {[key: string]: string};
}

export class Process {
  private _exitHandlers: ((statusCode: number) => void)[] = [];
  private _cleanupHandlers: (() => void)[] = [];
  public statusCode = -1;
  public stdin: IPipeReader;
  public stdout: IPipeWriter;
  public stderr: IPipeWriter;
  constructor(private _runner: ProcessMain, private _stdin: IPipe, private _stdout: IPipe, private _stderr: IPipe) {
    this.stdin = this._stdin.getReader();
    this.stdout = this._stdout.getWriter();
    this.stderr = this._stderr.getWriter();
  }
  public run(args: any[], environ: {[key: string]: string}) {
    this._stdin.onClose(() => this.exit());
    this._stdout.onClose(() => this.exit());
    this._runner(args, {
      stdin: this.stdin,
      stdout: this.stdout,
      stderr: this.stderr,
      env: {...environ},
      exit: (statusCode: number = 0) => this.exit(statusCode),
      onExit: (handler: (statusCode: number) => void) => this.onExit(handler)
    });
  }
  public onExit(handler: (statusCode: number) => void): IDisposable {
    this._exitHandlers.push(handler);
    return {
      dispose: () => {
        const idx = this._exitHandlers.indexOf(handler);
        if (~idx) this._exitHandlers.splice(idx, 1);
      }
    }
  }
  public exit(statusCode: number = 0): void {
    setTimeout(() => this._exit(statusCode), 0);
  }
  public _exit(statusCode: number): void {
    this.statusCode = statusCode;
    let exitHandler: (statusCode: number) => void;
    while ((exitHandler = this._exitHandlers.shift())) {
      try { exitHandler(statusCode); } catch (e) {}
    }
    this.stdin.close();
    this.stdout.close();
    this.stderr.close();
    setTimeout(() => this._afterExit(), 0);
  }
  public afterExit(handler: () => void): IDisposable {
    this._cleanupHandlers.push(handler);
    return {
      dispose: () => {
        const idx = this._cleanupHandlers.indexOf(handler);
        if (~idx) this._cleanupHandlers.splice(idx, 1);
      }
    }
  }
  private _afterExit(): void {
    let cleanupHandler: () => void;
    while ((cleanupHandler = this._cleanupHandlers.shift())) {
      cleanupHandler();
    }
  }
}
