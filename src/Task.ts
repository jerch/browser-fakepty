import { IPipePort, BytePipe, BytePipePort } from './BytePipe';
import { IOpenFlags, RDWR_MASK } from './ObjectPipe';
import { ERRNO } from './errno';

export type TFileTableEntry = (IPipePort | null);
export type TExecutable = () => void;

export const enum StdFildes {
  STDIN_FILENO = 0,
  STDOUT_FILENO = 1,
  STDERR_FILENO = 2
}

export class Task {
  public id: number = 1;
  public parent: number = 0;
  public files: (IPipePort | null)[];

  constructor(exe: TExecutable, files: TFileTableEntry[], cterm: any) {
    this.files = kCloneFiles(files); // FIXME: move to run?
  }

  public run(): void {
    // TODO: set parent + id
  }



  // rudimentary c interface (mainly related to unistd.h)
  public errno = 0;
  public c_dup(fd: number): number {
    const orig = this.files[fd];
    if (orig) {
      return kAttachFile(this.files, orig.dup());
    }
    this.errno = ERRNO.EBADF;
    return -1;
  }

  public c_close(fd: number): number {
    if (this.files[fd]) {
      this.files[fd].close();
      return 0;
    }
    this.errno = ERRNO.EBADF;
    return -1;
  }

  public c_pipe(pipefd: number[], flags: IOpenFlags = 0): number {
    const pipe = new BytePipe();
    const reader = pipe.open((flags & ~RDWR_MASK) | IOpenFlags.RDONLY);
    const writer = pipe.open((flags & ~RDWR_MASK) | IOpenFlags.WRONLY);
    pipefd[0] = kAttachFile(this.files, reader);
    pipefd[1] = kAttachFile(this.files, writer);
    return 0;
  }

  public c_read(): void {}
  public c_write(): void {}
  public c_poll(): void {}
  public c_ioctl(): void {}
  public c_fcntl(): void {}

  // nodejs interface
  public get stdin(): IPipePort | null {
    return this.files[StdFildes.STDIN_FILENO];
  }
  public get stdout(): IPipePort | null {
    return this.files[StdFildes.STDOUT_FILENO];
  }
  public get stderr(): IPipePort | null {
    return this.files[StdFildes.STDERR_FILENO];
  }
}


export function kCloneFiles(files: TFileTableEntry[]): TFileTableEntry[] {
  const result: TFileTableEntry[] = [];
  for (let i = 0; i < files.length; ++i) {
    const orig = files[i];
    if (orig && !orig.closed && !(orig.flags & IOpenFlags.CLOEXEC)) {
      result.push(orig.dup());
    } else {
      result.push(null);
    }
  }
  if (result.length) {
    let last: IPipePort | null;
    while (!(last = result.pop()) && result.length) {}
    if (last) result.push(last);
  }
  return result;
}

export function kAttachFile(files: TFileTableEntry[], port: TFileTableEntry): number {
  for (let i = 0; i < files.length; ++i) {
    if (files[i] === null) {
      files[i] = port;
      return i;
    }
  }
  files.push(port);
  return files.length - 1;
}

export function kCloseFiles(files: TFileTableEntry[]): void {
  for (let i = 0; i < files.length; ++i) {
    if (files[i] !== null) {
      files[i].close();
      files[i] = null;
    }
  }
}


class FileTable {
  files: TFileTableEntry[] = [];

  public dup(): FileTable {
    const newTable = new FileTable();
    for (let i = 0; i < this.files.length; ++i) {
      const orig = this.files[i];
      if (orig && !orig.closed && !(orig.flags & IOpenFlags.CLOEXEC)) {
        newTable.files.push(orig.dup());
      } else {
        newTable.files.push(null);
      }
    }
    if (newTable.files.length) {
      let last: IPipePort | null;
      while (!(last = newTable.files.pop()) && newTable.files.length) {}
      if (last) newTable.files.push(last);
    }
    return newTable;
  }

  public attach(port: IPipePort): number {
    for (let i = 0; i < this.files.length; ++i) {
      if (this.files[i] === null) {
        this.files[i] = port;
        return i;
      }
    }
    this.files.push(port);
    return this.files.length - 1;
  }

  public closeAll(): void {
    for (let i = 0; i < this.files.length; ++i) {
      if (this.files[i] !== null) {
        this.files[i].close();
      }
    }
    this.files.length = 0;
  }
}
