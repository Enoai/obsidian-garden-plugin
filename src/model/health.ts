/**
 * The scoring model — pure functions of numbers and dates. No side effects, no
 * Obsidian. This is where correctness lives; see health.test.ts. The maths is
 * explained in docs/ARCHITECTURE.md#scoring-model.
 */
import { HealthScore, ScoringConfig, Stage } from "./types";

const MS_PER_DAY = 86_400_000;

/**
 * Freshness via half-life decay: 1 at 0 days old, 0.5 at `halfLifeDays`, and
 * asymptotically approaching (but never reaching) 0. A note gets weedy — it
 * never dies.
 */
export function freshness(
  modifiedMs: number,
  nowMs: number,
  halfLifeDays: number,
): number {
  const days = Math.max(0, (nowMs - modifiedMs) / MS_PER_DAY);
  if (halfLifeDays <= 0) return days === 0 ? 1 : 0;
  return Math.pow(0.5, days / halfLifeDays);
}

/**
 * Connectivity saturates: more links help with diminishing returns, capped at
 * 1. A note with 40 links is not 10× a note with 4.
 */
export function connectivity(linkCount: number, saturation: number): number {
  if (linkCount <= 0) return 0;
  if (saturation <= 0) return 1;
  return Math.min(1, linkCount / saturation);
}

/**
 * Map the two axes to a coarse stage. Neglect (low freshness) dominates — a
 * once-important note gone stale should read as wilting regardless of size.
 */
export function stageOf(h: HealthScore): Stage {
  if (h.freshness < 0.25) return "wilting";
  if (h.connectivity < 0.15) return h.freshness > 0.75 ? "seed" : "sprout";
  if (h.freshness > 0.7 && h.connectivity > 0.6) return "flowering";
  return "growing";
}

/** Score one note's metadata against the current config. */
export function scoreNote(
  input: { modifiedMs: number; linkCount: number },
  nowMs: number,
  cfg: ScoringConfig,
): HealthScore {
  return {
    freshness: freshness(input.modifiedMs, nowMs, cfg.freshnessHalfLifeDays),
    connectivity: connectivity(input.linkCount, cfg.connectivitySaturation),
  };
}
