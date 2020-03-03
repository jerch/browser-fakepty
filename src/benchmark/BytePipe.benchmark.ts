import { perfContext, ThroughputRuntimeCase, before } from 'xterm-benchmark';
import { FifoBuffer, BytePipe } from '../BytePipe';
import { IOpenFlags } from '../ObjectPipe';
import { Pipe } from '../new/Pipe';
import { FasterPipe } from '../new/FasterPipe';
import { IOpenFlags as Flags } from '../new/Constants';

/**
 * some settings
 * - FIFO_SIZE    size of fifo in tests
 * - DATA_SIZE    size of total data in tests
 * - CHUNK_SIZE   single chunk size for pipe tests
 * 
 * Note: if chunk size is bigger than fifo size the pipe will bypass the fifo
 * --> major speedup due to less copying (1x vs 2x with fifo)
 * --> "tandem mode" for writer|block -> reader|block
 */
const FIFO_SIZE = 256;
const DATA_SIZE = 1 << 24;
const CHUNK_SIZE = 1024;


perfContext('FifoBuffer - byteswise single', () => {
  let input: Uint8Array;
  let output: Uint8Array;
  let fb: FifoBuffer;
  let wCount: number;
  let rCount: number;

  before(() => {
    input = new Uint8Array(DATA_SIZE);
    output = new Uint8Array(DATA_SIZE);
    for (let i = 0; i < DATA_SIZE; ++i) input[i] = i;
  });

  new ThroughputRuntimeCase('throughput', () => {
    fb = new FifoBuffer(FIFO_SIZE);
    wCount = 0;
    rCount = 0;
    while (wCount < DATA_SIZE) {
      fb.writeByte(input[wCount++]);
      output[rCount++] = fb.readByte();
    }
    return {payloadSize: rCount};
  }).showAverageThroughput().showAverageRuntime();
});


perfContext('FifoBuffer - byteswise batch', () => {
  let input: Uint8Array;
  let output: Uint8Array;
  let fb: FifoBuffer;
  let wCount: number;
  let rCount: number;

  function writeBatch(n: number) {
    for (let i = 0; i < n; ++i) fb.writeByte(input[wCount++]);
  }
  function readBatch(n: number) {
    for (let i = 0; i < n; ++i) output[rCount++] = fb.readByte();
  }

  before(() => {
    input = new Uint8Array(DATA_SIZE);
    output = new Uint8Array(DATA_SIZE);
    for (let i = 0; i < DATA_SIZE; ++i) input[i] = i;
  });

  new ThroughputRuntimeCase('throughput', () => {
    fb = new FifoBuffer(FIFO_SIZE);
    wCount = 0;
    rCount = 0;
    while (wCount < DATA_SIZE) {
      writeBatch(FIFO_SIZE);
      readBatch(FIFO_SIZE);
    }
    return {payloadSize: rCount};
  }).showAverageThroughput().showAverageRuntime();
});


perfContext('FifoBuffer - aligned full chunk', () => {
  let input: Uint8Array;
  let output: Uint8Array;
  let fb: FifoBuffer;

  before(() => {
    input = new Uint8Array(DATA_SIZE);
    input.fill(255);
    output = new Uint8Array(DATA_SIZE);
  });

  new ThroughputRuntimeCase('throughput', () => {
    output.fill(0);
    fb = new FifoBuffer(FIFO_SIZE);
    let wCount = 0;
    let rCount = 0;
    while (wCount < DATA_SIZE) {
      wCount += fb.write(input.buffer, wCount, FIFO_SIZE);
      rCount += fb.read(output.buffer, rCount, FIFO_SIZE);
    }
    if (output[0] !== input[0] || output[DATA_SIZE-1] !== input[DATA_SIZE-1]) {
      throw new Error('mismatch!');
    }
    return {payloadSize: rCount};
  }).showAverageThroughput().showAverageRuntime();
});


perfContext('BytePipe - single bytes', () => {
  let pipe: BytePipe;

  new ThroughputRuntimeCase('throughout', async () => {
    const DATA_SIZE = 1 << 16;    // smaller DATA_SIZE due to taking so long
    pipe = new BytePipe();
    let wCount = 0;
    let rCount = 0;
    const din = new Uint8Array(1);
    const dout = new Uint8Array(1);
    async function writer() {
      while (wCount < DATA_SIZE) {
        din[0] = wCount;
        await pipe.write(din);
        wCount += 1;
      }
    }
    async function reader() {
      while (rCount < DATA_SIZE) {
        rCount += (await pipe.readTo(dout)).length;
      }
    }
    await Promise.all([writer(), reader()]);
    return {payloadSize: rCount};
  }).showAverageThroughput().showAverageRuntime();
  //}, {repeat: 1, fork: true, forkOptions: {execArgv: ['--inspect-brk']}}).showAverageRuntime();
});


perfContext('BytePipe - big chunks', () => {
  let input: Uint8Array;
  let output: Uint8Array;
  let pipe: BytePipe;

  before(() => {
    input = new Uint8Array(DATA_SIZE);
    input.fill(255);
    output = new Uint8Array(DATA_SIZE);
  });

  new ThroughputRuntimeCase('throughout', async () => {
    pipe = new BytePipe();
    const w = pipe.open(IOpenFlags.WRONLY);  // why is this needed here?
    output.fill(0);
    let wCount = 0;
    let rCount = 0;
    async function writer() {
      while (wCount < DATA_SIZE) {
        wCount += await pipe.write(input.subarray(wCount, wCount + CHUNK_SIZE));
      }
    }
    async function reader() {
      while (rCount < DATA_SIZE) {
        rCount += (await pipe.readTo(output.subarray(rCount, rCount + CHUNK_SIZE))).length;
      }
    }
    await Promise.all([writer(), reader()]);
    if (output[0] !== input[0] || output[DATA_SIZE-1] !== input[DATA_SIZE-1]) {
      throw new Error('mismatch!');
    }
    return {payloadSize: rCount};
  }).showAverageThroughput().showAverageRuntime();
});

perfContext('Pipe - big chunks', () => {
  let input: Uint8Array;
  let output: Uint8Array;
  let pipe: Pipe;

  before(() => {
    input = new Uint8Array(DATA_SIZE);
    input.fill(255);
    output = new Uint8Array(DATA_SIZE);
  });

  new ThroughputRuntimeCase('throughout', async () => {
    pipe = new Pipe();
    //const w = pipe.open(Flags.WRONLY);
    output.fill(0);
    let wCount = 0;
    let rCount = 0;
    async function writer() {
      while (wCount < DATA_SIZE) {
        wCount += await pipe.write(input.buffer, wCount, CHUNK_SIZE);
      }
    }
    async function reader() {
      while (rCount < DATA_SIZE) {
        rCount += await pipe.read(output.buffer, rCount, CHUNK_SIZE);
      }
    }
    await Promise.all([writer(), reader()]);
    if (output[0] !== input[0] || output[DATA_SIZE-1] !== input[DATA_SIZE-1]) {
      throw new Error('mismatch!');
    }
    return {payloadSize: rCount};
  }).showAverageThroughput().showAverageRuntime();
  //}, {repeat: 1, fork: true, forkOptions: {execArgv: ['--inspect-brk']}}).showAverageRuntime();
});


perfContext('FasterPipe - big chunks', () => {
  let input: Uint8Array;
  let output: Uint8Array;
  let pipe: FasterPipe;

  before(() => {
    input = new Uint8Array(DATA_SIZE);
    input.fill(255);
    output = new Uint8Array(DATA_SIZE);
  });

  new ThroughputRuntimeCase('throughout', async () => {
    pipe = new FasterPipe();
    //const w = pipe.open(Flags.WRONLY);
    output.fill(0);
    let wCount = 0;
    let rCount = 0;
    let resolveFinish: () => void = null;
    const finished = new Promise(resolve => { resolveFinish = resolve; });

    function wCb(count: number, error: any) {
      wCount += count;
      if (wCount < DATA_SIZE) {
        writer();
      }
    }
    function writer() {
      while (wCount < DATA_SIZE) {
        if (!pipe.write(input.buffer, wCount, CHUNK_SIZE, wCb)) {
          break;
        }
        wCount += CHUNK_SIZE;
      }
    }
    function rCb(count: number, error: any) {
      rCount += count;
      if (rCount < DATA_SIZE) {
        reader();
      } else {
        resolveFinish();
      }
    }
    function reader() {
        //pipe.read(output.buffer, rCount, CHUNK_SIZE, rCb);
        let count = 0;
        while (rCount < DATA_SIZE) {
          count = pipe.read(output.buffer, rCount, CHUNK_SIZE, rCb);
          if (count === 0) {
            break;
          }
          rCount += count;
        }
        if (rCount >= DATA_SIZE) {
          resolveFinish();
        }
    }
    writer();
    reader();

    await finished;
    if (output[0] !== input[0] || output[DATA_SIZE-1] !== input[DATA_SIZE-1]) {
      throw new Error('mismatch!');
    }
    return {payloadSize: rCount};
  }).showAverageThroughput().showAverageRuntime();
  //}, {repeat: 1, fork: true, forkOptions: {execArgv: ['--inspect-brk']}}).showAverageRuntime();
});


perfContext('Pipe - single bytes', () => {
  let pipe: Pipe;

  new ThroughputRuntimeCase('throughout', async () => {
    const DATA_SIZE = 1 << 20;    // smaller DATA_SIZE due to taking so long
    pipe = new Pipe();
    let wCount = 0;
    let rCount = 0;
    const din = new Uint8Array(1);
    const dout = new Uint8Array(1);
    async function writer() {
      while (wCount < DATA_SIZE) {
        din[0] = wCount;
        await pipe.write(din.buffer, 0, 1);
        wCount += 1;
      }
    }
    async function reader() {
      while (rCount < DATA_SIZE) {
        rCount += await pipe.read(dout.buffer, 0, 1);
      }
    }
    await Promise.all([writer(), reader()]);
    return {payloadSize: rCount};
  }).showAverageThroughput().showAverageRuntime();
  //}, {repeat: 1, fork: true, forkOptions: {execArgv: ['--inspect-brk']}}).showAverageRuntime();
});


perfContext('FasterPipe - single bytes', () => {
  let pipe: FasterPipe;

  new ThroughputRuntimeCase('throughout', async () => {
    const DATA_SIZE = 1 << 20;    // smaller DATA_SIZE due to taking so long
    pipe = new FasterPipe();
    let wCount = 0;
    let rCount = 0;
    const din = new Uint8Array(1);
    const dout = new Uint8Array(1);
    let resolveFinish: () => void = null;
    const finished = new Promise(resolve => { resolveFinish = resolve; });

    function wCb(count: number, error: any) {
      wCount += count;
      if (wCount < DATA_SIZE) {
        writer();
      }
    }
    function writer() {
      while (wCount < DATA_SIZE) {
        din[0] = wCount;
        if (!pipe.write(din.buffer, 0 , 1, wCb)) {
          break;
        }
        wCount += 1;
      }
    }
    function rCb(count: number, error: any) {
      rCount += count;
      if (rCount < DATA_SIZE) {
        reader();
      } else {
        resolveFinish();
      }
    }
    function reader() {
      let count = 0;
      while (rCount < DATA_SIZE) {
        count = pipe.read(dout.buffer, 0, 1, rCb);
        if (count === 0) {
          break;
        }
        rCount += count;
      }
      if (rCount >= DATA_SIZE) {
        resolveFinish();
      }
    }
    writer();
    reader();

    await finished;
    return {payloadSize: rCount};
  }).showAverageThroughput().showAverageRuntime();
  //}, {repeat: 1, fork: true, forkOptions: {execArgv: ['--inspect-brk']}}).showAverageRuntime();
});
