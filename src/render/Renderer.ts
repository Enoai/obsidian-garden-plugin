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

export type PlantEvent = { type: "select"; id: NoteId };

export interface Renderer {
  mount(host: HTMLElement): void;
  render(garden: PositionedGarden): void;
  on(handler: (e: PlantEvent) => void): void;
  destroy(): void;
}
