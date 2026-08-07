/**
 * The placement seam. A `Layout` decides *where* each plant goes; the renderer
 * decides *what* it looks like. Keeping them separate means going from an
 * auto-grid (Phase 1) to saved manual placement (Phase 2) never touches the
 * model or the renderer.
 */
import { GardenState, PositionedGarden } from "../model/types";

export interface Layout {
  place(garden: GardenState): PositionedGarden;
}
