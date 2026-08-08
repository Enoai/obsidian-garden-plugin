/**
 * The write side of the Obsidian boundary. Like `VaultAdapter`, this is the
 * only place (besides the adapter) that touches Obsidian's file APIs — every
 * garden gesture that mutates the vault goes through here. Kept as a seam so the
 * view stays testable and the interaction layer never imports `obsidian`.
 *
 * Phase 2 starts with folder moves; archive (shed) and trash (compost) will be
 * added here as they land.
 */
import { App, TFile } from "obsidian";
import { NoteId } from "../model/types";

export interface VaultMutator {
  /** Move a note into `toFolder` (a full folder path, or "(root)"). Updates
   *  links via Obsidian's file manager. */
  move(id: NoteId, toFolder: string): Promise<void>;
}

export class ObsidianVaultMutator implements VaultMutator {
  constructor(private app: App) {}

  async move(id: NoteId, toFolder: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(id);
    if (!(file instanceof TFile)) return;
    const folder = toFolder === "(root)" ? "" : toFolder;
    const newPath = folder ? `${folder}/${file.name}` : file.name;
    if (newPath === id) return;
    await this.app.fileManager.renameFile(file, newPath);
  }
}
