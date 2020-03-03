/**
 * PIPE_BUF - POSIX: Maximum number of bytes that is guaranteed to be atomic when writing to a pipe.
 *                   Minimum Acceptable Value: {_POSIX_PIPE_BUF} (=512 bytes)
 * 
 * Currently we simply line up all write calls and do not split big writes into smaller chunks.
 * Thus all writes are atomic and a big write would block all others. This might change in future versions.
 * We also use PIPE_BUF as default size of the internal fifo buffer of a pipe. That size gets reported
 * with F_GETPIPE_SZ and can be altered with F_SETPIPE_SZ.
 */
export const PIPE_BUF = 512;


export const enum IOpenFlags {
  // these 3 are exclusive
  RDONLY = 0,
  WRONLY = 1,
  RDWR = 2,

  // FIXME: below fix symbol values (should match linux)
  APPEND = 2,
  //ASYNC,
  CLOEXEC = 4,
  CREAT = 8,
  DIRECT = 16,
  DIRECTORY = 32,
  DSYNC = 64,
  EXCL = 128,
  //LARGEFILE,
  NOATIME = 256,
  NOCTTY = 512,
  NOFOLLOW = 1024,
  NONBLOCK = 2048,
  //NDELAY,
  //PATH,
  SYNC = 4096,
  //TMPFILE,
  TRUNC = 8192,
}

// mask for exclusive RDONLY | WRONLY | RDWR handling
export const RDWR_MASK = IOpenFlags.RDONLY | IOpenFlags.WRONLY | IOpenFlags.RDWR;

// ioctl/fcntl for pipe
export const enum PIPE_CTL {
  /**
   * Pending bytes in internal pipe buffer. Can be read immediately.
   */
  FIONREAD,
  /**
   * Bytes of pending (blocked) writes. A read attempt might block.
   */
  FIONWRITE,
  /**
   * Get the size of the internal pipe buffer.
   */
  F_GETPIPE_SZ,
  /**
   * Set the size of the internal pipe buffer.
   */
  F_SETPIPE_SZ
}


export const enum POLL_EVENTS {
  POLLIN = 1,     // There is data to read.
  POLLPRI = 2,    // exceptional condition on fd, tty: state change of pty slave, see ioctl_tty(2)
  POLLOUT = 4,    // Writing is now possible, larger chunk that the available space will block (unless O_NONBLOCK)
  POLLRDHUP = 8,  // socket: reader closed (not used for pipes?)
  POLLERR = 16,   // (ignored in events) some error condition, also set on writer if read end has been closed
  POLLHUP = 32,   // (ignored in events) writer hang up, there might be pending read data
  POLLNVAL = 64   // (ignored in events) invalid request: fd not open
}
export const POLL_REVENTS_MASK = POLL_EVENTS.POLLERR | POLL_EVENTS.POLLHUP | POLL_EVENTS.POLLNVAL;
