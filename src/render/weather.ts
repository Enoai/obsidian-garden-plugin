/**
 * Seasonal atmosphere: a subtle tint plus falling particles, rendered as a DOM
 * overlay above the garden pane (independent of the SVG camera, so weather
 * drifts over the whole view regardless of pan/zoom). Pure cosmetic — it never
 * touches vault data.
 */
export type Season = "spring" | "summer" | "autumn" | "winter";
export type SeasonSetting = "auto" | Season | "off";

/** Northern-hemisphere season for a date (meteorological months). */
export function currentSeason(date = new Date()): Season {
  const m = date.getMonth();
  if (m === 11 || m <= 1) return "winter";
  if (m <= 4) return "spring";
  if (m <= 7) return "summer";
  return "autumn";
}

interface SeasonSpec {
  tint: string;
  count: number;
  flakeClasses: string[];
}

const SPRING_SHAPES = ["garden-flake--petal-a", "garden-flake--petal-b", "garden-flake--petal-c"];
const AUTUMN_SHAPES = ["garden-flake--leaf-a", "garden-flake--leaf-b", "garden-flake--leaf-c", "garden-flake--leaf-d"];

const SEASONS: Record<Season, SeasonSpec> = {
  spring: {
    tint: "rgba(150, 210, 140, 0.05)",
    count: 14,
    flakeClasses: SPRING_SHAPES,
  },
  summer: {
    tint: "rgba(255, 210, 120, 0.05)",
    count: 9,
    flakeClasses: ["garden-flake--pollen"],
  },
  autumn: {
    tint: "rgba(210, 140, 60, 0.07)",
    count: 16,
    flakeClasses: AUTUMN_SHAPES,
  },
  winter: {
    tint: "rgba(150, 180, 220, 0.08)",
    count: 22,
    flakeClasses: ["garden-flake--snow"],
  },
};

export class Weather {
  private root: HTMLElement | null = null;
  private tintEl: HTMLElement | null = null;
  private field: HTMLElement | null = null;

  mount(host: HTMLElement): void {
    const root = host.createDiv({ cls: "garden-weather" });
    const tint = root.createDiv({ cls: "garden-weather-tint" });
    const field = root.createDiv({ cls: "garden-weather-field" });
    this.root = root;
    this.tintEl = tint;
    this.field = field;
  }

  setSeason(season: Season | "off"): void {
    const root = this.root;
    const tint = this.tintEl;
    const field = this.field;
    if (!root || !tint || !field) return;

    field.replaceChildren();
    if (season === "off") {
      root.hidden = true;
      return;
    }
    root.hidden = false;

    const spec = SEASONS[season];
    tint.setCssStyles({ background: spec.tint });
    for (let i = 0; i < spec.count; i++) {
      const flakeClass = spec.flakeClasses[Math.floor(Math.random() * spec.flakeClasses.length)];
      const p = field.createSpan({ cls: `garden-flake ${flakeClass}` });
      const size = 5 + Math.random() * 8;
      const duration = 6 + Math.random() * 8;
      p.setCssStyles({
        width: `${size}px`,
        height: `${size}px`,
        left: `${Math.random() * 100}%`,
      });
      p.setCssProps({
        "--drift": `${Math.random() * 80 - 40}px`,
        "--spin": `${Math.random() * 720 - 360}deg`,
        "--flake-duration": `${duration}s`,
        "--flake-delay": `${-Math.random() * duration}s`,
      });
    }
  }

  destroy(): void {
    this.root?.remove();
    this.root = null;
    this.tintEl = null;
    this.field = null;
  }
}
