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
import { DEFAULT_THEME, Theme } from "../theme";
import { PLANT_HEIGHT, PLANT_WIDTH, applyPlantTheme, drawPlant } from "./plants";
import { applyWorldTheme, drawBed, drawBedLabel, drawCompost, drawFence, drawGrass, drawShed, drawTuft, drawWateringCan } from "./world";

const SVG_NS = "http://www.w3.org/2000/svg";
const TUFT_STEP = 46;
const MIN_SCALE = 0.15;
const MAX_SCALE = 4;
const DRAG_THRESHOLD = 4;
// Watering targets the whole plant box plus this margin, so small plants are
// easy to hit.
const WATER_HIT_PAD = 12;
// Above this many plants on screen, sway is switched off entirely — at that
// zoom the motion is imperceptible anyway, and it's where CPU cost blows up.
const SWAY_CAP = 80;
// Height of a bed's header strip (its signpost) — the grab handle for moving a
// bed. Mirrors GardenLayout's `header`.
const BED_HEADER = 22;

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

interface BedDrag {
  bed: Bed;
  startWx: number;
  startWy: number;
  dx: number;
  dy: number;
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
  private lastThemeName = "";
  private handler: ((e: PlantEvent) => void) | null = null;
  private lastGarden: PositionedGarden | null = null;
  private resizeObs: ResizeObserver | null = null;
  private cullTimer: number | null = null;

  constructor(private getTheme: () => Theme = () => DEFAULT_THEME) {}

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
  private bedDrag: BedDrag | null = null;

  // Watering-can tool.
  private wateringMode = false;
  private pendingWater: { id: NoteId; startX: number; startY: number; moved: boolean } | null = null;
  private canCursor: HTMLDivElement | null = null;
  private canLabel: HTMLElement | null = null;
  private escHandler: ((e: KeyboardEvent) => void) | null = null;
  private lastClientX = 0;
  private lastClientY = 0;

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

    // Fit once the pane actually has a size (replaces a requestAnimationFrame
    // busy-loop), and re-cull sway when the pane resizes.
    this.resizeObs = new ResizeObserver(() => {
      if (!this.fitted) this.fit();
      this.scheduleCull();
    });
    this.resizeObs.observe(svg);

    // A watering can that follows the cursor while the tool is active.
    const cursor = host.createDiv({ cls: "garden-can-cursor" });
    const canSvg = doc.createElementNS(SVG_NS, "svg");
    canSvg.setAttribute("width", "32");
    canSvg.setAttribute("height", "32");
    canSvg.setAttribute("viewBox", "0 0 32 32");
    const addPart = (name: string, attrs: Record<string, string>) => {
      const node = doc.createElementNS(SVG_NS, name);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
      canSvg.appendChild(node);
    };
    addPart("rect", { x: "9", y: "14", width: "15", height: "12", rx: "3", fill: "#4a9d8e", stroke: "#37796d" });
    addPart("path", { d: "M12 14 Q16 6 21 14", fill: "none", stroke: "#37796d", "stroke-width": "2" });
    addPart("path", { d: "M9 18 L2 13", stroke: "#37796d", "stroke-width": "2", "stroke-linecap": "round" });
    addPart("ellipse", { cx: "2", cy: "13", rx: "2.4", ry: "1.6", fill: "#37796d" });
    cursor.appendChild(canSvg);
    const label = cursor.createSpan({ cls: "garden-can-label", attr: { hidden: "" } });
    cursor.hidden = true;
    this.canCursor = cursor;
    this.canLabel = label;

    this.escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && this.wateringMode) this.exitWatering();
    };
    window.addEventListener("keydown", this.escHandler);

    this.attachControls(host);
    this.applyTransform();
  }

  render(garden: PositionedGarden): void {
    const svg = this.svg;
    const layer = this.plantsLayer;
    if (!svg || !layer) return;
    const doc = svg.ownerDocument;
    this.lastGarden = garden;

    // Apply the active theme; if it changed, force world + plants to redraw.
    const theme = this.getTheme();
    applyPlantTheme(theme);
    applyWorldTheme(theme);
    if (theme.name !== this.lastThemeName) {
      this.lastThemeName = theme.name;
      this.worldSig = "";
      this.sigs.clear();
    }

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
      minX = Math.min(minX, p.position.x);
      minY = Math.min(minY, p.position.y);
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
        el.addEventListener("mouseenter", () => {
          if (this.wateringMode) return; // no tooltips while watering
          this.handler?.({ type: "hover", id, rect: el.getBoundingClientRect() });
        });
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

    if (!this.fitted) this.fit(); // no-op until the pane has a size (ResizeObserver retries)
    this.updateCull();
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
    this.scheduleCull();
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

  fit(): void {
    const svg = this.svg;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    // Not laid out yet — the ResizeObserver will call us again once it has size.
    if (rect.width === 0 || rect.height === 0 || this.contentW === 0) return;
    const k = Math.min(rect.width / this.contentW, rect.height / this.contentH) * 0.98;
    this.scale = clamp(k, MIN_SCALE, MAX_SCALE);
    this.tx = (rect.width - this.contentW * this.scale) / 2;
    this.ty = Math.max(8, (rect.height - this.contentH * this.scale) / 2);
    this.fitted = true;
    this.applyTransform();
  }

  private scheduleCull(): void {
    if (this.cullTimer !== null) window.clearTimeout(this.cullTimer);
    this.cullTimer = window.setTimeout(() => {
      this.cullTimer = null;
      this.updateCull();
    }, 120);
  }

  /** Sway only plants inside the camera viewport (and none when too many are on
   *  screen). Off-screen plants get `garden-still`, which stops their animation. */
  private updateCull(): void {
    const svg = this.svg;
    const garden = this.lastGarden;
    if (!svg || !garden) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return;
    const m = 160;
    const left = -this.tx / this.scale - m;
    const top = -this.ty / this.scale - m;
    const right = (rect.width - this.tx) / this.scale + m;
    const bottom = (rect.height - this.ty) / this.scale + m;

    const visible = new Map<NoteId, boolean>();
    let visCount = 0;
    for (const [id, p] of garden.plants) {
      const v =
        p.position.x + PLANT_WIDTH >= left &&
        p.position.x <= right &&
        p.position.y + PLANT_HEIGHT >= top &&
        p.position.y <= bottom;
      visible.set(id, v);
      if (v) visCount++;
    }
    const over = visCount > SWAY_CAP;
    for (const [id, node] of this.nodes) {
      const still = over || !visible.get(id);
      if (node.classList.contains("garden-still") !== still) {
        node.classList.toggle("garden-still", still);
      }
    }
  }

  // --- Pointer interaction --------------------------------------------------

  private attachControls(host: HTMLElement): void {
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

    const controls = host.createDiv({ cls: "garden-controls" });
    const button = (label: string, title: string, onClick: () => void) => {
      controls
        .createEl("button", {
          text: label,
          attr: { "aria-label": title },
        })
        .addEventListener("click", onClick);
    };
    const zoomButton = (factor: number) => {
      const rect = svg.getBoundingClientRect();
      this.zoomAround(rect.width / 2, rect.height / 2, factor);
    };
    button("−", "Zoom out", () => zoomButton(1 / 1.2));
    button("⤢", "Fit to view", () => this.fit());
    button("+", "Zoom in", () => zoomButton(1.2));
    button("↺", "Reset arrangement", () => this.handler?.({ type: "resetLayout" }));
    host.appendChild(controls);
    this.controls = controls;
  }

  private onPointerDown(e: PointerEvent): void {
    const { wx, wy } = this.clientToWorld(e.clientX, e.clientY);
    const plantEl = e.target instanceof Element ? e.target.closest(".garden-plant") : null;
    const onCan = this.structureAt(wx, wy)?.kind === "watering";

    if (this.wateringMode) {
      const hit = this.plantAt(wx, wy);
      if (hit) {
        this.pendingWater = { id: hit.id, startX: e.clientX, startY: e.clientY, moved: false };
        this.svg?.setPointerCapture(e.pointerId);
        return;
      }
      this.beginPan(e); // pan (or click-to-exit) while the tool is active
      this.downOnCan = onCan;
      return;
    }

    if (plantEl instanceof SVGGElement) {
      this.beginPlantDrag(plantEl, e);
      return;
    }
    const headerBed = this.bedHeaderAt(wx, wy);
    if (headerBed) {
      this.bedDrag = { bed: headerBed, startWx: wx, startWy: wy, dx: 0, dy: 0, moved: false };
      this.svg?.setPointerCapture(e.pointerId);
      return;
    }
    this.beginPan(e);
    this.downOnCan = onCan;
  }

  /** Deepest bed whose header strip (signpost) contains the point — the handle
   *  for dragging a bed. */
  private bedHeaderAt(wx: number, wy: number): Bed | null {
    let best: Bed | null = null;
    for (const b of this.lastGarden?.beds ?? []) {
      if (wx >= b.x && wx <= b.x + b.width && wy >= b.y && wy <= b.y + BED_HEADER) {
        if (!best || b.depth > best.depth) best = b;
      }
    }
    return best;
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
    this.lastClientX = e.clientX;
    this.lastClientY = e.clientY;

    if (this.wateringMode) {
      this.positionCanCursor(e.clientX, e.clientY);
      const { wx, wy } = this.clientToWorld(e.clientX, e.clientY);
      this.highlightWaterTarget(wx, wy);
    }

    const pw = this.pendingWater;
    if (pw) {
      if (Math.abs(e.clientX - pw.startX) + Math.abs(e.clientY - pw.startY) > DRAG_THRESHOLD) pw.moved = true;
      return;
    }

    const bd = this.bedDrag;
    if (bd) {
      const { wx, wy } = this.clientToWorld(e.clientX, e.clientY);
      bd.dx = wx - bd.startWx;
      bd.dy = wy - bd.startWy;
      if (Math.abs(bd.dx) + Math.abs(bd.dy) > DRAG_THRESHOLD) bd.moved = true;
      this.showHighlight(bd.bed.x + bd.dx, bd.bed.y + bd.dy, bd.bed.width, bd.bed.height);
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

    const bd = this.bedDrag;
    if (bd) {
      this.bedDrag = null;
      this.svg?.releasePointerCapture(e.pointerId);
      this.clearHighlight();
      if (bd.moved) this.handler?.({ type: "moveBed", key: bd.bed.key, dx: bd.dx, dy: bd.dy });
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
        // Dropped on the lawn or its own bed → remember this spot.
        this.handler?.({ type: "placePlant", id: drag.id, x: wx - drag.offX, y: wy - drag.offY });
      }
      return;
    }

    if (this.panning) {
      this.panning = false;
      this.svg?.releasePointerCapture(e.pointerId);
      this.svg?.classList.remove("grabbing");
      // A click (no drag) on the can toggles the tool. Clicking elsewhere does
      // NOT drop the tool — it stays until you click the can again or hit Esc.
      if (!this.panMoved && this.downOnCan) this.toggleWatering();
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
    if (this.canCursor) {
      // Place it at the pointer right away so it doesn't flash in from a corner.
      this.positionCanCursor(this.lastClientX, this.lastClientY);
      this.canCursor.hidden = false;
    }
  }

  private exitWatering(): void {
    this.wateringMode = false;
    this.svg?.classList.remove("garden-watering");
    if (this.canCursor) this.canCursor.hidden = true;
    this.clearHighlight();
  }

  /** Keep the can's spout tip on the pointer (the can art's tip is at 2,13). */
  private positionCanCursor(clientX: number, clientY: number): void {
    const rect = this.svg?.getBoundingClientRect();
    if (rect && this.canCursor) {
      this.canCursor.setCssStyles({
        left: `${clientX - rect.left - 2}px`,
        top: `${clientY - rect.top - 13}px`,
      });
    }
  }

  /** The plant whose (padded) box contains the point — nearest centre wins when
   *  boxes overlap. Makes the whole plant cell a watering target. */
  private plantAt(wx: number, wy: number): { id: NoteId; plant: PositionedPlant } | null {
    let best: { id: NoteId; plant: PositionedPlant } | null = null;
    let bestDist = Infinity;
    for (const [id, plant] of this.lastGarden?.plants ?? []) {
      const { x, y } = plant.position;
      if (
        wx >= x - WATER_HIT_PAD &&
        wx <= x + PLANT_WIDTH + WATER_HIT_PAD &&
        wy >= y - WATER_HIT_PAD &&
        wy <= y + PLANT_HEIGHT + WATER_HIT_PAD
      ) {
        const cx = x + PLANT_WIDTH / 2;
        const cy = y + PLANT_HEIGHT * 0.65; // the plant sits low in its box
        const d = (wx - cx) ** 2 + (wy - cy) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = { id, plant };
        }
      }
    }
    return best;
  }

  /** Outline the plant under the spout tip and name it on the cursor label, so
   *  it's clear exactly what will be watered. */
  private highlightWaterTarget(wx: number, wy: number): void {
    const hit = this.plantAt(wx, wy);
    if (hit) {
      this.showHighlight(
        hit.plant.position.x - WATER_HIT_PAD,
        hit.plant.position.y - WATER_HIT_PAD,
        PLANT_WIDTH + WATER_HIT_PAD * 2,
        PLANT_HEIGHT + WATER_HIT_PAD * 2,
      );
      if (this.canLabel) {
        this.canLabel.textContent = hit.plant.title;
        this.canLabel.hidden = false;
      }
    } else {
      this.clearHighlight();
      if (this.canLabel) {
        this.canLabel.textContent = "";
        this.canLabel.hidden = true;
      }
    }
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
    this.highlight.removeAttribute("display");
  }

  private clearHighlight(): void {
    if (this.highlight) this.highlight.setAttribute("display", "none");
  }

  /** Re-render the last garden (used to snap a plant back / restore z-order). */
  private rerender(): void {
    if (this.lastGarden) this.render(this.lastGarden);
  }

  on(handler: (e: PlantEvent) => void): void {
    this.handler = handler;
  }

  destroy(): void {
    this.resizeObs?.disconnect();
    this.resizeObs = null;
    if (this.cullTimer !== null) window.clearTimeout(this.cullTimer);
    this.cullTimer = null;
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
    this.canLabel = null;
    this.lastGarden = null;
    this.wateringMode = false;
    this.pendingWater = null;
    this.bedDrag = null;
    this.nodes.clear();
    this.sigs.clear();
    this.worldSig = "";
    this.fitted = false;
  }
}
