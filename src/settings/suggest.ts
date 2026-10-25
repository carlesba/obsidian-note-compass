import { AbstractInputSuggest, setIcon } from "obsidian";
import type { App } from "obsidian";
import { tCount } from "../i18n";
import { typeLabel } from "../i18n/labels";
import { paintChip } from "../render";
import { matchingSuggestions } from "./listForm";
import type { PropertySuggestion } from "./listForm";
import type { PrefixSuggestion } from "./prefixLinks";

export interface TextSuggestion {
	value: string;
	label?: string;
	detail?: string;
}

export class PropertySuggest extends AbstractInputSuggest<PropertySuggestion> {
	private readonly suggestions: () => PropertySuggestion[];

	constructor(app: App, inputEl: HTMLInputElement, suggestions: () => PropertySuggestion[]) {
		super(app, inputEl);
		this.suggestions = suggestions;
	}

	protected getSuggestions(query: string): PropertySuggestion[] {
		return matchingSuggestions(this.suggestions(), query);
	}

	renderSuggestion(suggestion: PropertySuggestion, el: HTMLElement): void {
		el.createDiv({ text: suggestion.name });
		el.createDiv({ text: typeLabel(suggestion.type), cls: "setting-item-description" });
	}
}

export class TextSuggest extends AbstractInputSuggest<TextSuggestion> {
	private readonly suggestions: () => TextSuggestion[];

	constructor(app: App, inputEl: HTMLInputElement, suggestions: () => TextSuggestion[]) {
		super(app, inputEl);
		this.suggestions = suggestions;
	}

	protected getSuggestions(query: string): TextSuggestion[] {
		const typed = query.trim().toLowerCase();
		return this.suggestions().filter((suggestion) => (suggestion.label ?? suggestion.value).toLowerCase().includes(typed) || suggestion.value.toLowerCase().includes(typed));
	}

	renderSuggestion(suggestion: TextSuggestion, el: HTMLElement): void {
		el.createDiv({ text: suggestion.label ?? suggestion.value });
		if (suggestion.detail) el.createDiv({ text: suggestion.detail, cls: "setting-item-description" });
	}
}

export class PrefixSuggest extends AbstractInputSuggest<PrefixSuggestion> {
	private readonly suggestions: (query: string) => PrefixSuggestion[];

	constructor(app: App, inputEl: HTMLInputElement, suggestions: (query: string) => PrefixSuggestion[]) {
		super(app, inputEl);
		this.suggestions = suggestions;
	}

	protected getSuggestions(query: string): PrefixSuggestion[] {
		return this.suggestions(query);
	}

	renderSuggestion(suggestion: PrefixSuggestion, el: HTMLElement): void {
		el.addClass("note-compass-prefix-suggestion");
		const chipEl = el.createSpan({ cls: "note-compass-prefix-suggestion-chip" });
		chipEl.createSpan({ cls: "note-compass-chip-text", text: suggestion.prefix });
		paintChip(chipEl, suggestion.color);
		el.createSpan({
			cls: "note-compass-prefix-suggestion-count",
			text: tCount("prefixRowCountOne", "prefixRowCountOther", suggestion.count),
		});
	}
}

export function warningDescription(descEl: HTMLElement, warning: string): void {
	descEl.empty();
	descEl.addClass("note-compass-warning");
	setIcon(descEl.createSpan({ cls: "note-compass-warning-icon" }), "alert-triangle");
	descEl.createSpan({ text: warning });
}
