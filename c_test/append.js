// quick' dirty shim to talk over webworker messages

var stdinHandler = {};

var process = {
  stdin: {
    pause() {},
    resume() {},
    on(event, fn) {
      if (!stdinHandler[event]) stdinHandler[event] = [];
      stdinHandler[event].push(fn);
    }
  },
  stdout: {
    write(msg) {
      self.postMessage(['cat:', msg]);
    }
  }
};

self.onmessage = msg => {
  msg = msg.data;
  if (msg === 'EOF') {
    for (let i = 0; i < stdinHandler['end'].length; ++i) {
      stdinHandler['end'][i]();
    }
  } else if (msg === 'RUN') {
    __CAT().then(Module => Module.callMain());
  } else {
    const data = new TextEncoder().encode(msg);
    for (let i = 0; i < stdinHandler['data'].length; ++i) {
      stdinHandler['data'][i](data);
    }
  }
};
