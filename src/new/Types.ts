import { POLL_EVENTS, IOpenFlags, PIPE_CTL } from './Constants';


export interface IDisposable {
  dispose(): void;
}

export interface IPipePort {
  isReader: boolean;
  isWriter: boolean;
  closed: boolean;
  flags: IOpenFlags;

  // C like interface
  read(target: Uint8Array): Promise<number>;
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

export interface IFasterPipePort {
  isReader: boolean;
  isWriter: boolean;
  closed: boolean;
  flags: IOpenFlags;

  // I/O interface
  read(buf: ArrayBuffer, offset: number, length: number, callback: (count: number, error?: any) => void): number | null;
  write(buf: ArrayBuffer, offset: number, length: number, callback: (count: number, error?: any) => void): number;

  // kernel interface
  dup(flags?: IOpenFlags): IFasterPipePort;
  ctl(type: PIPE_CTL, ...args: any[]): any;
  poll(events: POLL_EVENTS): POLL_EVENTS;
  close(): number;
  lseek(offset: number, whence: any): number;
}

export interface IDeferredChunk {
  initialLength: number;
  buf: ArrayBuffer;
  offset: number;
  length: number;
  callback: (count: number | null, error?: any) => void;
}
