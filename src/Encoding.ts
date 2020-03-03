import { Encoder, Decoder } from './utf8';

/**
 * Various string <--> byte encodings (Uint8Array). 
 */

// interfaces
export interface IEncoder {
  encode(input: string): Uint8Array;
}
export interface IDecoder {
  decode(input: Uint8Array, opts?: any): string;
}

// utf8
export const Utf8Encoder = Encoder;   // string --> bytes
export const Utf8Decoder = Decoder;   // bytes  --> string

// ascii
export class AsciiEncoder {
  encode(input: string): Uint8Array {
    const result = new Uint8Array(input.length);
    for (let i = 0; i < input.length; ++i) result[i] = input.charCodeAt(i) & 0x7F;
    return result;
  }
}
export class AsciiDecoder {
  decode(input: Uint8Array): string {
    let result = '';
    for (let i = 0; i < input.length; ++i) result += String.fromCharCode(input[i]);
    return result;
  }
}

// binary
export class BinaryEncoder {
  encode(input: string): Uint8Array {
    const result = new Uint8Array(input.length);
    for (let i = 0; i < input.length; ++i) result[i] = input.charCodeAt(i) & 0xFF;
    return result;
  }
}
export class BinaryDecoder {
  decode(input: Uint8Array): string {
    let result = '';
    for (let i = 0; i < input.length; ++i) result += String.fromCharCode(input[i]);
    return result;
  }
}
