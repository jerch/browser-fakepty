import { spawn, ProcessModule } from './index';
import { Terminal } from 'xterm';
import { cat } from './command_example';
import { Pty } from './Tty';
import { FakeShell } from './Shell';

function shell(args: string[], process: ProcessModule) {
  process.stdout.write('fake-shell$> ');
  
  process.stdin.on('data', (data: Uint8Array | string) => {
    if (data === '\x04') process.exit(0);
    if (typeof data === 'string' && data.startsWith('cat')) cat(data.split(' '), process);
    process.stdout.write(data);
  });

  process.on('SIGWINCH', () => console.log('terminal size changed'));
}



function bootstrap() {
  const pty = spawn(shell, [], {
    cols: 80,
    rows: 25,
    cwd: '/',
    env: {}
  });
  const term = new Terminal({cols: 80, rows: 25});
  term.open(document.getElementById('terminal'));
  pty.onData(data => term.write(data));
  term.onData(data => pty.write(data));

  (window as any).term = term;
  (window as any).pty = pty;
}
//window.onload = bootstrap;

function bootstrap2() {
  const pty = new Pty(FakeShell, [], {});
  const term = new Terminal({cols: 80, rows: 25});
  term.open(document.getElementById('terminal'));
  pty.onData(data => term.write(data));
  term.onData(data => pty.write(data));

  (window as any).term = term;
  (window as any).pty = pty;
}
window.onload = bootstrap2;