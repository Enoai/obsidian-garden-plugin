/**
 * Plugin entry point. Lifecycle and wiring only — no domain logic. It builds
 * the dependency graph for the view and registers the view, ribbon icon,
 * command, and settings tab. See docs/ARCHITECTURE.md for the big picture.
 */
import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS, GardenSettings, GardenSettingTab } from "./settings";
import { ObsidianVaultAdapter } from "./data/VaultAdapter";
import { ObsidianVaultMutator } from "./data/VaultMutator";
import { GardenModel } from "./model/GardenModel";
import { GardenLayout } from "./layout/GardenLayout";
import { SvgRenderer } from "./render/svg/SvgRenderer";
import { PLANT_HEIGHT, PLANT_WIDTH } from "./render/svg/plants";
import { BUILTIN_THEMES, DEFAULT_THEME, Theme, mergeTheme } from "./render/theme";
import { GARDEN_VIEW_TYPE, GardenView, GardenViewDeps } from "./view/GardenView";
import { ScoringConfig } from "./model/types";

export default class GardenPlugin extends Plugin {
  settings: GardenSettings = DEFAULT_SETTINGS;
  /** Built-in themes plus any user packs discovered in the plugin's themes/. */
  themes: Theme[] = BUILTIN_THEMES;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.themes = [...BUILTIN_THEMES, ...(await this.loadThemePacks())];

    this.registerView(
      GARDEN_VIEW_TYPE,
      (leaf) => new GardenView(leaf, this.buildDeps()),
    );

    this.addRibbonIcon("sprout", "Open garden", () => void this.activateView());
    this.addCommand({
      id: "open-garden",
      name: "Open garden",
      callback: () => void this.activateView(),
    });

    this.addSettingTab(new GardenSettingTab(this.app, this));
  }

  /** Assemble the view's dependencies. The seams live here. */
  private buildDeps(): GardenViewDeps {
    const getConfig = (): ScoringConfig => ({
      freshnessHalfLifeDays: this.settings.freshnessHalfLifeDays,
      connectivitySaturation: this.settings.connectivitySaturation,
    });
    const getPlacement = () => this.settings.placement;
    const setPlacement = async (p: typeof this.settings.placement): Promise<void> => {
      this.settings.placement = p;
      await this.saveSettings();
    };
    return {
      adapter: new ObsidianVaultAdapter(this.app),
      mutator: new ObsidianVaultMutator(this.app),
      model: new GardenModel(getConfig()),
      layout: new GardenLayout({ plantWidth: PLANT_WIDTH, plantHeight: PLANT_HEIGHT, getPlacement }),
      renderer: new SvgRenderer(() => this.activeTheme()),
      getConfig,
      archiveFolder: this.settings.archiveFolder,
      getSeason: () => this.settings.season,
      debounceMs: this.settings.debounceMs,
      getPlacement,
      setPlacement,
    };
  }

  private async activateView(): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(GARDEN_VIEW_TYPE);
    if (existing.length > 0) {
      workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = workspace.getLeaf(true);
    await leaf.setViewState({ type: GARDEN_VIEW_TYPE, active: true });
    workspace.revealLeaf(leaf);
  }

  /** The theme matching the current setting, falling back to the default. */
  private activeTheme(): Theme {
    return this.themes.find((t) => t.name === this.settings.theme) ?? DEFAULT_THEME;
  }

  /** Load user theme packs (*.json) from the plugin's themes/ folder. */
  private async loadThemePacks(): Promise<Theme[]> {
    const dir = `${this.manifest.dir ?? ""}/themes`;
    const adapter = this.app.vault.adapter;
    const out: Theme[] = [];
    try {
      if (!(await adapter.exists(dir))) return out;
      const listing = await adapter.list(dir);
      for (const file of listing.files) {
        if (!file.endsWith(".json")) continue;
        try {
          out.push(mergeTheme(DEFAULT_THEME, JSON.parse(await adapter.read(file))));
        } catch (e) {
          console.error(`Garden: could not load theme pack ${file}`, e);
        }
      }
    } catch {
      /* no themes folder — that's fine */
    }
    return out;
  }

  /** Re-render open garden views (e.g. after a theme/season setting change). */
  refreshViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(GARDEN_VIEW_TYPE)) {
      const view = leaf.view;
      if (view instanceof GardenView) view.applySettings();
    }
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
