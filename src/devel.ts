import { Terminal } from 'xterm';
import { Pty } from './Tty';
import { FakeShell } from './Shell';
import { Pipe, IOpenFlags, PIPE_CTL, PipePort } from './ObjectPipe';
import { Pipe as OldPipe } from './Pipe';
import { BytePipe, BytePipePort } from './BytePipe';
import { Pipe as NPipe } from './new/Pipe';
import { IOpenFlags as NFlags } from './new/Constants';
import { clockIsOverdue } from './new/Clock';
import { FasterPipe } from './new/FasterPipe';

const ENVIRON = {
  TERM: 'xterm-256color',
  LINES: '25',
  COLUMNS: '80'
};

function bootstrap() {
  const pty = new Pty(FakeShell, [], {env: ENVIRON});
  const term = new Terminal({cols: 80, rows: 25});
  term.open(document.getElementById('terminal'));
  pty.onData(data => term.write(data));
  term.onData(data => pty.write(data));

  (window as any).term = term;
  (window as any).pty = pty;

  //load();
}
window.onload = bootstrap;

/*
// ##################### NewPipe #####################
// test
const pipe = new Pipe();
//const pipe2 = new Pipe();
const reader = pipe.open(IOpenFlags.RDONLY);
const writer = pipe.open(IOpenFlags.WRONLY);

//const _r = pipe.open(IOpenFlags.RDONLY);
//const _w = pipe2.open(IOpenFlags.WRONLY);
async function pipeThrough(r: PipePort, w: PipePort) {
  while (true) {
    for (const chunk of await r.read(1024)) {
      await w.write(chunk);
    }
  }
}
//pipeThrough(_r, _w);


reader.ctl(PIPE_CTL.F_SETPIPE_SZ, 64);   // should write up to 4 entries before "blocking"
console.log('pipe size writer:', writer.ctl(PIPE_CTL.F_GETPIPE_SZ));

async function read_sumthing(it: number, amount: number) {
  const data: any[][] = [];
  let count = 0;
  console.log('READ started');
  const start = Date.now();
  while (true) {
    const chunk = await reader.read(amount);
    data.push(chunk);
    count += chunk.length;
    if (chunk.slice(-1)[0] === 'FIN') break;
  }
  const dur = Date.now() - start;
  const rate = count / dur;
  console.log('read in total', data, 'time taken:', dur, 'rate', rate.toFixed(2), 'ops/ms');
}

async function write_sumthing() {
  console.log('WRITE started');
  for (let i = 0; i < 100000; ++i) {
    await writer.write(i);
  }
  await writer.write('FIN');
}


setTimeout(() => console.log('OUTER1'), 0);
setTimeout(async () => read_sumthing(20, 1024), 100);
//read_sumthing(20, 10);
write_sumthing();
//read_sumthing(20, 10);
setTimeout(() => console.log('OUTER2'), 0);
setTimeout(() => console.log('OUTER after 50ms'), 50);
*/

/*
// ##################### old pipe #####################################
const op = new OldPipe();
const op2 = new OldPipe();
const op3 = new OldPipe();
const op4 = new OldPipe();
const op5 = new OldPipe();
op.pipeTo([op2]);
//op2.pipeTo([op3]);
//op3.pipeTo([op4]);
//op4.pipeTo([op5]);
const oreader = op.getReader();
const owriter = op.getWriter();

let num = 0;
function owrite(): void {
  while (owriter.write(num++)) {
    if (num === 1000) {
      owriter.close();
      return;
    }
  }
  if (num < 1000) {
    setTimeout(owrite, 0);
  }
}

owrite();
const start = Date.now();
oreader.onData(data => {
  //console.log(data);
  if (data === 999) {
    console.log('time taken', Date.now()-start);
  }
});
*/






/*
// ################### BytePipe #############################
// test
const pipe = new BytePipe();
//const pipe2 = new Pipe();
const reader = pipe;
const writer = pipe;

//const _r = pipe.open(IOpenFlags.RDONLY);
//const _w = pipe2.open(IOpenFlags.WRONLY);
async function pipeThrough(r: PipePort, w: PipePort) {
  while (true) {
    for (const chunk of await r.read(1024)) {
      await w.write(chunk);
    }
  }
}
//pipeThrough(_r, _w);


//pipe.ctl(PIPE_CTL.F_SETPIPE_SZ, 8);   // should write up to 4 entries before "blocking"
//console.log('pipe size writer:', pipe.ctl(PIPE_CTL.F_GETPIPE_SZ));
//console.log(pipe);

async function read_sumthing(it: number, amount: number) {
  const data: any[] = [];
  let count = 0;
  const target = new Uint8Array(4);
  const buf32 = new Uint32Array(target.buffer);
  console.log('READ started');
  const start = Date.now();
  while (true) {
    //const chunk = await reader.read(4);
    //const buf32 = new Uint32Array(chunk.buffer);
    const chunk = await reader.readTo(target);
    //console.log(chunk);
    //console.log('read', buf32);
    data.push(buf32[0]);
    count += chunk.length;
    if (buf32[0] === 99999) break;
  }
  const dur = Date.now() - start;
  const rate = count / dur;
  console.log('read in total', data, 'time taken:', dur, 'rate', rate.toFixed(2), 'ops/ms');
}

async function write_sumthing() {
  const buf = new Uint8Array(4);
  const buf32 = new Uint32Array(buf.buffer);
  console.log('WRITE started');
  for (let i = 0; i < 100000; ++i) {
    //console.log('write', i);
    buf32[0] = i;
    await writer.write(buf);
  }
  //await writer.write('FIN');
}


setTimeout(() => console.log('OUTER1'), 0);
setTimeout(async () => read_sumthing(20, 1024), 100);
//read_sumthing(20, 10);
write_sumthing();
//read_sumthing(20, 10);
setTimeout(() => console.log('OUTER2'), 0);
setTimeout(() => console.log('OUTER after 50ms'), 50);
*/




/*

const p = new BytePipe();
const r = p.open(IOpenFlags.RDONLY);
const w = p.open(IOpenFlags.WRONLY);
(window as any).w = w;
(window as any).r = r;

const p2 = new BytePipe();
const r2 = p2.open(IOpenFlags.RDONLY);
const w2 = p2.open(IOpenFlags.WRONLY);
(window as any).w2 = w2;
(window as any).r2 = r2;

async function forwardPipe(reader: BytePipePort, writer: BytePipePort) {
  reader.encoding = null;
  writer.encoding = null;
  let shouldExit = false;
  while (true) {
    const data = await reader.read(512);
    if (data === null) {
      break;
    }
    await writer.write(data).catch(err => {
      console.log('got EPIPE in forward', [new Uint16Array(data.buffer)]);
      shouldExit = true;
    });
    if (shouldExit) {
      break;
    }
  }
  reader.close();
  writer.close();
}
//forwardPipe(r, w2);

function pipeTo(reader: BytePipePort, writers: BytePipePort[]): void {
  reader.encoding = null;
  writers.forEach(w => { w.encoding = null; });
  reader.onData(data => {
    Promise.all(writers.map(w => w.write(data)));
  });
  reader.onEnd(() => {
    writers.forEach(w => w.close());
  });
}
pipeTo(r, [w2]);

// producer
async function writeNumbers() {
  const data = new Uint16Array(1);
  let shouldExit = false;
  for (let i = 0; i < 1000; ++i) {
    data[0] = i;
    await w.write(new Uint8Array(data.buffer)).catch(err => {
      shouldExit = true;
    });
    if (shouldExit) {
      console.log('got stopped at', i);
      break;
    }
  }
  w.close();
}
writeNumbers();

// consumer
async function readNumbers() {
  r2.encoding = null;
  const target = new Uint16Array(1);
  const targetBytes = new Uint8Array(target.buffer);
  while (target[0] < 100) {
    const data = await r2.read(2);
    if (data === null) {
      console.log('writer hung up, exit');
      break;
    }
    targetBytes.set(data);
    console.log(target);
  }
  r2.close();
}
readNumbers();

function readNumbers2() {
  r2.encoding = null;
  r2.onData(data => {
    console.log(new Uint16Array((data as Uint8Array).buffer));
  });
  r2.onEnd(() => {
    console.log('writer hung up, exit');
    r2.close();
  });
}
//readNumbers2();

*/


/*
function load() {
const p = new NPipe();
const r = p.open(NFlags.RDONLY);
const w = p.open(NFlags.WRONLY);
let start: number;
let count = 0;

w.encoding = 'utf8';
//w.encoding = null;
async function writeStuff() {
  const d = new Uint8Array(1);
  d[0] = 97;
  for (let i = 0; i < 1000000; ++i) {
    await w.write('a');
    //await w.write(d);
  }
  await w.write('FIN');
  await w.flush();
  w.close();
}

const readData: any[] = [];
(window as any).ddd = readData;
r.encoding = 'utf8';
//r.encoding = null;
let c = 0;
r.onData(data => {
  //console.log('read:', [data]);
  //target += data;
  readData.push(data.length);
  count += data.length;
  //c++;
  //if (c === 50) {
  //  c = 0;
  //  r.pause();
  //  (window as any).term.write(data, () => r.resume());
  //} else {
  //  (window as any).term.write(data);
  //}
  (window as any).term.write(data);
});
r.onEnd(() => console.log('time taken', Date.now() - start, count));

start = Date.now();
writeStuff();
}
*/


/*
// ################### BytePipe #############################
// test
const pipe = new NPipe();
//const pipe2 = new Pipe();
const reader = pipe;
const writer = pipe;

//const _r = pipe.open(IOpenFlags.RDONLY);
//const _w = pipe2.open(IOpenFlags.WRONLY);
async function pipeThrough(r: PipePort, w: PipePort) {
  while (true) {
    for (const chunk of await r.read(1024)) {
      await w.write(chunk);
    }
  }
}
//pipeThrough(_r, _w);


//pipe.ctl(PIPE_CTL.F_SETPIPE_SZ, 8);   // should write up to 4 entries before "blocking"
//console.log('pipe size writer:', pipe.ctl(PIPE_CTL.F_GETPIPE_SZ));
//console.log(pipe);

async function read_sumthing(it: number, amount: number) {
  const data: any[] = [];
  let count = 0;
  const target = new Uint8Array(4);
  const buf32 = new Uint32Array(target.buffer);
  console.log('READ started');
  const start = Date.now();
  while (true) {
    //const chunk = await reader.read(4);
    //const buf32 = new Uint32Array(chunk.buffer);
    await reader.read(target.buffer, 0, 4);
    //console.log(chunk);
    //console.log('read', buf32);
    data.push(buf32[0]);
    count += 4;
    if (buf32[0] === 99999) break;
  }
  const dur = Date.now() - start;
  const rate = count / dur;
  console.log('read in total', data, 'time taken:', dur, 'rate', rate.toFixed(2), 'ops/ms');
}

async function write_sumthing() {
  const buf = new Uint8Array(4);
  const buf32 = new Uint32Array(buf.buffer);
  console.log('WRITE started');
  for (let i = 0; i < 100000; ++i) {
    //console.log('write', i);
    buf32[0] = i;
    await writer.write(buf.buffer, 0, 4);
  }
  //await writer.write('FIN');
}


setTimeout(() => console.log('OUTER1'), 0);
setTimeout(async () => read_sumthing(20, 1024), 100);
//read_sumthing(20, 10);
write_sumthing();
//read_sumthing(20, 10);
setTimeout(() => console.log('OUTER2'), 0);
setTimeout(() => console.log('OUTER after 50ms'), 50);
*/




// +++++++++++++ FasterPipe +++++++++++++++++++++++++
async function ttt(start: number) {
  const DATA_SIZE = 1 << 20;
  const pipe = new FasterPipe();
  let wCount = 0;
  let rCount = 0;
  const din = new Uint8Array(1);
  const dout = new Uint8Array(1);
  let resolveFinish: () => void = null;
  const finished = new Promise(resolve => { resolveFinish = resolve; });
  const data = [65, 66, 67, 68, 69, 70, 71, 72];

  function wCb(count: number, error: any) {
    //console.log('wCb triggered');
    wCount += count;
    if (wCount < DATA_SIZE) {
      writer();
    }
  }
  function writer() {
    while (wCount < DATA_SIZE) {
      din[0] = data[wCount % 8];
      //din[1] = data[(wCount+1) % 8];
      //din[2] = data[(wCount+2) % 8];
      //din[3] = data[(wCount+3) % 8];
      if (!pipe.write(din.buffer, 0 , 1, wCb)) {
        break;
      }
      wCount += 1;
    }
  }
  let lastWrite = 0;
  function rCb(count: number, error: any) {
    //console.log('rCb triggered');
    (window as any).term.write(dout.slice());
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
      if (count === null) console.log('got NULL -.-');
      if (count === 0) {
        break;
      }
      rCount += count;
      if (!((lastWrite += 1) & 0xffff)) {
        (window as any).term.write(dout.slice(), () => reader());
        return;
      } else {
        (window as any).term.write(dout.slice());
      }
    }
    if (rCount >= DATA_SIZE) {
      resolveFinish();
    }
  }
  writer();
  reader();
  //writer();
  //const bla = setInterval(() => console.log('??'), 10);

  await finished;
  //clearInterval(bla);
  console.log('time taken', Date.now() - start);
}

setTimeout(() => ttt(Date.now()), 1000);
//ttt(Date.now());
//ttt(Date.now());
//ttt(Date.now());
//ttt(Date.now());
//ttt(Date.now());



/*
// +++++++++++ compared to Pipe
async function ttt(start: number) {
  const DATA_SIZE = 1 << 20;    // smaller DATA_SIZE due to taking so long
  const pipe = new NPipe();
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
      (window as any).term.write(dout);
    }
  }
  await Promise.all([writer(), reader()]);

  console.log('time taken', Date.now() - start);
}

setTimeout(() => ttt(Date.now()), 0);
//ttt(Date.now());
//ttt(Date.now());
//ttt(Date.now());
*/
