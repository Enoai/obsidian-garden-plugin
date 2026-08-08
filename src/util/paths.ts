/** Path helpers shared by the layout (grouping) and the renderer (drop hit
 *  tests). A note's id is its vault-relative path. */

/** The folder a note lives in — its full parent path, or "(root)" for the
 *  vault root. This is the bed a note belongs to, subfolders included. */
export function parentFolder(id: string): string {
  const i = id.lastIndexOf("/");
  return i < 0 ? "(root)" : id.slice(0, i);
}

/** The last path segment — used for a short bed signpost label. */
export function leafName(folderKey: string): string {
  if (folderKey === "(root)") return "root";
  const parts = folderKey.split("/");
  return parts[parts.length - 1] || folderKey;
}
