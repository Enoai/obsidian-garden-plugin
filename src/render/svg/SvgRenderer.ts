/**
 * Phase 1 renderer: procedural SVG with a pan/zoom camera.
 *
 * Layers: a world layer (grass, beds, tufts, signposts, border) behind a plants
 * layer, both inside a camera group that we translate/scale. The SVG fills the
 * pane at 1 unit = 1px (no viewBox); the camera moves the world instead. This is
 * what keeps the garden from shrinking as the vault grows — adding notes no
 * longer refits everything; the user pans/zooms to navigate.
 *
 * Plants are patched (redrawn only when their appearance signature changes) and
 * re-stacked back-to-front each render. The world layer is only rebuilt when the
 * bounds or beds change.
 */
import { Bed, NoteId, PositionedGarden, PositionedPlant } from "../../model/types";
import { clamp } from "../../util/math";
import { hashString } from "../../util/hash";
import { PlantEvent, Renderer } from "../Renderer";
import { PLANT_HEIGHT, PLANT_WIDTH, drawPlant } from "./plants";
import { drawBed, drawBedLabel, drawBorder, drawGrass, drawTuft } from "./world";

const SVG_NS = "http://www.w3.org/2000/svg";
const TUFT_STEP = 46;
const MIN_SCALE = 0.15;
const MAX_SCALE = 4;
const DRAG_THRESHOLD = 3;

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
  private camera: SVGGElement | null = null;
  private worldLayer: SVGGElement | null = null;
  private plantsLayer: SVGGElement | null = null;
  private controls: HTMLElement | null = null;
  private nodes = new Map<NoteId, SVGGElement>();
  private sigs = new Map<NoteId, string>();
  private worldSig = "";
  private handler: ((e: PlantEvent) => void) | null = null;

  // Camera state.
  private scale = 1;
  private tx = 0;
  private ty = 0;
  private fitted = false;
  private contentW = 0;
  private contentH = 0;

  // Drag state.
  private dragging = false;
  private dragged = false;
  private suppressClick = false;
  private dragStart = { x: 0, y: 0, tx: 0, ty: 0 };

  mount(host: HTMLElement): void {
    const doc = host.ownerDocument;
    const svg = doc.createElementNS(SVG_NS, "svg");
    svg.classList.add("garden-canvas");

    const camera = doc.createElementNS(SVG_NS, "g");
    const world = doc.createElementNS(SVG_NS, "g");
    const plants = doc.createElementNS(SVG_NS, "g");
    camera.appendChild(world);
    camera.appendChild(plants);
    svg.appendChild(camera);
    host.appendChild(svg);

    this.svg = svg;
    this.camera = camera;
    this.worldLayer = world;
    this.plantsLayer = plants;

    this.attachCameraControls(host, doc);
    this.applyTransform();
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
    this.contentW = maxX + 24;
    this.contentH = maxY + 24;
    const beds = garden.beds ?? [];

    this.renderWorld(doc, this.contentW, this.contentH, beds);

    // Add / update plants.
    const seen = new Set<NoteId>();
    for (const [id, plant] of garden.plants) {
      seen.add(id);
      let node = this.nodes.get(id);
      if (!node) {
        node = doc.createElementNS(SVG_NS, "g");
        node.classList.add("garden-plant");
        const el = node;
        el.addEventListener("click", () => {
          if (this.suppressClick) {
            this.suppressClick = false;
            return;
          }
          this.handler?.({ type: "select", id });
        });
        el.addEventListener("mouseenter", () =>
          this.handler?.({ type: "hover", id, rect: el.getBoundingClientRect() }),
        );
        el.addEventListener("mouseleave", () => this.handler?.({ type: "unhover" }));
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

    // Fit the whole garden into the pane once, on first load.
    if (!this.fitted) {
      this.fitted = true;
      this.scheduleFit();
    }
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

    for (let gx = TUFT_STEP / 2; gx < width; gx += TUFT_STEP) {
      for (let gy = TUFT_STEP / 2; gy < height; gy += TUFT_STEP) {
        const h = hashString(`${gx},${gy}`);
        const px = gx + ((h % 100) / 100 - 0.5) * TUFT_STEP * 0.8;
        const py = gy + (((h >> 8) % 100) / 100 - 0.5) * TUFT_STEP * 0.8;
        if (pointInBed(px, py, beds)) continue;
        layer.appendChild(drawTuft(doc, px, py));
      }
    }

    for (const bed of beds) layer.appendChild(drawBedLabel(doc, bed));
    layer.appendChild(drawBorder(doc, width, height));
  }

  // --- Camera ---------------------------------------------------------------

  private applyTransform(): void {
    this.camera?.setAttribute("transform", `translate(${this.tx}, ${this.ty}) scale(${this.scale})`);
  }

  /** Zoom keeping the given pane point fixed under the cursor. */
  private zoomAround(px: number, py: number, factor: number): void {
    const next = clamp(this.scale * factor, MIN_SCALE, MAX_SCALE);
    const wx = (px - this.tx) / this.scale;
    const wy = (py - this.ty) / this.scale;
    this.scale = next;
    this.tx = px - wx * next;
    this.ty = py - wy * next;
    this.applyTransform();
  }

  private scheduleFit(): void {
    requestAnimationFrame(() => this.fit());
  }

  /** Fit the whole garden into the pane, centred. */
  fit(): void {
    const svg = this.svg;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || this.contentW === 0) {
      // Pane not laid out yet — try again next frame.
      requestAnimationFrame(() => this.fit());
      return;
    }
    const k = Math.min(rect.width / this.contentW, rect.height / this.contentH) * 0.98;
    this.scale = clamp(k, MIN_SCALE, MAX_SCALE);
    this.tx = (rect.width - this.contentW * this.scale) / 2;
    this.ty = Math.max(8, (rect.height - this.contentH * this.scale) / 2);
    this.applyTransform();
  }

  private attachCameraControls(host: HTMLElement, doc: Document): void {
    const svg = this.svg;
    if (!svg) return;

    svg.addEventListener(
      "wheel",
      (e: WheelEvent) => {
        e.preventDefault();
        const rect = svg.getBoundingClientRect();
        const factor = Math.exp(-e.deltaY * 0.0015);
        this.zoomAround(e.clientX - rect.left, e.clientY - rect.top, factor);
      },
      { passive: false },
    );

    svg.addEventListener("pointerdown", (e: PointerEvent) => {
      this.dragging = true;
      this.dragged = false;
      this.dragStart = { x: e.clientX, y: e.clientY, tx: this.tx, ty: this.ty };
      svg.setPointerCapture(e.pointerId);
      svg.classList.add("grabbing");
    });
    svg.addEventListener("pointermove", (e: PointerEvent) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.dragStart.x;
      const dy = e.clientY - this.dragStart.y;
      if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) this.dragged = true;
      this.tx = this.dragStart.tx + dx;
      this.ty = this.dragStart.ty + dy;
      this.applyTransform();
    });
    const endDrag = (e: PointerEvent) => {
      if (!this.dragging) return;
      this.dragging = false;
      svg.releasePointerCapture(e.pointerId);
      svg.classList.remove("grabbing");
      // Swallow the click that follows a real drag so it doesn't open a note.
      if (this.dragged) this.suppressClick = true;
    };
    svg.addEventListener("pointerup", endDrag);
    svg.addEventListener("pointercancel", endDrag);

    const controls = doc.createElement("div");
    controls.className = "garden-controls";
    const button = (label: string, title: string, onClick: () => void) => {
      const b = doc.createElement("button");
      b.textContent = label;
      b.setAttribute("aria-label", title);
      b.addEventListener("click", onClick);
      controls.appendChild(b);
    };
    const zoomButton = (factor: number) => {
      const rect = svg.getBoundingClientRect();
      this.zoomAround(rect.width / 2, rect.height / 2, factor);
    };
    button("−", "Zoom out", () => zoomButton(1 / 1.2));
    button("⤢", "Fit to view", () => this.fit());
    button("+", "Zoom in", () => zoomButton(1.2));
    host.appendChild(controls);
    this.controls = controls;
  }

  on(handler: (e: PlantEvent) => void): void {
    this.handler = handler;
  }

  destroy(): void {
    this.svg?.remove();
    this.controls?.remove();
    this.svg = null;
    this.camera = null;
    this.worldLayer = null;
    this.plantsLayer = null;
    this.controls = null;
    this.nodes.clear();
    this.sigs.clear();
    this.worldSig = "";
    this.fitted = false;
  }
}
