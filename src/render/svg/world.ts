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
