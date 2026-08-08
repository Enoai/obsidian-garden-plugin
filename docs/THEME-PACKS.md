# Theme packs

Re-skin the garden with your own colours. A theme pack is a small JSON file of
colour overrides — no code, no build step. This is the **palette tier**; a later
sprite tier (bring-your-own plant art) will extend the same manifest.

## Using packs

- Built-in themes ship with the plugin: **Verdant** (default), **Dusk**, **Amber**.
  Pick one under *Settings → Garden → Theme*.
- Drop your own `*.json` packs into the plugin's `themes/` folder:
  `<vault>/.obsidian/plugins/vault-garden/themes/`. They appear in the Theme
  dropdown by their `name`. (Reload the plugin after adding files.)

## Pack format

Every field is optional — a pack is merged over the default, so you can override
just a few colours. Foliage tones are `[r, g, b]` arrays (they're interpolated in
code as a note ages); everything else is a CSS colour string.

```jsonc
{
  "name": "My Pack",

  "world": {
    "grass": "#9cbf6a",
    "tuft": "#7ba650",
    "soilRim": "#5f4326",
    "soilShades": ["#7c5230", "#8a5d38", "#986a41", "#a5764a"],     // nested-bed depth
    "soilTopShades": ["#875a37", "#946640", "#a1734a", "#ad7f54"],
    "wood": "#c08a4e",        // signpost plaque
    "woodDark": "#8a5f31",
    "woodText": "#3f2a12",
    "fence": "#caa06a",
    "fenceDark": "#8a5f31"
  },

  "plant": {
    "foliage": {
      "darkHealthy": [47, 95, 22],  "darkDead": [90, 61, 26],
      "midHealthy":  [78, 125, 26], "midDead":  [122, 86, 32],
      "lightHealthy":[140, 193, 82],"lightDead":[176, 147, 82]
    },
    "petal": "#e8749f",
    "petalCenter": "#f2b705",
    "petalFaded": "#b98a6a",
    "soil": "#5f4326",        // a plant's own soil mound
    "soilTop": "#6f5030",
    "trunk": "#6e4a28",
    "succDead": [168, 85, 48],
    "succTan":  [192, 119, 80]
  }
}
```

## Notes & guarantees

- **Fail soft.** A malformed pack is logged and skipped; the garden falls back
  to the default theme. Missing fields fall back per-field.
- **Colours only.** A pack decides appearance; it never touches vault data or
  health logic — the garden still never lies.
- **Live.** Switching themes re-skins the open garden immediately (no reload).
- Structures (shed, compost, watering can) use fixed art for now; they'll become
  themeable when the sprite tier lands.

## Sprite packs (bring your own art)

A pack can also supply **image art** for plants and structures. A sprite pack is
a **folder** (not a single JSON) inside `themes/`:

```
themes/
  Storybook/
    manifest.json
    tree.svg
    flower.svg
```

`manifest.json` is the same as a palette pack, plus a `sprites` section whose
paths are **relative to the pack folder**:

```jsonc
{
  "name": "Storybook",
  "world": { "grass": "#b6d98a" },        // palette overrides still apply
  "sprites": {
    "plants": {                            // species → image (any of:)
      "bush": "bush.svg", "flower": "flower.svg", "tree": "tree.svg",
      "fern": "fern.svg", "succulent": "succulent.png"
    },
    "structures": {                        // optional
      "shed": "shed.svg", "compost": "compost.svg", "watering": "can.svg"
    }
  }
}
```

- Images can be SVG or PNG. They're bottom-aligned on the plant's spot and
  scale with the note's connectivity; wilting notes are desaturated so health
  still reads through the art.
- **Partial packs are fine.** Any species without a sprite falls back to the
  procedural plant, so you can theme just the trees if you like. A bundled
  **Storybook** pack (tree + flower) ships as a working example.
- Young notes (seed/sprout) always use the procedural sprout.
- Sprite loading uses Obsidian's resource paths (desktop); palette-only packs
  work everywhere.
