/**
 * The garden pane. An Obsidian `ItemView` that owns the host element and drives
 * the one-directional loop: snapshot → model → layout → render. It also owns the
 * hover tooltip and decides what a plant interaction means (open the note) — but
 * no domain logic lives here.
 */
import { ItemView, WorkspaceLeaf } from "obsidian";
import { VaultAdapter } from "../data/VaultAdapter";
import { GardenModel } from "../model/GardenModel";
import { Layout } from "../layout/Layout";
import { Renderer } from "../render/Renderer";
import { NoteId, PlantState, ScoringConfig, Stage } from "../model/types";
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

/** Plain-English description of each stage — the "what's going on / what to do". */
const STAGE_TEXT: Record<Stage, string> = {
  flowering: "Flowering — fresh and well linked. Thriving.",
  growing: "Growing — in good health.",
  seed: "Seedling — brand new. Link it to help it grow.",
  sprout: "Sprout — young and lightly linked.",
  wilting: "Wilting — neglected. Open or link it to revive it.",
};

function relativeTime(modifiedMs: number, nowMs: number): string {
  const days = Math.floor((nowMs - modifiedMs) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

export class GardenView extends ItemView {
  private unsubscribe: (() => void) | null = null;
  private tooltipEl: HTMLDivElement | null = null;
  private hideTimer: number | null = null;
  private plantsById: Map<NoteId, PlantState> = new Map();

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
      else if (e.type === "hover") this.showTooltip(e.id, e.rect);
      else if (e.type === "unhover") this.scheduleHideTooltip();
    });

    // Tooltip lives above the canvas; keeping the pointer on it cancels the hide
    // so its link stays clickable.
    const tip = host.createDiv({ cls: "garden-tooltip" });
    tip.hidden = true;
    tip.addEventListener("mouseenter", () => this.cancelHide());
    tip.addEventListener("mouseleave", () => this.scheduleHideTooltip());
    this.tooltipEl = tip;

    this.unsubscribe = this.deps.adapter.onChange(
      debounce(() => this.refresh(), this.deps.debounceMs),
    );
    this.refresh();
  }

  async onClose(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.cancelHide();
    this.tooltipEl = null;
    this.deps.renderer.destroy();
  }

  private refresh(): void {
    this.deps.model.setConfig(this.deps.getConfig());
    const snapshot = this.deps.adapter.snapshot();
    const state = this.deps.model.build(snapshot);
    this.plantsById = state.plants;
    if (this.tooltipEl) this.tooltipEl.hidden = true;
    const positioned = this.deps.layout.place(state);
    this.deps.renderer.render(positioned);
  }

  private showTooltip(id: NoteId, rect: DOMRect): void {
    const plant = this.plantsById.get(id);
    const tip = this.tooltipEl;
    if (!plant || !tip) return;
    this.cancelHide();

    tip.empty();
    const link = tip.createEl("a", {
      cls: "garden-tooltip-title",
      text: plant.title,
      href: "#",
    });
    link.addEventListener("click", (ev) => {
      ev.preventDefault();
      this.openNote(id);
    });
    tip.createDiv({ cls: "garden-tooltip-desc", text: STAGE_TEXT[plant.stage] });
    const linkWord = plant.links === 1 ? "link" : "links";
    tip.createDiv({
      cls: "garden-tooltip-stats",
      text: `Edited ${relativeTime(plant.modifiedMs, Date.now())} · ${plant.links} ${linkWord}`,
    });

    // Anchor to the plant; flip below when it's near the top edge.
    const hostRect = this.contentEl.getBoundingClientRect();
    const centerX = rect.left - hostRect.left + rect.width / 2;
    const topRel = rect.top - hostRect.top;
    const below = topRel < 120;
    tip.toggleClass("garden-tooltip--below", below);
    tip.style.left = `${centerX}px`;
    tip.style.top = `${below ? rect.bottom - hostRect.top : topRel}px`;
    tip.hidden = false;
  }

  private scheduleHideTooltip(): void {
    this.cancelHide();
    this.hideTimer = window.setTimeout(() => {
      if (this.tooltipEl) this.tooltipEl.hidden = true;
      this.hideTimer = null;
    }, 150);
  }

  private cancelHide(): void {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  private openNote(id: string): void {
    void this.app.workspace.openLinkText(id, "", false);
  }
}
