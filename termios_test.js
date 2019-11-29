const Termios = require('node-termios').Termios;
const sym = require('node-termios').native.ALL_SYMBOLS;
const pty = require('node-pty');

const command = {
  exe: 'python',
  args: ['output.py']
};

const term = pty.spawn(command.exe, command.args, {
  name: 'xterm-color',
  cols: 80,
  rows: 30,
  cwd: process.cwd(),
  env: process.env
});

term.onData(data => console.log([data]));

setTimeout(() => {
  const t = new Termios(term._fd);
  //t.c_oflag &= ~sym.ONLCR;  // only on output to master

  t.writeTo(term._fd);
  console.log(t);
}, 50);

setTimeout(() => term.write('###\r***'), 100);
setTimeout(() => term.write('#\r\x1a???\r'), 200);
//setTimeout(() => term.kill(18), 1000);
setTimeout(() => term.write('second\r'), 2000);

setTimeout(() => term.kill(), 10000);
//setTimeout(() => term.write('\x03'), 3000);
