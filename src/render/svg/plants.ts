/**
 * Procedural plant drawing — pure functions of a plant's state to SVG. Painterly
 * style: layered overlapping foliage in tonal greens for depth (no outlines).
 *
 * How state maps to appearance:
 *   - connectivity → stature & fullness (scale, stem height)
 *   - freshness    → the whole palette ramps green → brown, plus stem droop
 *   - stage        → seed/sprout draw a small sprout; wilting sheds leaves;
 *                    flowering nestles blooms in the canopy
 *
 * Everything is deterministic (fixed offsets, no randomness) so re-renders don't
 * make plants jitter. A theme-pack renderer (Phase 3) replaces this file's role
 * without touching anything else.
 *
 * Local coordinate box is PLANT_WIDTH × PLANT_HEIGHT with the soil near the
 * bottom; the caller translates the whole group into place.
 */
import { PositionedPlant, Stage } from "../../model/types";
import { clamp, lerp } from "../../util/math";
import { hashString } from "../../util/hash";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Drawn footprint of a plant. Kept here because this file owns plant size;
 *  the layout spaces cells larger than this and the renderer pads the viewBox
 *  by it. */
export const PLANT_WIDTH = 104;
export const PLANT_HEIGHT = 104;

const BASE_X = 52;
const BASE_Y = 96;

type RGB = readonly [number, number, number];

// Healthy tone → dead tone for each foliage layer.
const GREEN_DARK: RGB = [0x2f, 0x5f, 0x16];
const GREEN_MID: RGB = [0x4e, 0x7d, 0x1a];
const GREEN_LIGHT: RGB = [0x8c, 0xc1, 0x52];
const BROWN_DARK: RGB = [0x5a, 0x3d, 0x1a];
const BROWN_MID: RGB = [0x7a, 0x56, 0x20];
const TAN_LIGHT: RGB = [0xb0, 0x93, 0x52];

const PETAL = "#e8749f";
const PETAL_CENTER = "#f2b705";
const PETAL_FADED = "#b98a6a";
const SOIL = "#5f4326";
const SOIL_TOP = "#6f5030";
const TRUNK = "#6e4a28";
// Succulents redden as they dry out.
const SUCC_DEAD: RGB = [0xa8, 0x55, 0x30];
const SUCC_TAN: RGB = [0xc0, 0x77, 0x50];

function svgEl(
  doc: Document,
  name: string,
  attrs: Record<string, string | number>,
): SVGElement {
  const node = doc.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** Interpolate a layer's colour from its dead tone (freshness 0) to its
 *  healthy tone (freshness 1). */
function ramp(freshness: number, healthy: RGB, dead: RGB): string {
  const t = clamp(freshness, 0, 1);
  const r = Math.round(lerp(dead[0], healthy[0], t));
  const g = Math.round(lerp(dead[1], healthy[1], t));
  const b = Math.round(lerp(dead[2], healthy[2], t));
  return `rgb(${r}, ${g}, ${b})`;
}

function blob(
  doc: Document,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fill: string,
): SVGElement {
  return svgEl(doc, "ellipse", { cx, cy, rx, ry, fill });
}

export function drawPlant(doc: Document, plant: PositionedPlant): SVGGElement {
  const g = doc.createElementNS(SVG_NS, "g");
  const freshness = clamp(plant.health.freshness, 0, 1);
  const connectivity = clamp(plant.health.connectivity, 0, 1);
  const scale = lerp(0.6, 1.25, connectivity);

  // Soil mound (static — does not sway).
  g.appendChild(blob(doc, BASE_X, BASE_Y, 24 * scale, 6, SOIL));
  g.appendChild(blob(doc, BASE_X, BASE_Y - 3, 20 * scale, 4, SOIL_TOP));

  // Foliage sits in its own group that CSS sways from the base. Each plant is
  // desynced by its id so the garden doesn't move in unison.
  const foliage = doc.createElementNS(SVG_NS, "g");
  foliage.classList.add("garden-foliage");
  const h = hashString(plant.id);
  foliage.style.animationDelay = `-${(h % 6000) / 1000}s`;
  foliage.style.animationDuration = `${4.2 + ((h >> 8) % 20) / 10}s`;

  if (plant.stage === "seed" || plant.stage === "sprout") {
    drawSprout(doc, foliage, freshness, scale);
  } else {
    drawSpecies(doc, foliage, plant.type, freshness, connectivity, scale, plant.stage);
  }
  g.appendChild(foliage);

  const title = doc.createElementNS(SVG_NS, "title");
  title.textContent = plant.title;
  g.appendChild(title);
  return g;
}

/** A small young plant — the orphan / just-planted case. */
function drawSprout(
  doc: Document,
  g: SVGGElement,
  freshness: number,
  scale: number,
): void {
  const stem = ramp(freshness, GREEN_MID, BROWN_MID);
  const light = ramp(freshness, GREEN_LIGHT, TAN_LIGHT);
  const h = 28 * scale;
  const topY = BASE_Y - h;

  g.appendChild(
    svgEl(doc, "path", {
      d: `M ${BASE_X} ${BASE_Y} Q ${BASE_X - 2} ${BASE_Y - h * 0.6} ${BASE_X} ${topY}`,
      stroke: stem,
      "stroke-width": 3 * scale,
      fill: "none",
      "stroke-linecap": "round",
    }),
  );
  g.appendChild(
    svgEl(doc, "path", {
      d: `M ${BASE_X} ${topY + 9} Q ${BASE_X - 15 * scale} ${topY + 1} ${BASE_X - 17 * scale} ${topY + 12} Q ${BASE_X - 6 * scale} ${topY + 13} ${BASE_X} ${topY + 9} Z`,
      fill: light,
    }),
  );
  g.appendChild(
    svgEl(doc, "path", {
      d: `M ${BASE_X} ${topY + 4} Q ${BASE_X + 15 * scale} ${topY - 4} ${BASE_X + 17 * scale} ${topY + 7} Q ${BASE_X + 6 * scale} ${topY + 9} ${BASE_X} ${topY + 4} Z`,
      fill: stem,
    }),
  );
}

/** A full plant — layered painterly canopy. */
function drawBush(
  doc: Document,
  g: SVGGElement,
  freshness: number,
  connectivity: number,
  scale: number,
  stage: Stage,
): void {
  const dark = ramp(freshness, GREEN_DARK, BROWN_DARK);
  const mid = ramp(freshness, GREEN_MID, BROWN_MID);
  const light = ramp(freshness, GREEN_LIGHT, TAN_LIGHT);
  const wilting = stage === "wilting";

  const stemH = lerp(26, 48, connectivity) * scale;
  const droop = (1 - freshness) * 12;
  const topX = BASE_X + droop;
  const topY = BASE_Y - stemH;

  // Stem, bending as the note goes stale.
  g.appendChild(
    svgEl(doc, "path", {
      d: `M ${BASE_X} ${BASE_Y} C ${BASE_X + droop * 0.4} ${BASE_Y - stemH * 0.5} ${topX} ${BASE_Y - stemH * 0.7} ${topX} ${topY}`,
      stroke: dark,
      "stroke-width": 4 * scale,
      fill: "none",
      "stroke-linecap": "round",
    }),
  );

  // Canopy: overlapping ellipses, back-to-front, offsets relative to the top.
  const at = (dx: number, dy: number, rx: number, ry: number, fill: string) =>
    g.appendChild(blob(doc, topX + dx * scale, topY + dy * scale, rx * scale, ry * scale, fill));

  at(-14, 6, 20, 13, dark);
  at(16, 2, 18, 12, dark);
  at(-6, -6, 22, 15, mid);
  at(10, 10, 17, 12, mid);
  if (!wilting && freshness > 0.4) {
    at(-10, -13, 13, 9, light);
    at(6, -3, 11, 8, light);
  }

  // Wilting sheds a few leaves onto the soil.
  if (wilting) {
    g.appendChild(blob(doc, BASE_X - 16 * scale, BASE_Y - 1, 6, 3, dark));
    g.appendChild(blob(doc, BASE_X + 14 * scale, BASE_Y, 5, 2.5, mid));
    g.appendChild(blob(doc, BASE_X + 2 * scale, BASE_Y + 2, 5, 2.5, dark));
  }

  // Flowering nestles blooms in the canopy — the earned reward state.
  if (stage === "flowering") {
    bloom(doc, g, topX - 8 * scale, topY - 6 * scale, 6 * scale);
    bloom(doc, g, topX + 8 * scale, topY + 6 * scale, 4.5 * scale);
  }
}

function bloom(doc: Document, g: SVGGElement, cx: number, cy: number, r: number): void {
  const petals: ReadonlyArray<readonly [number, number]> = [
    [0, -1],
    [1, 0.4],
    [0.6, 1],
    [-0.6, 1],
    [-1, 0.4],
  ];
  for (const [dx, dy] of petals) {
    g.appendChild(blob(doc, cx + dx * r, cy + dy * r, r * 0.7, r * 0.7, PETAL));
  }
  g.appendChild(blob(doc, cx, cy, r * 0.55, r * 0.55, PETAL_CENTER));
}

/** Dispatch to a species silhouette. Health (colour/size/stage) is applied
 *  inside each. */
function drawSpecies(
  doc: Document,
  g: SVGGElement,
  type: string,
  freshness: number,
  connectivity: number,
  scale: number,
  stage: Stage,
): void {
  switch (type) {
    case "flower":
      return drawFlower(doc, g, freshness, connectivity, scale, stage);
    case "tree":
      return drawTree(doc, g, freshness, connectivity, scale, stage);
    case "fern":
      return drawFern(doc, g, freshness, connectivity, scale);
    case "succulent":
      return drawSucculent(doc, g, freshness, connectivity, scale, stage);
    default:
      return drawBush(doc, g, freshness, connectivity, scale, stage);
  }
}

/** Tall stem topped with a bloom. */
function drawFlower(
  doc: Document,
  g: SVGGElement,
  freshness: number,
  connectivity: number,
  scale: number,
  stage: Stage,
): void {
  const stemCol = ramp(freshness, GREEN_MID, BROWN_MID);
  const leafCol = ramp(freshness, GREEN_LIGHT, TAN_LIGHT);
  const wilting = stage === "wilting";
  const stemH = lerp(30, 52, connectivity) * scale;
  const droop = (1 - freshness) * 14;
  const topX = BASE_X + droop;
  const topY = BASE_Y - stemH;
  const midY = (BASE_Y + topY) / 2;

  g.appendChild(
    svgEl(doc, "path", {
      d: `M ${BASE_X} ${BASE_Y} C ${BASE_X + droop * 0.4} ${BASE_Y - stemH * 0.5} ${topX} ${BASE_Y - stemH * 0.7} ${topX} ${topY}`,
      stroke: stemCol,
      "stroke-width": 3 * scale,
      fill: "none",
      "stroke-linecap": "round",
    }),
  );
  g.appendChild(
    svgEl(doc, "path", {
      d: `M ${BASE_X} ${midY} Q ${BASE_X - 14 * scale} ${midY - 6} ${BASE_X - 16 * scale} ${midY + 4} Q ${BASE_X - 5 * scale} ${midY + 6} ${BASE_X} ${midY} Z`,
      fill: leafCol,
    }),
  );
  g.appendChild(
    svgEl(doc, "path", {
      d: `M ${topX} ${midY + 8} Q ${topX + 14 * scale} ${midY} ${topX + 16 * scale} ${midY + 10} Q ${topX + 5 * scale} ${midY + 12} ${topX} ${midY + 8} Z`,
      fill: stemCol,
    }),
  );

  const petalColor = wilting ? PETAL_FADED : PETAL;
  const r = 7 * scale;
  const petals = wilting
    ? [[0, -1], [0.9, 0.5], [-0.9, 0.5]]
    : [[0, -1], [0.95, -0.31], [0.59, 0.81], [-0.59, 0.81], [-0.95, -0.31]];
  for (const [dx, dy] of petals) {
    g.appendChild(blob(doc, topX + dx * r, topY + dy * r, r * 0.85, r * 0.85, petalColor));
  }
  g.appendChild(blob(doc, topX, topY, r * 0.6, r * 0.6, PETAL_CENTER));
}

/** Woody trunk with a rounded canopy — bigger and taller than a bush. */
function drawTree(
  doc: Document,
  g: SVGGElement,
  freshness: number,
  connectivity: number,
  scale: number,
  stage: Stage,
): void {
  const dark = ramp(freshness, GREEN_DARK, BROWN_DARK);
  const mid = ramp(freshness, GREEN_MID, BROWN_MID);
  const light = ramp(freshness, GREEN_LIGHT, TAN_LIGHT);
  const wilting = stage === "wilting";
  const trunkH = lerp(26, 42, connectivity) * scale;
  const trunkTopY = BASE_Y - trunkH;
  const w = 8 * scale;

  g.appendChild(
    svgEl(doc, "path", {
      d: `M ${BASE_X - w / 2} ${BASE_Y} L ${BASE_X - w / 3} ${trunkTopY} L ${BASE_X + w / 3} ${trunkTopY} L ${BASE_X + w / 2} ${BASE_Y} Z`,
      fill: TRUNK,
    }),
  );

  const cx = BASE_X;
  const cy = trunkTopY - 6 * scale;
  const at = (dx: number, dy: number, rx: number, ry: number, fill: string) =>
    blob(doc, cx + dx * scale, cy + dy * scale, rx * scale, ry * scale, fill);
  at(-16, 6, 22, 16, dark);
  at(16, 4, 20, 15, dark);
  at(-4, -8, 26, 19, mid);
  at(12, 10, 18, 14, mid);
  if (!wilting && freshness > 0.4) {
    at(-10, -14, 15, 11, light);
    at(8, -4, 13, 10, light);
  }
  if (wilting) {
    blob(doc, BASE_X - 16 * scale, BASE_Y - 1, 6, 3, dark);
    blob(doc, BASE_X + 12 * scale, BASE_Y, 5, 2.5, mid);
  }
  if (stage === "flowering") {
    for (const [dx, dy] of [[-8, -6], [8, -2], [0, 8]]) {
      blob(doc, cx + dx * scale, cy + dy * scale, 3.2 * scale, 3.2 * scale, PETAL);
    }
  }
}

/** Arching fronds fanning from the base. */
function drawFern(
  doc: Document,
  g: SVGGElement,
  freshness: number,
  connectivity: number,
  scale: number,
): void {
  const col = ramp(freshness, GREEN_MID, BROWN_MID);
  const tip = ramp(freshness, GREEN_LIGHT, TAN_LIGHT);
  const n = Math.round(lerp(4, 7, connectivity));
  const droop = (1 - freshness) * 10;
  const h = lerp(26, 44, connectivity) * scale;

  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const spread = (t - 0.5) * 2;
    const endX = BASE_X + spread * 26 * scale;
    const endY = BASE_Y - h * (1 - Math.abs(spread) * 0.35) + droop;
    const ctrlX = BASE_X + spread * 10 * scale;
    const ctrlY = BASE_Y - h * 0.8;
    g.appendChild(
      svgEl(doc, "path", {
        d: `M ${BASE_X} ${BASE_Y} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`,
        stroke: col,
        "stroke-width": 2.4 * scale,
        fill: "none",
        "stroke-linecap": "round",
      }),
    );
    g.appendChild(blob(doc, endX, endY, 3 * scale, 3 * scale, tip));
  }
}

/** A low rosette of thick leaves; reddens when dry, sends up a bloom stalk. */
function drawSucculent(
  doc: Document,
  g: SVGGElement,
  freshness: number,
  connectivity: number,
  scale: number,
  stage: Stage,
): void {
  const col = ramp(freshness, GREEN_MID, SUCC_DEAD);
  const light = ramp(freshness, GREEN_LIGHT, SUCC_TAN);
  const cx = BASE_X;
  const cy = BASE_Y - 8 * scale;
  const n = 8;
  const r = lerp(14, 22, connectivity) * scale;

  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const ex = cx + Math.cos(a) * r;
    const ey = cy + Math.sin(a) * r * 0.6 - 4 * scale;
    const mx = cx + Math.cos(a) * r * 0.5;
    const my = cy + Math.sin(a) * r * 0.3 - 2 * scale;
    g.appendChild(
      svgEl(doc, "path", {
        d: `M ${cx} ${cy} Q ${mx - 3} ${my} ${ex} ${ey} Q ${mx + 3} ${my} ${cx} ${cy} Z`,
        fill: i % 2 ? col : light,
      }),
    );
  }
  g.appendChild(blob(doc, cx, cy, 4 * scale, 3 * scale, light));
  if (stage === "flowering") {
    g.appendChild(
      svgEl(doc, "path", {
        d: `M ${cx} ${cy} L ${cx} ${cy - 16 * scale}`,
        stroke: col,
        "stroke-width": 2 * scale,
        fill: "none",
        "stroke-linecap": "round",
      }),
    );
    g.appendChild(blob(doc, cx, cy - 16 * scale, 3.5 * scale, 3.5 * scale, PETAL));
  }
}
