#include <emscripten.h>
#include <stdio.h>
#include <unistd.h>

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
 */


EM_JS(char, getchar_js, (), {
  return Asyncify.handleSleep(function(wakeUp) {
    if (__CAT.__inState.resolver) {
      // this must never happen (another getchar_js call is still pending?)
      // anyway resolve to -1
      wakeUp(-1);
    } else {
      new Promise(resolve => {
        __CAT.__inState.resolver = resolve;
        __CAT.__inState.poll();
      }).then(ret => wakeUp(ret));
    }
  });
});

EM_JS(void, startup, (), {
  __CAT.__inState = {input: Buffer.alloc(0), pos: 0, resolver: null, closed: false};
  __CAT.__inState.poll = () => {
    if (__CAT.__inState.pos < __CAT.__inState.input.length) {
      __CAT.__inState.resolver(__CAT.__inState.input[__CAT.__inState.pos++]);
      __CAT.__inState.resolver = null;
    } else {
      if (__CAT.__inState.closed) {
        __CAT.__inState.resolver(-1);
        return;
      }
      if (__CAT.__inState.input.length > 5) {
        __CAT.__inState.input = Buffer.alloc(0);
        __CAT.__inState.pos = 0;
        process.stdin.resume();
      }
      setTimeout(() => __CAT.__inState.poll(), 10); // this is ugly - refactor with waiting promise
    }
  };
  process.stdin.on("data", function (chunk) {
    __CAT.__inState.input = Buffer.concat([__CAT.__inState.input, chunk]);
    if (__CAT.__inState.input.length > 5) {
      process.stdin.pause();
    }
  });

  process.stdin.on("end", function () {  
    __CAT.__inState.closed = true;
  });
  process.stdin.resume();
});


EM_JS(char, putchar_js, (char c), {
  if (process && process.stdout) process.stdout.write(String.fromCharCode(c));
});

EM_JS(int, isatty_js, (int fd), {
  return require('tty').isatty(fd);
});

int main() {
  startup();
  char c;
  printf("tty: %d\n", isatty_js(0));
  while((c = getchar_js()) != EOF) putchar_js(c);
  printf("\ndone with C\n");
  return 0;
}
