/**
 * Plant species — the visual variety of plants. A note's species is derived
 * deterministically from its id so the garden looks varied but stable (a note
 * keeps its kind across renders). Health still drives colour/size/stage on top
 * of the species silhouette. Swap this resolver for tag/folder rules later.
 */
import { hashString } from "../util/hash";

export const PLANT_SPECIES = ["bush", "flower", "tree", "fern", "succulent"] as const;
export type Species = (typeof PLANT_SPECIES)[number];

// Weighted pool — bushes and flowers are common, trees/ferns/succulents rarer.
const POOL: Species[] = ["bush", "bush", "flower", "flower", "tree", "fern", "succulent"];

export function resolveSpecies(id: string): Species {
  return POOL[hashString(id) % POOL.length];
}
