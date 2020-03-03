import { IDeferredChunk } from './Types';

/**
 * Some global "kernel" object pools.
 */

const CHUNKPOOL_SIZE = 20;


/**
 * Store ArrayBuffer --> View8|32 for faster access.
 */
class View8Pool {
  private _map = new WeakMap();
  public get(buffer: ArrayBuffer): Uint8Array {
    let view: Uint8Array = this._map.get(buffer);
    if (!view) {
      const newView = new Uint8Array(buffer);
      this._map.set(buffer, newView);
      view = newView;
    }
    return view;
  }
}

class View32Pool {
  private _map = new WeakMap();
  public get(buffer: ArrayBuffer): Uint32Array {
    let view: Uint32Array = this._map.get(buffer);
    if (!view) {
      const newView = new Uint32Array(buffer, 0, buffer.byteLength >>> 2);
      this._map.set(buffer, newView);
      view = newView;
    }
    return view;
  }
}
export const MEMORY_VIEW8 = new View8Pool();
export const MEMORY_VIEW32 = new View32Pool();

/**
 * Data structure to hold needed information per chunk processing.
 * Used for read/write chunk accounting in _resolve for
 * pointer like offset calculation and callback handling.
 */
class DeferredChunk implements IDeferredChunk {
  public initialLength = 0;
  constructor(
    public buf: ArrayBuffer,
    public offset: number,
    public length: number,
    public callback: (count: number | null, error?: any) => void)
  {
    this.initialLength = length;
  }
}

/**
 * Chunk pool.
 * This gets instantiated only once as global chunk storage.
 * Used by all pipes to avoid costly object creation anf GC
 * (~10% perf benefit for small chunks).
 */
class ChunkPool {
  private _pool: IDeferredChunk[] = [];
  constructor(public size: number) {}
  public create(
    buf: ArrayBuffer,
    offset: number,
    length: number,
    callback: (count: number | null, error?: any) => void): IDeferredChunk
  {
    if (this._pool.length) {
      const chunk = this._pool.pop();
      chunk.buf = buf;
      chunk.offset = offset;
      chunk.length = chunk.initialLength = length;
      chunk.callback = callback;
      return chunk;
    }
    return new DeferredChunk(buf, offset, length, callback);
  }
  public store(chunk: IDeferredChunk): void {
    if (this._pool.length < this.size) {
      // release memory and callback binding
      chunk.buf = null;
      chunk.callback = null;
      this._pool.push(chunk);
    }
  }
}
export const CHUNK_POOL = new ChunkPool(CHUNKPOOL_SIZE);
