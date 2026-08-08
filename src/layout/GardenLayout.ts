/**
 * Recursive nested-bed layout. The vault's folder tree becomes a tree of beds:
 * a folder is a bed, and its subfolders are smaller beds packed *inside* it
 * (each with its own header label and a lighter soil shade). A folder's own
 * notes are plants packed alongside its subfolder beds. Top-level folders (and
 * a "root" bed for vault-root notes) are packed across the garden into a roughly
 * square block, with an outer margin so the fence sits outside every bed.
 *
 * Plants are emitted back-to-front (ascending y) so overlapping canopies layer
 * correctly. Footprint size is passed in from the renderer to stay decoupled
 * from how plants are drawn.
 */
import { Bed, GardenState, NoteId, PositionedGarden, PositionedPlant } from "../model/types";
import { hashString } from "../util/hash";
import { clamp } from "../util/math";
import { Layout } from "./Layout";

export interface GardenLayoutOptions {
  plantWidth: number;
  plantHeight: number;
  /** Inner padding around a bed's contents. */
  padding: number;
  /** Top strip inside a bed reserved for its header label. */
  header: number;
  /** Gap between items within a bed. */
  gap: number;
  /** Small organic offset applied to each plant within its cell. */
  jitter: number;
  /** Target aspect ratio when packing (slightly landscape). */
  aspect: number;
  /** Outer margin around the whole garden (room for the fence). */
  margin: number;
}

const DEFAULTS: GardenLayoutOptions = {
  plantWidth: 104,
  plantHeight: 104,
  padding: 18,
  header: 22,
  gap: 14,
  jitter: 6,
  aspect: 1.35,
  margin: 40,
};

interface FolderNode {
  key: string;
  name: string;
  notes: NoteId[];
  children: Map<string, FolderNode>;
}

type Item =
  | { kind: "plant"; id: NoteId; w: number; h: number; lx: number; ly: number }
  | { kind: "folder"; node: FolderNode; w: number; h: number; lx: number; ly: number };

interface Measured {
  w: number;
  h: number;
  items: Item[];
}

function jitter(id: string, salt: string, amount: number): number {
  return ((hashString(id + salt) % 1000) / 1000 - 0.5) * 2 * amount;
}

/** Shelf-pack sized boxes left-to-right, wrapping at targetW. */
function pack(
  sizes: { w: number; h: number }[],
  targetW: number,
  gap: number,
): { pos: { x: number; y: number }[]; innerW: number; innerH: number } {
  let x = 0;
  let y = 0;
  let rowH = 0;
  let innerW = 0;
  const pos: { x: number; y: number }[] = [];
  for (const s of sizes) {
    if (x > 0 && x + s.w > targetW) {
      x = 0;
      y += rowH + gap;
      rowH = 0;
    }
    pos.push({ x, y });
    x += s.w + gap;
    rowH = Math.max(rowH, s.h);
    innerW = Math.max(innerW, x - gap);
  }
  return { pos, innerW, innerH: y + rowH };
}

function buildTree(ids: NoteId[]): FolderNode {
  const root: FolderNode = { key: "(root)", name: "root", notes: [], children: new Map() };
  for (const id of ids) {
    const segs = id.split("/");
    let node = root;
    let path = "";
    for (const folder of segs.slice(0, -1)) {
      path = path ? `${path}/${folder}` : folder;
      let child = node.children.get(folder);
      if (!child) {
        child = { key: path, name: folder, notes: [], children: new Map() };
        node.children.set(folder, child);
      }
      node = child;
    }
    node.notes.push(id);
  }
  return root;
}

export class GardenLayout implements Layout {
  private opts: GardenLayoutOptions;

  constructor(opts: Partial<GardenLayoutOptions> = {}) {
    this.opts = { ...DEFAULTS, ...opts };
  }

  place(garden: GardenState): PositionedGarden {
    const o = this.opts;
    const memo = new Map<FolderNode, Measured>();
    const root = buildTree([...garden.plants.keys()].sort());

    // Top-level items: each top-level folder subtree, plus a "root" bed for
    // vault-root notes.
    const topItems = [...root.children.values()].sort((a, b) => a.name.localeCompare(b.name));
    if (root.notes.length) {
      topItems.push({ key: "(root)", name: "root", notes: [...root.notes], children: new Map() });
    }

    const sizes = topItems.map((n) => {
      const m = this.measure(n, memo);
      return { w: m.w, h: m.h };
    });
    const totalArea = sizes.reduce((s, z) => s + z.w * z.h, 0);
    const widest = sizes.reduce((m, z) => Math.max(m, z.w), 0);
    const targetW = Math.max(widest, Math.sqrt(Math.max(1, totalArea) * o.aspect));
    const topGap = o.gap * 2;
    const { pos } = pack(sizes, targetW, topGap);

    const beds: Bed[] = [];
    const plants = new Map<NoteId, PositionedPlant>();
    topItems.forEach((node, i) => {
      this.placeNode(node, o.margin + pos[i].x, o.margin + pos[i].y, 0, beds, plants, memo, garden);
    });

    // Back-to-front so overlapping canopies stack correctly.
    const ordered = new Map<NoteId, PositionedPlant>(
      [...plants.entries()].sort((a, b) => a[1].position.y - b[1].position.y),
    );
    return { plants: ordered, beds };
  }

  /** Measure a folder node's bed size and its items' local positions. */
  private measure(node: FolderNode, memo: Map<FolderNode, Measured>): Measured {
    const cached = memo.get(node);
    if (cached) return cached;
    const o = this.opts;

    const boxes: Array<
      | { kind: "plant"; id: NoteId; w: number; h: number }
      | { kind: "folder"; node: FolderNode; w: number; h: number }
    > = [];

    for (const child of [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name))) {
      const m = this.measure(child, memo);
      boxes.push({ kind: "folder", node: child, w: m.w, h: m.h });
    }
    for (const id of [...node.notes].sort()) {
      boxes.push({ kind: "plant", id, w: o.plantWidth + 2 * o.jitter, h: o.plantHeight + 2 * o.jitter });
    }

    const totalArea = boxes.reduce((s, b) => s + b.w * b.h, 0);
    const widest = boxes.reduce((m, b) => Math.max(m, b.w), 0);
    const targetW = Math.max(widest, Math.sqrt(Math.max(1, totalArea) * o.aspect));
    const { pos, innerW, innerH } = pack(boxes, targetW, o.gap);

    const items: Item[] = boxes.map((b, i) => ({
      ...b,
      lx: o.padding + pos[i].x,
      ly: o.padding + o.header + pos[i].y,
    }));

    const measured: Measured = {
      w: innerW + o.padding * 2,
      h: o.padding + o.header + innerH + o.padding,
      items,
    };
    memo.set(node, measured);
    return measured;
  }

  private placeNode(
    node: FolderNode,
    ox: number,
    oy: number,
    depth: number,
    beds: Bed[],
    plants: Map<NoteId, PositionedPlant>,
    memo: Map<FolderNode, Measured>,
    garden: GardenState,
  ): void {
    const o = this.opts;
    const m = this.measure(node, memo);
    beds.push({ key: node.key, label: node.name, depth, x: ox, y: oy, width: m.w, height: m.h });

    for (const item of m.items) {
      const ax = ox + item.lx;
      const ay = oy + item.ly;
      if (item.kind === "plant") {
        const plant = garden.plants.get(item.id);
        if (!plant) continue;
        const jx = clamp(jitter(item.id, "x", o.jitter), -o.jitter, o.jitter);
        const jy = clamp(jitter(item.id, "y", o.jitter), -o.jitter, o.jitter);
        plants.set(item.id, {
          ...plant,
          position: { x: ax + o.jitter + jx, y: ay + o.jitter + jy },
        });
      } else {
        this.placeNode(item.node, ax, ay, depth + 1, beds, plants, memo, garden);
      }
    }
  }
}
