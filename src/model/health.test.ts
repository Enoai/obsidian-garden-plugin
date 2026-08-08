import { describe, expect, it } from "vitest";
import { connectivity, freshness, scoreNote, stageOf } from "./health";
import { ScoringConfig } from "./types";

const DAY = 86_400_000;
const cfg: ScoringConfig = { freshnessHalfLifeDays: 30, connectivitySaturation: 8 };

describe("freshness", () => {
  it("is 1 for a note just edited", () => {
    const now = Date.now();
    expect(freshness(now, now, 30)).toBeCloseTo(1);
  });

  it("halves at the half-life", () => {
    const now = Date.now();
    expect(freshness(now - 30 * DAY, now, 30)).toBeCloseTo(0.5);
  });

  it("decays monotonically and never reaches 0", () => {
    const now = Date.now();
    let prev = Infinity;
    for (const days of [0, 30, 90, 365, 3650]) {
      const f = freshness(now - days * DAY, now, 30);
      expect(f).toBeLessThan(prev);
      expect(f).toBeGreaterThan(0);
      prev = f;
    }
  });
});

describe("connectivity", () => {
  it("is 0 for an orphan", () => {
    expect(connectivity(0, 8)).toBe(0);
  });

  it("saturates at the saturation point", () => {
    expect(connectivity(8, 8)).toBe(1);
    expect(connectivity(40, 8)).toBe(1);
  });

  it("is linear below saturation", () => {
    expect(connectivity(4, 8)).toBeCloseTo(0.5);
  });
});

describe("stageOf", () => {
  it("wilts when stale, whatever the connectivity", () => {
    expect(stageOf({ freshness: 0.1, connectivity: 0.9 })).toBe("wilting");
  });

  it("flowers only when fresh and well-connected", () => {
    expect(stageOf({ freshness: 0.9, connectivity: 0.8 })).toBe("flowering");
  });

  it("treats a fresh orphan as a seed, not an alarm", () => {
    expect(stageOf({ freshness: 0.95, connectivity: 0 })).toBe("seed");
  });
});

describe("scoreNote", () => {
  it("combines both axes", () => {
    const now = Date.now();
    const s = scoreNote({ modifiedMs: now - 30 * DAY, linkCount: 4 }, now, cfg);
    expect(s.freshness).toBeCloseTo(0.5);
    expect(s.connectivity).toBeCloseTo(0.5);
  });
});
