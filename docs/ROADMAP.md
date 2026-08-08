# Roadmap

The plugin is built in three phases. Each phase is independently shippable and
useful on its own. Crucially, the [architecture](ARCHITECTURE.md) is designed so
that **later phases are additive, not rewrites** — Phase 2 and 3 slot into seams
that Phase 1 already establishes.

> "Diagnostic first" does **not** mean "ugly first." Phase 1 is read-only in
> *behaviour*, but it still ships the organic plants, ambient motion, and
> cohesive world. A garden that already feels good is what justifies building
> the interactions on top of it.

---

## Phase 1 — The diagnostic garden

> **Status: complete.** Painterly plants, folder beds, grass/tufts/signposts/
> fence, hover cards, ambient sway, and a pan/zoom camera are all in.

**Goal:** a beautiful, read-only view that makes vault health visceral at a
glance. Prove the core mechanic before investing in interaction.

### Scope

- Custom `ItemView` pane, opened from the ribbon and command palette.
- Read vault metadata via a single `VaultAdapter` (created/modified timestamps,
  resolved links + backlinks).
- Compute the two-axis health score (see
  [ARCHITECTURE › Scoring model](ARCHITECTURE.md#scoring-model)).
- Procedural SVG plants: organic shapes, 2–3 green tones, gentle sway and
  drifting-leaf ambience. A cohesive ground/border world (structures may appear
  as *décor* here, before they're functional).
- Grid layout (deterministic, no physics).
- Click a plant → open its note. (The only interaction — and a safe one.)
- Live, debounced updates on vault/metadata change events.
- Settings tab: scoring constants (half-life, link saturation, axis weights).

### Acceptance criteria

- [ ] Opens on a real vault of a few hundred notes without jank.
- [ ] A note edited moments ago renders visibly healthier than a stale one.
- [ ] A well-linked note renders visibly larger than an orphan.
- [ ] Editing a note updates its plant within ~1s (debounced), no full reload.
- [ ] Clicking a plant opens the correct note.
- [ ] Scoring constants are tunable from settings and persist.

### Explicitly out of scope for Phase 1

Dragging, persistent placement, folder/archive/delete operations, sprite/theme
packs, seasons/weather. All deferred — but their seams exist (see below).

---

## Phase 2 — The tended garden

> **Status: in progress.** Drag-a-plant-to-another-bed moves the note to that
> folder (subfolder-aware), with a confirm popup, via `VaultMutator`. Beds are
> keyed by full folder path. Still to come: shed (archive), compost (delete),
> watering can, greenhouse, and persisted manual placement.

**Goal:** the garden becomes a place you *tend*. Gardening actions map to real
vault operations.

### Scope

- **Persistent placement.** Plant positions are saved in plugin data; the
  garden is a stable place you arrange. (This replaces auto-layout as the
  default — see the architecture note on why interactivity requires it.)
- **Structures become functional:**
  - **Beds = folders.** Drag a plant between beds → move the note between
    folders.
  - **Shed = archive.** Drag into the shed → move the note to the archive
    folder (configurable). Reversible.
  - **Compost = delete.** Drag into the compost → **two-step confirm** →
    move to Obsidian trash (never a hard delete).
  - **Watering can** → "touch" a note (bump its freshness) without opening it.
  - **Greenhouse** → drafts / pinned / work-in-progress.
- **"Where to?" popup** on drop, so a drag is never destructive by accident.
- New notes sprout into a default bed (or auto-placed by folder).

### Acceptance criteria

- [ ] Plant positions survive a reload and an Obsidian restart.
- [ ] Dragging a plant between beds moves the underlying file; the change is
      reflected in the file explorer.
- [ ] Archiving is reversible and lands the note in the configured folder.
- [ ] Deleting requires an explicit confirm and routes to trash, not `unlink`.
- [ ] All destructive actions are guarded — no accidental drops mutate the vault.

---

## Phase 3 — Theme packs & cosmetics

**Goal:** let the community bring its own art. Turn the "you need an artist"
weakness of authored assets into a distribution strength, the way Obsidian CSS
themes and icon packs already spread.

### Scope

- **Sprite renderer** implementing the same `Renderer` interface as the
  procedural one.
- **Theme-pack format** — a folder with sprites + a `manifest.json` mapping
  stages / plant types / world objects to assets. See
  [THEME-PACKS.md](THEME-PACKS.md).
- Pack picker in settings; hot-swap without reload.
- Cosmetic layer: seasons, weather, day/night tint — all derived, all optional.

### Acceptance criteria

- [ ] A pack folder dropped into the vault appears in the pack picker.
- [ ] Switching packs re-skins the garden with no logic changes.
- [ ] A malformed pack fails gracefully (falls back to procedural, surfaces a
      clear error) rather than breaking the view.

---

## Guiding constraints (all phases)

- **The garden never lies.** Visuals are always derived from real vault
  metadata. No divergent game state, no manual bookkeeping.
- **Local only.** No backend, no network, no telemetry.
- **Safe by default.** The plugin never performs destructive or irreversible
  vault operations without explicit user confirmation.
- **Forkable.** Clean seams, pure domain logic, documented extension points.
