/**
 * Simple helper functions to get minimal support for locale LC_CTYPE classifications.
 */
import * as cases from './casemappings.json';

function b64ToBuf(s: string): ArrayBuffer {
  var decoded = (typeof atob !== 'undefined') ? atob(s) : Buffer.from(s, 'base64').toString('binary');
  var len = decoded.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
      bytes[i] = decoded.charCodeAt(i);
  }
  return bytes.buffer;
}

function insertMapping(data: ArrayLike<number>, target: Map<number, number>, reverse: number): any {
  for (let i = 0; i < data.length; i += 2) {
    target.set(data[i + reverse], data[i + +!reverse]);
  }
}

/**
 * case mappings to provide a simple toLower / toUpper implmentation
 * 
 * The case mappings were created with bin/casemapper.py in python for the full unicode range.
 * Python was used since it turned out, that toUpperCase() in JS does some weird stuff with
 * multi codepoint replaces, which is hard to handle correctly in a terminal env, while
 * Python uses the system's locale settings and never switches bitwidth or codepoint length.
 */
const UPPERS: Map<number, number> = new Map();
const LOWERS: Map<number, number> = new Map();

insertMapping(new Uint16Array(b64ToBuf(cases.BMP.EQUAL)), UPPERS, 0);
insertMapping(new Uint16Array(b64ToBuf(cases.BMP.EQUAL)), LOWERS, 1);
insertMapping(new Uint16Array(b64ToBuf(cases.BMP.UPPER)), UPPERS, 0);
insertMapping(new Uint16Array(b64ToBuf(cases.BMP.LOWER)), LOWERS, 0);
insertMapping(new Uint32Array(b64ToBuf(cases.HIGH.EQUAL)), UPPERS, 0);
insertMapping(new Uint32Array(b64ToBuf(cases.HIGH.EQUAL)), LOWERS, 1);
insertMapping(new Uint32Array(b64ToBuf(cases.HIGH.UPPER)), UPPERS, 0);
insertMapping(new Uint32Array(b64ToBuf(cases.HIGH.LOWER)), LOWERS, 0);


/**
 * Convert `codepoint` (unicode) to lower case if possible.
 */
export function toLower(codepoint: number): number {
  return LOWERS.get(codepoint) || codepoint;
}
/**
 * Convert `codepoint` (unicode) to upper case if possible.
 */
export function toUpper(codepoint: number): number {
  return UPPERS.get(codepoint) || codepoint;
}
