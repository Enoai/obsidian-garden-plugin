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
const SOIL = "#7c5230";
const SOIL_TOP = "#875a37";
const SOIL_RIM = "#5f4326";

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
  g.appendChild(el(doc, "rect", { x: bed.x, y: bed.y, width: bed.width, height: bed.height, rx: 18, fill: SOIL_RIM }));
  g.appendChild(el(doc, "rect", { x: bed.x, y: bed.y, width: bed.width, height: bed.height - 5, rx: 18, fill: SOIL }));
  g.appendChild(el(doc, "rect", { x: bed.x + 4, y: bed.y + 4, width: bed.width - 8, height: bed.height - 12, rx: 14, fill: SOIL_TOP }));
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
const WOOD_STAKE = "#6f4a28";
const WOOD_TEXT = "#3f2a12";
const LABEL_HEIGHT = 18;

/** A little wooden signpost naming the folder a bed represents. */
export function drawBedLabel(doc: Document, bed: Bed): SVGElement {
  const g = doc.createElementNS(SVG_NS, "g");
  const raw = bed.key === "(root)" ? "root" : bed.key;
  const label = raw.length > 16 ? `${raw.slice(0, 15)}…` : raw;
  const width = Math.max(46, label.length * 7 + 16);
  const cx = bed.x + bed.width / 2;
  const plaqueY = bed.y - LABEL_HEIGHT - 3;

  g.appendChild(el(doc, "rect", { x: cx - 2, y: bed.y - 6, width: 4, height: 12, fill: WOOD_STAKE }));
  g.appendChild(el(doc, "rect", { x: cx - width / 2, y: plaqueY, width, height: LABEL_HEIGHT, rx: 5, fill: WOOD }));
  g.appendChild(el(doc, "rect", { x: cx - width / 2, y: plaqueY, width, height: LABEL_HEIGHT, rx: 5, fill: "none", stroke: WOOD_DARK, "stroke-width": 1 }));

  const text = doc.createElementNS(SVG_NS, "text");
  text.setAttribute("x", String(cx));
  text.setAttribute("y", String(plaqueY + LABEL_HEIGHT / 2));
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dominant-baseline", "central");
  text.setAttribute("font-family", "-apple-system, system-ui, sans-serif");
  text.setAttribute("font-size", "11");
  text.setAttribute("fill", WOOD_TEXT);
  text.textContent = label;
  g.appendChild(text);
  return g;
}

/** A wooden frame around the whole plot. */
export function drawBorder(doc: Document, width: number, height: number): SVGElement {
  const g = doc.createElementNS(SVG_NS, "g");
  g.appendChild(el(doc, "rect", { x: 3, y: 3, width: width - 6, height: height - 6, rx: 14, fill: "none", stroke: WOOD_DARK, "stroke-width": 4 }));
  g.appendChild(el(doc, "rect", { x: 6, y: 6, width: width - 12, height: height - 12, rx: 11, fill: "none", stroke: WOOD, "stroke-width": 1.5, "stroke-opacity": 0.6 }));
  return g;
}
