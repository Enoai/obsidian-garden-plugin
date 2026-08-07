/**
 * The surrounding scene. Phase 1 is just a soft ground surface; later phases
 * add fence, shed, compost, and ambient effects here.
 */
const SVG_NS = "http://www.w3.org/2000/svg";

export function drawGround(doc: Document, width: number, height: number): SVGElement {
  const rect = doc.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", "0");
  rect.setAttribute("y", "0");
  rect.setAttribute("width", String(width));
  rect.setAttribute("height", String(height));
  rect.setAttribute("rx", "12");
  // Theme-aware — reads Obsidian's own surface colour, so it fits any theme.
  rect.setAttribute("fill", "var(--background-secondary)");
  return rect;
}
