/**
 * Plugin settings: the shape, the defaults, and the settings tab. The scoring
 * fields feed straight into `ScoringConfig` (see main.ts `buildDeps`).
 */
import { App, PluginSettingTab, Setting } from "obsidian";
import { Placement, emptyPlacement } from "./model/types";
import type GardenPlugin from "./main";

export interface GardenSettings {
  freshnessHalfLifeDays: number;
  connectivitySaturation: number;
  archiveFolder: string;
  debounceMs: number;
  /** Manual arrangement (drag-to-place). Not shown in the settings UI. */
  placement: Placement;
}

export const DEFAULT_SETTINGS: GardenSettings = {
  freshnessHalfLifeDays: 30,
  connectivitySaturation: 8,
  archiveFolder: "Archive",
  debounceMs: 250,
  placement: emptyPlacement(),
};

export class GardenSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: GardenPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Freshness half-life (days)")
      .setDesc("Days after which a note's freshness halves. Larger = slower decay.")
      .addSlider((s) =>
        s
          .setLimits(1, 180, 1)
          .setValue(this.plugin.settings.freshnessHalfLifeDays)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.freshnessHalfLifeDays = v;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Connectivity saturation")
      .setDesc("Link count at which a note counts as fully connected.")
      .addSlider((s) =>
        s
          .setLimits(1, 40, 1)
          .setValue(this.plugin.settings.connectivitySaturation)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.connectivitySaturation = v;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Archive folder")
      .setDesc("Folder the shed archives notes into (created if missing).")
      .addText((t) =>
        t
          .setValue(this.plugin.settings.archiveFolder)
          .setPlaceholder("Archive")
          .onChange(async (v) => {
            this.plugin.settings.archiveFolder = v.trim() || "Archive";
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Update debounce (ms)")
      .setDesc("How long to wait after an edit before the garden refreshes.")
      .addSlider((s) =>
        s
          .setLimits(50, 1000, 50)
          .setValue(this.plugin.settings.debounceMs)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.debounceMs = v;
            await this.plugin.saveSettings();
          }),
      );
  }
}
