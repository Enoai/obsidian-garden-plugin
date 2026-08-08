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
  make: (doc: Document) => HTMLElement;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function styled(doc: Document, background: string, borderRadius: string): HTMLElement {
  const s = doc.createElement("span");
  s.style.background = background;
  s.style.borderRadius = borderRadius;
  return s;
}

const SEASONS: Record<Season, SeasonSpec> = {
  spring: {
    tint: "rgba(150, 210, 140, 0.05)",
    count: 14,
    make: (doc) => styled(doc, pick(["#f2b8cd", "#e88ba9", "#f4c9d6"]), "50% 0 50% 0"),
  },
  summer: {
    tint: "rgba(255, 210, 120, 0.05)",
    count: 9,
    make: (doc) => styled(doc, "rgba(245, 225, 120, 0.7)", "50%"),
  },
  autumn: {
    tint: "rgba(210, 140, 60, 0.07)",
    count: 16,
    make: (doc) => styled(doc, pick(["#c56a2c", "#d98a3a", "#a8471f", "#c9a13a"]), "0 100% 0 100%"),
  },
  winter: {
    tint: "rgba(150, 180, 220, 0.08)",
    count: 22,
    make: (doc) => styled(doc, "rgba(255, 255, 255, 0.9)", "50%"),
  },
};

export class Weather {
  private root: HTMLElement | null = null;
  private tintEl: HTMLElement | null = null;
  private field: HTMLElement | null = null;

  mount(host: HTMLElement): void {
    const doc = host.ownerDocument;
    const root = doc.createElement("div");
    root.className = "garden-weather";
    const tint = doc.createElement("div");
    tint.className = "garden-weather-tint";
    const field = doc.createElement("div");
    field.className = "garden-weather-field";
    root.append(tint, field);
    host.appendChild(root);
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
    tint.style.background = spec.tint;
    const doc = field.ownerDocument;
    for (let i = 0; i < spec.count; i++) {
      const p = spec.make(doc);
      p.classList.add("garden-flake");
      const size = 5 + Math.random() * 8;
      const duration = 6 + Math.random() * 8;
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      p.style.left = `${Math.random() * 100}%`;
      p.style.setProperty("--drift", `${Math.random() * 80 - 40}px`);
      p.style.setProperty("--spin", `${Math.random() * 720 - 360}deg`);
      p.style.animationDuration = `${duration}s`;
      p.style.animationDelay = `${-Math.random() * duration}s`;
      field.appendChild(p);
    }
  }

  destroy(): void {
    this.root?.remove();
    this.root = null;
    this.tintEl = null;
    this.field = null;
  }
}
