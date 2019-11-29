import { ProcessModule } from '.';
//import * as minimist from 'minimist';
import minimist from 'minimist';


// cat like
export function cat(args: string[], process: ProcessModule): void {
  //process.stdout.write(minimist(args));
  console.log(minimist(args));

  //process.stdin.on('data', data => {
  //  process.stdout.write(data);
  //});
}

/**
 * Fifo
 * Handles synchronous fifo logic of OsPipe.
 */
class Fifo {
  public data: Uint8Array;
  public readCur: number = 0;
  public writeCur: number = 0;
  public size: number = 0;
  constructor(size: number) {
    this.data = new Uint8Array(size);
  }
  public get space(): number {
    return this.data.length - this.size;
  }
  public write(data: Uint8Array, start: number = 0, length: number = data.length): boolean {
    if (length > this.data.length) {
      return false;
    }
    const end = start + length;
    for (let i = start; i < end; ++i) {
      this.data[this.writeCur++] = data[i];
      if (this.writeCur >= this.data.length) {
        this.writeCur = 0;
      }
    }
    this.size += length;
    return true;
  }
  public read(target: Uint8Array, offset: number = 0, length: number = Math.min(this.size, target.length)): boolean {
    if (length > this.size) {
      return false;
    }
    for (let i = 0; i < length; ++i) {
      target[offset++] = this.data[this.readCur++];
      if (this.readCur >= this.data.length) {
        this.readCur = 0;
      }
    }
    this.size -= length;
    return true;
  }
}

// unidirectional pipe for interprocess communication
/**
 * Os Pipe
 * TODO:
 * - state handling:
 *    - allow writes up to limit at beginning w'o reader
 *    - see https://linux.die.net/man/7/pipe
 */
const REJECT_LIMIT = 16384;
const MAX_ENTRIES = 10;
const FIFO_SIZE = 4096;
class OsPipe {
  private _fifo = new Fifo(FIFO_SIZE);
  private _buf: Uint8Array[] = [];
  private _cbs: (() => void)[] = [];
  private _pos = 0;
  private _chunkOffset = 0;
  private _pending = 0;
  private _reader: ((data: Uint8Array) => void | Promise<any>)[] = [];
  private _readBuf = new Uint8Array(FIFO_SIZE);
  private _pendingRead = false;

  constructor(public name: string) {}

  public write(data: Uint8Array, cb: () => void): boolean {
    if (!data.length) return true;
    if (this._pending > REJECT_LIMIT) return false;
    if (!this._pending) {
      setTimeout(() => this._innerWrite(), 0);
    }
    this._pending += data.length;
    this._buf.push(data);
    this._cbs.push(cb);
  }

  private _innerWrite(): void {
    if (!this._pending) return;
    let writable = this._fifo.space;
    if (!writable) {
      this._triggerRead();
      setTimeout(() => this._innerWrite(), 0);
      return;
    }
    while (this._pos < this._buf.length) {
      const chunk = this._buf[this._pos];
      const cb = this._cbs[this._pos];
      const toWrite = Math.min(chunk.length - this._chunkOffset, writable);
      this._fifo.write(chunk, this._chunkOffset, toWrite);
      //console.log('written', this.name, toWrite);
      writable -= toWrite;
      this._pending -= toWrite;
      if (this._chunkOffset + toWrite >= chunk.length) {
        this._pos++;
        this._chunkOffset = 0;
        cb(); //console.log('cb called', this.name, toWrite);
      } else {
        //console.log('schedule', this.name);
        this._chunkOffset += toWrite;
        this._triggerRead();
        setTimeout(() => this._innerWrite(), 0);
        break;
      }
    }
    if (this._pos > MAX_ENTRIES) {
      this._buf = this._buf.slice(this._pos);
      this._cbs = this._cbs.slice(this._pos);
      this._pos = 0;
    }
    //this._triggerRead();
  }

  public onData(handler: (data: Uint8Array) => void | Promise<any>): void {
    this._reader.push(handler);
    this._triggerRead();
  }

  private _triggerRead(): void {
    if (!this._pendingRead && this._reader.length && this._fifo.size > 0) {
      this._pendingRead = true;
      setTimeout(async () => {
        const length = this._fifo.size;
        this._fifo.read(this._readBuf);
        for (let i = 0; i < this._reader.length; ++i) {
          //console.log('preread', i, length);
          await this._reader[i](this._readBuf.subarray(0, length));
        }
        this._pendingRead = false;
      }, 0);
    }
  }
}

/*
async function test() {
  const p = new OsPipe();
  p.onData(data => console.log('read', data));
  await new Promise(resolve => p.write(new Uint8Array([1,2,3]), resolve));
  console.log('data1 written');
  await new Promise(resolve => p.write(new Uint8Array([4,5,6]), resolve));
  console.log('data2 written');
  console.log((p as any)._fifo.size);
}
//test();

async function test2() {
  const p1 = new OsPipe();
  const p2 = new OsPipe();
  p1.onData(async data => await new Promise(resolve => p2.write(data.slice(), resolve)));
  p2.onData(data => console.log('read', data));
  await new Promise(resolve => p1.write(new Uint8Array([1,2,3]), resolve));
  console.log('data1 written');
  await new Promise(resolve => p1.write(new Uint8Array([4,5,6]), resolve));
  console.log('data2 written');
  console.log((p1 as any)._fifo.size, (p2 as any)._fifo.size);
}
//test2();
*/
/*
const a = new Uint8Array(100);
for (let i = 0; i < 100; ++i) a[i] = i;
const b = new Uint8Array(100);
for (let i = 0; i < 100; ++i) b[i] = i + 100;

const t = new Uint8Array(200);
let tp = 0;

async function test3() {
  const p1 = new OsPipe('p1');
  const p2 = new OsPipe('p2');
  p1.onData(async data => await new Promise(resolve => p2.write(data, resolve)));
  const p3 = new OsPipe('p3');
  p2.onData(async data => await new Promise(resolve => p3.write(data, resolve)));
  //p3.onData(data => {
  //  console.log('read', data.length);
  //  for (let i = 0; i < data.length; ++i) t[tp+i] = data[i];
  //  tp += data.length;
  //});

  setTimeout(() => console.log((p1 as any)._fifo.size, (p2 as any)._fifo.size, (p3 as any)._fifo.size), 3000);

  await new Promise(resolve => p1.write(a, resolve));
  console.log('data1 written');
  await new Promise(resolve => p1.write(b, resolve));
  console.log('data2 written');
  await new Promise(resolve => p1.write(new Uint8Array(200), resolve));
  console.log('data3 written');
  //console.log((p as any)._fifo.size, (p2 as any)._fifo.size, (p3 as any)._fifo.size);
  //console.log(tp, t.slice(90));
}
test3();
*/
//setTimeout(() => console.log('final', t.slice(190)), 3000);

const source32 = new Uint32Array(1000000);
const source = new Uint8Array(source32.buffer);
const target32 = new Uint32Array(1000000);
const target = new Uint8Array(target32.buffer);
for (let i = 0; i < 1000000; ++i) source32[i] = i;
let cursor = 0;

async function test4() {
  const p1 = new OsPipe('p1');
  const p2 = new OsPipe('p2');
  p1.onData(async data => await new Promise(resolve => p2.write(data, resolve)));
  let c = 0;
  p2.onData(data => {
    //console.log(data.length, c++);
    target.set(data, cursor);
    cursor += data.length;
  });
  await new Promise(resolve => p1.write(source, resolve));
  await new Promise(resolve => p1.write(new Uint8Array([0,0,0]), resolve));
  await new Promise(resolve => p1.write(new Uint8Array([0,0,0]), resolve));

  //console.log(source32.subarray(999995));
  //console.log(target32.subarray(999995));
  setTimeout(() => setTimeout(() => console.log(cursor), 0), 0);
}
//test4();

async function measure(cb: () => Promise<any>) {
  const start = Date.now();
  await cb();
  console.log(Date.now() - start);
}
measure(test4);
//setInterval(() => console.log(cursor), 1000);

measure(async () => {
  for (let i = 0; i < source.length; ++i) target[i] = source[i];
  //target.set(source);
});