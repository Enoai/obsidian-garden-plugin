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
const SOIL = "#5f4326";
const SOIL_TOP = "#6f5030";

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
    drawBush(doc, foliage, freshness, connectivity, scale, plant.stage);
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
