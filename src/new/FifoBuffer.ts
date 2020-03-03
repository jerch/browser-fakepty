import { higherPower2 } from './Helper';
import { MEMORY_VIEW8, MEMORY_VIEW32 } from './Pools';

/**
 * Binary fifo buffer, used as immediately available pipe buffer.
 * The size should be a power of 2 (gets automatically rounded up).
 * 
 * Note: `write` and `read` do no bound checks for provided offsets.
 */
export class FifoBuffer {
  public data: Uint8Array;
  public data32: Uint32Array;
  public mask: number;
  public mask32: number;
  public rCur: number = 0;
  public wCur: number = 0;
  public size: number = 0;

  constructor(size: number) {
    const space = higherPower2(size);
    this.data = new Uint8Array(space);
    this.data32 = new Uint32Array(this.data.buffer);
    this.mask = space - 1;
    this.mask32 = this.mask >> 2;
  }

  public get space(): number {
    return this.data.length - this .size;
  }

  private _write8(data8: Uint8Array, offset: number, length: number): number {
    const end = offset + length;
    for (let i = offset; i < end; ++i) {
      this.data[this.wCur++] = data8[i];
      this.wCur &= this.mask;
    }
    this.size += length;
    return length;
  }
  //private _write32(data32: Uint32Array): number {
  //  let wCur = this.wCur >> 2;
  //  for (let i = 0; i < data32.length; ++i) {
  //    this.data32[wCur++] = data32[i];
  //    wCur &= this.mask32;
  //  }
  //  this.size += data32.length << 2;
  //  this.wCur = wCur << 2;
  //  return data32.length << 2;
  //}
  private _write32_2(data32: Uint32Array, offset: number, length: number): number {
    let wCur = this.wCur >>> 2;
    const end = (offset + length) >>> 2;
    for (let i = offset >>> 2; i < end; ++i) {
      this.data32[wCur++] = data32[i];
      wCur &= this.mask32;
    }
    this.size += length;
    this.wCur = wCur << 2;
    return length;
  }
  public write(buf: ArrayBuffer, offset: number, length: number): number {
    const count = Math.min(length, this.data.length - this.size);
    if (!count) return 0;
    if ((count & 3) || (this.wCur & 3) || (offset & 3)) {
      return this._write8(MEMORY_VIEW8.get(buf), offset, count);
    }
    //return this._write32(new Uint32Array(buf, offset, count >> 2));
    return this._write32_2(MEMORY_VIEW32.get(buf), offset, count);
  }

  private _read8(data8: Uint8Array, offset: number, length: number): number {
    const end = offset + length;
    for (let i = offset; i < end; ++i) {
      data8[i] = this.data[this.rCur++];
      this.rCur &= this.mask;
    }
    this.size -= length;
    return length;
  }
  //private _read32(data32: Uint32Array): number {
  //  let rCur = this.rCur >> 2;
  //  for (let i = 0; i < data32.length; ++i) {
  //    data32[i] = this.data32[rCur++];
  //    rCur &= this.mask32;
  //  }
  //  this.size -= data32.length << 2;
  //  this.rCur = rCur << 2;
  //  return data32.length << 2;
  //}
  private _read32_2(data32: Uint32Array, offset: number, length: number): number {
    let rCur = this.rCur >>> 2;
    const end = (offset + length) >>> 2;
    for (let i = offset >>> 2; i < end; ++i) {
      data32[i] = this.data32[rCur++];
      rCur &= this.mask32;
    }
    this.size -= length;
    this.rCur = rCur << 2;
    return length;
  }
  public read(buf: ArrayBuffer, offset: number, length: number): number {
    const count = Math.min(length, this.size);
    if (!count) return 0;
    if ((count & 3) || (this.rCur & 3) || (offset & 3)) {
      return this._read8(MEMORY_VIEW8.get(buf), offset, count);
    }
    // return this._read32(new Uint32Array(buf, offset, count >> 2));
    return this._read32_2(MEMORY_VIEW32.get(buf), offset, count);
  }

  public writeByte(value: number): boolean {
    if (this.size < this.data.length) {
      this.data[this.wCur++] = value;
      this.wCur &= this.mask;
      this.size++;
      return true;
    }
    return false;
  }
  public readByte(): number {
    if (this.size) {
      const value = this.data[this.rCur++];
      this.rCur &= this.mask;
      this.size--;
      return value;
    }
    return -1;
  }
}
