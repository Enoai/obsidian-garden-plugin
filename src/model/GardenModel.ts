/**
 * Turns a `VaultSnapshot` into a `GardenState`. Pure domain logic — no Obsidian.
 * Kept separate from scoring so the "what does a note become" mapping and the
 * "how healthy is it" maths can evolve independently.
 */
import {
  GardenState,
  NoteId,
  NoteMeta,
  PlantState,
  PlantType,
  ScoringConfig,
  VaultSnapshot,
} from "./types";
import { scoreNote, stageOf } from "./health";
import { resolveSpecies } from "./plantTypes";

/** Decides what kind of plant a note is. Swap in tag/folder rules here. */
export type PlantTypeResolver = (note: NoteMeta) => PlantType;

const defaultTypeResolver: PlantTypeResolver = (note) => resolveSpecies(note.id);

export class GardenModel {
  constructor(
    private cfg: ScoringConfig,
    private resolveType: PlantTypeResolver = defaultTypeResolver,
  ) {}

  /** Update the scoring config (e.g. after the user changes settings). */
  setConfig(cfg: ScoringConfig): void {
    this.cfg = cfg;
  }

  /** Build a full garden state from a snapshot. */
  build(snapshot: VaultSnapshot): GardenState {
    const plants = new Map<NoteId, PlantState>();
    for (const note of snapshot.notes) {
      plants.set(note.id, this.toPlant(note, snapshot.takenAt));
    }
    return { plants, generatedAt: snapshot.takenAt };
  }

  private toPlant(note: NoteMeta, nowMs: number): PlantState {
    const links = note.outLinks + note.backLinks;
    const health = scoreNote(
      { modifiedMs: note.modifiedMs, linkCount: links },
      nowMs,
      this.cfg,
    );
    return {
      id: note.id,
      title: note.title,
      type: this.resolveType(note),
      health,
      stage: stageOf(health),
      modifiedMs: note.modifiedMs,
      links,
    };
  }
}
