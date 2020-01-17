import { ProcessMain, Process } from './Process';
import { IDisposable } from 'xterm';
import { Pipe, getLogPipe } from './Pipe';
import { tcsetattr, isatty, tcgetattr } from './Tty';
import { TERMIOS_RAW, TERMIOS_COOKED, IFlags, OFlags, LFlags } from './Termios';
import { IPipe } from './Types';
import STTY from './executables/stty';

/**
 * Simple line based shell REPL.
 */
export const FakeShell: ProcessMain = (argv, process) => {
  interface ICmd {
    cmd: string;
    argv: string[];
    error: string;
  }
  let currentReadHandler: IDisposable;
  let lastExitCode = 0;   // TODO: provide $? var
  let shellTermios = tcgetattr(process.stdin);
  function showPrompt(): void {
    process.stdout.write('FakeShell> ');
  }
  function parseCommand(data: string): ICmd[] {
    const result: ICmd[] = [{cmd: '', argv: [], error: ''}];
    let cmdPos = 0;
    data = data.trim();
    if (!data) return result;
    if (!~data.indexOf(' ')) {
      result[cmdPos].cmd = data;
      return result;
    }
    result[cmdPos].cmd = data.slice(0, data.indexOf(' '));
    data = data.slice(data.indexOf(' ') + 1).trim();
    if (!~data.indexOf('"')) {
      if (!~data.indexOf('|')) {
        result[cmdPos].argv = data.split(/\s+/);
        return result;
      }
    }
    const parts = data.split('"');
    if (parts.length % 2 === 0) {
      result[cmdPos].error = 'unterminated argument';
      return result;
    }
    let isCmd = false;
    for (let i = 0; i < parts.length; ++i) {
      let part = parts[i].trim();
      if (!part) continue;
      if (i % 2) {
        result[cmdPos].argv.push(part);
      } else {
        part = part.replace(/[|]/g, ' | ');
        const sub = part.split(/\s+/);
        for (let i = 0; i < sub.length; ++i) {
          if (sub[i] === '|') {
            result.push({cmd: '', argv: [], error: ''});
            cmdPos++;
            isCmd = true;
            continue;
          }
          if (isCmd) {
            result[cmdPos].cmd = sub[i];
            isCmd = false;
          } else {
            if (sub[i]) {
              result[cmdPos].argv.push(sub[i]);
            }
          }
        }
      }
    }
    return result;
  }
  function evalCommand(cmd: ICmd[]): boolean {
    // basic error checks
    if (cmd[0].error) {
      process.stdout.write(`[Error]: ${cmd[0].error}\n`);
      return false;
    }
    if (!cmd[0].cmd) {
      return false;
    }
    // check if programs are available
    const progs = cmd.map(el => el.cmd);
    for (const prog of progs) {
      if (!(prog in KNOWN_COMMANDS)) {
        process.stdout.write(`unknown command: "${prog}"\nType \`commands\` to see a list of supported commands.\n`);
        return false;
      }
    }
    return true;
  }
  function runCommand(cmd: ICmd[]): void {
    // create pipes
    const ttyIn = (process.stdin as any)._tty;
    const ttyOut = (process.stdout as any)._tty;
    const pipes: IPipe[] = [];
    for (let i = 0; i < cmd.length - 1; ++i) {
      pipes.push(new Pipe());
    }
    // create processes
    const processes: Process[] = [];
    for (let i = 0; i < cmd.length; ++i) {
      if (i === 0) {
        processes.push(new Process(KNOWN_COMMANDS[cmd[0].cmd], ttyIn, pipes[0] || ttyOut, pipes[0] || ttyOut));
      } else if (i === cmd.length - 1) {
        processes.push(new Process(KNOWN_COMMANDS[cmd[cmd.length - 1].cmd], pipes[pipes.length - 1] || ttyIn, ttyOut, ttyOut));
      } else {
        processes.push(new Process(KNOWN_COMMANDS[cmd[i].cmd], pipes[i - 1], pipes[i], pipes[i]));
      }
    }
    // detach shell from tty
    currentReadHandler?.dispose();
    // reattach after last process is gone
    processes[processes.length - 1].afterExit(() => {
      // dont restore old termios settings by default to allow stty changes take effect
      // NOTE: to still recover from raw settings: LF reset LF (LF is Ctrl-J)
      // tcsetattr(process.stdin, shellTermios);
      currentReadHandler = process.stdin.onData(readHandler);
      showPrompt();
    });
    // grab exit code from last process
    processes[processes.length - 1].onExit(statusCode => { lastExitCode = statusCode; });
    // run processes
    for (let i = 0; i < processes.length; ++i) {
      // handle data === null in fg; TODO: better fg distinction
      processes[i].stdin.onData(data => { if (data === null) processes[i].exit(); });
      processes[i].run(cmd[i].argv, {...process.env, SHELL: 'FakeShell'});
    }
  }

  // primitive REPL
  let cmdstring = '';
  const readHandler = (data: string) => {
    if (data === null) {
      // shell exit
      process.exit();
      return;
    }
    // FIXME: write handling of messed up termios settings (entry for `reset`)
    cmdstring += data;

    // parse, eval and run
    if (cmdstring.endsWith('\n')) {
      const cmd = parseCommand(cmdstring);
      cmdstring = '';
      if (evalCommand(cmd)) runCommand(cmd);
      else showPrompt();
    }
  }

  process.onExit(() => process.stdout.write('\n[Exiting FakeShell]\n'));

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
  process.stdout.write(
    argv.join(' ')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\x([0-9A-Fa-f][0-9A-Fa-f])/g, (m, p1) => String.fromCharCode(parseInt(p1, 16)))
    + '\n'
  );
  process.exit();
}

/**
 * Simple wc implementation.
 */
const WC: ProcessMain = (argv, process) => {
  let gChars = 0;
  let gLines = 0;
  let gWords = 0;
  let lastChunk = '';

  process.onExit(() => process.stdout.write(`\t${gLines}\t${gWords}\t${gChars}\n`));

  process.stdin.onData(data => {
    // last chunk is null in interactive mode
    if (data === null) {
      return;
    }

    gChars += data.length;
    data += lastChunk;
    lastChunk = '';
    const lines = data.split('\n');
    gLines += lines.length;
    for (let i = 0; i < lines.length; ++i) {
      const words = lines[i].split(/\s+/);
      gWords += words.filter(Boolean).length;
      if (i === lines.length - 1) {
        // fix split last word
        if (words[words.length - 1]) {
          gWords--;
          lastChunk = words[words.length - 1];
        } else if (lines[i] === '') {
          gLines--;
          lastChunk = '\n';
        }
      }
    }
  });
}

/**
 * Testing raw mode...
 */
const RAW: ProcessMain = (argv, process) => {
  const oldTermios = tcgetattr(process.stdin);

  process.stdout.write('Exit with Ctrl-D.\r\n');
  tcsetattr(process.stdin, TERMIOS_RAW);

  process.stdin.onData(data => {
    if (data === '\x04') {
      tcsetattr(process.stdin, oldTermios);
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
    process.stdout.write(`byte read: "${escaped}"\r\n`);
  });
}

const RESET: ProcessMain = (argv, process) => {
  if (isatty(process.stdout)) {
    tcsetattr(process.stdout, TERMIOS_COOKED);
    process.stdout.write('\x1bc');
  }
  setTimeout(() => process.exit(), 300);
}

const CAT: ProcessMain = (argv, process) => {
  process.stdin.onData(data => {
    if (data !== null) {
      process.stdout.write(data);
    }
  });
}

const SLEEP: ProcessMain = (argv, process) => {
  let seconds;
  if (argv.length !== 1 || isNaN(seconds = parseFloat(argv[0]))) {
    process.stderr.write('sleep: illegal operant\n');
    process.exit(1);
  }
  setTimeout(() => process.exit(), seconds * 1000);
}

const EXPORT: ProcessMain = (argv, process) => {
  if (argv.length) {

  } else {
    for (const key of Object.keys(process.env).sort()) {
      process.stdout.write(`${key}=${process.env[key]}\n`);
    }
  }
  process.exit();
}

const LONGRUN: ProcessMain = (argv, process) => {
  let running = true;
  process.onExit(() => { running = false; });

  async function main(): Promise<void> {
    let counter = 0;
    while(running) {
      process.stdout.write(`${counter++}\n`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  main();
};

// tee to console.log
const LOG: ProcessMain = (argv, process) => {
  const logWriter = getLogPipe().getWriter();
  process.stdin.onData(data => {
    if (data !== null) {
      process.stdout.write(data);
      logWriter.write(data);
    }
  });
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
  'commands': COMMANDS,
  'wc': WC,
  'cat': CAT,
  'sleep': SLEEP,
  'export': EXPORT,
  'longrun': LONGRUN,
  'log': LOG
};

// missing shell operators: &&, ||, ;, redirects
// missing process primitives: cterm, fg, bg
