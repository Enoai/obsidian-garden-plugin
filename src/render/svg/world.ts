/**
 * The garden scene the plants sit in: a grassy field, soil beds under each
 * clump, and scattered grass tufts. Physical greens/browns are hardcoded on
 * purpose — the garden should look like a garden in any Obsidian theme rather
 * than inverting with light/dark mode.
 */
import { Bed, Structure } from "../../model/types";
import { Theme } from "../theme";

const SVG_NS = "http://www.w3.org/2000/svg";

// Palette — reassigned by applyWorldTheme() before each render.
let GRASS = "#9cbf6a";
let TUFT = "#7ba650";
let SOIL_RIM = "#5f4326";
// Nested beds get progressively lighter soil so depth reads at a glance.
let SOIL_SHADES = ["#7c5230", "#8a5d38", "#986a41", "#a5764a"];
let SOIL_TOP_SHADES = ["#875a37", "#946640", "#a1734a", "#ad7f54"];

// Sprite art for structures, if the active theme is a sprite pack.
let STRUCTURE_SPRITES: Record<string, string> | undefined;

export function applyWorldTheme(theme: Theme): void {
  STRUCTURE_SPRITES = theme.sprites?.structures;
  GRASS = theme.world.grass;
  TUFT = theme.world.tuft;
  SOIL_RIM = theme.world.soilRim;
  SOIL_SHADES = theme.world.soilShades;
  SOIL_TOP_SHADES = theme.world.soilTopShades;
  WOOD = theme.world.wood;
  WOOD_DARK = theme.world.woodDark;
  WOOD_TEXT = theme.world.woodText;
  FENCE = theme.world.fence;
  FENCE_DARK = theme.world.fenceDark;
}

function el(
  doc: Document,
  name: string,
  attrs: Record<string, string | number>,
): SVGElement {
  const node = doc.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

export function drawGrass(doc: Document, width: number, height: number): SVGElement {
  const g = doc.createElementNS(SVG_NS, "g");
  g.appendChild(el(doc, "rect", { x: 0, y: 0, width, height, rx: 16, fill: GRASS }));
  // A whisper of shading so the flat field isn't dead flat.
  g.appendChild(
    el(doc, "rect", { x: 0, y: 0, width, height, rx: 16, fill: "#000000", "fill-opacity": 0.04 }),
  );
  return g;
}

export function drawBed(doc: Document, bed: Bed): SVGElement {
  const g = doc.createElementNS(SVG_NS, "g");
  const i = Math.min(bed.depth, SOIL_SHADES.length - 1);
  g.appendChild(el(doc, "rect", { x: bed.x, y: bed.y, width: bed.width, height: bed.height, rx: 16, fill: SOIL_RIM }));
  g.appendChild(el(doc, "rect", { x: bed.x, y: bed.y, width: bed.width, height: bed.height - 5, rx: 16, fill: SOIL_SHADES[i] }));
  g.appendChild(el(doc, "rect", { x: bed.x + 4, y: bed.y + 4, width: bed.width - 8, height: bed.height - 12, rx: 12, fill: SOIL_TOP_SHADES[i] }));
  return g;
}

export function drawTuft(doc: Document, x: number, y: number): SVGElement {
  const g = doc.createElementNS(SVG_NS, "g");
  for (const dx of [-3, 0, 3]) {
    g.appendChild(
      el(doc, "path", {
        d: `M ${x + dx} ${y} q ${dx * 0.4} -6 ${dx * 0.25} -9`,
        stroke: TUFT,
        "stroke-width": 1.6,
        fill: "none",
        "stroke-linecap": "round",
      }),
    );
  }
  return g;
}

let WOOD = "#c08a4e";
let WOOD_DARK = "#8a5f31";
let WOOD_TEXT = "#3f2a12";
const LABEL_HEIGHT = 16;

/** A wooden header plaque naming the folder, sitting inside the bed's top strip
 *  so nested beds label cleanly without anything poking outside. */
export function drawBedLabel(doc: Document, bed: Bed): SVGElement {
  const g = doc.createElementNS(SVG_NS, "g");
  const raw = bed.label;
  const label = raw.length > 18 ? `${raw.slice(0, 17)}…` : raw;
  const width = Math.min(bed.width - 12, Math.max(40, label.length * 7 + 14));
  const x = bed.x + 8;
  const y = bed.y + 5;

  g.appendChild(el(doc, "rect", { x, y, width, height: LABEL_HEIGHT, rx: 5, fill: WOOD }));
  g.appendChild(el(doc, "rect", { x, y, width, height: LABEL_HEIGHT, rx: 5, fill: "none", stroke: WOOD_DARK, "stroke-width": 1 }));

  const text = doc.createElementNS(SVG_NS, "text");
  text.setAttribute("x", String(x + width / 2));
  text.setAttribute("y", String(y + LABEL_HEIGHT / 2));
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dominant-baseline", "central");
  text.setAttribute("font-family", "-apple-system, system-ui, sans-serif");
  text.setAttribute("font-size", "11");
  text.setAttribute("fill", WOOD_TEXT);
  text.textContent = label;
  g.appendChild(text);
  return g;
}

function structureLabel(doc: Document, cx: number, y: number, text: string): SVGElement {
  const t = doc.createElementNS(SVG_NS, "text");
  t.setAttribute("x", String(cx));
  t.setAttribute("y", String(y));
  t.setAttribute("text-anchor", "middle");
  t.setAttribute("dominant-baseline", "central");
  t.setAttribute("font-family", "-apple-system, system-ui, sans-serif");
  t.setAttribute("font-size", "11");
  t.setAttribute("font-weight", "500");
  t.setAttribute("fill", WOOD_TEXT);
  t.textContent = text;
  return t;
}

/** Draw a sprite pack's image for a structure, with its label underneath. */
function structureImage(doc: Document, s: Structure, url: string, label: string): SVGElement {
  const g = doc.createElementNS(SVG_NS, "g");
  g.appendChild(
    el(doc, "image", {
      x: s.x + 6,
      y: s.y + 2,
      width: s.width - 12,
      height: s.height - 18,
      href: url,
      preserveAspectRatio: "xMidYMax meet",
    }),
  );
  g.appendChild(structureLabel(doc, s.x + s.width / 2, s.y + s.height - 6, label));
  return g;
}

/** A little wooden shed — the archive drop target. */
export function drawShed(doc: Document, s: Structure): SVGElement {
  if (STRUCTURE_SPRITES?.shed) return structureImage(doc, s, STRUCTURE_SPRITES.shed, "shed · archive");
  const g = doc.createElementNS(SVG_NS, "g");
  const cx = s.x + s.width / 2;
  const bodyY = s.y + 34;
  g.appendChild(el(doc, "rect", { x: s.x + 20, y: bodyY, width: s.width - 40, height: 44, rx: 3, fill: "#a9764a" }));
  g.appendChild(el(doc, "rect", { x: s.x + 20, y: bodyY, width: s.width - 40, height: 44, rx: 3, fill: "none", stroke: "#7c5636", "stroke-width": 1 }));
  g.appendChild(el(doc, "path", { d: `M ${s.x + 12} ${bodyY + 2} L ${cx} ${s.y + 8} L ${s.x + s.width - 12} ${bodyY + 2} Z`, fill: "#6d4a2e" }));
  g.appendChild(el(doc, "rect", { x: cx - 9, y: bodyY + 14, width: 18, height: 30, rx: 2, fill: "#7c5636" }));
  g.appendChild(el(doc, "circle", { cx: cx + 4, cy: bodyY + 29, r: 1.6, fill: "#d8c79b" }));
  g.appendChild(structureLabel(doc, cx, s.y + s.height - 6, "shed · archive"));
  return g;
}

/** A compost bin — the trash drop target. */
export function drawCompost(doc: Document, s: Structure): SVGElement {
  if (STRUCTURE_SPRITES?.compost) return structureImage(doc, s, STRUCTURE_SPRITES.compost, "compost");
  const g = doc.createElementNS(SVG_NS, "g");
  const cx = s.x + s.width / 2;
  const x = s.x + 28;
  const y = s.y + 34;
  const w = s.width - 56;
  const h = 44;
  g.appendChild(el(doc, "rect", { x, y, width: w, height: h, rx: 4, fill: "#8a5a34" }));
  g.appendChild(el(doc, "rect", { x, y, width: w, height: h, rx: 4, fill: "none", stroke: "#6a4426", "stroke-width": 1 }));
  for (let i = 1; i <= 2; i++) {
    g.appendChild(el(doc, "line", { x1: x, y1: y + (h / 3) * i, x2: x + w, y2: y + (h / 3) * i, stroke: "#6a4426", "stroke-width": 1.5 }));
  }
  g.appendChild(el(doc, "ellipse", { cx: x + w * 0.35, cy: y, rx: 12, ry: 6, fill: "#4e6b2f" }));
  g.appendChild(el(doc, "ellipse", { cx: x + w * 0.68, cy: y - 1, rx: 10, ry: 5, fill: "#3f7a1f" }));
  g.appendChild(structureLabel(doc, cx, s.y + s.height - 6, "compost"));
  return g;
}

/** A watering can — the "touch / refresh" drop target. */
export function drawWateringCan(doc: Document, s: Structure): SVGElement {
  if (STRUCTURE_SPRITES?.watering) return structureImage(doc, s, STRUCTURE_SPRITES.watering, "watering can");
  const g = doc.createElementNS(SVG_NS, "g");
  const cx = s.x + s.width / 2;
  const CAN = "#4a9d8e";
  const CAN_DARK = "#37796d";
  const topY = s.y + 46;

  g.appendChild(el(doc, "rect", { x: cx - 24, y: topY, width: 48, height: 36, rx: 7, fill: CAN }));
  g.appendChild(el(doc, "rect", { x: cx - 24, y: topY, width: 48, height: 36, rx: 7, fill: "none", stroke: CAN_DARK, "stroke-width": 1 }));
  g.appendChild(el(doc, "ellipse", { cx, cy: topY, rx: 24, ry: 5, fill: CAN_DARK }));
  g.appendChild(el(doc, "path", { d: `M ${cx - 15} ${topY - 1} Q ${cx} ${topY - 21} ${cx + 15} ${topY - 1}`, stroke: CAN_DARK, "stroke-width": 4, fill: "none", "stroke-linecap": "round" }));
  g.appendChild(el(doc, "path", { d: `M ${cx - 22} ${topY + 9} L ${cx - 46} ${topY - 7} L ${cx - 40} ${topY - 13} L ${cx - 18} ${topY + 3} Z`, fill: CAN }));
  g.appendChild(el(doc, "path", { d: `M ${cx - 22} ${topY + 9} L ${cx - 46} ${topY - 7} L ${cx - 40} ${topY - 13} L ${cx - 18} ${topY + 3} Z`, fill: "none", stroke: CAN_DARK, "stroke-width": 1 }));
  g.appendChild(el(doc, "ellipse", { cx: cx - 45, cy: topY - 10, rx: 6, ry: 4, fill: CAN_DARK }));
  for (const [dx, dy] of [[-45, 4], [-48, 12], [-42, 11]] as const) {
    g.appendChild(el(doc, "ellipse", { cx: cx + dx, cy: topY + dy, rx: 1.6, ry: 2.4, fill: "#7fc8f2" }));
  }
  g.appendChild(structureLabel(doc, cx, s.y + s.height - 6, "watering can"));
  return g;
}

let FENCE = "#caa06a";
let FENCE_DARK = "#8a5f31";
const PICKET_STEP = 22;
const FENCE_INSET = 11;

/** A picket fence enclosing the whole plot. */
export function drawFence(doc: Document, width: number, height: number): SVGElement {
  const g = doc.createElementNS(SVG_NS, "g");
  const i = FENCE_INSET;

  // Rail frame the pickets sit on.
  g.appendChild(
    el(doc, "rect", {
      x: i, y: i, width: width - i * 2, height: height - i * 2, rx: 6,
      fill: "none", stroke: FENCE_DARK, "stroke-width": 2, "stroke-opacity": 0.55,
    }),
  );

  const picket = (cx: number, cy: number) => {
    g.appendChild(el(doc, "rect", { x: cx - 3, y: cy - 8, width: 6, height: 16, rx: 2, fill: FENCE }));
    g.appendChild(el(doc, "rect", { x: cx - 3, y: cy - 8, width: 6, height: 16, rx: 2, fill: "none", stroke: FENCE_DARK, "stroke-width": 0.75 }));
  };

  for (let x = i + PICKET_STEP; x <= width - i - PICKET_STEP; x += PICKET_STEP) {
    picket(x, i);
    picket(x, height - i);
  }
  for (let y = i + PICKET_STEP; y <= height - i - PICKET_STEP; y += PICKET_STEP) {
    picket(i, y);
    picket(width - i, y);
  }

  // Sturdier corner posts.
  const post = (cx: number, cy: number) =>
    g.appendChild(el(doc, "rect", { x: cx - 4, y: cy - 11, width: 8, height: 22, rx: 2, fill: FENCE_DARK }));
  post(i, i);
  post(width - i, i);
  post(i, height - i);
  post(width - i, height - i);

  return g;
}
