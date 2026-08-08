# Theme packs

Re-skin the garden with your own colours. A theme pack is a small JSON file of
colour overrides — no code, no build step. This is the **palette tier**; a later
sprite tier (bring-your-own plant art) will extend the same manifest.

## Using packs

- Built-in themes ship with the plugin: **Verdant** (default), **Dusk**, **Amber**.
  Pick one under *Settings → Garden → Theme*.
- Drop your own `*.json` packs into the plugin's `themes/` folder:
  `<vault>/.obsidian/plugins/obsidian-garden/themes/`. They appear in the Theme
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

## Planned: sprite tier

A future `sprites` section will let a pack supply images for plant species,
stages, and structures (with a manifest mapping), rendered by a sprite
implementation of the `Renderer` seam. The palette fields above will remain
valid, so today's packs keep working.
