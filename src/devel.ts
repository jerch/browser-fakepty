import { Terminal } from 'xterm';
import { Pty } from './Tty';
import { FakeShell } from './Shell';

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
}
window.onload = bootstrap;
