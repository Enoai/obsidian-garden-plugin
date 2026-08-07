/**
 * Procedural plant drawing — pure functions of a plant's state to SVG. This is
 * the heart of the Phase 1 aesthetic and the easiest place to iterate on how
 * plants look. A theme-pack renderer (Phase 3) replaces this file's role
 * without touching anything else.
 *
 * Local coordinate box is ~56×64 with the soil line near the bottom; the
 * caller translates the whole group into place.
 */
import { PositionedPlant } from "../../model/types";
import { clamp, lerp } from "../../util/math";

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(
  doc: Document,
  name: string,
  attrs: Record<string, string | number>,
): SVGElement {
  const node = doc.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function mix(from: number, to: number, t: number): number {
  return Math.round(lerp(to, from, t));
}

/** Healthy green at freshness 1 → wilted brown at freshness 0. */
function foliageColor(freshness: number): string {
  const green = [0x4e, 0x7d, 0x1a];
  const brown = [0x8a, 0x5a, 0x1f];
  const t = clamp(freshness, 0, 1);
  return `rgb(${mix(green[0], brown[0], t)}, ${mix(green[1], brown[1], t)}, ${mix(green[2], brown[2], t)})`;
}

export function drawPlant(doc: Document, plant: PositionedPlant): SVGGElement {
  const g = doc.createElementNS(SVG_NS, "g");
  const freshness = clamp(plant.health.freshness, 0, 1);
  const connectivity = clamp(plant.health.connectivity, 0, 1);

  // Connectivity drives stature; freshness drives vitality and droop.
  const scale = lerp(0.7, 1.25, connectivity);
  const stemH = lerp(18, 40, connectivity);
  const droop = (1 - freshness) * 10;
  const color = foliageColor(freshness);

  const baseX = 28;
  const baseY = 60;
  const topX = baseX + droop;
  const topY = baseY - stemH * scale;
  const midY = (baseY + topY) / 2;

  g.appendChild(
    svgEl(doc, "ellipse", { cx: baseX, cy: baseY, rx: 14 * scale, ry: 4, fill: "#6b4f2a", opacity: 0.7 }),
  );

  // Stem — quadratic so it can bend as the note goes stale.
  g.appendChild(
    svgEl(doc, "path", {
      d: `M ${baseX} ${baseY} Q ${baseX + droop * 0.5} ${midY} ${topX} ${topY}`,
      stroke: color,
      "stroke-width": 3 * scale,
      fill: "none",
      "stroke-linecap": "round",
    }),
  );

  // A pair of leaves.
  g.appendChild(
    svgEl(doc, "path", {
      d: `M ${baseX} ${midY} Q ${baseX - 12 * scale} ${midY - 6} ${baseX - 14 * scale} ${midY + 2}`,
      stroke: color,
      "stroke-width": 3 * scale,
      fill: "none",
      "stroke-linecap": "round",
    }),
  );
  g.appendChild(
    svgEl(doc, "path", {
      d: `M ${topX} ${topY + 8} Q ${topX + 12 * scale} ${topY + 2} ${topX + 14 * scale} ${topY + 10}`,
      stroke: color,
      "stroke-width": 3 * scale,
      fill: "none",
      "stroke-linecap": "round",
    }),
  );

  // Bloom — the earned reward state.
  if (plant.stage === "flowering") {
    const petals: ReadonlyArray<readonly [number, number, number, string]> = [
      [0, -2, 5, "#e8749f"],
      [-5, 3, 4, "#f2b705"],
      [5, 3, 4, "#d4537e"],
    ];
    for (const [dx, dy, r, fill] of petals) {
      g.appendChild(svgEl(doc, "circle", { cx: topX + dx, cy: topY + dy, r: r * scale, fill }));
    }
  }

  const title = doc.createElementNS(SVG_NS, "title");
  title.textContent = plant.title;
  g.appendChild(title);

  return g;
}
