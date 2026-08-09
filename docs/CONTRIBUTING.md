# Contributing

Thanks for looking under the hood. This project is built to be forked and
extended — the [architecture](ARCHITECTURE.md) draws clean seams so most
changes are localised. This doc covers the dev loop, the conventions, and
step-by-step recipes for the most common extensions.

## Dev setup

Prerequisites: Node 18+ and a test vault you don't mind experimenting in.

```bash
npm install
npm run dev      # esbuild watch — rebuilds main.js on save
```

Load it into a test vault:

```bash
ln -s "$(pwd)" /path/to/YourVault/.obsidian/plugins/vault-garden
```

Enable **Vault Garden** under *Settings → Community plugins*. After a rebuild, reload
the plugin (toggle it off/on, or use the Hot-Reload community plugin) to see
changes.

Other scripts:

```bash
npm run build      # type-check + production bundle
npm run lint       # Obsidian community ESLint rules
npm test           # run the unit tests (model + layout)
npm run typecheck  # type-check only
```

## Project layout

See [ARCHITECTURE › Module map](ARCHITECTURE.md#module-map) for the full tree
and the dependency rule. The short version:

- `model/` — pure domain logic. **Never import `obsidian` here.**
- `data/` — the only place that touches Obsidian's data APIs.
- `render/`, `layout/` — implementations behind the `Renderer` / `Layout`
  interfaces; depend only on `model/`.
- `view/`, `main.ts` — wiring and lifecycle.

## Conventions

- **TypeScript strict.** No `any` without a comment justifying it.
- **Pure where possible.** If a function can be a pure function of its inputs,
  make it one and put it in `model/` or `util/`.
- **Respect the dependency rule.** Inward toward `model/`. If you need Obsidian
  data somewhere new, route it through `VaultAdapter`, don't import `obsidian`
  directly.
- **Small files, one responsibility.** Match the naming and comment density of
  the surrounding code.
- **Safety first.** Any vault mutation (move/rename/delete) must be explicit,
  reversible where possible, and never triggered without user confirmation.
  Deletes route to Obsidian trash, never `unlink`.
- **Comments explain *why*, not *what*.** The types say what; comments earn
  their place by explaining a decision.

## Extension recipes

The seams exist so these are small, local changes. Each recipe touches one area.

### Tune the scoring

All in `src/model/health.ts` — pure functions. Adjust the curves or add a new
signal, then update the tests in `health.test.ts` to lock in the behaviour.
Exposed constants (`τ`, `k`, axis weights) live in settings; wire new ones
through `settings.ts` and `ScoringConfig`.

### Add a plant type

Plant type is derived from a note's tags/folders. Add a rule to the
type-resolution step in `GardenModel`, then teach the renderer how to draw it:
add a case in `render/svg/plants.ts` (procedural) — a function `state →
SVGElement`. Because drawing is keyed on `PlantType`, no other layer changes.

### Add a renderer (e.g. Canvas)

Implement the `Renderer` interface (`mount`, `render`, `on`, `destroy`) in a new
`render/<name>/` folder and register it where renderers are selected. Nothing in
`model/`, `layout/`, or `view/` needs to change — that's the point of the seam.
See [ARCHITECTURE › The seams](ARCHITECTURE.md#the-seams).

### Add a layout (e.g. persisted / manual placement)

Implement `Layout.place(state) → PositionedGarden`. A persisted layout reads
saved positions from plugin data and falls back to the grid for notes it hasn't
seen. This is the Phase 2 path; the interface is already in place.

### Ship a theme pack (Phase 3)

Theme packs need no code — they're data. See [THEME-PACKS.md](THEME-PACKS.md)
for the `manifest.json` format and asset layout.

## Testing

The valuable logic is pure and tested without Obsidian:

- Put model/layout tests next to the code (`*.test.ts`).
- Test the *curves*, not just points: freshness should decay monotonically and
  never hit 0; connectivity should saturate at `k`.
- Build `VaultSnapshot` fixtures by hand — no Obsidian needed.
- The Obsidian-coupled `VaultAdapter` is intentionally thin; verify it manually
  in a test vault rather than mocking Obsidian.

```bash
npm test
```

## Commits & PRs

- Small, focused commits with a clear message ("why" in the body if not obvious).
- Keep changes within one seam where you can — it makes review easy and keeps
  the layers honest.
- Run `npm run lint`, `npm run build`, and `npm test` before opening a PR.
- Describe the user-visible effect and the phase it belongs to.

## Releasing

Releases are automated by [`.github/workflows/release.yml`](../.github/workflows/release.yml).

1. Bump the version in **three** places to the same value: `manifest.json`,
   `package.json`, and add an entry to `versions.json` mapping the new version to
   the minimum Obsidian version.
2. Update `CHANGELOG.md`.
3. Commit, then tag and push:
   ```bash
   git tag 1.0.0
   git push --tags
   ```
4. CI runs tests, builds, and publishes a GitHub release with `main.js`,
   `manifest.json`, and `styles.css` attached — the three files a user (or the
   community plugin browser) needs.

To build a release locally instead: `npm run build`, then attach those three
files to a release yourself. `main.js` is git-ignored on purpose — it's a build
artifact, produced fresh for each release.

## A note on scope

This is a weekend-scale, single-purpose plugin, deliberately. Before adding a
feature, check it against the [roadmap](ROADMAP.md) and the guiding constraints
(the garden never lies; local only; safe by default; forkable). Whimsical is
welcome; divergent game state and required bookkeeping are not.
