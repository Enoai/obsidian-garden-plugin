/**
 * Phase 1/2 renderer: procedural SVG with a pan/zoom camera and draggable
 * plants.
 *
 * Layers (inside a camera group we translate/scale): world (grass, beds, tufts,
 * signposts, fence) → plants → overlay (drop highlight). The SVG fills the pane
 * at 1 unit = 1px (no viewBox); the camera moves the world, so the garden never
 * shrinks as the vault grows.
 *
 * Pointer model: pressing on a plant starts a plant drag; pressing on empty
 * ground pans the camera. A plant drag that doesn't move is a click (select). A
 * drag that ends over a different bed emits a `dropped` event; the view confirms
 * and performs the folder move.
 */
import { Bed, NoteId, PositionedGarden, PositionedPlant, Structure } from "../../model/types";
import { clamp } from "../../util/math";
import { hashString } from "../../util/hash";
import { parentFolder } from "../../util/paths";
import { PlantEvent, Renderer } from "../Renderer";
import { PLANT_HEIGHT, PLANT_WIDTH, drawPlant } from "./plants";
import { drawBed, drawBedLabel, drawCompost, drawFence, drawGrass, drawShed, drawTuft, drawWateringCan } from "./world";

const SVG_NS = "http://www.w3.org/2000/svg";
const TUFT_STEP = 46;
const MIN_SCALE = 0.15;
const MAX_SCALE = 4;
const DRAG_THRESHOLD = 4;

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

interface PlantDrag {
  id: NoteId;
  node: SVGGElement;
  srcKey: string;
  offX: number;
  offY: number;
  startX: number;
  startY: number;
  moved: boolean;
}

export class SvgRenderer implements Renderer {
  private svg: SVGSVGElement | null = null;
  private camera: SVGGElement | null = null;
  private worldLayer: SVGGElement | null = null;
  private plantsLayer: SVGGElement | null = null;
  private overlayLayer: SVGGElement | null = null;
  private highlight: SVGRectElement | null = null;
  private controls: HTMLElement | null = null;
  private nodes = new Map<NoteId, SVGGElement>();
  private sigs = new Map<NoteId, string>();
  private worldSig = "";
  private handler: ((e: PlantEvent) => void) | null = null;
  private lastGarden: PositionedGarden | null = null;

  // Camera state.
  private scale = 1;
  private tx = 0;
  private ty = 0;
  private fitted = false;
  private contentW = 0;
  private contentH = 0;

  // Interaction state.
  private panning = false;
  private panMoved = false;
  private panStart = { x: 0, y: 0, tx: 0, ty: 0 };
  private downOnCan = false;
  private plantDrag: PlantDrag | null = null;

  // Watering-can tool.
  private wateringMode = false;
  private pendingWater: { id: NoteId; startX: number; startY: number; moved: boolean } | null = null;
  private canCursor: HTMLDivElement | null = null;
  private escHandler: ((e: KeyboardEvent) => void) | null = null;

  mount(host: HTMLElement): void {
    const doc = host.ownerDocument;
    const svg = doc.createElementNS(SVG_NS, "svg");
    svg.classList.add("garden-canvas");

    const camera = doc.createElementNS(SVG_NS, "g");
    const world = doc.createElementNS(SVG_NS, "g");
    const plants = doc.createElementNS(SVG_NS, "g");
    const overlay = doc.createElementNS(SVG_NS, "g");
    camera.append(world, plants, overlay);
    svg.appendChild(camera);
    host.appendChild(svg);

    this.svg = svg;
    this.camera = camera;
    this.worldLayer = world;
    this.plantsLayer = plants;
    this.overlayLayer = overlay;

    // A watering can that follows the cursor while the tool is active.
    const cursor = doc.createElement("div");
    cursor.className = "garden-can-cursor";
    cursor.innerHTML =
      "<svg width='32' height='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'>" +
      "<rect x='9' y='14' width='15' height='12' rx='3' fill='#4a9d8e' stroke='#37796d'/>" +
      "<path d='M12 14 Q16 6 21 14' fill='none' stroke='#37796d' stroke-width='2'/>" +
      "<path d='M9 18 L2 13' stroke='#37796d' stroke-width='2' stroke-linecap='round'/>" +
      "<ellipse cx='2' cy='13' rx='2.4' ry='1.6' fill='#37796d'/></svg>";
    cursor.hidden = true;
    host.appendChild(cursor);
    this.canCursor = cursor;

    this.escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && this.wateringMode) this.exitWatering();
    };
    window.addEventListener("keydown", this.escHandler);

    this.attachControls(host, doc);
    this.applyTransform();
  }

  render(garden: PositionedGarden): void {
    const svg = this.svg;
    const layer = this.plantsLayer;
    if (!svg || !layer) return;
    const doc = svg.ownerDocument;
    this.lastGarden = garden;

    const beds = garden.beds ?? [];
    const structures = garden.structures ?? [];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = 0;
    let maxY = 0;
    for (const b of [...beds, ...structures]) {
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    }
    for (const p of garden.plants.values()) {
      maxX = Math.max(maxX, p.position.x + PLANT_WIDTH);
      maxY = Math.max(maxY, p.position.y + PLANT_HEIGHT);
    }
    if (!Number.isFinite(minX)) {
      minX = 24;
      minY = 24;
    }
    // Mirror the left/top margin on the right/bottom so the fence sits outside
    // every bed on all sides.
    this.contentW = maxX + minX;
    this.contentH = maxY + minY;

    this.renderWorld(doc, this.contentW, this.contentH, beds, structures);

    const seen = new Set<NoteId>();
    for (const [id, plant] of garden.plants) {
      seen.add(id);
      let node = this.nodes.get(id);
      if (!node) {
        node = doc.createElementNS(SVG_NS, "g");
        node.classList.add("garden-plant");
        node.setAttribute("data-id", id);
        const el = node;
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

    if (!this.fitted) {
      this.fitted = true;
      this.scheduleFit();
    }
  }

  private renderWorld(doc: Document, width: number, height: number, beds: Bed[], structures: Structure[]): void {
    const layer = this.worldLayer;
    if (!layer) return;
    const sig = `${width}x${height}:${beds.map((b) => `${b.key}@${b.x},${b.y},${b.width}x${b.height}`).join("|")}`;
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

    for (const s of structures) {
      const drawn = s.kind === "shed" ? drawShed(doc, s) : s.kind === "compost" ? drawCompost(doc, s) : drawWateringCan(doc, s);
      layer.appendChild(drawn);
    }
    for (const bed of beds) layer.appendChild(drawBedLabel(doc, bed));
    layer.appendChild(drawFence(doc, width, height));
  }

  // --- Camera ---------------------------------------------------------------

  private applyTransform(): void {
    this.camera?.setAttribute("transform", `translate(${this.tx}, ${this.ty}) scale(${this.scale})`);
  }

  private clientToWorld(cx: number, cy: number): { wx: number; wy: number } {
    const rect = this.svg?.getBoundingClientRect();
    const px = cx - (rect?.left ?? 0);
    const py = cy - (rect?.top ?? 0);
    return { wx: (px - this.tx) / this.scale, wy: (py - this.ty) / this.scale };
  }

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

  fit(): void {
    const svg = this.svg;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || this.contentW === 0) {
      requestAnimationFrame(() => this.fit());
      return;
    }
    const k = Math.min(rect.width / this.contentW, rect.height / this.contentH) * 0.98;
    this.scale = clamp(k, MIN_SCALE, MAX_SCALE);
    this.tx = (rect.width - this.contentW * this.scale) / 2;
    this.ty = Math.max(8, (rect.height - this.contentH * this.scale) / 2);
    this.applyTransform();
  }

  // --- Pointer interaction --------------------------------------------------

  private attachControls(host: HTMLElement, doc: Document): void {
    const svg = this.svg;
    if (!svg) return;

    svg.addEventListener(
      "wheel",
      (e: WheelEvent) => {
        e.preventDefault();
        const rect = svg.getBoundingClientRect();
        this.zoomAround(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0015));
      },
      { passive: false },
    );

    svg.addEventListener("pointerdown", (e: PointerEvent) => this.onPointerDown(e));
    svg.addEventListener("pointermove", (e: PointerEvent) => this.onPointerMove(e));
    const end = (e: PointerEvent) => this.onPointerUp(e);
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);

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

  private onPointerDown(e: PointerEvent): void {
    const { wx, wy } = this.clientToWorld(e.clientX, e.clientY);
    const plantEl = e.target instanceof Element ? e.target.closest(".garden-plant") : null;
    const onCan = this.structureAt(wx, wy)?.kind === "watering";

    if (this.wateringMode) {
      if (plantEl instanceof SVGGElement) {
        const id = plantEl.getAttribute("data-id");
        if (id) {
          this.pendingWater = { id, startX: e.clientX, startY: e.clientY, moved: false };
          this.svg?.setPointerCapture(e.pointerId);
          return;
        }
      }
      this.beginPan(e); // pan (or click-to-exit) while the tool is active
      this.downOnCan = onCan;
      return;
    }

    if (plantEl instanceof SVGGElement) {
      this.beginPlantDrag(plantEl, e);
      return;
    }
    this.beginPan(e);
    this.downOnCan = onCan;
  }

  private beginPan(e: PointerEvent): void {
    this.panning = true;
    this.panMoved = false;
    this.panStart = { x: e.clientX, y: e.clientY, tx: this.tx, ty: this.ty };
    this.svg?.setPointerCapture(e.pointerId);
    this.svg?.classList.add("grabbing");
  }

  private beginPlantDrag(node: SVGGElement, e: PointerEvent): void {
    const id = node.getAttribute("data-id");
    const plant = id ? this.lastGarden?.plants.get(id) : undefined;
    if (!id || !plant) return;
    const { wx, wy } = this.clientToWorld(e.clientX, e.clientY);
    this.plantDrag = {
      id,
      node,
      srcKey: parentFolder(id),
      offX: wx - plant.position.x,
      offY: wy - plant.position.y,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    this.svg?.setPointerCapture(e.pointerId);
    node.classList.add("garden-plant--dragging");
    this.plantsLayer?.appendChild(node); // raise above siblings
  }

  private onPointerMove(e: PointerEvent): void {
    if (this.wateringMode && this.canCursor && !this.canCursor.hidden) {
      const rect = this.svg?.getBoundingClientRect();
      if (rect) {
        this.canCursor.style.left = `${e.clientX - rect.left - 2}px`;
        this.canCursor.style.top = `${e.clientY - rect.top - 13}px`;
      }
    }

    const pw = this.pendingWater;
    if (pw) {
      if (Math.abs(e.clientX - pw.startX) + Math.abs(e.clientY - pw.startY) > DRAG_THRESHOLD) pw.moved = true;
      return;
    }

    const drag = this.plantDrag;
    if (drag) {
      if (Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) > DRAG_THRESHOLD) {
        drag.moved = true;
      }
      const { wx, wy } = this.clientToWorld(e.clientX, e.clientY);
      drag.node.setAttribute("transform", `translate(${wx - drag.offX}, ${wy - drag.offY})`);
      if (drag.moved) this.updateHighlight(wx, wy, drag.srcKey);
      return;
    }

    if (this.panning) {
      if (Math.abs(e.clientX - this.panStart.x) + Math.abs(e.clientY - this.panStart.y) > DRAG_THRESHOLD) {
        this.panMoved = true;
      }
      this.tx = this.panStart.tx + (e.clientX - this.panStart.x);
      this.ty = this.panStart.ty + (e.clientY - this.panStart.y);
      this.applyTransform();
    }
  }

  private onPointerUp(e: PointerEvent): void {
    const pw = this.pendingWater;
    if (pw) {
      this.pendingWater = null;
      this.svg?.releasePointerCapture(e.pointerId);
      if (!pw.moved) this.handler?.({ type: "water", id: pw.id });
      return;
    }

    const drag = this.plantDrag;
    if (drag) {
      this.plantDrag = null;
      this.svg?.releasePointerCapture(e.pointerId);
      drag.node.classList.remove("garden-plant--dragging");
      this.clearHighlight();

      if (!drag.moved) {
        this.rerender(); // restore z-order
        this.handler?.({ type: "select", id: drag.id });
        return;
      }
      const { wx, wy } = this.clientToWorld(e.clientX, e.clientY);
      const structure = this.structureAt(wx, wy);
      if (structure) {
        this.handler?.({
          type: "droppedStructure",
          id: drag.id,
          kind: structure.kind,
          clientX: e.clientX,
          clientY: e.clientY,
        });
        return;
      }
      const target = this.bedAt(wx, wy);
      if (target && target.key !== drag.srcKey) {
        this.handler?.({
          type: "dropped",
          id: drag.id,
          toKey: target.key,
          clientX: e.clientX,
          clientY: e.clientY,
        });
        // Leave the plant where it was dropped until the view confirms/cancels.
      } else {
        this.rerender(); // snap back
      }
      return;
    }

    if (this.panning) {
      this.panning = false;
      this.svg?.releasePointerCapture(e.pointerId);
      this.svg?.classList.remove("grabbing");
      if (!this.panMoved) {
        // A click (no drag): on the can → toggle the tool; elsewhere while the
        // tool is active → put it down.
        if (this.downOnCan) this.toggleWatering();
        else if (this.wateringMode) this.exitWatering();
      }
      this.downOnCan = false;
    }
  }

  private toggleWatering(): void {
    if (this.wateringMode) this.exitWatering();
    else this.enterWatering();
  }

  private enterWatering(): void {
    this.wateringMode = true;
    this.svg?.classList.add("garden-watering");
    if (this.canCursor) this.canCursor.hidden = false;
  }

  private exitWatering(): void {
    this.wateringMode = false;
    this.svg?.classList.remove("garden-watering");
    if (this.canCursor) this.canCursor.hidden = true;
  }

  /** The deepest (innermost) bed under the point, so drops target the most
   *  specific subfolder. */
  private bedAt(wx: number, wy: number): Bed | null {
    let best: Bed | null = null;
    for (const b of this.lastGarden?.beds ?? []) {
      if (wx >= b.x && wx <= b.x + b.width && wy >= b.y && wy <= b.y + b.height) {
        if (!best || b.depth > best.depth) best = b;
      }
    }
    return best;
  }

  private structureAt(wx: number, wy: number): Structure | null {
    for (const s of this.lastGarden?.structures ?? []) {
      if (wx >= s.x && wx <= s.x + s.width && wy >= s.y && wy <= s.y + s.height) return s;
    }
    return null;
  }

  private updateHighlight(wx: number, wy: number, srcKey: string): void {
    const structure = this.structureAt(wx, wy);
    if (structure) {
      this.showHighlight(structure.x, structure.y, structure.width, structure.height);
      return;
    }
    const bed = this.bedAt(wx, wy);
    if (bed && bed.key !== srcKey) this.showHighlight(bed.x, bed.y, bed.width, bed.height);
    else this.clearHighlight();
  }

  private showHighlight(x: number, y: number, width: number, height: number): void {
    const overlay = this.overlayLayer;
    if (!overlay) return;
    if (!this.highlight) {
      const rect = overlay.ownerDocument.createElementNS(SVG_NS, "rect");
      rect.setAttribute("rx", "16");
      rect.setAttribute("fill", "rgba(255,255,255,0.18)");
      rect.setAttribute("stroke", "#ffffff");
      rect.setAttribute("stroke-width", "2");
      rect.setAttribute("stroke-dasharray", "6 5");
      rect.setAttribute("pointer-events", "none");
      this.highlight = rect;
      overlay.appendChild(rect);
    }
    this.highlight.setAttribute("x", String(x));
    this.highlight.setAttribute("y", String(y));
    this.highlight.setAttribute("width", String(width));
    this.highlight.setAttribute("height", String(height));
    this.highlight.style.display = "";
  }

  private clearHighlight(): void {
    if (this.highlight) this.highlight.style.display = "none";
  }

  /** Re-render the last garden (used to snap a plant back / restore z-order). */
  private rerender(): void {
    if (this.lastGarden) this.render(this.lastGarden);
  }

  on(handler: (e: PlantEvent) => void): void {
    this.handler = handler;
  }

  destroy(): void {
    this.svg?.remove();
    this.controls?.remove();
    this.canCursor?.remove();
    if (this.escHandler) window.removeEventListener("keydown", this.escHandler);
    this.escHandler = null;
    this.svg = null;
    this.camera = null;
    this.worldLayer = null;
    this.plantsLayer = null;
    this.overlayLayer = null;
    this.highlight = null;
    this.controls = null;
    this.canCursor = null;
    this.lastGarden = null;
    this.wateringMode = false;
    this.pendingWater = null;
    this.nodes.clear();
    this.sigs.clear();
    this.worldSig = "";
    this.fitted = false;
  }
}
