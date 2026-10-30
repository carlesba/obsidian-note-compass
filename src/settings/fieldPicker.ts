import { SuggestModal, moment, setIcon } from "obsidian";
import type { App } from "obsidian";
import { presetFormat } from "../forms/presets";
import type { FieldPreset } from "../forms/presets";
import { t } from "../i18n";
import { fieldPickerGroupLabel, matchingFieldPickerEntries, startsGroup } from "./customFieldsForm";
import type { FieldPickerEntry } from "./customFieldsForm";

const PRESET_ICONS: Record<FieldPreset, string> = {
	blank: "plus",
	date: "calendar",
	time: "clock",
	timestamp: "calendar-clock",
	isoTimestamp: "globe",
	entryDate: "calendar",
	entryTime: "history",
};

const TEMPLATE_ICON = "bookmark";

const BLOCK_ICON = "git-branch";

export class FieldPickerModal extends SuggestModal<FieldPickerEntry> {
	private readonly entries: readonly FieldPickerEntry[];
	private readonly choose: (entry: FieldPickerEntry) => void;
	private shown: FieldPickerEntry[] = [];

	constructor(app: App, entries: readonly FieldPickerEntry[], choose: (entry: FieldPickerEntry) => void) {
		super(app);
		this.entries = entries;
		this.choose = choose;
		this.limit = Number.MAX_SAFE_INTEGER;
		this.setPlaceholder(t("fieldPickerPlaceholder"));
		this.emptyStateText = t("fieldPickerNoMatches");
		this.modalEl.addClass("note-compass-field-picker");
	}

	getSuggestions(query: string): FieldPickerEntry[] {
		this.shown = matchingFieldPickerEntries(this.entries, query);
		return this.shown;
	}

	renderSuggestion(entry: FieldPickerEntry, el: HTMLElement): void {
		el.addClass("mod-complex", "note-compass-field-picker-item");
		if (startsGroup(this.shown, entry)) el.createDiv({ cls: "note-compass-field-picker-group", text: fieldPickerGroupLabel(entry.group) });
		const rowEl = el.createDiv({ cls: "note-compass-field-picker-row" });
		const iconEl = rowEl.createDiv({ cls: "note-compass-field-picker-icon" });
		iconEl.toggleClass("mod-custom", entry.kind === "template");
		setIcon(iconEl, entryIcon(entry));
		const contentEl = rowEl.createDiv({ cls: "suggestion-content" });
		contentEl.createDiv({ cls: "suggestion-title", text: entry.label });
		const detail = entryDetail(entry);
		if (detail !== undefined) contentEl.createDiv({ cls: "suggestion-note", text: detail });
	}

	onChooseSuggestion(entry: FieldPickerEntry): void {
		this.choose(entry);
	}
}

function entryIcon(entry: FieldPickerEntry): string {
	if (entry.kind === "template") return TEMPLATE_ICON;
	if (entry.kind === "block") return BLOCK_ICON;
	return PRESET_ICONS[entry.preset];
}

function entryDetail(entry: FieldPickerEntry): string | undefined {
	if (entry.kind === "template") return entry.detail;
	if (entry.kind === "block") return undefined;
	const format = presetFormat(entry.preset);
	if (format === undefined) return undefined;
	const now = moment();
	return format === "iso" ? now.toISOString() : now.format(format);
}
