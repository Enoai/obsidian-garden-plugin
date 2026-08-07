/**
 * Organic clustered layout: notes clump by top-level folder into garden beds,
 * packed tightly with a little deterministic jitter so each clump reads as a
 * planted patch rather than a spreadsheet. Beds flow left-to-right and wrap.
 *
 * Plants are emitted in ascending-y order so overlapping canopies layer
 * back-to-front. Footprint is passed in (from the renderer) to keep this file
 * decoupled from how plants are drawn.
 */
import { Bed, GardenState, NoteId, PositionedGarden, PositionedPlant } from "../model/types";
import { hashString } from "../util/hash";
import { Layout } from "./Layout";

export interface GardenLayoutOptions {
  plantWidth: number;
  plantHeight: number;
  /** Distance between plant cell origins within a clump. */
  spacing: number;
  /** Max organic offset applied to each plant. */
  jitter: number;
  /** Soil margin around a clump's plants. */
  bedPadding: number;
  /** Gap between beds. */
  clusterGap: number;
  /** Rough width before beds wrap to a new row. */
  targetWidth: number;
}

const DEFAULTS: GardenLayoutOptions = {
  plantWidth: 104,
  plantHeight: 104,
  spacing: 74,
  jitter: 9,
  bedPadding: 24,
  clusterGap: 44,
  targetWidth: 780,
};

/** Top-level folder of a note path; the key we clump on. */
function topFolder(id: NoteId): string {
  const i = id.indexOf("/");
  return i < 0 ? "(root)" : id.slice(0, i);
}

/** Deterministic offset in [-amount, amount] from an id + salt. */
function jitter(id: string, salt: string, amount: number): number {
  return ((hashString(id + salt) % 1000) / 1000 - 0.5) * 2 * amount;
}

export class GardenLayout implements Layout {
  private opts: GardenLayoutOptions;

  constructor(opts: Partial<GardenLayoutOptions> = {}) {
    this.opts = { ...DEFAULTS, ...opts };
  }

  place(garden: GardenState): PositionedGarden {
    const o = this.opts;

    // Group by folder, stable order within each group.
    const groups = new Map<string, NoteId[]>();
    for (const id of [...garden.plants.keys()].sort()) {
      const key = topFolder(id);
      const arr = groups.get(key) ?? [];
      arr.push(id);
      groups.set(key, arr);
    }

    const placed = new Map<NoteId, PositionedPlant>();
    const beds: Bed[] = [];

    let cursorX = o.clusterGap;
    let cursorY = o.clusterGap;
    let rowHeight = 0;

    for (const [key, ids] of [...groups.entries()].sort()) {
      const cols = Math.max(1, Math.ceil(Math.sqrt(ids.length)));
      const rows = Math.ceil(ids.length / cols);
      const bedW = (cols - 1) * o.spacing + o.plantWidth + o.bedPadding * 2;
      const bedH = (rows - 1) * o.spacing + o.plantHeight + o.bedPadding * 2;

      // Wrap to the next row of beds when this one won't fit.
      if (cursorX > o.clusterGap && cursorX + bedW > o.targetWidth) {
        cursorX = o.clusterGap;
        cursorY += rowHeight + o.clusterGap;
        rowHeight = 0;
      }

      const bedX = cursorX;
      const bedY = cursorY;
      beds.push({ key, x: bedX, y: bedY, width: bedW, height: bedH });

      ids.forEach((id, i) => {
        const plant = garden.plants.get(id);
        if (!plant) return;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = bedX + o.bedPadding + col * o.spacing + jitter(id, "x", o.jitter);
        const y = bedY + o.bedPadding + row * o.spacing + jitter(id, "y", o.jitter);
        placed.set(id, { ...plant, position: { x, y } });
      });

      cursorX += bedW + o.clusterGap;
      rowHeight = Math.max(rowHeight, bedH);
    }

    // Re-emit back-to-front so overlapping canopies stack correctly.
    const ordered = new Map<NoteId, PositionedPlant>(
      [...placed.entries()].sort((a, b) => a[1].position.y - b[1].position.y),
    );

    return { plants: ordered, beds };
  }
}
