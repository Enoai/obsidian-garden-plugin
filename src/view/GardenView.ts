/**
 * The garden pane. An Obsidian `ItemView` that owns the host element and drives
 * the one-directional loop: snapshot → model → layout → render. It knows how to
 * wire the pieces together and what a plant selection means (open the note) —
 * but no domain logic lives here.
 */
import { ItemView, WorkspaceLeaf } from "obsidian";
import { VaultAdapter } from "../data/VaultAdapter";
import { GardenModel } from "../model/GardenModel";
import { Layout } from "../layout/Layout";
import { Renderer } from "../render/Renderer";
import { ScoringConfig } from "../model/types";
import { debounce } from "../util/debounce";

export const GARDEN_VIEW_TYPE = "garden-view";

export interface GardenViewDeps {
  adapter: VaultAdapter;
  model: GardenModel;
  layout: Layout;
  renderer: Renderer;
  getConfig: () => ScoringConfig;
  debounceMs: number;
}

export class GardenView extends ItemView {
  private unsubscribe: (() => void) | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private deps: GardenViewDeps,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return GARDEN_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Garden";
  }

  getIcon(): string {
    return "sprout";
  }

  async onOpen(): Promise<void> {
    const host = this.contentEl;
    host.empty();
    host.addClass("garden-view");

    this.deps.renderer.mount(host);
    this.deps.renderer.on((e) => {
      if (e.type === "select") this.openNote(e.id);
    });

    this.unsubscribe = this.deps.adapter.onChange(
      debounce(() => this.refresh(), this.deps.debounceMs),
    );
    this.refresh();
  }

  async onClose(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.deps.renderer.destroy();
  }

  private refresh(): void {
    this.deps.model.setConfig(this.deps.getConfig());
    const snapshot = this.deps.adapter.snapshot();
    const state = this.deps.model.build(snapshot);
    const positioned = this.deps.layout.place(state);
    this.deps.renderer.render(positioned);
  }

  private openNote(id: string): void {
    void this.app.workspace.openLinkText(id, "", false);
  }
}
