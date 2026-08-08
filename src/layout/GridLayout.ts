/**
 * Phase 1 default layout: a deterministic grid. Stateless and stable — plants
 * are sorted by id so a given vault always lays out the same way, which keeps
 * re-renders from shuffling everything around.
 */
import { GardenState, NoteId, PositionedGarden, PositionedPlant } from "../model/types";
import { Layout } from "./Layout";

export interface GridLayoutOptions {
  cellSize: number;
  padding: number;
  /** Fixed column count; if omitted, a roughly-square grid is used. */
  columns?: number;
}

// cellSize must exceed the renderer's plant footprint (PLANT_WIDTH/HEIGHT) so
// neighbouring plants don't overlap.
const DEFAULTS: GridLayoutOptions = { cellSize: 112, padding: 28 };

export class GridLayout implements Layout {
  private opts: GridLayoutOptions;

  constructor(opts: Partial<GridLayoutOptions> = {}) {
    this.opts = { ...DEFAULTS, ...opts };
  }

  place(garden: GardenState): PositionedGarden {
    const ids = [...garden.plants.keys()].sort();
    const cols = this.opts.columns ?? Math.max(1, Math.ceil(Math.sqrt(ids.length)));
    const { cellSize, padding } = this.opts;

    const plants = new Map<NoteId, PositionedPlant>();
    ids.forEach((id, i) => {
      const plant = garden.plants.get(id);
      if (!plant) return;
      const col = i % cols;
      const row = Math.floor(i / cols);
      plants.set(id, {
        ...plant,
        position: { x: padding + col * cellSize, y: padding + row * cellSize },
      });
    });
    return { plants };
  }
}
