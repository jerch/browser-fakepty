import { Terminal } from 'xterm';
import { Pty } from './Tty';
import { FakeShell } from './Shell';

function bootstrap() {
  const pty = new Pty(FakeShell, [], {});
  const term = new Terminal({cols: 80, rows: 25});
  term.open(document.getElementById('terminal'));
  pty.onData(data => term.write(data));
  term.onData(data => pty.write(data));

  (window as any).term = term;
  (window as any).pty = pty;
}
window.onload = bootstrap;
