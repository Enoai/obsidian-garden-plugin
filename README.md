# 🌱 Obsidian Garden

> Your vault as a living garden. Every note is a plant whose health reflects
> how recently you've touched it and how well it's connected to the rest of
> your vault.

Graph View tells you *what links to what*. **Garden tells you what needs
tending.** A flourishing, flowering plant is a note you edit often and link
well. A big, browning tree is an important note you've neglected. A wilted
sprout with moss creeping in is a stale orphan you can prune.

Nothing here is a separate game state you have to maintain — the garden is
always a *true* reflection of your vault's real metadata. Edit a note and it
perks back up. Ignore one and it slowly, gently wilts (logarithmically — a
note untouched for a year gets weedy, it never "dies").

---

## Status

🚧 **Early / pre-release.** Being built in phases (see the
[roadmap](docs/ROADMAP.md)):

- **Phase 1 — Diagnostic garden** *(in progress)* — a beautiful, read-only
  view. Click a plant to open its note.
- **Phase 2 — Tended garden** — drag plants between beds (folders), into the
  shed (archive), or the compost (delete). Direct manipulation of your vault.
- **Phase 3 — Theme packs** — bring your own art. A pluggable renderer so the
  community can ship garden skins the way it ships CSS themes.

## How health is computed

Each note maps to **two independent axes** — see
[ARCHITECTURE › Scoring model](docs/ARCHITECTURE.md#scoring-model) for the math.

| Axis | Driven by | Shows up as |
| --- | --- | --- |
| **Freshness** | Days since last modified (logarithmic decay) | Vitality — lush green & upright vs. brown & drooping |
| **Connectivity** | Resolved links + backlinks (saturating) | Stature — orphan sprout → linked plant → hub tree |

The interesting states live on the diagonal:

- **Fresh + hub → flowering** — your alive, load-bearing notes (rare, earned).
- **Stale + hub → browning tree** — *important but neglected.* The single most
  useful signal the plugin surfaces, and the one Graph View can't.
- **Stale + orphan → wilted sprout** — low stakes; prune or ignore.

## Quick start (development)

```bash
npm install
npm run dev      # esbuild watch — rebuilds main.js on change
```

Then symlink or copy the repo into a test vault's plugins folder:

```bash
ln -s "$(pwd)" /path/to/YourVault/.obsidian/plugins/obsidian-garden
```

Enable **Garden** in *Settings → Community plugins*, then open the garden from
the ribbon icon or the command palette (`Garden: Open garden`).

See [CONTRIBUTING](docs/CONTRIBUTING.md) for the full dev loop, project layout,
and extension recipes.

## Documentation

- [**Roadmap**](docs/ROADMAP.md) — what's being built, in what order, and the
  acceptance criteria for each phase.
- [**Architecture**](docs/ARCHITECTURE.md) — the data model, the module seams,
  and the one-directional data flow. Start here if you're forking.
- [**Contributing**](docs/CONTRIBUTING.md) — dev setup, conventions, and
  step-by-step recipes for common extensions.
- [**Theme packs**](docs/THEME-PACKS.md) — the (Phase 3) pack format for
  bringing your own art.
- [**Concept brief**](obsidian-garden-plugin-README.md) — the original pitch.

## License

MIT — see [LICENSE](LICENSE).
