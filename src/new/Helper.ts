/**
 * Various helper functions.
 */

// nearest lesser or equal power of 2
// Note: no range check done here, never apply negative numbers or >0x7FFFFFFF
export function lowerPower2(value: number): number {
  return 1 << 31 - Math.clz32(value);
}

// nearest greater or equal power of 2
export function higherPower2(value: number): number {
  const p2 = lowerPower2(value);
  return p2 === value ? value : p2 << 1;
}
