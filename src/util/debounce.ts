/**
 * Returns a debounced wrapper around `fn`: rapid calls collapse into a single
 * trailing-edge invocation after `waitMs` of quiet. Used to coalesce the burst
 * of vault/metadata events Obsidian fires while you type.
 */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number,
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, waitMs);
  };
}
