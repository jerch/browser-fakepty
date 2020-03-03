import { assert } from 'chai';
import { TFileTableEntry, kCloneFiles, kAttachFile } from './Task';
import { BytePipe } from './BytePipe';
import { IOpenFlags } from './ObjectPipe';

describe('kCloneFiles', () => {
  it('empty', () => {
    const files: TFileTableEntry[] = [];
    const newFiles = kCloneFiles(files);
    assert.equal(newFiles.length, 0);
  });
  it('null', () => {
    const files: TFileTableEntry[] = [null, null, null];
    const newFiles = kCloneFiles(files);
    assert.equal(newFiles.length, 0);
  });
  it('correct dup', () => {
    const p1 = new BytePipe();
    const p2 = new BytePipe();
    const files: TFileTableEntry[] = [
      p1.open(IOpenFlags.RDONLY),
      p1.open(IOpenFlags.WRONLY),
      p2.open(IOpenFlags.RDONLY),
      p2.open(IOpenFlags.WRONLY)
    ];
    const newFiles = kCloneFiles(files);
    assert.notEqual(newFiles[0], files[0]);
    assert.notEqual(newFiles[1], files[1]);
    assert.notEqual(newFiles[2], files[2]);
    assert.notEqual(newFiles[3], files[3]);
    assert.equal(newFiles[0].flags, files[0].flags);
    assert.equal(newFiles[1].flags, files[1].flags);
    assert.equal(newFiles[2].flags, files[2].flags);
    assert.equal(newFiles[3].flags, files[3].flags);
  });
  it('omit CLOEXEC', () => {
    const p1 = new BytePipe();
    const p2 = new BytePipe();
    const files: TFileTableEntry[] = [
      p1.open(IOpenFlags.RDONLY | IOpenFlags.CLOEXEC),
      p1.open(IOpenFlags.WRONLY),
      p2.open(IOpenFlags.RDONLY | IOpenFlags.CLOEXEC),
      p2.open(IOpenFlags.WRONLY | IOpenFlags.CLOEXEC)
    ];
    const newFiles = kCloneFiles(files);
    assert.equal(newFiles.length, 2);
    assert.equal(newFiles[0], null);
  });
  it('sparse', () => {
    const p1 = new BytePipe();
    const p2 = new BytePipe();
    const p3 = new BytePipe();
    const files: TFileTableEntry[] = [
      p1.open(IOpenFlags.RDONLY),
      p2.open(IOpenFlags.WRONLY),
      p2.open(IOpenFlags.WRONLY),
      null,
      null,
      p2.open(IOpenFlags.WRONLY | IOpenFlags.CLOEXEC),
      null,
      p3.open(IOpenFlags.RDONLY),
      p3.open(IOpenFlags.WRONLY),
      null,
      null
    ];
    const newFiles = kCloneFiles(files);
    assert.equal(newFiles.length, 9);
    assert.equal(newFiles[5], null);
  });
});

describe('kAttachFile', () => {
  it('empty', () => {
    const files: TFileTableEntry[] = [];
    const p = new BytePipe();
    const fd = kAttachFile(files, p.open(IOpenFlags.RDONLY));
    assert.equal(fd, 0);
    assert.equal(files.length, 1);
  });
  it('null', () => {
    const files: TFileTableEntry[] = [null, null, null];
    const p = new BytePipe();
    const fd = kAttachFile(files, p.open(IOpenFlags.RDONLY));
    assert.equal(fd, 0);
    assert.equal(files.length, 3);
  });
});
