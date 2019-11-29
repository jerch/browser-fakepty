import { ProcessMain, Process } from './Process';
import { IDisposable } from 'xterm';

export const FakeShell: ProcessMain = (argv, process) => {
  function showPrompt(): void {
    process.stdout.write('FakeShell $> ');
  }
  let currentReadHandler: IDisposable;

  // primitive shell REPL
  const readHandler = (data: string) => {
    console.log('process reads:', [data]);

    // eval and run sub process
    if (data === 'fun\n') {
      const p = new Process(FUN, (process.stdin as any)._tty, (process.stdout as any)._tty, (process.stderr as any)._tty);
      // disconnect shell from tty
      currentReadHandler?.dispose();
      // reconnect shell to tty when done
      p.afterExit(() => {
        console.log('EXIT subprogram "fun"');
        currentReadHandler = process.stdin.onData(readHandler);
        showPrompt();
      });
      p.run([], {});
    } else {
      if (data !== '\n') {
        process.stdout.write(`unknown command: "${data.slice(0, -1)}"\n`);
      }
      showPrompt();
    }
  }

  // startup
  currentReadHandler = process.stdin.onData(readHandler);
  process.stdout.write('\x1b[2J\x1b[H');
  showPrompt();
}

const FUN: ProcessMain = (argv, process) => {
  process.stdout.write('This actually does nothing more than printing this...\n');
  process.exit();
}