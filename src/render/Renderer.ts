/**
 * The drawing seam. A `Renderer` turns a positioned garden into visuals inside
 * a host element. The procedural SVG renderer is the first implementation; a
 * Canvas renderer (for very large vaults) or a sprite renderer (Phase 3 theme
 * packs) are drop-in alternatives that need no changes to the model or layout.
 *
 * Note the renderer emits *semantic* events (`select`), not DOM events — the
 * view decides what selection means. That keeps interaction policy out of the
 * drawing layer, so Phase 2 can add drag semantics without the renderer ever
 * knowing about folders or archiving.
 */
import { NoteId, PositionedGarden } from "../model/types";

export type PlantEvent =
  | { type: "select"; id: NoteId }
  /** `rect` is the plant's on-screen bounding box (client coords), so the view
   *  can anchor a tooltip to it. */
  | { type: "hover"; id: NoteId; rect: DOMRect }
  | { type: "unhover" }
  /** A plant was dragged and dropped onto a different bed. `toKey` is the target
   *  folder path; client coords are for anchoring the confirm popup. */
  | { type: "dropped"; id: NoteId; toKey: string; clientX: number; clientY: number }
  /** A plant was dropped onto a structure (shed → archive, compost → trash,
   *  watering → refresh). */
  | { type: "droppedStructure"; id: NoteId; kind: "shed" | "compost" | "watering"; clientX: number; clientY: number }
  /** A plant was clicked while the watering-can tool is active. */
  | { type: "water"; id: NoteId }
  /** A plant was dropped on the lawn or its own bed — remember it here. */
  | { type: "placePlant"; id: NoteId; x: number; y: number }
  /** A bed was dragged by its signpost by (dx, dy) in world units. */
  | { type: "moveBed"; key: string; dx: number; dy: number }
  /** The user asked to clear all manual arrangement. */
  | { type: "resetLayout" };

export interface Renderer {
  mount(host: HTMLElement): void;
  render(garden: PositionedGarden): void;
  on(handler: (e: PlantEvent) => void): void;
  destroy(): void;
}
