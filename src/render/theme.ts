/**
 * Theme = the garden's palette. Every colour the renderer draws comes from a
 * Theme, so a "theme pack" is just a set of colour overrides (a JSON file).
 * Built-in themes live here; user packs are JSON merged over the default.
 *
 * This is the palette tier of theme packs. The manifest is intentionally shaped
 * so a later `sprites` section can be added without breaking existing packs.
 */
export type RGB = readonly [number, number, number];

export type StructureKind = "shed" | "compost" | "watering";

/** Optional sprite art (resolved resource URLs) supplied by a folder pack. */
export interface ThemeSprites {
  /** Species name → image URL (missing species fall back to procedural). */
  plants?: Record<string, string>;
  structures?: Partial<Record<StructureKind, string>>;
}

export interface Theme {
  name: string;
  sprites?: ThemeSprites;
  world: {
    grass: string;
    tuft: string;
    soilRim: string;
    soilShades: string[];
    soilTopShades: string[];
    wood: string;
    woodDark: string;
    woodText: string;
    fence: string;
    fenceDark: string;
  };
  plant: {
    foliage: {
      darkHealthy: RGB;
      darkDead: RGB;
      midHealthy: RGB;
      midDead: RGB;
      lightHealthy: RGB;
      lightDead: RGB;
    };
    petal: string;
    petalCenter: string;
    petalFaded: string;
    soil: string;
    soilTop: string;
    trunk: string;
    succDead: RGB;
    succTan: RGB;
  };
}

export const DEFAULT_THEME: Theme = {
  name: "Verdant",
  world: {
    grass: "#9cbf6a",
    tuft: "#7ba650",
    soilRim: "#5f4326",
    soilShades: ["#7c5230", "#8a5d38", "#986a41", "#a5764a"],
    soilTopShades: ["#875a37", "#946640", "#a1734a", "#ad7f54"],
    wood: "#c08a4e",
    woodDark: "#8a5f31",
    woodText: "#3f2a12",
    fence: "#caa06a",
    fenceDark: "#8a5f31",
  },
  plant: {
    foliage: {
      darkHealthy: [0x2f, 0x5f, 0x16],
      darkDead: [0x5a, 0x3d, 0x1a],
      midHealthy: [0x4e, 0x7d, 0x1a],
      midDead: [0x7a, 0x56, 0x20],
      lightHealthy: [0x8c, 0xc1, 0x52],
      lightDead: [0xb0, 0x93, 0x52],
    },
    petal: "#e8749f",
    petalCenter: "#f2b705",
    petalFaded: "#b98a6a",
    soil: "#5f4326",
    soilTop: "#6f5030",
    trunk: "#6e4a28",
    succDead: [0xa8, 0x55, 0x30],
    succTan: [0xc0, 0x77, 0x50],
  },
};

const DUSK: Theme = {
  name: "Dusk",
  world: {
    grass: "#6e8f7a",
    tuft: "#557a66",
    soilRim: "#3f3a4a",
    soilShades: ["#4a4658", "#565265", "#625d72", "#6e6980"],
    soilTopShades: ["#565265", "#625d72", "#6e6980", "#7a758c"],
    wood: "#8a7fa0",
    woodDark: "#5f5673",
    woodText: "#241f33",
    fence: "#9a8fb0",
    fenceDark: "#5f5673",
  },
  plant: {
    foliage: {
      darkHealthy: [0x28, 0x4a, 0x3e],
      darkDead: [0x40, 0x38, 0x50],
      midHealthy: [0x3e, 0x6e, 0x5a],
      midDead: [0x5a, 0x52, 0x6e],
      lightHealthy: [0x74, 0xa8, 0x8e],
      lightDead: [0x8a, 0x82, 0x9e],
    },
    petal: "#b98fd6",
    petalCenter: "#e0c46a",
    petalFaded: "#8a7fa0",
    soil: "#3f3a4a",
    soilTop: "#4a4658",
    trunk: "#4a4252",
    succDead: [0x6a, 0x55, 0x70],
    succTan: [0x8a, 0x82, 0x9e],
  },
};

const AMBER: Theme = {
  name: "Amber",
  world: {
    grass: "#a9b56a",
    tuft: "#8a9a4a",
    soilRim: "#5a3418",
    soilShades: ["#7a4a24", "#8a5628", "#9a6430", "#a8703a"],
    soilTopShades: ["#8a5628", "#9a6430", "#a8703a", "#b67c44"],
    wood: "#c8862e",
    woodDark: "#8a5522",
    woodText: "#3a220a",
    fence: "#d8a24a",
    fenceDark: "#8a5522",
  },
  plant: {
    foliage: {
      darkHealthy: [0x4a, 0x5f, 0x18],
      darkDead: [0x6a, 0x33, 0x12],
      midHealthy: [0x7a, 0x7d, 0x1a],
      midDead: [0x9a, 0x50, 0x18],
      lightHealthy: [0xbf, 0xb0, 0x40],
      lightDead: [0xd0, 0x77, 0x30],
    },
    petal: "#f0873a",
    petalCenter: "#f2c705",
    petalFaded: "#b9724a",
    soil: "#5a3418",
    soilTop: "#6a4322",
    trunk: "#5e3a1e",
    succDead: [0xc0, 0x55, 0x28],
    succTan: [0xd8, 0x80, 0x40],
  },
};

/** Themes shipped with the plugin. */
export const BUILTIN_THEMES: Theme[] = [DEFAULT_THEME, DUSK, AMBER];

/** Merge a (possibly partial) pack over a base theme. Tolerant of missing
 *  fields so a pack can override just a few colours. */
export function mergeTheme(base: Theme, pack: unknown): Theme {
  const p = (pack ?? {}) as Partial<Theme> & {
    world?: Partial<Theme["world"]>;
    plant?: Partial<Theme["plant"]> & { foliage?: Partial<Theme["plant"]["foliage"]> };
  };
  return {
    name: typeof p.name === "string" ? p.name : base.name,
    world: { ...base.world, ...(p.world ?? {}) },
    plant: {
      ...base.plant,
      ...(p.plant ?? {}),
      foliage: { ...base.plant.foliage, ...(p.plant?.foliage ?? {}) },
    },
  };
}
