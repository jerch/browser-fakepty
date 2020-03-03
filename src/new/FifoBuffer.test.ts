import { assert } from 'chai';
import { FifoBuffer } from './FifoBuffer';

describe('FifoBuffer', () => {
  let fb: FifoBuffer;
  beforeEach(() => {
    fb = new FifoBuffer(16);
  });
  it('allocation is always 2^n', () => {
    fb = new FifoBuffer(16); assert.equal(fb.data.length, 16); assert.equal(fb.mask, 16 - 1);
    fb = new FifoBuffer(20); assert.equal(fb.data.length, 32); assert.equal(fb.mask, 32 - 1);
    fb = new FifoBuffer(31); assert.equal(fb.data.length, 32); assert.equal(fb.mask, 32 - 1);
    fb = new FifoBuffer(32); assert.equal(fb.data.length, 32); assert.equal(fb.mask, 32 - 1);
    fb = new FifoBuffer(33); assert.equal(fb.data.length, 64); assert.equal(fb.mask, 64 - 1);
    fb = new FifoBuffer(4000); assert.equal(fb.data.length, 4096); assert.equal(fb.mask, 4096 - 1);
  });
  it('writeByte', () => {
    for (let i = 0; i < 20; ++i) {
      assert.equal(fb.size, i < 16 ? i : 16);
      assert.equal(fb.wCur, i < 16 ? i : 0);
      assert.equal(fb.space, i < 16 ? 16 - i : 0);
      assert.equal(fb.writeByte(i), i < 16 ? true : false);
    }
    assert.deepEqual(fb.data, new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]));
  });
  it('readByte', () => {
    fb.write(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]).buffer, 0, 16);
    for (let i = 0; i < 20; ++i) {
      assert.equal(fb.size, i < 16 ? 16 - i : 0);
      assert.equal(fb.rCur, i < 16 ? i : 0);
      assert.equal(fb.space, i < 16 ? i : 16);
      assert.equal(fb.readByte(), i < 16 ? i : -1);
    }
  });
  describe('write', () => {
    it('single write', () => {
      const data = [1, 2, 3];
      const bytes = new Uint8Array([1,2,3]);
      const written = fb.write(bytes.buffer, 0, bytes.length);
      assert.equal(written, 3);
      assert.equal(fb.size, 3);
      assert.equal(fb.rCur, 0);
      assert.equal(fb.wCur, 3);
      assert.deepEqual(Array.from(fb.data.subarray(0, 3)), data);
    });
    it('multiple writes', () => {
      const data = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12], [13, 14, 15]];
      for (let i = 0; i < data.length; ++i) {
        const chunk = data[i];
        const bytes = new Uint8Array(chunk);
        const written = fb.write(bytes.buffer, 0, bytes.length);
        assert.equal(written, 3);
        assert.equal(fb.size, (i + 1) * 3);
        assert.equal(fb.rCur, 0);
        assert.equal(fb.wCur, (i + 1) * 3);
      }
      const bytes = new Uint8Array([16, 17, 18]);
      const written = fb.write(bytes.buffer, 0, bytes.length);
      assert.equal(written, 1);
      assert.equal(fb.size, 16);
      assert.equal(fb.rCur, 0);
      assert.equal(fb.wCur, 0);
      const written2 = fb.write(bytes.buffer, 0, bytes.length);
      assert.equal(written2, 0);
      assert.deepEqual(Array.from(fb.data), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    });
    it('offset write', () => {
      const data = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
      const bytes = new Uint8Array(data);
      let written = fb.write(bytes.buffer, 14, 2);
      assert.equal(written, 2);
      assert.equal(fb.size, 2);
      written = fb.write(bytes.buffer, 0, 6);
      assert.equal(written, 6);
      assert.equal(fb.size, 8);
      written = fb.write(bytes.buffer, 3, 13);
      assert.equal(written, 8);
      assert.equal(fb.size, 16);
      assert.deepEqual(Array.from(fb.data), [14, 15, 0, 1, 2, 3, 4, 5, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
  });
  describe('read', () => {
    it('multiple reads', () => {
      const data = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
      const wbytes = new Uint8Array(data);
      fb.write(wbytes.buffer, 0, wbytes.length);
      const dataRead: number[] = [];
      const rbytes = new Uint8Array(3);
      for (let i = 0; i < 5; ++i) {
        const count = fb.read(rbytes.buffer, 0, rbytes.length);
        dataRead.push(...rbytes);
        assert.equal(count, 3);
        assert.equal(fb.size, 16 - (i + 1) * 3);
        assert.equal(fb.rCur, (i + 1) * 3);
        assert.equal(fb.wCur, 0);
      }
      const count = fb.read(rbytes.buffer, 0, rbytes.length);
      dataRead.push(rbytes[0]);
      assert.equal(count, 1);
      assert.equal(fb.size, 0);
      assert.equal(fb.rCur, 0);
      assert.equal(fb.wCur, 0);
      const count2 = fb.read(rbytes.buffer, 0, rbytes.length);
      assert.equal(count2, 0);
      assert.deepEqual(dataRead, data);
    });
    it('offset read', () => {
      const data = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
      const bytes = new Uint8Array(data);
      fb.write(bytes.buffer, 0, bytes.length);
      bytes.fill(255);
      let count = fb.read(bytes.buffer, 14, 2);
      assert.equal(count, 2);
      assert.equal(fb.size, 14);
      count = fb.read(bytes.buffer, 0, 6);
      assert.equal(count, 6);
      assert.equal(fb.size, 8);
      count = fb.read(bytes.buffer, 3, 13);
      assert.equal(count, 8);
      assert.equal(fb.size, 0);
      assert.deepEqual(Array.from(bytes), [2, 3, 4, 8, 9, 10, 11, 12, 13, 14, 15, 255, 255, 255, 0, 1]);
    });
  });
  it('random write/read', () => {
    // monte carlo testing: test random arbitrary writes/reads
    const NUMS = 10000;
    for (let i = 0; i < 100; ++i) {
      const data = new Uint16Array(NUMS);
      for (let i = 0; i < data.length; ++i) data[i] = i;
      const input = new Uint8Array(data.buffer);
      const target = new Uint8Array(input.length);
      let wCount = 0;
      let rCount = 0;
      fb = new FifoBuffer(64);
      while (wCount < input.length) {
        wCount += fb.write(input.buffer, wCount, Math.min((Math.random() * 32 + 3) | 0, input.length - wCount));
        if (fb.size === fb.data.length || Math.random() > 0.2) {
          while (Math.random() < 0.7) {
            rCount += fb.read(target.buffer, rCount, (Math.random() * 32 + 3) | 0);
          }
        }
      }
      rCount += fb.read(target.buffer, rCount, target.length - rCount);
      assert.deepEqual(input, target);
    }
  });
});
