/**
 * Maintains an internal clock about event loop invocations,
 * used to indicate whether the next pipe resolve step should
 * be queued as macrotask, otherwise we might block events forever.
 * 
 * Note: High workload on the macrotask queue will make every single
 * loop step in a pipe to be bound to setTimeout (up to 10x slower).
 * We update the clock as global to make sure, that the throughput does
 * not suffer to much. This way all pipes can use the same clock,
 * also it guarantees, that any pipe interaction will never block the main loop.
 * 
 * Note: performance.now is more accurate, but slower. We dont need
 * the accurancy and go with Date.now().
 */
const CLOCK_LIMIT = 10;  // msec
let clock = Date.now();

export function clockIsOverdue(): boolean {
  return Date.now() - clock > CLOCK_LIMIT;
}
export function clockUpdate(): void {
  clock = Date.now();
}
