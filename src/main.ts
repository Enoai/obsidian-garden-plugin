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
import { GARDEN_VIEW_TYPE, GardenView, GardenViewDeps } from "./view/GardenView";
import { ScoringConfig } from "./model/types";

export default class GardenPlugin extends Plugin {
  settings: GardenSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

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
      renderer: new SvgRenderer(),
      getConfig,
      archiveFolder: this.settings.archiveFolder,
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

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
