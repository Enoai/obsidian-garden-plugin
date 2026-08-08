/**
 * The garden scene the plants sit in: a grassy field, soil beds under each
 * clump, and scattered grass tufts. Physical greens/browns are hardcoded on
 * purpose — the garden should look like a garden in any Obsidian theme rather
 * than inverting with light/dark mode.
 */
import { Bed } from "../../model/types";

const SVG_NS = "http://www.w3.org/2000/svg";

const GRASS = "#9cbf6a";
const TUFT = "#7ba650";
const SOIL_RIM = "#5f4326";
// Nested beds get progressively lighter soil so depth reads at a glance.
const SOIL_SHADES = ["#7c5230", "#8a5d38", "#986a41", "#a5764a"];
const SOIL_TOP_SHADES = ["#875a37", "#946640", "#a1734a", "#ad7f54"];

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

const WOOD = "#c08a4e";
const WOOD_DARK = "#8a5f31";
const WOOD_TEXT = "#3f2a12";
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

const FENCE = "#caa06a";
const FENCE_DARK = "#8a5f31";
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
