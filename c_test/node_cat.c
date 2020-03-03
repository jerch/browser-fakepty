#include <emscripten.h>
#include <stdio.h>
#include <unistd.h>
//#include <fakepty_termios.h>
//#include <fakepty_tty_ioctl.h>
#include <termios.h>

/**
 * cat in C/emscripten to work with TTY stdin in nodejs.
 *
 * Evil hack around nodejs and emscripten limitations:
 * - nodejs sets stdin into raw mode (?), not possible to operate on fd level
 * - TTY in emscripten is a very limited stub
 *    - stdin only works with pipe mode
 *    - stdout does not flush correctly
 *    - no termios handling
 *
 * compile:
 * emcc -O3 node_cat.c -s ASYNCIFY -s 'ASYNCIFY_IMPORTS=["getchar_js"]' -s ASYNCIFY_IGNORE_INDIRECT\
 * -s ENVIRONMENT=node -s EXPORT_NAME='"__CAT"' -s MODULARIZE_INSTANCE=1 -o cat.js
 *
 * run:
 * node a.out.js                  - works
 * echo hello | node a.out.js     - works
 *
 * run as loadable module:
 * emcc -O3 node_cat.c -s ASYNCIFY -s 'ASYNCIFY_IMPORTS=["getchar_js"]' -s ASYNCIFY_IGNORE_INDIRECT\
 * -s ENVIRONMENT=node -s EXPORT_NAME='"__CAT"' -s MODULARIZE=1 -o cat.js -s INVOKE_RUN=0\
 * -s EXTRA_EXPORTED_RUNTIME_METHODS="['callMain']
 * call in nodejs:
 * require('./cat.js')().then(Module => Module.callMain());
 *
 * last:
 * emcc -O0 node_cat.c -s ASYNCIFY -s 'ASYNCIFY_IMPORTS=["getchar_js"]' -s ASYNCIFY_IGNORE_INDIRECT\
 * -s EXPORT_NAME='"__CAT"' -s MODULARIZE=1 -o cat.js -s INVOKE_RUN=0\
 * -s EXTRA_EXPORTED_RUNTIME_METHODS="['callMain']" -s SINGLE_FILE=1 -s USE_CLOSURE_COMPILER=1
 *
 * append.js shim to talk to main thread
 */


EM_JS(char, getchar_js, (), {
  return Asyncify.handleSleep(function(wakeUp) {
    if (process.__inState.resolver) {
      // this must never happen (another getchar_js call is still pending?)
      // anyway resolve to -1
      wakeUp(-1);
    } else {
      new Promise(resolve => {
        process.__inState.resolver = resolve;
        process.__inState.poll();
      }).then(ret => wakeUp(ret));
    }
  });
});

EM_JS(void, startup, (), {
  process.bufferConcat = (a, b) => {
    var result = new (a.constructor)(a.length + b.length);
    result.set(a);
    result.set(b, a.length);
    return result;
  };
  process.__inState = {input: new Uint8Array(0), pos: 0, resolver: null, closed: false};
  process.__inState.poll = () => {
    if (process.__inState.pos < process.__inState.input.length) {
      process.__inState.resolver(process.__inState.input[process.__inState.pos++]);
      process.__inState.resolver = null;
    } else {
      if (process.__inState.closed) {
        process.__inState.resolver(-1);
        return;
      }
      if (process.__inState.input.length > 5) {
        process.__inState.input = new Uint8Array(0);
        process.__inState.pos = 0;
        process.stdin.resume();
      }
      setTimeout(() => process.__inState.poll(), 50); // this is ugly - refactor with waiting promise
    }
  };
  process.stdin.on("data", function (chunk) {
    process.__inState.input = process.bufferConcat(process.__inState.input, chunk);
    if (process.__inState.input.length > 5) {
      process.stdin.pause();
    }
  });

  process.stdin.on("end", function () {  
    process.__inState.closed = true;
  });
  process.stdin.resume();
});


EM_JS(char, putchar_js, (char c), {
  process.stdout.write(String.fromCharCode(c));
});


EM_JS(void, fill_termios, (
  struct termios *p,
  size_t bytes,
  unsigned int *iflags,
  unsigned int *oflags,
  unsigned int *lflags,
  unsigned char *cc
), {
  console.log('offset & size:', p, bytes);
  console.log('adresses:', iflags, oflags, lflags, cc);
  Module.setValue(iflags, 12345, 'i32');
  Module.setValue(oflags, 45678, 'i32');
  Module.setValue(lflags, 666, 'i32');
});


int main() {
  startup();
  struct termios p;
  fill_termios(&p, sizeof(struct termios), &p.c_iflag, &p.c_oflag, &p.c_lflag, &p.c_cc[0]);
  printf("termios filled: %d %d %d\n", p.c_iflag, p.c_oflag, p.c_lflag);
  printf("termios size: %d\n", sizeof(p));
  printf("cc offset: %d\n", ((int) &(p.c_cc)) - ((int) &p));
  //tcsetattr(0, 0, &p);
  //printf("tty: %d %d\n", isatty(0), isatty_js(0));
  char c;
  while((c = getchar_js()) != EOF) putchar_js(c);
  printf("\ndone with C\n");
  return 0;
}
