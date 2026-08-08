# Obsidian "Garden" Plugin — Project Brief

## Concept

An Obsidian plugin that visualizes your vault as a garden. Each note is a
plant. How healthy or overgrown that plant looks reflects the note's real
metadata — how recently it's been touched and how well-connected it is to
the rest of the vault.

- **Flourishing / flowering** — recently edited, well-linked (has
  backlinks/outlinks).
- **Overgrown / weeds** — stale (untouched for a long time) and isolated
  (few or no links).
- Editing a note "waters" it and moves it back toward a healthy stage.
  Decay should be logarithmic, not punishing — a note untouched for a year
  shouldn't "die," just get weedy.

This turns an abstract "vault health" concept (usually only visible via
Graph View, which is not very legible) into something visceral: at a
glance you can see what's neglected and needs pruning or linking.

## Why this idea

- Small, well-scoped — realistic as a weekend/side project, not a startup.
- Genuinely useful signal, not just decoration: surfaces stale/orphaned
  notes better than the native graph view does.
- Obsidian has a mature plugin API, active plugin marketplace, and a
  community that likes whimsical-but-useful tools. Built-in distribution
  via the plugin browser — no need to solve growth/marketing separately.
- Fully local, no backend needed.

## Optional decoration/gamification layer (v2+)

- Manual layout: drag notes onto a garden canvas (could extend Obsidian's
  native Canvas feature rather than building a new one).
- Plant type per tag/folder (e.g. "project" notes = trees, "fleeting"
  notes = flowers).
- Cosmetic unlocks tied to real activity: streaks, seasons, weather
  effects.

## Technical approach

**Toolchain:** standard Obsidian plugin setup — TypeScript, bundled with
esbuild.

**Rendering:** register a custom `ItemView` (same mechanism the native
Graph View uses) that opens as a pane/tab, and render into it with:
- **SVG** — good default. Procedurally draw each plant (stem/leaves/flower
  as paths), animate stage transitions with CSS. Easy "hand-drawn garden"
  aesthetic, scales fine for typical vault sizes.
- **Canvas** — better if adding particle effects (wind, falling leaves,
  weather) or rendering very large vaults (thousands of notes), since it
  handles high element counts better than SVG DOM nodes.

**Data → visual pipeline:**
1. On load and on vault change events, read metadata via Obsidian's
   `MetadataCache` API — file created/modified timestamps and resolved
   links/backlinks per note (no need to hand-parse markdown).
2. Compute a health score per note from recency + connectivity.
3. Map score → plant stage (seed / sprout / flower / weed), output as a
   simple data array: `{id, x, y, stage, type}[]`.
4. Re-render (ideally patch only changed nodes) on vault change events so
   the garden updates live as you edit.

**Layout options:**
- Force-directed physics (like Graph View) for automatic placement.
- Fixed grid/plot the user manually arranges notes into — more control,
  more "Animal Crossing"-like, more upfront work for the user.

**Performance:** SVG or Canvas both fine for hundreds–low thousands of
notes on modern hardware. Only need viewport culling/pagination for very
large (10k+) vaults.

## Suggested MVP scope

1. Custom `ItemView` pane that lists all notes as simple colored dots/
   plant icons in a grid (no physics yet).
2. Health score = function of (days since last modified) and (backlink
   count) pulled from `MetadataCache`.
3. 3–4 discrete visual stages (weed → sprout → flower) driven by score
   thresholds.
4. Live update on vault modify events.
5. Ship as a bare-bones local plugin (not yet on the community plugin
   list) to validate the mechanic before investing in decoration features.

## Open questions to resolve in the build

- Exact scoring formula (weighting recency vs. connectivity).
- SVG vs. Canvas as the starting renderer.
- Auto-layout (force-directed) vs. manual garden-plot placement for v1.
- Whether to hook into Obsidian's native Canvas feature or build a fully
  custom view.
