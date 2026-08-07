/**
 * Phase 1 renderer: procedural SVG. Patches rather than rebuilds — on each
 * render it diffs against what's already on screen and only redraws plants
 * whose appearance actually changed (tracked by a cheap signature).
 */
import { NoteId, PositionedGarden, PositionedPlant } from "../../model/types";
import { PlantEvent, Renderer } from "../Renderer";
import { drawPlant } from "./plants";
import { drawGround } from "./world";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Cheap change key: if this is unchanged, the plant's drawing is unchanged. */
function signature(p: PositionedPlant): string {
  const f = Math.round(p.health.freshness * 20);
  const c = Math.round(p.health.connectivity * 20);
  return `${p.type}:${p.stage}:${f}:${c}`;
}

export class SvgRenderer implements Renderer {
  private svg: SVGSVGElement | null = null;
  private ground: SVGElement | null = null;
  private plantsLayer: SVGGElement | null = null;
  private nodes = new Map<NoteId, SVGGElement>();
  private sigs = new Map<NoteId, string>();
  private handler: ((e: PlantEvent) => void) | null = null;

  mount(host: HTMLElement): void {
    const doc = host.ownerDocument;
    const svg = doc.createElementNS(SVG_NS, "svg");
    svg.classList.add("garden-canvas");
    svg.setAttribute("preserveAspectRatio", "xMidYMin meet");

    this.ground = drawGround(doc, 100, 100);
    svg.appendChild(this.ground);

    const layer = doc.createElementNS(SVG_NS, "g");
    svg.appendChild(layer);

    host.appendChild(svg);
    this.svg = svg;
    this.plantsLayer = layer;
  }

  render(garden: PositionedGarden): void {
    const svg = this.svg;
    const layer = this.plantsLayer;
    if (!svg || !layer) return;
    const doc = svg.ownerDocument;

    let maxX = 0;
    let maxY = 0;
    const seen = new Set<NoteId>();

    for (const [id, plant] of garden.plants) {
      seen.add(id);
      maxX = Math.max(maxX, plant.position.x + 64);
      maxY = Math.max(maxY, plant.position.y + 72);

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

    const width = maxX + 24;
    const height = maxY + 24;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    this.ground?.setAttribute("width", String(width));
    this.ground?.setAttribute("height", String(height));
  }

  on(handler: (e: PlantEvent) => void): void {
    this.handler = handler;
  }

  destroy(): void {
    this.svg?.remove();
    this.svg = null;
    this.ground = null;
    this.plantsLayer = null;
    this.nodes.clear();
    this.sigs.clear();
  }
}
