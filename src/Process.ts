import { Pipe, IPipeReader, IPipeWriter, IDisposable, IPipe } from './Pipe';

export type ProcessMain = (args: any[], process: ProcessModule) => void;

interface ProcessModule {
  stdin: IPipeReader;
  stdout: IPipeWriter;
  stderr: IPipeWriter;
  exit(): void;
  onExit(handler: () => void): IDisposable;
  environ: {[key: string]: string};
}

export class Process {
  private _exitHandlers: (() => void)[] = [];
  private _cleanupHandlers: (() => void)[] = [];
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
      environ,
      exit: () => this.exit(),
      onExit: (handler: () => void) => this.onExit(handler)
    });
  }
  public onExit(handler: () => void): IDisposable {
    this._exitHandlers.push(handler);
    return {
      dispose: () => {
        const idx = this._exitHandlers.indexOf(handler);
        if (~idx) this._exitHandlers.splice(idx, 1);
      }
    }
  }
  public exit(): void {
    this._exit();
  }
  public _exit(): void {
    let exitHandler: () => void;
    while ((exitHandler = this._exitHandlers.shift())) {
      try { exitHandler(); } catch (e) {}
    }
    this.stdin.close();
    this.stdout.close();
    this.stderr.close();
    setTimeout(() => this._afterExit(), 50); // run somewhat in the future
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
