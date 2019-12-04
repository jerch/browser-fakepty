# fake-pty for browser env.

This library tries to mimick parts of POSIX's tty interface to be used with xterm.js in local browser mode.

## TODO:
- identify useable/unusable termios entries
  - get ICANON on par with linux
  - job control?
  - find suitable shims for signalling
  - skip any stuff not needed for terminal line handling (no parity stuff etc.)
- better pipe handling with exit states
- better process handling with correct exit state propagation
- make `Process` promise based
- workaround for blocking reads
- define & cleanup interfaces
- tests

## State:
This is in an early alpha state, thus dont expect anything being usable or stable yet.

## Early testing:

Run `npm install && npm start` and open your browser at `localhost:8080`. There is an early version of a shell, that can execute commands defined in `src/Shell.ts`.
