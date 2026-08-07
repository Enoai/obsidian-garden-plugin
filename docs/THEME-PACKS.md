# Theme packs (Phase 3 — draft)

> ⚠️ **Not implemented yet.** This is the design sketch for the Phase 3 pack
> format so the [architecture](ARCHITECTURE.md) can be built with it in mind.
> The shape below may change before it ships.

Theme packs let anyone re-skin the garden with their own art — no code. A pack
is just a folder of assets plus a `manifest.json`. The plugin's sprite
`Renderer` reads the manifest and draws with your assets instead of the built-in
procedural plants. This is the same idea as Obsidian CSS themes and icon packs,
and it's meant to spread the same way.

## Where packs live

```
YourVault/.obsidian/plugins/obsidian-garden/packs/<pack-name>/
├── manifest.json
└── assets/…            # svg or png, referenced by manifest
```

Any folder here with a valid `manifest.json` appears in the pack picker in
settings.

## `manifest.json` (sketch)

```jsonc
{
  "name": "Cozy Cottage",
  "author": "you",
  "version": "1.0.0",
  "format": 1,                     // pack format version, for forward-compat

  // Plants by type → art per stage. Continuous health still tints/animates;
  // stage selects which asset. "default" is the fallback type.
  "plants": {
    "default": {
      "sprout":    "assets/sprout.svg",
      "growing":   "assets/plant.svg",
      "flowering": "assets/flower.svg",
      "wilting":   "assets/wilt.svg"
    },
    "tree": {
      "growing":   "assets/tree.svg",
      "flowering": "assets/tree-blossom.svg",
      "wilting":   "assets/tree-bare.svg"
    }
  },

  // The cohesive world.
  "world": {
    "ground":  "assets/ground.png",
    "shed":    "assets/shed.svg",
    "compost": "assets/compost.svg",
    "fence":   "assets/fence.svg"
  },

  // Optional cosmetic tuning.
  "ambient": {
    "sway": true,
    "particles": "leaves",         // "leaves" | "none" | …
    "seasonTint": true
  }
}
```

## Rules the loader enforces

- **Fail soft.** A missing or malformed manifest, or a missing asset, falls back
  to the procedural renderer and surfaces a clear error — it never breaks the
  view.
- **Sandboxed to the pack folder.** Asset paths are resolved relative to the
  pack; no escaping the folder, no remote URLs (local only).
- **Format-versioned.** `format` lets the plugin support old packs as the schema
  evolves.

## Design intent

- Packs are **data, not code** — safe to share, no build step.
- Every mapping is optional; anything omitted falls back to procedural. A pack
  can re-skin just the shed if that's all it wants to do.
- Health/logic never lives in a pack. Packs decide *appearance only*; the garden
  still never lies.
