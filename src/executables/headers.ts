import { IProcessModule } from '../Process';
import { TTY_IOCTL } from '../Tty';

/**
 * TODO: remove unsupported defines, tmpl values in/from JS
 */

const TERMIOS_TMPL = `
/**
 * fakepty_termios.h
 * 
 * termios definitions for fakepty.
 */
#ifndef	_FAKEPTY_TERMIOS_H_
#define _FAKEPTY_TERMIOS_H_

#ifdef __cplusplus
extern "C" {
#endif

/* FILE: bits/termios.h */

typedef unsigned char   cc_t;
typedef unsigned int    speed_t;
typedef unsigned int    tcflag_t;

#define NCCS 32
struct termios {
    tcflag_t c_iflag;           /* input mode flags */
    tcflag_t c_oflag;           /* output mode flags */
    tcflag_t c_cflag;           /* control mode flags */
    tcflag_t c_lflag;           /* local mode flags */
    cc_t c_line;                /* line discipline */
    cc_t c_cc[NCCS];            /* control characters */
    speed_t c_ispeed;           /* input speed */
    speed_t c_ospeed;           /* output speed */
};
#define _HAVE_STRUCT_TERMIOS_C_ISPEED 1
#define _HAVE_STRUCT_TERMIOS_C_OSPEED 1

/* c_cc characters */
#define VINTR     0
#define VQUIT     1
#define VERASE    2
#define VKILL     3
#define VEOF      4
#define VTIME     5
#define VMIN      6
#define VSWTC     7
#define VSTART    8
#define VSTOP     9
#define VSUSP     10
#define VEOL      11
#define VREPRINT  12
#define VDISCARD  13
#define VWERASE   14
#define VLNEXT    15
#define VEOL2     16

/* c_iflag bits */
#define IGNBRK  0000001
#define BRKINT  0000002
#define IGNPAR  0000004
#define PARMRK  0000010
#define INPCK   0000020
#define ISTRIP  0000040
#define INLCR   0000100
#define IGNCR   0000200
#define ICRNL   0000400
#define IUCLC   0001000
#define IXON    0002000
#define IXANY   0004000
#define IXOFF   0010000
#define IMAXBEL 0020000
#define IUTF8   0040000

/* c_oflag bits */
#define OPOST   0000001
#define OLCUC   0000002
#define ONLCR   0000004
#define OCRNL   0000010
#define ONOCR   0000020
#define ONLRET  0000040
#define OFILL   0000100
#define OFDEL   0000200

/* c_cflag bit meaning */
/* currently none supported */

/* c_lflag bits */
#define ISIG    0000001
#define ICANON  0000002
#define XCASE   0000004
#define ECHO    0000010
#define ECHOE   0000020
#define ECHOK   0000040
#define ECHONL  0000100
#define NOFLSH  0000200
#define TOSTOP  0000400
#define ECHOCTL 0001000
#define ECHOPRT 0002000
#define ECHOKE  0004000
#define FLUSHO  0010000
#define PENDIN  0040000
#define IEXTEN  0100000

/* tcflow() and TCXONC use these */
#define TCOOFF        0
#define TCOON         1
#define TCIOFF        2
#define TCION         3

/* tcflush() and TCFLSH use these */
#define TCIFLUSH      0
#define TCOFLUSH      1
#define TCIOFLUSH     2

/* tcsetattr uses these */
#define TCSANOW       0
#define TCSADRAIN     1
#define TCSAFLUSH     2


/* FILE: termios.h */
speed_t cfgetospeed(const struct termios *);      /* Return the output baud rate. */
speed_t cfgetispeed(const struct termios *);      /* Return the input baud rate. */
int cfsetospeed(struct termios *, speed_t);       /* Set the output baud rate. */
int cfsetispeed(struct termios *, speed_t);       /* Set the input baud rate. */
int cfsetspeed(struct termios *, speed_t);        /* Set both the input and output baud rates. */

int tcgetattr(int, struct termios *);             /* Get termios state of fd.  */
int tcsetattr(int, int, const struct termios *);  /* Set termios state of fd. */

void cfmakeraw(struct termios *);                 /* Set termios to raw mode. */

int tcsendbreak(int, int);                        /* Send zero bits. */
int tcdrain(int);                                 /* Wait for draining of pending data. */
int tcflush(int, int);                            /* Flush pending data. */
int tcflow(int, int);                             /* Suspend or restart transmission. */
pid_t tcgetsid(int);                              /* Get process group ID for session leader. */

#ifdef __cplusplus
}
#endif

#include "fakepty_ttydefaults.h"

#endif /* _FAKEPTY_TERMIOS_H_ */
`;

const TTYDEFAULTS_TMPL = `
/**
 * fakepty_ttydefaults.h
 * 
 * System wide defaults for terminal state.
 */
#ifndef _FAKEPTY_TTYDEFAULTS_H_
#define _FAKEPTY_TTYDEFAULTS_H_

/* Defaults on "first" open. */
#define TTYDEF_IFLAG    (BRKINT | ISTRIP | ICRNL | IMAXBEL | IXON | IXANY)
#define TTYDEF_OFLAG    (OPOST | ONLCR | XTABS)
#define TTYDEF_LFLAG    (ECHO | ICANON | ISIG | IEXTEN | ECHOE | ECHOKE | ECHOCTL)
#define TTYDEF_CFLAG    (CREAD | CS7 | PARENB | HUPCL)
#define TTYDEF_SPEED    (B9600)

/* Control Character Defaults */
#define CTRL(x) (x&037)
#define CEOF            CTRL('d')
#define CEOL            0
#define CERASE          0177
#define CINTR           CTRL('c')
#define CSTATUS         0
#define CKILL           CTRL('u')
#define CMIN            1
#define CQUIT           034             /* FS, ^\ */
#define CSUSP           CTRL('z')
#define CTIME           0
#define CDSUSP          CTRL('y')
#define CSTART          CTRL('q')
#define CSTOP           CTRL('s')
#define CLNEXT          CTRL('v')
#define CDISCARD        CTRL('o')
#define CWERASE         CTRL('w')
#define CREPRINT        CTRL('r')
#define CEOT            CEOF
/* compat */
#define CBRK            CEOL
#define CRPRNT          CREPRINT
#define CFLUSH          CDISCARD

cc_t ttydefchars[NCCS] = {
  CEOF, CEOL, CEOL, CERASE, CWERASE, CKILL, CREPRINT, 0,
  CINTR, CQUIT, CSUSP, CDSUSP, CSTART, CSTOP,  CLNEXT, CDISCARD,
  CMIN, CTIME, CSTATUS, 0
};

#endif  /* _FAKEPTY_TTYDEFAULTS_H_ */
`;

const IOCTL_TMPL = `
/**
 * fakepty_tty_ioctl.h
 * 
 * TTY ioctls for fakepty.
 */
#ifndef	_FAKEPTY_TTYIOCTL_H_
#define _FAKEPTY_TTYIOCTL_H_

/* FILE: asm-generic/ioctl.h */

#define _IOC_NONE      0U
#define _IOC_WRITE     1U
#define _IOC_READ      2U

#define _IOC(dir,type,nr,size) ( ((dir) << 30) | ((type) << 8) | (nr) | ((size) << 16) )
#define _IO(type,nr)            _IOC(_IOC_NONE,(type),(nr),0)
#define _IOR(type,nr,size)      _IOC(_IOC_READ,(type),(nr),sizeof(size))
#define _IOW(type,nr,size)      _IOC(_IOC_WRITE,(type),(nr),sizeof(size))

/* FILE: asm-gneric/ioctls.h */

#define TCGETS          0x5401
#define TCSETS          0x5402
#define TCSETSW         0x5403
#define TCSETSF         0x5404

/* unsupported - no termio interface */
// #define TCGETA          0x5405
// #define TCSETA          0x5406
// #define TCSETAW         0x5407
// #define TCSETAF         0x5408

#define TCSBRK          0x5409
#define TCXONC          0x540A
#define TCFLSH          0x540B
#define TIOCEXCL        0x540C
#define TIOCNXCL        0x540D
#define TIOCSCTTY       0x540E
#define TIOCGPGRP       0x540F
#define TIOCSPGRP       0x5410
#define TIOCOUTQ        0x5411
#define TIOCSTI         0x5412
#define TIOCGWINSZ      0x5413
#define TIOCSWINSZ      0x5414

/* unsupported - no modem support */
// #define TIOCMGET        0x5415
// #define TIOCMBIS        0x5416
// #define TIOCMBIC        0x5417
// #define TIOCMSET        0x5418

/* unsupported - no clocal settings */
// #define TIOCGSOFTCAR    0x5419
// #define TIOCSSOFTCAR    0x541A

#define FIONREAD        0x541B
#define TIOCINQ         FIONREAD
// #define TIOCLINUX       0x541C
#define TIOCCONS        0x541D
// #define TIOCGSERIAL     0x541E
// #define TIOCSSERIAL     0x541F
// #define TIOCPKT         0x5420
// #define FIONBIO         0x5421
#define TIOCNOTTY       0x5422
#define TIOCSETD        0x5423
#define TIOCGETD        0x5424
#define TCSBRKP         0x5425  /* Needed for POSIX tcsendbreak() */
#define TIOCSBRK        0x5427  /* BSD compatibility */
#define TIOCCBRK        0x5428  /* BSD compatibility */
#define TIOCGSID        0x5429  /* Return the session ID of FD */
#define TCGETS2         _IOR('T', 0x2A, struct termios2)
#define TCSETS2         _IOW('T', 0x2B, struct termios2)
#define TCSETSW2        _IOW('T', 0x2C, struct termios2)
#define TCSETSF2        _IOW('T', 0x2D, struct termios2)
// #define TIOCGRS485      0x542E
// #ifndef TIOCSRS485
// #define TIOCSRS485      0x542F
// #endif
#define TIOCGPTN        _IOR('T', 0x30, unsigned int) /* Get Pty Number (of pty-mux device) */
#define TIOCSPTLCK      _IOW('T', 0x31, int)  /* Lock/unlock Pty */
#define TIOCGDEV        _IOR('T', 0x32, unsigned int) /* Get primary device node of /dev/console */
// #define TCGETX          0x5432 /* SYS5 TCGETX compatibility */
// #define TCSETX          0x5433
// #define TCSETXF         0x5434
// #define TCSETXW         0x5435
#define TIOCSIG         _IOW('T', 0x36, int)  /* pty: generate signal */
// #define TIOCVHANGUP     0x5437
// #define TIOCGPKT        _IOR('T', 0x38, int) /* Get packet mode state */
#define TIOCGPTLCK      _IOR('T', 0x39, int) /* Get Pty lock state */
#define TIOCGEXCL       _IOR('T', 0x40, int) /* Get exclusive mode state */
// #define TIOCGPTPEER     _IO('T', 0x41) /* Safely open the slave */

// #define FIONCLEX        0x5450
// #define FIOCLEX         0x5451
// #define FIOASYNC        0x5452
// #define TIOCSERCONFIG   0x5453
// #define TIOCSERGWILD    0x5454
// #define TIOCSERSWILD    0x5455
// #define TIOCGLCKTRMIOS  0x5456
// #define TIOCSLCKTRMIOS  0x5457
// #define TIOCSERGSTRUCT  0x5458 /* For debugging only */
// #define TIOCSERGETLSR   0x5459 /* Get line status register */
// #define TIOCSERGETMULTI 0x545A /* Get multiport config  */
// #define TIOCSERSETMULTI 0x545B /* Set multiport config */
// 
// #define TIOCMIWAIT      0x545C  /* wait for a change on serial input line(s) */
// #define TIOCGICOUNT     0x545D  /* read serial port __inline__ interrupt counts */


/* FILE: bits/ioctl-types.h */

struct winsize {
  unsigned short ws_row;
	unsigned short ws_col;
	unsigned short ws_xpixel;
	unsigned short ws_ypixel;
};
/* line disciplines */
#define N_TTY         0

#endif /* _FAKEPTY_TTYIOCTL_H_ */
`;

function help(): string {
  return `Get fakepty headers.
Call:   headers <name>    Get content for header name.
        headers --list    List available header names.
        headers --all     Get all headers separated by /* FILE */.
`;
}

export default function main(argv: string[], process: IProcessModule) {
  // we lack any FS abstraction, thus just output
  // header definitions to stdout

  const headers: {[key: string]: string} = {
    'fakepty_tty_ioctl.h': IOCTL_TMPL,
    'fakepty_ttydefaults.h': TTYDEFAULTS_TMPL,
    'fakepty_termios.h': TERMIOS_TMPL
  }

  if (!argv.length || argv.length > 1) {
    process.stdout.write(help());
    process.exit(0);
    return;
  }

  let ret = 0;
  switch (argv[0]) {
    case '--list':
      process.stdout.write(Object.keys(headers).join('\n') + '\n');
      break;
    case '--all':
      const data: string[] = [];
      for (const header in headers) {
        data.push(headers[header]);
      }
      process.stdout.write(data.join('\n/* FILE */\n') + '\n');
      break;
    default:
      const tmpl = headers[argv[0]];
      if (!tmpl) {
        process.stderr.write(`headers: "${argv[0]}" was not found.\n`);
        ret = 1;
      } else {
        process.stdout.write(tmpl + '\n');
      }
  }
  process.exit(ret);
}
