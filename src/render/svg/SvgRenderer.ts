/**
 * Phase 1 renderer: procedural SVG. Two layers — a world layer (grass, beds,
 * tufts) behind a plants layer. Plants are patched (only redrawn when their
 * appearance signature changes) and re-stacked back-to-front each render so
 * overlapping canopies layer correctly. The world layer is only rebuilt when
 * the bounds or beds change, so editing a note doesn't re-scatter the grass.
 */
import { Bed, NoteId, PositionedGarden, PositionedPlant } from "../../model/types";
import { hashString } from "../../util/hash";
import { PlantEvent, Renderer } from "../Renderer";
import { PLANT_HEIGHT, PLANT_WIDTH, drawPlant } from "./plants";
import { drawBed, drawGrass, drawTuft } from "./world";

const SVG_NS = "http://www.w3.org/2000/svg";
const TUFT_STEP = 46;

/** Cheap change key: if this is unchanged, the plant's drawing is unchanged. */
function signature(p: PositionedPlant): string {
  const f = Math.round(p.health.freshness * 20);
  const c = Math.round(p.health.connectivity * 20);
  return `${p.type}:${p.stage}:${f}:${c}`;
}

function pointInBed(x: number, y: number, beds: Bed[]): boolean {
  for (const b of beds) {
    if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) return true;
  }
  return false;
}

export class SvgRenderer implements Renderer {
  private svg: SVGSVGElement | null = null;
  private worldLayer: SVGGElement | null = null;
  private plantsLayer: SVGGElement | null = null;
  private nodes = new Map<NoteId, SVGGElement>();
  private sigs = new Map<NoteId, string>();
  private worldSig = "";
  private handler: ((e: PlantEvent) => void) | null = null;

  mount(host: HTMLElement): void {
    const doc = host.ownerDocument;
    const svg = doc.createElementNS(SVG_NS, "svg");
    svg.classList.add("garden-canvas");
    svg.setAttribute("preserveAspectRatio", "xMidYMin meet");

    const world = doc.createElementNS(SVG_NS, "g");
    const plants = doc.createElementNS(SVG_NS, "g");
    svg.appendChild(world);
    svg.appendChild(plants);
    host.appendChild(svg);

    this.svg = svg;
    this.worldLayer = world;
    this.plantsLayer = plants;
  }

  render(garden: PositionedGarden): void {
    const svg = this.svg;
    const layer = this.plantsLayer;
    if (!svg || !layer) return;
    const doc = svg.ownerDocument;

    let maxX = 0;
    let maxY = 0;
    for (const plant of garden.plants.values()) {
      maxX = Math.max(maxX, plant.position.x + PLANT_WIDTH);
      maxY = Math.max(maxY, plant.position.y + PLANT_HEIGHT);
    }
    const width = maxX + 24;
    const height = maxY + 24;
    const beds = garden.beds ?? [];

    this.renderWorld(doc, width, height, beds);

    // Add / update plants.
    const seen = new Set<NoteId>();
    for (const [id, plant] of garden.plants) {
      seen.add(id);
      let node = this.nodes.get(id);
      if (!node) {
        node = doc.createElementNS(SVG_NS, "g");
        node.classList.add("garden-plant");
        node.addEventListener("click", () => this.handler?.({ type: "select", id }));
        this.nodes.set(id, node);
        this.sigs.set(id, "");
        layer.appendChild(node);
      }
      node.setAttribute("transform", `translate(${plant.position.x}, ${plant.position.y})`);
      const sig = signature(plant);
      if (this.sigs.get(id) !== sig) {
        node.replaceChildren(drawPlant(doc, plant));
        this.sigs.set(id, sig);
      }
    }

    // Remove plants whose notes are gone.
    for (const [id, node] of this.nodes) {
      if (!seen.has(id)) {
        node.remove();
        this.nodes.delete(id);
        this.sigs.delete(id);
      }
    }

    // Re-stack back-to-front (garden.plants is already ascending-y).
    for (const id of garden.plants.keys()) {
      const node = this.nodes.get(id);
      if (node) layer.appendChild(node);
    }

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }

  private renderWorld(doc: Document, width: number, height: number, beds: Bed[]): void {
    const layer = this.worldLayer;
    if (!layer) return;
    const sig = `${width}x${height}:${beds.map((b) => `${b.key}@${b.x},${b.y}`).join("|")}`;
    if (sig === this.worldSig) return;
    this.worldSig = sig;

    layer.replaceChildren();
    layer.appendChild(drawGrass(doc, width, height));
    for (const bed of beds) layer.appendChild(drawBed(doc, bed));

    // Scatter tufts on the grass (not on the beds), jittered but deterministic.
    for (let gx = TUFT_STEP / 2; gx < width; gx += TUFT_STEP) {
      for (let gy = TUFT_STEP / 2; gy < height; gy += TUFT_STEP) {
        const h = hashString(`${gx},${gy}`);
        const px = gx + ((h % 100) / 100 - 0.5) * TUFT_STEP * 0.8;
        const py = gy + (((h >> 8) % 100) / 100 - 0.5) * TUFT_STEP * 0.8;
        if (pointInBed(px, py, beds)) continue;
        layer.appendChild(drawTuft(doc, px, py));
      }
    }
  }

  on(handler: (e: PlantEvent) => void): void {
    this.handler = handler;
  }

  destroy(): void {
    this.svg?.remove();
    this.svg = null;
    this.worldLayer = null;
    this.plantsLayer = null;
    this.nodes.clear();
    this.sigs.clear();
    this.worldSig = "";
  }
}
