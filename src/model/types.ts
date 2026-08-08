/**
 * The vocabulary shared across the whole plugin. This module is pure domain —
 * it imports nothing project-specific and never touches Obsidian. See
 * docs/ARCHITECTURE.md for how these types flow through the system.
 */

/** A note's identity — its vault-relative path. */
export type NoteId = string;

/**
 * Coarse visual bucket derived from the health score. The continuous score
 * still drives fine detail (exact colour, droop, bloom); `Stage` exists for
 * renderers that need discrete states, such as sprite theme packs.
 */
export type Stage = "seed" | "sprout" | "growing" | "flowering" | "wilting";

/** What kind of plant a note is, derived from tags/folders via user rules. */
export type PlantType = string;

/** The two independent axes, each normalised to [0, 1]. */
export interface HealthScore {
  /** 1 = just edited; decays toward (but never reaches) 0 as it ages. */
  freshness: number;
  /** 1 = well-connected hub; 0 = orphan. */
  connectivity: number;
}

/** Everything a renderer needs to draw one plant — and enough raw metadata to
 *  explain it to the user on hover. */
export interface PlantState {
  id: NoteId;
  title: string;
  type: PlantType;
  health: HealthScore;
  stage: Stage;
  /** Last-modified time (ms), for a human-readable "edited N days ago". */
  modifiedMs: number;
  /** Total links (out + back), for the hover stats. */
  links: number;
}

/** The single source of truth the view renders from. */
export interface GardenState {
  plants: Map<NoteId, PlantState>;
  generatedAt: number;
}

export interface Position {
  x: number;
  y: number;
}

/** A plant plus the position a `Layout` assigned it. */
export interface PositionedPlant extends PlantState {
  position: Position;
}

/**
 * A garden bed — a soil region a folder's plants sit on. Beds nest: a subfolder
 * bed sits inside its parent (higher `depth`). `key` is the full folder path
 * (the drop target for a folder move); `label` is the leaf name shown on the
 * bed; `depth` drives nested soil shading and drop hit-testing.
 */
export interface Bed {
  key: string;
  label: string;
  depth: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A fixed garden structure that acts as a drop target for a gardening action:
 *  the shed archives a note, the compost trashes it. */
export interface Structure {
  kind: "shed" | "compost";
  x: number;
  y: number;
  width: number;
  height: number;
}

/** `GardenState` after a `Layout` has placed every plant. */
export interface PositionedGarden {
  /** Insertion order is back-to-front (ascending y) so overlap layers right. */
  plants: Map<NoteId, PositionedPlant>;
  /** Optional soil beds under plant clusters; a grid layout omits these. */
  beds?: Bed[];
  /** Optional fixed structures (shed, compost) as drop targets. */
  structures?: Structure[];
}

/** Tunable constants for the scoring model. Surfaced in settings. */
export interface ScoringConfig {
  /** Days after which freshness halves. Larger = slower decay. */
  freshnessHalfLifeDays: number;
  /** Link count at which connectivity saturates to 1. */
  connectivitySaturation: number;
}

/**
 * A plain, Obsidian-free description of one note's metadata. Produced by the
 * `VaultAdapter` and consumed by the model — this is the boundary type that
 * keeps the domain layer testable without Obsidian.
 */
export interface NoteMeta {
  id: NoteId;
  title: string;
  modifiedMs: number;
  createdMs: number;
  outLinks: number;
  backLinks: number;
}

/** A point-in-time read of the whole vault's metadata. */
export interface VaultSnapshot {
  notes: NoteMeta[];
  takenAt: number;
}
