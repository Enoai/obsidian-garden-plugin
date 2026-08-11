/**
 * Plugin settings: the shape, the defaults, and the settings tab. The scoring
 * fields feed straight into `ScoringConfig` (see main.ts `buildDeps`).
 */
import { AbstractInputSuggest, App, PluginSettingTab, Setting, TAbstractFile } from "obsidian";
import { Placement, emptyPlacement } from "./model/types";
import { SeasonSetting } from "./render/weather";
import type GardenPlugin from "./main";

export interface GardenSettings {
  freshnessHalfLifeDays: number;
  connectivitySaturation: number;
  archiveFolder: string;
  season: SeasonSetting;
  theme: string;
  sway: boolean;
  debounceMs: number;
  /** Folder or file paths to leave out of the garden (folders exclude nested). */
  ignoredPaths: string[];
  /** Bare tag word; notes carrying #<tag> are hidden. Empty = disabled. */
  ignoreTag: string;
  /** Open the garden automatically when Obsidian starts. */
  openOnStartup: boolean;
  /** Manual arrangement (drag-to-place). Not shown in the settings UI. */
  placement: Placement;
}

export const DEFAULT_SETTINGS: GardenSettings = {
  freshnessHalfLifeDays: 30,
  connectivitySaturation: 8,
  archiveFolder: "Archive",
  season: "auto",
  theme: "Verdant",
  sway: true,
  debounceMs: 250,
  ignoredPaths: [],
  ignoreTag: "garden-hide",
  openOnStartup: false,
  placement: emptyPlacement(),
};

/** Autocomplete for a vault path — suggests folders and files as you type. */
class PathSuggest extends AbstractInputSuggest<TAbstractFile> {
  constructor(
    app: App,
    inputEl: HTMLInputElement,
    private onPick: (path: string) => void,
  ) {
    super(app, inputEl);
    this.onSelect((item) => this.onPick(item.path));
  }

  protected getSuggestions(query: string): TAbstractFile[] {
    const q = query.toLowerCase();
    return this.app.vault
      .getAllLoadedFiles()
      .filter((f) => f.path !== "/" && f.path !== "" && f.path.toLowerCase().includes(q))
      .slice(0, 50);
  }

  renderSuggestion(item: TAbstractFile, el: HTMLElement): void {
    el.setText(item.path);
  }
}

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
      .setName("Season")
      .setDesc("Seasonal tint and weather. Auto follows the current date.")
      .addDropdown((d) =>
        d
          .addOptions({
            auto: "Auto (by date)",
            spring: "Spring",
            summer: "Summer",
            autumn: "Autumn",
            winter: "Winter",
            off: "Off",
          })
          .setValue(this.plugin.settings.season)
          .onChange(async (v) => {
            this.plugin.settings.season = v as SeasonSetting;
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
          }),
      );

    const themeOptions: Record<string, string> = {};
    for (const t of this.plugin.themes) themeOptions[t.name] = t.name;
    new Setting(containerEl)
      .setName("Theme")
      .setDesc("Colour palette. Drop JSON theme packs in the plugin's themes/ folder.")
      .addDropdown((d) =>
        d
          .addOptions(themeOptions)
          .setValue(this.plugin.settings.theme)
          .onChange(async (v) => {
            this.plugin.settings.theme = v;
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
          }),
      );

    new Setting(containerEl)
      .setName("Plant sway")
      .setDesc("Gentle ambient motion. Turn off to reduce CPU usage on large vaults.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.sway).onChange(async (v) => {
          this.plugin.settings.sway = v;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        }),
      );

    new Setting(containerEl)
      .setName("Update debounce (ms)")
      .setDesc("How long to wait after an edit before the garden refreshes.")
      .addSlider((s) =>
        s
          .setLimits(50, 1000, 50)
          .setValue(this.plugin.settings.debounceMs)
          .onChange(async (v) => {
            this.plugin.settings.debounceMs = v;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Open garden on startup")
      .setDesc("Automatically open the garden when Obsidian starts.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.openOnStartup).onChange(async (v) => {
          this.plugin.settings.openOnStartup = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl).setName("Filtering").setHeading();

    // Ignored files & folders: a searchable input that appends to a list below.
    const ignoreList = containerEl.createDiv();
    const renderIgnoreList = (): void => {
      ignoreList.empty();
      for (const path of this.plugin.settings.ignoredPaths) {
        new Setting(ignoreList).setName(path).addExtraButton((b) =>
          b
            .setIcon("x")
            .setTooltip("Remove")
            .onClick(async () => {
              this.plugin.settings.ignoredPaths = this.plugin.settings.ignoredPaths.filter(
                (p) => p !== path,
              );
              await this.plugin.saveSettings();
              this.plugin.refreshViews();
              renderIgnoreList();
            }),
        );
      }
    };

    new Setting(containerEl)
      .setName("Ignored files & folders")
      .setDesc("Notes here won't appear in the garden. A folder hides everything inside it. Type to search your vault.")
      .addSearch((s) => {
        s.setPlaceholder("Add a folder or file…");
        new PathSuggest(this.app, s.inputEl, async (path) => {
          if (!this.plugin.settings.ignoredPaths.includes(path)) {
            this.plugin.settings.ignoredPaths.push(path);
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
            renderIgnoreList();
          }
          s.setValue("");
        });
      });
    renderIgnoreList();

    new Setting(containerEl)
      .setName("Ignore tag")
      .setDesc("Notes tagged with this — e.g. #garden-hide, in frontmatter or inline — are hidden. Leave blank to disable.")
      .addText((t) =>
        t
          .setPlaceholder("garden-hide")
          .setValue(this.plugin.settings.ignoreTag)
          .onChange(async (v) => {
            this.plugin.settings.ignoreTag = v.trim().replace(/^#/, "");
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
          }),
      );
  }
}
