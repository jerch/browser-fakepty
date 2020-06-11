import { higherPower2 } from './Helper';

export class BlockBuffer {
  public data: Uint8Array;
  public data32: Uint32Array;
  public mask: number;
  public mask32: number;
  public cursor = 0;

  constructor(size: number) {
    const space = higherPower2(size);
    this.data = new Uint8Array(space);
    this.data32 = new Uint32Array(this.data.buffer);
    this.mask = space - 1;
    this.mask32 = this.mask >> 2;
  }

  public writeByte(value: number): boolean {
    if (this.cursor < this.data.length) {
      this.data[this.cursor++] = value;
      return true;
    }
    return false;
  }

  public write(buf: ArrayBuffer, offset: number, length: number): number {
    return 0;
  }

  public reset(): void {
    this.cursor = 0;
  }

  public read(buf: ArrayBuffer, offset: number, length: number): number {
    if (!this.cursor) return 0;

  }
}
