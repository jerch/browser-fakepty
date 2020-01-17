export const enum IFlags {
  //IGNBRK = 1,
  //BRKINT = 2,
  //IGNPAR = 4,
  //PARMRK = 8,
  //INPCK = 16,
  ISTRIP = 32,    // Strip off eighth bit.
  INLCR = 64,     // Translate NL to CR on input.
  IGNCR = 128,    // Ignore CR on input.
  ICRNL = 256,    // Translate CR to NL on input (unless IGNCR is set).
  IUCLC = 512,    // Map uppercase characters to lowercase on input. (IEXTEN)
  IXON = 1024,    // Enable XON/XOFF flow control on output.
  IXANY = 2048,   // Typing any character will restart stopped output (default is just START character).
  IXOFF = 4096,   // Enable XON/XOFF flow control on input.
  IMAXBEL = 8192, // Ring bell when input queue is full.
  IUTF8 = 16384   // Input is UTF8 (used for cooked mode editing).
}

export const enum OFlags {
  OPOST = 1,      // Enable implementation-defined output processing.
  //OLCUC = 2,    // Map lowercase characters to uppercase on output.
  ONLCR = 4,      // Map NL to CR-NL on output.
  OCRNL = 8,      // Map CR to NL on output.
  ONOCR = 16,     // Don't output CR at column 0.
  ONLRET = 32,    // Don't output CR.
  //OFILL = 64,   // Send fill characters for a delay, rather than using a timed delay.
  //OFDEL = 128,
  //NLDLY = 256,
  //CRDLY = 1536,
  //TABDLY = 6144,
  //BSDLY = 8192,
  //VTDLY = 16384,
  //FFDLY = 32768,
  //TAB0 = 0,
  //TAB3 = 6144
}

export const enum LFlags {
  ISIG = 1,       // INTR, QUIT, SUSP, or DSUSP generate the corresponding signal.
  ICANON = 2,     // Enable canonical mode.
  //XCASE = 4,    // (ICANON) Uppercse terminal only. Input is converted to lowercase.
  ECHO = 8,       // Echo input characters.
  ECHOE = 16,     // (ICANON) ERASE character erases the preceding input character, and WERASE erases the preceding word.
  ECHOK = 32,     // (ICANON) KILL character erases the current line.
  ECHONL = 64,    // (ICANON) Echo the NL character even if ECHO is not set.
  ECHOCTL = 512,  // (ECHO) Control codes are echoed as ^(code + 0x40), not for TAB, NL, START, and STOP.
  //ECHOPRT = 1024, // (ICANON+ECHO) Characters are printed as they are being erased.
  ECHOKE = 2048,  // (ICANON) KILL is echoed by erasing each character on the line.
  //DEFECHO
  //FLUSHO = 4096,  // Output is being flushed.
  //NOFLSH = 128,   // Disable flushing the input and output queues when generating signals for the INT, QUIT, and SUSP.
  //TOSTOP = 256,   // Send the SIGTTOU signal to the process group of a bg process which tries to write to the terminal.
  //PENDIN = 16384, // All characters in the input queue are reprinted when the next character is read.
  IEXTEN = 32768,   // Enable implementation-defined input processing.
  //EXTPROC = 65536
}

/**
Linux
VINTR: 0
VQUIT: 1
VERASE: 2
VKILL: 3
VEOF: 4
VTIME: 5
VMIN: 6

VSTART: 8
VSTOP: 9
VSUSP: 10
VEOL: 11
VREPRINT: 12
VDISCARD: 13
VWERASE: 14
VLNEXT: 15
VEOL2: 16

OSX (Mojave)
VEOF: 0
VEOL: 1
VEOL2: 2
VERASE: 3
VWERASE: 4
VKILL: 5
VREPRINT: 6

VINTR: 8
VQUIT: 9
VSUSP: 10
VDSUSP: 11
VSTART: 12
VSTOP: 13
VLNEXT: 14
VDISCARD: 15
VMIN: 16
VTIME: 17
VSTATUS: 18
 */

export interface CC {
    VDISCARD: number;   // (017, SI, Ctrl-O) Toggle: start/stop discarding pending output. (IEXTEN)
    VEOF: number;       // (004, EOT, Ctrl-D) End-of-file character (EOF). (ICANON)
    VEOL: number;       // (0, NUL) Additional end-of-line character (EOL). (ICANON)
    VEOL2: number;      // (0, NUL) Yet another end-of-line character (EOL2). (ICANON)
    VERASE: number;     // (0177, DEL, rubout, or 010, BS, Ctrl-H, or also #) Erase character (ERASE). (ICANON)
                        // This erases the previous not-yet-erased character, but does not erase past EOF or beginning-of-line.
    VINTR: number;      // (003, ETX, Ctrl-C, or also 0177, DEL, rubout) Interrupt character (INTR). (ICANON)
                        // Send a SIGINT signal.  (ISIG)
    VKILL: number;      // (025, NAK, Ctrl-U, or Ctrl-X, or also @) Kill character (KILL).
                        // This erases the input since the last EOF or beginning-of-line. (ICANON)
    VLNEXT: number;     // (026, SYN, Ctrl-V) Literal next (LNEXT).  Quotes the next input character,
                        // depriving it of a possible special meaning. (IEXTEN)
    VMIN: number;       // Minimum number of characters for noncanonical read (MIN).
    VQUIT: number;      // (034, FS, Ctrl-\) Quit character (QUIT).  Send SIGQUIT signal. (ISIG)
    VREPRINT: number;   // (022, DC2, Ctrl-R) Reprint unread characters (REPRINT). (ICANON+IEXTEN)
    VSTART: number;     // (021, DC1, Ctrl-Q) Start character (START).  Restarts output stopped by the Stop character. (IXON)
    //VSTATUS: number;  // (024, DC4, Ctrl-T).  Status character (STATUS).
    VSTOP: number;      // (023, DC3, Ctrl-S) Stop character (STOP).  Stop output until Start character typed. (IXON)
    VSUSP: number;      // (032, SUB, Ctrl-Z) Suspend character (SUSP).  Send SIGTSTP signal. (ISIG)
    VTIME: number;      // Timeout in deciseconds for noncanonical read (TIME).
    VWERASE: number;    // (027, ETB, Ctrl-W) Word erase (WERASE). (ICANON+IEXTEN)
}

export interface ITermios {
  iflags: IFlags;
  oflags: OFlags;
  lflags: LFlags;
  cc: CC;
}

const DEFAULT_CC: CC = Object.freeze({
  VDISCARD: 15,
  VEOF: 4,
  VEOL: 0,
  VEOL2: 0,
  VERASE: 127,
  VINTR: 3,
  VKILL: 21,
  VLNEXT: 22,
  VMIN: 1,
  VQUIT: 28,
  VREPRINT: 18,
  VSTART: 17,
  VSTOP: 19,
  VSUSP: 26,
  VTIME: 0,
  VWERASE: 24 // temp. set to Ctrl-X, orig. Ctrl-W: 23
});

export const TERMIOS_COOKED: ITermios = Object.freeze({
  iflags: IFlags.ICRNL | IFlags.IXON | IFlags.IUTF8,
  oflags: OFlags.OPOST | OFlags.ONLCR,
  lflags: LFlags.ECHOKE | LFlags.ECHOCTL | LFlags.ECHOK | LFlags.ECHOE | LFlags.ECHO |
          LFlags.ICANON | LFlags.IEXTEN | LFlags.ISIG,
  cc: DEFAULT_CC
});

export const TERMIOS_CBREAK: ITermios = Object.freeze({
  iflags: IFlags.ICRNL | IFlags.IXON | IFlags.IUTF8,
  oflags: OFlags.OPOST | OFlags.ONLCR,
  lflags: LFlags.ECHOKE | LFlags.ECHOCTL | LFlags.ECHOK | LFlags.ECHOE | LFlags.IEXTEN | LFlags.ISIG,
  cc: DEFAULT_CC
});

export const TERMIOS_RAW: ITermios = Object.freeze({
  iflags: 0,
  oflags: 0,
  lflags: 0,
  cc: DEFAULT_CC
});

export const enum When {
  TCSANOW,
  TCSADRAIN,
  TCSAFLUSH
}
