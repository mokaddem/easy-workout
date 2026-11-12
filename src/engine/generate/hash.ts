/** 32-bit FNV-1a: small, stable across platforms, good enough to shuffle ties. */
const fnv1a = (text: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
};

/** Seed 0 keeps candidates in their natural order; any other seed reorders ties only. */
export const tieBreak = (seed: number, ...parts: string[]): number =>
  seed === 0 ? 0 : fnv1a([seed, ...parts].join('|'));
