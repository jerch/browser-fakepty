/**
 * Various string <--> byte encodings (Uint8Array). 
 */

// types and interfaces

export type Encoding = 'utf8' | 'binary' | 'ascii' | null;

export interface IReadWriteCounter {
  read: number;
  written: number;
}
export interface IEncoder {
  encode(input: string): Uint8Array;
  encodeTo(input: string, target: Uint8Array, offset: number, counter: IReadWriteCounter): void;
}
export interface IDecoder {
  decode(input: Uint8Array, opts?: any): string;
}


// utf8
export class Utf8Encoder implements IEncoder {
  private _counter: IReadWriteCounter = {read: 0, written: 0};
  public encode(input: string): Uint8Array {
    const target = new Uint8Array(input.length * 3 + 4);
    this.encodeTo(input, target, 0, this._counter);
    return target.slice(0, this._counter.written);  // FIXME: why is slice faster than subarray here?
  }
  public encodeTo(input: string, target: Uint8Array, offset: number, counter: IReadWriteCounter): void {
    let read = 0;
    let written = offset;
    const writeEnd = target.length - 4;
    while (read < input.length && written < writeEnd) {
      let cp = input.charCodeAt(read++);
      if (cp >= 0xD800 && cp <= 0xDBFF) {
        if (read === input.length) {
          target[written++] = 0xef;
          target[written++] = 0xbf;
          target[written++] = 0xbd;
          break;
        }
        const next = input.charCodeAt(read++);
        if (next < 0xDC00 || next > 0xDFFF) {
          target[written++] = 0xef;
          target[written++] = 0xbf;
          target[written++] = 0xbd;
          continue;
        }
        // 4 bytes
        cp = (cp - 0xD800) * 0x400 + next - 0xDC00 + 0x10000;
        target[written++] = cp >>> 18 | 0xF0;
        target[written++] = cp >>> 12 & 0x3F | 0x80;
        target[written++] = cp >>> 6 & 0x3F | 0x80;
        target[written++] = cp & 0x3F | 0x80;
        continue;
      }
      if (cp < 0x80) {
        // 1 byte
        target[written++] = cp;
      } else if (cp < 0x800) {
        // 2 bytes
        target[written++] = cp >>> 6 | 0xC0;
        target[written++] = cp & 0x3F | 0x80;
      } else {
        // 3 bytes
        target[written++] = cp >>> 12 | 0xE0;
        target[written++] = cp >>> 6 & 0x3F | 0x80;
        target[written++] = cp & 0x3F | 0x80;
      }
    }
    counter.read = read;
    counter.written = written - offset;
  }
}

export const Utf8EncoderOld = (typeof TextEncoder=== 'undefined') ? require('util').TextEncoder : TextEncoder;   // string --> bytes
export const Utf8Decoder = (typeof TextDecoder === 'undefined') ? require('util').TextDecoder : TextDecoder;  // bytes  --> string

// ascii
export class AsciiEncoder implements IEncoder {
  public encode(input: string): Uint8Array {
    const result = new Uint8Array(input.length);
    for (let i = 0; i < input.length; ++i) result[i] = input.charCodeAt(i) & 0x7F;
    return result;
  }
  public encodeTo(input: string, target: Uint8Array, offset: number, counter: IReadWriteCounter): void {
    let read = 0;
    let written = offset;
    const end = Math.min(input.length, target.length - offset);
    while (read < end) {
      target[written++] = input.charCodeAt(read++) & 0x7F;
    }
    counter.read = read;
    counter.written = written - offset;
  }
}
export class AsciiDecoder {
  public decode(input: Uint8Array): string {
    let result = '';
    for (let i = 0; i < input.length; ++i) result += String.fromCharCode(input[i]);
    return result;
  }
}

// binary
export class BinaryEncoder implements IEncoder {
  public encode(input: string): Uint8Array {
    const result = new Uint8Array(input.length);
    for (let i = 0; i < input.length; ++i) result[i] = input.charCodeAt(i) & 0xFF;
    return result;
  }
  public encodeTo(input: string, target: Uint8Array, offset: number, counter: IReadWriteCounter): void {
    let read = 0;
    let written = offset;
    const end = Math.min(input.length, target.length - offset);
    while (read < end) {
      target[written++] = input.charCodeAt(read++) & 0xFF;
    }
    counter.read = read;
    counter.written = written - offset;
  }
}
export class BinaryDecoder {
  public decode(input: Uint8Array): string {
    let result = '';
    for (let i = 0; i < input.length; ++i) result += String.fromCharCode(input[i]);
    return result;
  }
}


// null
export class NullEncoder implements IEncoder {
  public encode(input: string): Uint8Array {
    throw new Error('no string encoding set');
  }
  public encodeTo(input: string, target: Uint8Array, offset: number, counter: IReadWriteCounter): void {
    throw new Error('no string encoding set');
  }
}
export class NullDecoder implements IDecoder {
  public decode(input: Uint8Array): string {
    throw new Error('no string encoding set');
  }
}


export function getEncoder(encoding: Encoding): IEncoder {
  switch (encoding) {
    case 'utf8': return new Utf8Encoder();
    case 'ascii': return new AsciiEncoder();
    case 'binary': return new BinaryEncoder();
    case null: return new NullEncoder();
    default: throw new Error(`unsupported encoding "${encoding}"`);
  }
}

export function getDecoder(encoding: Encoding): IDecoder {
  switch (encoding) {
    case 'utf8': return new Utf8Decoder();
    case 'ascii': return new AsciiDecoder();
    case 'binary': return new BinaryDecoder();
    case null: return new NullDecoder();
    default: throw new Error(`unsupported encoding "${encoding}"`);
  }
}
