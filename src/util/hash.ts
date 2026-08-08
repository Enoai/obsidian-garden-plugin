/**
 * Small deterministic string hash (FNV-1a). Used for stable "random-looking"
 * offsets — plant jitter and grass-tuft scatter — so the garden looks organic
 * but never jitters between renders.
 */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
