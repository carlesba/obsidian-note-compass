import { AbstractInputSuggest, setIcon } from "obsidian";
import type { App } from "obsidian";
import { matchingSuggestions } from "./listForm";
import type { PropertySuggestion } from "./listForm";

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
		el.createDiv({ text: suggestion.type, cls: "setting-item-description" });
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

export function warningDescription(descEl: HTMLElement, warning: string): void {
	descEl.empty();
	descEl.addClass("note-compass-warning");
	setIcon(descEl.createSpan({ cls: "note-compass-warning-icon" }), "alert-triangle");
	descEl.createSpan({ text: warning });
}
