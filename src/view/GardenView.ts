/**
 * The garden pane. An Obsidian `ItemView` that owns the host element and drives
 * the one-directional loop: snapshot → model → layout → render. It also owns the
 * hover tooltip and decides what a plant interaction means (open the note) — but
 * no domain logic lives here.
 */
import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import { VaultAdapter } from "../data/VaultAdapter";
import { VaultMutator } from "../data/VaultMutator";
import { GardenModel } from "../model/GardenModel";
import { Layout } from "../layout/Layout";
import { Renderer } from "../render/Renderer";
import { NoteId, Placement, PlantState, ScoringConfig, Stage } from "../model/types";
import { Season, SeasonSetting, Weather, currentSeason } from "../render/weather";
import { clamp } from "../util/math";
import { debounce } from "../util/debounce";

export const GARDEN_VIEW_TYPE = "garden-view";

export interface GardenViewDeps {
  adapter: VaultAdapter;
  mutator: VaultMutator;
  model: GardenModel;
  layout: Layout;
  renderer: Renderer;
  getConfig: () => ScoringConfig;
  archiveFolder: string;
  getSeason: () => SeasonSetting;
  debounceMs: number;
  /** Read/persist the manual arrangement (drag-to-place). */
  getPlacement: () => Placement;
  setPlacement: (p: Placement) => Promise<void>;
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
  private confirmEl: HTMLDivElement | null = null;
  private hideTimer: number | null = null;
  private plantsById: Map<NoteId, PlantState> = new Map();
  private weather = new Weather();
  private lastSeason: Season | "off" | null = null;

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
    this.weather.mount(host);
    this.deps.renderer.on((e) => {
      if (e.type === "select") this.openNote(e.id);
      else if (e.type === "hover") this.showTooltip(e.id, e.rect);
      else if (e.type === "unhover") this.scheduleHideTooltip();
      else if (e.type === "dropped") this.showMoveConfirm(e.id, e.toKey, e.clientX, e.clientY);
      else if (e.type === "droppedStructure") {
        // Watering is a gentle, reversible action — no confirm, just do it.
        if (e.kind === "watering") void this.performWater(e.id);
        else this.showStructureConfirm(e.id, e.kind, e.clientX, e.clientY);
      } else if (e.type === "water") void this.performWater(e.id);
      else if (e.type === "placePlant") void this.placePlant(e.id, e.x, e.y);
      else if (e.type === "moveBed") void this.moveBed(e.key, e.dx, e.dy);
      else if (e.type === "resetLayout") void this.resetLayout();
    });

    // Tooltip lives above the canvas; keeping the pointer on it cancels the hide
    // so its link stays clickable.
    const tip = host.createDiv({ cls: "garden-tooltip" });
    tip.hidden = true;
    tip.addEventListener("mouseenter", () => this.cancelHide());
    tip.addEventListener("mouseleave", () => this.scheduleHideTooltip());
    this.tooltipEl = tip;

    // Confirm popup for a drag-to-move.
    const confirm = host.createDiv({ cls: "garden-confirm" });
    confirm.hidden = true;
    this.confirmEl = confirm;

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
    this.confirmEl = null;
    this.weather.destroy();
    this.lastSeason = null;
    this.deps.renderer.destroy();
  }

  /** Re-render with the latest settings (theme, season, …). Public so the
   *  plugin can apply setting changes to an open view without reopening it. */
  applySettings(): void {
    this.refresh();
  }

  private refresh(): void {
    this.deps.model.setConfig(this.deps.getConfig());
    const snapshot = this.deps.adapter.snapshot();
    const state = this.deps.model.build(snapshot);
    this.plantsById = state.plants;
    if (this.tooltipEl) this.tooltipEl.hidden = true;
    const positioned = this.deps.layout.place(state);
    this.deps.renderer.render(positioned);

    const setting = this.deps.getSeason();
    const resolved: Season | "off" = setting === "auto" ? currentSeason() : setting;
    if (resolved !== this.lastSeason) {
      this.weather.setSeason(resolved);
      this.lastSeason = resolved;
    }
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

  private showMoveConfirm(id: NoteId, toKey: string, clientX: number, clientY: number): void {
    const title = this.plantsById.get(id)?.title ?? id;
    const folder = toKey === "(root)" ? "root" : toKey;
    this.showConfirmPopup(
      `Move “${title}” to ${folder}?`,
      "Move",
      false,
      () => this.performMove(id, toKey),
      clientX,
      clientY,
    );
  }

  private showStructureConfirm(
    id: NoteId,
    kind: "shed" | "compost",
    clientX: number,
    clientY: number,
  ): void {
    const title = this.plantsById.get(id)?.title ?? id;
    if (kind === "shed") {
      this.showConfirmPopup(
        `Archive “${title}”?`,
        "Archive",
        false,
        () => this.performArchive(id),
        clientX,
        clientY,
      );
    } else {
      this.showConfirmPopup(
        `Send “${title}” to trash?`,
        "Delete",
        true,
        () => this.performTrash(id),
        clientX,
        clientY,
      );
    }
  }

  private showConfirmPopup(
    message: string,
    actionLabel: string,
    danger: boolean,
    action: () => Promise<void>,
    clientX: number,
    clientY: number,
  ): void {
    const c = this.confirmEl;
    if (!c) return;
    this.cancelHide();
    if (this.tooltipEl) this.tooltipEl.hidden = true;

    c.empty();
    c.createDiv({ cls: "garden-confirm-msg", text: message });
    const row = c.createDiv({ cls: "garden-confirm-row" });
    const actBtn = row.createEl("button", { cls: danger ? "mod-warning" : "mod-cta", text: actionLabel });
    const cancelBtn = row.createEl("button", { text: "Cancel" });
    actBtn.addEventListener("click", () => {
      c.hidden = true;
      void action();
    });
    cancelBtn.addEventListener("click", () => {
      c.hidden = true;
      this.refresh(); // snap the plant back
    });

    const hostRect = this.contentEl.getBoundingClientRect();
    c.style.left = `${clamp(clientX - hostRect.left, 8, hostRect.width - 8)}px`;
    c.style.top = `${clamp(clientY - hostRect.top, 8, hostRect.height - 8)}px`;
    c.hidden = false;
  }

  private async performMove(id: NoteId, toKey: string): Promise<void> {
    this.clearPlantPlacement(id); // let it auto-place in its new bed
    await this.deps.mutator.move(id, toKey);
    this.refresh();
  }

  private async performArchive(id: NoteId): Promise<void> {
    this.clearPlantPlacement(id);
    await this.deps.mutator.archive(id, this.deps.archiveFolder);
    this.refresh();
  }

  private async performTrash(id: NoteId): Promise<void> {
    this.clearPlantPlacement(id);
    await this.deps.mutator.trash(id);
    this.refresh();
  }

  private async performWater(id: NoteId): Promise<void> {
    const title = this.plantsById.get(id)?.title ?? id;
    await this.deps.mutator.water(id);
    new Notice(`Watered “${title}”`);
    this.refresh();
  }

  private async placePlant(id: NoteId, x: number, y: number): Promise<void> {
    const p = this.deps.getPlacement();
    p.plants[id] = { x: Math.max(8, x), y: Math.max(8, y) };
    await this.deps.setPlacement(p);
    this.refresh();
  }

  private async moveBed(key: string, dx: number, dy: number): Promise<void> {
    const p = this.deps.getPlacement();
    const cur = p.beds[key] ?? { x: 0, y: 0 };
    p.beds[key] = { x: cur.x + dx, y: cur.y + dy };
    await this.deps.setPlacement(p);
    this.refresh();
  }

  private async resetLayout(): Promise<void> {
    await this.deps.setPlacement({ plants: {}, beds: {} });
    this.refresh();
  }

  /** Drop a plant's manual position (e.g. when it moves folder, so it
   *  auto-places in its new bed). */
  private clearPlantPlacement(id: NoteId): void {
    const p = this.deps.getPlacement();
    if (p.plants[id]) {
      delete p.plants[id];
      void this.deps.setPlacement(p);
    }
  }

  private openNote(id: string): void {
    void this.app.workspace.openLinkText(id, "", false);
  }
}
