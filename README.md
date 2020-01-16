## fake-pty for browser env.

This library tries to mimick parts of POSIX's tty interface to be used with xterm.js in local browser mode.

### TODO:
- identify useable/unusable termios entries
  - get ICANON on par with linux
  - job control (only in a limited fashion possible)
  - find suitable shims for signalling (via init process with process table)
  - skip any stuff not needed for terminal line handling (no parity stuff etc.)
- issues with current tty impl:
  - proper accounting of cursor advance (needed for erase in ICANON)
  - reshape tty/pty with proper interfaces for signalling / process control
  - proper pause/resume with backpressure shim
- init process with limited process management
- define & cleanup interfaces
- tests
- maybe integrate memfs as example fs impl

### Quirks to work around:
- no preemptive multitasking  
  There is no way to solve this without big sacrifices on JS level. To fully mimick POSIX job / process control, basically any JS code has to be stoppable / interruptable. There are ways to partially fake this by using generators for executable code, it still would be cooperative style as any generator step could block forever or never return. Enforcing unidiomatic code style is bad, also generators still have many issues (bad perf, screwed up stacktrace). SIGTERM / SIGKILL can be emulated with webworkers (maybe coming as a later extension), SIGSTP or SIGSTOP never gonna work. Load balancing / nice never gonna work. For now all "processes" need to behave as good citizens and always have to respect signal events in a certain way (its the executable's responsibility to end all pending async actions on `onExit`).
- no fork/exec  
  There is no way to fake the fork/exec model for executables, we simply cannot do a partial "copy-on-write" of executables. Thus the process model relies on full process creation from scratch (pretty much as in Windows). This way an executable can stay a simple JS function, while the process object is just a bunch of interfaces to provide standard pipes and some book keeping for the outer env.
- process management  
  This is in a very early stage. Planned is a master init process, that also holds a process table and assigns pid/ppid (much like the init process and process management done by kernel in one place). This way `kill` with proper signal bubbling can be implemented.
- process isolation  
  There are no plans to enforce isolation by any means. Currently an executable can be any JS function, which follows the JS scoping rules. A later webworker extension might provide better isolation. TODO: revise whether `this` needs special treatment.
- job control  
  Any executable directly attached to the pty automatically becomes session leader (typically a shell). Advanced handling with process groups and fg/bg jobs is not implemented, a shell starting a process or several processes as a job should detach itself from the tty and treat the running processes as a single fg process group. On exit the shell should reattach itself to the tty. It is currently implemented that way in `FakeShell`. This might change once the init process is implemented and can take more responsibility.


### State:
This is in an early alpha state, thus dont expect anything being usable or stable yet.

### Early testing:

Run `npm install && npm start` and open your browser at `localhost:8080`. There is an early version of a shell, that can execute commands defined in `src/Shell.ts`.
