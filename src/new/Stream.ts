import { IPipePort } from './Types';
import { ERRNO } from './errno';
import { IEncoder, Encoding, getEncoder } from './Encoding';

interface IWritableOptions {
  highWaterMark: number;
  decodeStrings: boolean;
  defaultEncoding: Encoding;
  objectMode: false;  // not implemented
  emitClose: boolean;
  // write: Function;
  // writev: Function;
  // destroy: Function;
  // final: Function;
  // autoDestroy: boolean;
}
interface IReadableOptions {
  highWaterMark: number;
  encoding: Encoding;
  objectMode: false;  // not implemented
  emitClose: boolean;
  // read: Function;
  // destroy: Function;
  // autoDestroy: boolean;
}
const WRITABLE_OPTIONS_DEFAULT: IWritableOptions = {
  highWaterMark: 1024,
  decodeStrings: true,
  defaultEncoding: 'utf8',
  objectMode: false,
  emitClose: true
}
const READABLE_OPTIONS_DEFAULT: IReadableOptions = {
  highWaterMark: 1024,
  encoding: null,
  objectMode: false,
  emitClose: true
}



// ANSI C - should be at least 256
const BUFSIZ = 1024;
const enum BufMode {
  /**
   * Full buffering: On output, data is written once the buffer is full (or flushed).
   * On Input, the buffer is filled when an input operation is requested and the buffer is empty.
   */
  IOFBF,
  /**
   * Line buffering: On output, data is written when a newline character is inserted into the stream
   * or when the buffer is full (or flushed), whatever happens first. On Input, the buffer is filled up
   * to the next newline character when an input operation is requested and the buffer is empty.
   */
  IOLBF,
  /**
   * No buffering: No buffer is used. Each I/O operation is written as soon as possible.
   * In this case, the buffer and size parameters are ignored.
   */
  IONBF
}

interface IWStreamOptions {
  bufferSize: number;
  textMode: boolean;
  encoding: Encoding;
}
const WSTREAM_OPTIONS_DEFAULT: IWStreamOptions = {
  bufferSize: BUFSIZ,
  textMode: false,
  encoding: 'utf8'
};


export class WStream {
  private _buffer: Uint8Array | null;
  private _bufferMode: BufMode;
  private _stringBuffer: string = '';
  private _stringLimit = 10;
  private _encoder: IEncoder | null = getEncoder('utf8');
  constructor(public port: IPipePort) {
    if (!port.isWriter) throw new Error('port must be writable');
  }

  public write(data: Uint8Array | string, encoding?: Encoding): Promise<number> {
    // if data is bytes --> encode string buffer first, append bytes
    // if data is string --> fillup string buffer

    switch (this._bufferMode) {
      case BufMode.IOFBF:
        
        break;
      case BufMode.IOLBF:
        break;
      default:
        
    }
    return Promise.resolve(0);


/*
    const bytes = (typeof data === 'string')
      ? (encoding === undefined ? this._encoder : getEncoder(encoding)).encode(data)
      : data;
    
    if (this._bufferMode === BufMode.IOFBF) {
      if (this._buffer.length - this._bufPos >= bytes.length) {
        for (let i = 0; i < bytes.length; ++i) this._buffer[this._bufPos++] = bytes[i];
        return Promise.resolve(bytes.length);
      } else {
        return this.flush().then(_ => {
          if (bytes.length < (this._buffer.length >> 1)) {
            for (let i = 0; i < bytes.length; ++i) this._buffer[this._bufPos++] = bytes[i];
            return Promise.resolve(bytes.length);
          }
          return this.pipe.write(bytes.buffer, bytes.byteOffset, bytes.length);
        });
      }
    }
    if (this._bufferMode === BufMode.IOLBF) {
      // TODO...
      return Promise.reject({error: ERRNO.ENOSYS});
    }
    return this.pipe.write(bytes.buffer, bytes.byteOffset, bytes.length);
    */
  }

  public setvbuf(mode: BufMode, buffer: Uint8Array | null = null): Promise<number> {
    return this.flush().then(_ => {
      this._bufferMode = mode;
      this._buffer = buffer;
      return 0;
    });
  }

  public flush(): Promise<number> {
    return Promise.resolve(0);
  }
}




















export class Writable {
  constructor(options: Partial<IWritableOptions>) {
    const opts = Object.assign({}, options, WRITABLE_OPTIONS_DEFAULT);
  }
  public onClose(): void {}
  public onDrain(): void {}
  public onError(): void {}
  public onFinish(): void {}
  public onPipe(): void {}
  public onUnpipe(): void {}

  public cork(): void {}
  public destroy(error: any): void {}
  public destroyed: boolean;
  public end(chunk?: any, encoding?: Encoding, callback?: Function): void {}
  public setDefaultEncoding(encoding: Encoding): void {}
  public uncork(): void {}
  public writable: boolean;
  public writableEnded: boolean;
  public writableCorked: boolean;
  public writableFinished: boolean;
  public writableHighWaterMark: number;
  public writableLength: number;
  public writableObjectMode: boolean;
  public write(chunk: any, encoding?: Encoding, callback?: Function): void {}
}

export class Readable {
  constructor(options: Partial<IReadableOptions>) {
    const opts = Object.assign({}, options, READABLE_OPTIONS_DEFAULT);
  }
}
