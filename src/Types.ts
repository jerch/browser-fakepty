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

export interface IEvent<T, U = void> {
  (listener: (arg1: T, arg2: U) => any): IDisposable;
}

export interface IEventEmitter<T, U = void> {
  event: IEvent<T, U>;
  fire(arg1: T, arg2: U): void;
  dispose(): void;
}


export interface ILineDiscipline {
  // settings
  settings: {[key: string]: any};
  // line interface
  recvL(data: string): boolean; // line incomming
  registerLineReceiver(handler: (data: string) => void): void; // line outgoing
  // pipe interface
  recvP(data: string): void; // process incomming
  registerProcessReceiver(handler: (data: string) => void): void; // pipe outgoing
}
