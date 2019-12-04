import { ProcessMain, Process } from './Process';
import { IDisposable } from 'xterm';
import { Pipe } from './Pipe';
import { tcsetattr, isatty } from './Tty';
import { TERMIOS_RAW, TERMIOS_COOKED, ITermios, LFlags } from './Termios';

/**
 * Simple line based shell REPL.
 */
export const FakeShell: ProcessMain = (argv, process) => {
  interface ICmd {
    cmd: string;
    argv: string[];
    error: string;
  }
  function showPrompt(): void {
    process.stdout.write('FakeShell> ');
  }
  function parseCommand(data: string): ICmd {
    const result: ICmd = {cmd: '', argv: [], error: ''};
    data = data.trim();
    if (!data) return result;
    if (!~data.indexOf(' ')) {
      result.cmd = data;
      return result;
    }
    result.cmd = data.slice(0, data.indexOf(' '));
    data = data.slice(data.indexOf(' ') + 1).trim();
    if (!~data.indexOf('"')) {
      result.argv = data.split(/\s+/);
      return result;
    }
    const parts = data.split('"');
    if (parts.length % 2 === 0) {
      result.error = 'unterminated argument';
      return result;
    }
    for (let i = 0; i < parts.length; ++i) {
      const part = parts[i].trim();
      if (!part) continue;
      if (i % 2) {
        result.argv.push(part);
      } else {
        part.split(/\s+/).forEach(el => result.argv.push(el));
      }
    }
    return result;
  }

  let currentReadHandler: IDisposable;

  // primitive REPL
  const readHandler = (data: string) => {
    // FIXME: write handling of messed up termios settings (entry for `reset`)

    // pipe example
    console.log('data', [data]);
    if (data === 'grr\n') {
      console.log('piper entered....');
      const pipe = new Pipe();
      const p1 = new Process(ECHO, (process.stdin as any)._tty, pipe, pipe);
      const p2 = new Process(WC, pipe, (process.stdout as any)._tty, (process.stdout as any)._tty);
      currentReadHandler?.dispose();
      pipe.onClose(() => p2.exit());
      setTimeout(() => console.log((pipe as any)._writers), 2000);
      p2.afterExit(() => {
        console.log(`EXIT subprogram "echo"`);
        currentReadHandler = process.stdin.onData(readHandler);
        showPrompt();
      });
      p1.run(['hello world!\nsecond line.'], {});
      p2.run([], {});
      return;
    }

    // eval
    const cmd = parseCommand(data);
    if (cmd.error) {
      process.stdout.write(`[Error]: ${cmd.error}\n`);
      showPrompt();
      return;
    }
    if (!cmd.cmd) {
      showPrompt();
      return;
    }

    // run sub process
    if (cmd.cmd in KNOWN_COMMANDS) {
      const p = new Process(
        KNOWN_COMMANDS[cmd.cmd],
        (process.stdin as any)._tty,
        (process.stdout as any)._tty,
        (process.stderr as any)._tty
      );
      // disconnect shell from tty
      currentReadHandler?.dispose();
      // reconnect shell to tty when done
      p.afterExit(() => {
        console.log(`EXIT subprogram "${cmd.cmd}"`);
        currentReadHandler = process.stdin.onData(readHandler);
        showPrompt();
      });
      p.run(cmd.argv, {});
    } else {
      process.stdout.write(`unknown command: "${cmd.cmd}"\nType \`commands\` to see a list of supported commands.\n`);
      showPrompt();
    }
  }

  // startup
  currentReadHandler = process.stdin.onData(readHandler);
  process.stdout.write('\x1b[2J\x1b[H');
  showPrompt();
}

/**
 * Example program.
 */
const FUN: ProcessMain = (argv, process) => {
  process.stdout.write('This actually does nothing more than printing this...\n');
  process.exit();
}

/**
 * Simple echo program.
 */
const ECHO: ProcessMain = (argv, process) => {
  function istty(obj: any) {
    return !!(obj?._tty);
  }
  process.stdout.write(
    argv.join(' ')
      .replace(/\\n/g, '\n')
      .replace(/\\x([0-9A-Fa-f][0-9A-Fa-f])/g, (m, p1) => String.fromCharCode(parseInt(p1, 16)))
    + (istty(process.stdout) ? '\n' : '')
  );
  process.exit();
}

/**
 * stty to maintain termios.
 */
const STTY: ProcessMain = (argv, process) => {
  process.stdout.write('Not yet implemented...\n');
  process.exit();
}

/**
 * Simple wc implementation. (accumulates data)
 */
const WC: ProcessMain = (argv, process) => {
  let input = '';

  process.stdin.onData(data => {
    console.log('seen in wc', [data]);
    input += data;
  });
  (process.stdin as any)._pipe.onClose(() => {
    console.log('gggggggggggggggggggggggggggggg');
    const lines = input.split('\n');
    const words = lines.reduce((prev, cur) => prev + cur.split(/\s+/).filter(Boolean).length, 0);
    //process.stdout.write(`${lines.length} ${words} ${input.length}\n`); // FIXME to late for stdout here
    console.log(`\t${lines.length}\t${words}\t${input.length}\n`);
  });
}

/**
 * Testing raw mode...
 */
const RAW: ProcessMain = (argv, process) => {
  process.stdin.onData(data => {
    if (data === '\x04') {
      tcsetattr(process.stdin, TERMIOS_COOKED);
      process.exit();
      return;
    }
    // escape any control codes
    let escaped = '';
    for (let i = 0; i < data.length; ++i) {
      if (data.charCodeAt(i) < 0x20) {
        escaped += '^' + String.fromCharCode(data.charCodeAt(i) + 0x40);
      } else {
        escaped += data[i];
      }
    }
    process.stdout.write(`raw read: "${escaped}"\r\n`);
  });
  process.stdout.write('Exit with Ctrl-D.\n');
  tcsetattr(process.stdin, TERMIOS_RAW);
}

const RESET: ProcessMain = (argv, process) => {
  if (isatty(process.stdout)) {
    tcsetattr(process.stdout, TERMIOS_COOKED);
    process.stdout.write('\x1bc');
  }
  process.exit();
}

const COMMANDS: ProcessMain = (argv, process) => {
  const commands = Object.keys(KNOWN_COMMANDS);
  commands.sort((a, b) => a.localeCompare(b));
  for (let i = 0; i < commands.length; ++i) {
    process.stdout.write(`${commands[i]}\n`);
  }
  process.exit();
}

const KNOWN_COMMANDS: {[key: string]: ProcessMain} = {
  'fun': FUN,
  'echo': ECHO,
  'stty': STTY,
  'raw': RAW,
  'reset': RESET,
  'commands': COMMANDS
};
