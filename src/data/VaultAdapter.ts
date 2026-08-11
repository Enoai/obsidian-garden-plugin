/**
 * The Obsidian boundary. This is the ONLY module that touches Obsidian's data
 * APIs; everything downstream works on the plain `VaultSnapshot` domain type.
 * Keeping this seam thin is what makes the model layer testable without
 * Obsidian and a port to another host a one-file change.
 */
import { App, TFile, getAllTags } from "obsidian";
import { NoteId, NoteMeta, VaultSnapshot } from "../model/types";
import { hasIgnoreTag, isPathIgnored } from "../model/filter";

/** Which notes to leave out of the garden. Read live on each snapshot. */
export interface IgnoreConfig {
  /** Folder or file paths to exclude (folders exclude everything under them). */
  paths: string[];
  /** Bare tag word (e.g. "garden-hide"); notes carrying it are excluded. Empty = off. */
  tag: string;
}

export interface VaultAdapter {
  /** Read the whole vault's metadata as a plain snapshot. */
  snapshot(): VaultSnapshot;
  /** Subscribe to relevant vault/metadata changes. Returns an unsubscribe fn. */
  onChange(handler: () => void): () => void;
}

export class ObsidianVaultAdapter implements VaultAdapter {
  constructor(
    private app: App,
    private getIgnore: () => IgnoreConfig = () => ({ paths: [], tag: "" }),
  ) {}

  snapshot(): VaultSnapshot {
    const { paths, tag } = this.getIgnore();
    // Only pay for per-file tag lookups when a tag filter is actually set.
    const tagActive = tag.trim().replace(/^#/, "") !== "";
    const files = this.app.vault.getMarkdownFiles().filter((file: TFile) => {
      if (isPathIgnored(file.path, paths)) return false;
      if (tagActive) {
        const cache = this.app.metadataCache.getFileCache(file);
        const tags = cache ? getAllTags(cache) ?? [] : [];
        if (hasIgnoreTag(tags, tag)) return false;
      }
      return true;
    });
    const resolved = this.app.metadataCache.resolvedLinks;

    // One pass over the resolved-link graph to count backlinks per target,
    // so the whole snapshot is O(links + notes) rather than O(notes²).
    const backLinkCounts = new Map<NoteId, number>();
    for (const source in resolved) {
      for (const target in resolved[source]) {
        backLinkCounts.set(target, (backLinkCounts.get(target) ?? 0) + 1);
      }
    }

    const notes: NoteMeta[] = files.map((file: TFile) => ({
      id: file.path,
      title: file.basename,
      modifiedMs: file.stat.mtime,
      createdMs: file.stat.ctime,
      outLinks: Object.keys(resolved[file.path] ?? {}).length,
      backLinks: backLinkCounts.get(file.path) ?? 0,
    }));

    return { notes, takenAt: Date.now() };
  }

  onChange(handler: () => void): () => void {
    const { metadataCache, vault } = this.app;
    const refs = [
      metadataCache.on("resolved", handler),
      vault.on("modify", handler),
      vault.on("create", handler),
      vault.on("delete", handler),
      vault.on("rename", handler),
    ];
    return () => {
      metadataCache.offref(refs[0]);
      for (let i = 1; i < refs.length; i++) vault.offref(refs[i]);
    };
  }
}
