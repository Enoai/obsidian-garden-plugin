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
  /** Move a note into the archive folder, creating it if needed. Reversible. */
  archive(id: NoteId, archiveFolder: string): Promise<void>;
  /** Send a note to Obsidian's trash (respects the user's trash setting). */
  trash(id: NoteId): Promise<void>;
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

  async archive(id: NoteId, archiveFolder: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(id);
    if (!(file instanceof TFile)) return;
    const folder = archiveFolder || "Archive";
    if (!this.app.vault.getAbstractFileByPath(folder)) {
      await this.app.vault.createFolder(folder);
    }
    const newPath = `${folder}/${file.name}`;
    if (newPath === id) return;
    await this.app.fileManager.renameFile(file, newPath);
  }

  async trash(id: NoteId): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(id);
    if (!(file instanceof TFile)) return;
    // Routes to the user's configured trash (system or .trash), never a hard delete.
    await this.app.fileManager.trashFile(file);
  }
}
