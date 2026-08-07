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
  /** Rough width before beds wrap to a new row. If omitted, it's derived from
   *  the total content so the garden forms a roughly square block rather than a
   *  long line. */
  targetWidth?: number;
}

const DEFAULTS: Required<Omit<GardenLayoutOptions, "targetWidth">> = {
  plantWidth: 104,
  plantHeight: 104,
  spacing: 74,
  jitter: 9,
  bedPadding: 24,
  clusterGap: 44,
};

/** Aspect ratio to aim for when auto-wrapping (slightly landscape). */
const TARGET_ASPECT = 1.4;

interface SizedBed {
  key: string;
  ids: NoteId[];
  cols: number;
  width: number;
  height: number;
}

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
  private opts: Required<Omit<GardenLayoutOptions, "targetWidth">> & { targetWidth?: number };

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

    // Pass 1: size each bed.
    const sized: SizedBed[] = [...groups.entries()].sort().map(([key, ids]) => {
      const cols = Math.max(1, Math.ceil(Math.sqrt(ids.length)));
      const rows = Math.ceil(ids.length / cols);
      return {
        key,
        ids,
        cols,
        width: (cols - 1) * o.spacing + o.plantWidth + o.bedPadding * 2,
        height: (rows - 1) * o.spacing + o.plantHeight + o.bedPadding * 2,
      };
    });

    const targetWidth = o.targetWidth ?? this.autoTargetWidth(sized);

    // Pass 2: pack beds left-to-right, wrapping at targetWidth.
    const placed = new Map<NoteId, PositionedPlant>();
    const beds: Bed[] = [];
    let cursorX = o.clusterGap;
    let cursorY = o.clusterGap;
    let rowHeight = 0;

    for (const b of sized) {
      if (cursorX > o.clusterGap && cursorX + b.width > targetWidth) {
        cursorX = o.clusterGap;
        cursorY += rowHeight + o.clusterGap;
        rowHeight = 0;
      }

      const bedX = cursorX;
      const bedY = cursorY;
      beds.push({ key: b.key, x: bedX, y: bedY, width: b.width, height: b.height });

      b.ids.forEach((id, i) => {
        const plant = garden.plants.get(id);
        if (!plant) return;
        const col = i % b.cols;
        const row = Math.floor(i / b.cols);
        const x = bedX + o.bedPadding + col * o.spacing + jitter(id, "x", o.jitter);
        const y = bedY + o.bedPadding + row * o.spacing + jitter(id, "y", o.jitter);
        placed.set(id, { ...plant, position: { x, y } });
      });

      cursorX += b.width + o.clusterGap;
      rowHeight = Math.max(rowHeight, b.height);
    }

    // Re-emit back-to-front so overlapping canopies stack correctly.
    const ordered = new Map<NoteId, PositionedPlant>(
      [...placed.entries()].sort((a, b) => a[1].position.y - b[1].position.y),
    );

    return { plants: ordered, beds };
  }

  /** Choose a wrap width so the beds pack into a roughly square (slightly
   *  landscape) block instead of one long row. */
  private autoTargetWidth(sized: SizedBed[]): number {
    const totalArea = sized.reduce((sum, b) => sum + b.width * b.height, 0);
    const widest = sized.reduce((m, b) => Math.max(m, b.width), 0);
    const byArea = Math.sqrt(totalArea * TARGET_ASPECT);
    // Never narrower than the widest single bed (plus a gap on each side).
    return Math.max(widest + this.opts.clusterGap * 2, byArea);
  }
}
