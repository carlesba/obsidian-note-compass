import { App, SuggestModal } from "obsidian";
import { MARK_COLUMN_CLASS, RESULTS_CLASS, renderRow } from "./render";
import type { RowParts } from "./render";

export interface ChoiceHandlers<Choice> {
	choose(choice: Choice, query: string): void;
	dismiss(): void;
}

export class ChoiceModal<Choice extends { parts: RowParts }> extends SuggestModal<Choice> {
	private readonly suggestions: (query: string) => Choice[];
	private readonly handlers: ChoiceHandlers<Choice>;
	private chosen = false;

	constructor(app: App, placeholder: string, suggestions: (query: string) => Choice[], handlers: ChoiceHandlers<Choice>) {
		super(app);
		this.suggestions = suggestions;
		this.handlers = handlers;
		this.limit = Number.MAX_SAFE_INTEGER;
		this.resultContainerEl.addClass(RESULTS_CLASS, MARK_COLUMN_CLASS);
		this.setPlaceholder(placeholder);
	}

	openWithQuery(query: string): void {
		this.open();
		if (!query) return;
		this.inputEl.value = query;
		this.inputEl.dispatchEvent(new Event("input"));
	}

	getSuggestions(query: string): Choice[] {
		return this.suggestions(query);
	}

	renderSuggestion(choice: Choice, el: HTMLElement): void {
		renderRow(el, choice.parts, true);
	}

	selectSuggestion(choice: Choice, evt: MouseEvent | KeyboardEvent): void {
		this.chosen = true;
		evt.preventDefault();
		evt.stopImmediatePropagation();
		super.selectSuggestion(choice, evt);
	}

	onChooseSuggestion(choice: Choice): void {
		this.handlers.choose(choice, this.inputEl.value);
	}

	onClose(): void {
		if (!this.chosen) this.handlers.dismiss();
	}
}
