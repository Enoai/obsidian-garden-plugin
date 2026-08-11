/**
 * Pure ignore-filter predicates. No Obsidian imports — the adapter gathers a
 * note's path and tags and asks these whether to drop it. Keeping the rules
 * here (rather than in the adapter) makes them unit-testable and keeps the
 * Obsidian boundary thin.
 */

/** Trim an ignore entry and drop a trailing slash so "Notes/" == "Notes". */
function normEntry(entry: string): string {
  const e = entry.trim();
  return e.endsWith("/") ? e.slice(0, -1) : e;
}

/**
 * True if `path` should be ignored given the user's list of entries. An entry
 * matches a specific file (exact path) or a folder (the path sits under it) —
 * nested folders included. The `entry + "/"` guard means "Foo" never matches
 * "Foobar/note".
 */
export function isPathIgnored(path: string, entries: readonly string[]): boolean {
  for (const raw of entries) {
    const e = normEntry(raw);
    if (!e) continue;
    if (path === e || path.startsWith(e + "/")) return true;
  }
  return false;
}

/** Strip a leading '#' and lowercase, for tolerant tag comparison. */
function normTag(tag: string): string {
  return tag.trim().replace(/^#/, "").toLowerCase();
}

/**
 * True if `tags` contains the ignore tag. Matching is case-insensitive and
 * covers nested children (`#garden-hide/foo` matches `garden-hide`). `tags`
 * are Obsidian-style with a leading '#'; `tagName` is the bare word (a leading
 * '#' is tolerated).
 */
export function hasIgnoreTag(tags: readonly string[], tagName: string): boolean {
  const want = normTag(tagName);
  if (!want) return false;
  const hash = "#" + want;
  for (const t of tags) {
    const lt = t.toLowerCase();
    if (lt === hash || lt.startsWith(hash + "/")) return true;
  }
  return false;
}
