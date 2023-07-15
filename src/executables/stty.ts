import { IProcessModule } from '../Process';
import { isatty, tcgetattr, tcsetattr } from '../Tty';
import { IFlags, OFlags, LFlags, ITermios } from '../Termios';


/**
 * stty command.
 *
 * see https://pubs.opengroup.org/onlinepubs/009695399/utilities/cat.html
 *
 * TODO:
 * - implement all needed symbols
 * - implement default short output
 * - document stuff in --help
 */

const VERSION = 'v0.0.1';

function help(): string {
  return `Change or print tty settings.
Usage:   stty [settings]   Alter settings.
   or:   stty [-a]         Print settings in human readable form.
   or:   stty [-g]         Print settings in stty form.

TODO: document supported settings...\r\n`;
}

function reprCC(n: number): string {
  if (!n) return '<undef>';
  if (n < 0x20 || n === 0x7F) return '^' + String.fromCharCode((n + 0x40) & 0x7F);
  else return String.fromCharCode(n);
}

function isSet(flag: number): string {
  return flag ? '' : '-';
}

function printAll(termios: ITermios): string {
  const result: string[] = [];
  result.push([
    `intr = ${reprCC(termios.cc.VINTR)};`,
    `quit = ${reprCC(termios.cc.VQUIT)};`,
    `erase = ${reprCC(termios.cc.VERASE)};`,
    `kill = ${reprCC(termios.cc.VKILL)};`,
    `eof = ${reprCC(termios.cc.VEOF)};`,
    `eol = ${reprCC(termios.cc.VEOL)};`,
    `eol2 = ${reprCC(termios.cc.VEOL2)};`,
    `start = ${reprCC(termios.cc.VSTART)};`,
    `stop = ${reprCC(termios.cc.VSTOP)};`,
    `susp = ${reprCC(termios.cc.VSUSP)};`,
    `rprnt = ${reprCC(termios.cc.VREPRINT)};`,
    `werase = ${reprCC(termios.cc.VWERASE)};`,
    `lnext = ${reprCC(termios.cc.VLNEXT)};`,
    `discard = ${reprCC(termios.cc.VDISCARD)};`,
    `min = ${termios.cc.VMIN};`,
    `time = ${termios.cc.VTIME};`
  ].join(' '));
  let f: number = termios.iflags;
  result.push([
    `${isSet(f & IFlags.ISTRIP)}istrip`,
    `${isSet(f & IFlags.INLCR)}inlcr`,
    `${isSet(f & IFlags.IGNCR)}igncr`,
    `${isSet(f & IFlags.ICRNL)}icrnl`,
    `${isSet(f & IFlags.IUCLC)}iuclc`,
    `${isSet(f & IFlags.IXON)}ixon`,
    `${isSet(f & IFlags.IXANY)}ixany`,
    `${isSet(f & IFlags.IXOFF)}ixoff`,
    `${isSet(f & IFlags.IMAXBEL)}imaxbel`,
    `${isSet(f & IFlags.IUTF8)}iutf8`
  ].join(' '));
  f = termios.oflags;
  result.push([
    `${isSet(f & OFlags.OPOST)}opost`,
    `${isSet(f & OFlags.ONLCR)}onlcr`,
    `${isSet(f & OFlags.OCRNL)}ocrnl`,
    `${isSet(f & OFlags.ONOCR)}onocr`,
    `${isSet(f & OFlags.ONLRET)}onlret`
  ].join(' '));
  f = termios.lflags;
  result.push([
    `${isSet(f & LFlags.ISIG)}isig`,
    `${isSet(f & LFlags.ICANON)}icanon`,
    `${isSet(f & LFlags.ECHO)}echo`,
    `${isSet(f & LFlags.ECHOE)}echoe`,
    `${isSet(f & LFlags.ECHOK)}echok`,
    `${isSet(f & LFlags.ECHONL)}echonl`,
    `${isSet(f & LFlags.ECHOCTL)}echoctl`,
    `${isSet(f & LFlags.ECHOKE)}echoke`,
    `${isSet(f & LFlags.IEXTEN)}iexten`
  ].join(' '));
  return result.join('\r\n') + '\r\n';
}

function printMachine(t: ITermios): string {
  const result: number[] = [
    t.iflags,
    t.oflags,
    0,
    t.lflags,
    t.cc.VINTR,
    t.cc.VQUIT,
    t.cc.VERASE,
    t.cc.VKILL,
    t.cc.VEOF,
    t.cc.VTIME,
    t.cc.VMIN,
    0,
    t.cc.VSTART,
    t.cc.VSTOP,
    t.cc.VSUSP,
    t.cc.VEOL,
    t.cc.VREPRINT,
    t.cc.VDISCARD,
    t.cc.VWERASE,
    t.cc.VLNEXT,
    t.cc.VEOL2
  ];
  while (result.length < 36) {
    result.push(0);
  }
  return result.map(el => el.toString(16)).join(':') + '\n';
}

function handleArgs(argv: string[], t: ITermios, process: IProcessModule): number {
  // -a and -g should already be handled
  if (~argv.indexOf('-a') || ~argv.indexOf('-g')) {
    process.stderr.write('Error: -a and -g should be single arguments.\r\n');
    return 1;
  }
  // check and parse machine version
  if (argv.length === 1 && argv[0].match(/^([0-9A-Fa-f]+:){35}[0-9A-Fa-f]{1}$/g)) {
    const d = argv[0].split(':').map(el => parseInt(el, 16));
    if (d.length !== 36) {
      process.stderr.write('stty: Cannot process stty format string.\r\n');
      return 1;
    }
    t.iflags = d[0];
    t.oflags = d[1];
    // d[2] skipped
    t.lflags = d[3];
    t.cc.VINTR = d[4];
    t.cc.VQUIT = d[5];
    t.cc.VERASE = d[6];
    t.cc.VKILL = d[7];
    t.cc.VEOF = d[8];
    t.cc.VTIME = d[9];
    t.cc.VMIN = d[10];
    // d[11] skipped
    t.cc.VSTART = d[12];
    t.cc.VSTOP = d[13];
    t.cc.VSUSP = d[14];
    t.cc.VEOL = d[15];
    t.cc.VREPRINT = d[16];
    t.cc.VDISCARD = d[17];
    t.cc.VWERASE = d[18];
    t.cc.VLNEXT = d[19];
    t.cc.VEOL2 = d[20];
    tcsetattr(process.stdin, t);
    return 0;
  }

  // TODO: handle CC pairs

  // TODO: handle all other
  let i = t.iflags;
  let o = t.oflags;
  let l = t.lflags;
  for (const arg of argv) {
    switch (arg) {
      // iflags
      case 'istrip'   : i |= IFlags.ISTRIP; break;
      case 'inlcr'    : i |= IFlags.INLCR; break;
      case 'igncr'    : i |= IFlags.IGNCR; break;
      case 'icrnl'    : i |= IFlags.ICRNL; break;
      case 'iuclc'    : i |= IFlags.IUCLC; break;
      case 'ixon'     : i |= IFlags.IXON; break;
      case 'ixany'    : i |= IFlags.IXANY; break;
      case 'ixoff'    : i |= IFlags.IXOFF; break;

      case '-istrip'  : i &= ~IFlags.ISTRIP; break;
      case '-inlcr'   : i &= ~IFlags.INLCR; break;
      case '-igncr'   : i &= ~IFlags.IGNCR; break;
      case '-icrnl'   : i &= ~IFlags.ICRNL; break;
      case '-iuclc'   : i &= ~IFlags.IUCLC; break;
      case '-ixon'    : i &= ~IFlags.IXON; break;
      case '-ixany'   : i &= ~IFlags.IXANY; break;
      case '-ixoff'   : i &= ~IFlags.IXOFF; break;
      // oflags

      // lflags
      case 'isig'     : l |= LFlags.ISIG; break;
      case 'icanon'   : l |= LFlags.ICANON; break;
      case 'echo'     : l |= LFlags.ECHO; break;
      case 'echoe'    : l |= LFlags.ECHOE; break;
      case 'echok'    : l |= LFlags.ECHOK; break;
      case 'echonl'   : l |= LFlags.ECHONL; break;
      case 'echoctl'  : l |= LFlags.ECHOCTL; break;
      case 'iexten'   : l |= LFlags.IEXTEN; break;
      case '-isig'    : l &= ~LFlags.ISIG; break;
      case '-icanon'  : l &= ~LFlags.ICANON; break;
      case '-echo'    : l &= ~LFlags.ECHO; break;
      case '-echoe'   : l &= ~LFlags.ECHOE; break;
      case '-echok'   : l &= ~LFlags.ECHOK; break;
      case '-echonl'  : l &= ~LFlags.ECHONL; break;
      case '-echoctl' : l &= ~LFlags.ECHOCTL; break;
      // TODO: test proper IEXTEN deactivation
      case '-iexten': l &= ~LFlags.IEXTEN; break;
      default:
        process.stderr.write(`stty: unsupported setting "${arg}"\r\n`);
        return 1;
    }
  }

  // if we end up here, everything went well
  t.iflags = i;
  t.lflags = l;
  tcsetattr(process.stdin, t);
  return 0;
}


export default function main(argv: string[], process: IProcessModule) {
  if (!isatty(process.stdin)) {
    process.stderr.write('stty: STDIN is not a TTY.\r\n');
    process.exit();
    return;
  }

  const termios = tcgetattr(process.stdin);

  if (!argv.length) {
    process.stdout.write('short version not implemented, use -a switch.\r\n');
    process.exit();
    return;
  }

  // single argument
  if (argv.length === 1) {
    switch (argv[0]) {
      case '--help':
        process.stdout.write(help());
        process.exit(0);
        return;
      case '--version':
          process.stdout.write(VERSION + '\r\n');
          process.exit(0);
          return;
      case '-a':
        process.stdout.write(printAll(termios));
        process.exit(0);
        return;
      case '-g':
        process.stdout.write(printMachine(termios));
        process.exit(0);
        return;
      default:
        process.exit(handleArgs(argv, termios, process));
    }
    return;
  }
  // multiple arguments
  process.exit(handleArgs(argv, termios, process));
}
