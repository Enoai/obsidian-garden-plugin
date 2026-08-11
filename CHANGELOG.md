# Changelog

All notable changes to this project are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [1.1.0] — 2026-08-11

### Added
- **Ignore files & folders** — a searchable setting (with vault autocomplete)
  to exclude specific folders or files from the garden; a folder hides
  everything nested inside it. (#10)
- **Ignore tag** — hide any note carrying a configurable tag (default
  `#garden-hide`, in frontmatter or inline); matching is case-insensitive. (#10)
- **Open garden on startup** — a setting to open the garden automatically when
  Obsidian starts. (#10)

## [1.0.2] — 2026-08-09

### Fixed
- Community directory review: ESLint compliance, minAppVersion 1.7.2, and DOM style API fixes.

## [1.0.1] — 2026-08-09

### Changed
- Renamed the plugin to **Vault Garden** for the community directory.

## [1.0.0] — 2026-08-09

Initial release.

### The living garden
- Vault visualised as a garden: each note is a plant whose health is derived
  from real metadata (freshness + connectivity) — no separate game state.
- Five procedural plant species (bush, flower, tree, fern, succulent).
- Notes clump by folder into nested soil beds; grassy world with a picket fence
  and folder signposts.
- Hover cards, ambient sway, seasonal weather, and a pan/zoom camera.

### Tend it
- Drag plants between beds to move folders; to the shed to archive; to the
  compost to trash (confirm); to the watering can to refresh.
- Watering-can tool mode (pick it up, click plants).
- Persisted manual placement: free-place plants, drag whole beds, reset button.

### Make it yours
- Built-in themes (Verdant, Dusk, Amber) and theme packs — palette (JSON) and
  sprite (bring-your-own art) tiers.

### Performance
- Ambient sway only animates plants on screen (and stops entirely above a cap),
  pauses when the garden isn't visible, and can be turned off in settings.
- Removed per-plant compositor layers and a fit() busy-loop.

[1.0.2]: https://github.com/Enoai/obsidian-garden-plugin/releases/tag/1.0.2
[1.0.1]: https://github.com/Enoai/obsidian-garden-plugin/releases/tag/1.0.1
[1.0.0]: https://github.com/Enoai/obsidian-garden-plugin/releases/tag/1.0.0
