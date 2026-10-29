import { AbstractInputSuggest, setIcon } from "obsidian";
import type { App, TFile } from "obsidian";
import { typeLabel } from "../i18n/labels";
import { matchingSuggestions } from "./listForm";
import type { PropertySuggestion } from "./listForm";
import { LINK_SUGGESTION_LIMIT, insertLink, matchingLinkCandidates, openLinkAt } from "./wikiLinks";

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

export class LinkSuggest extends AbstractInputSuggest<TFile> {
	private readonly inputEl: HTMLInputElement;
	private readonly picked: () => void;
	isOpen = false;

	constructor(app: App, inputEl: HTMLInputElement, picked: () => void = () => undefined) {
		super(app, inputEl);
		this.inputEl = inputEl;
		this.picked = picked;
		this.limit = LINK_SUGGESTION_LIMIT;
	}

	open(): void {
		super.open();
		this.isOpen = true;
	}

	close(): void {
		super.close();
		this.isOpen = false;
	}

	protected getSuggestions(): TFile[] {
		const link = openLinkAt(this.inputEl.value, this.caret());
		if (!link) return [];
		return matchingLinkCandidates(this.app.vault.getMarkdownFiles(), link.query);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.createDiv({ text: file.basename });
		const folder = file.parent?.path ?? "/";
		if (folder !== "/") el.createDiv({ text: folder, cls: "setting-item-description" });
	}

	selectSuggestion(file: TFile): void {
		const caret = this.caret();
		const link = openLinkAt(this.inputEl.value, caret);
		if (link) {
			const linktext = this.app.metadataCache.fileToLinktext(file, "", true);
			const inserted = insertLink(this.inputEl.value, caret, link, linktext);
			this.inputEl.value = inserted.text;
			this.inputEl.setSelectionRange(inserted.caret, inserted.caret);
			this.inputEl.dispatchEvent(new Event("input", { bubbles: true }));
		}
		this.close();
		this.picked();
	}

	private caret(): number {
		return this.inputEl.selectionStart ?? this.inputEl.value.length;
	}
}

export class NoteSuggest extends AbstractInputSuggest<TFile> {
	private readonly inputEl: HTMLInputElement;
	private readonly valueOf: (file: TFile) => string;

	constructor(app: App, inputEl: HTMLInputElement, valueOf: (file: TFile) => string = (file) => app.metadataCache.fileToLinktext(file, "", true)) {
		super(app, inputEl);
		this.inputEl = inputEl;
		this.valueOf = valueOf;
		this.limit = LINK_SUGGESTION_LIMIT;
	}

	protected getSuggestions(query: string): TFile[] {
		return matchingLinkCandidates(this.app.vault.getMarkdownFiles(), query.replace(/[[\]]/g, ""));
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.createDiv({ text: file.basename });
		const folder = file.parent?.path ?? "/";
		if (folder !== "/") el.createDiv({ text: folder, cls: "setting-item-description" });
	}

	selectSuggestion(file: TFile): void {
		this.inputEl.value = this.valueOf(file);
		this.inputEl.dispatchEvent(new Event("input", { bubbles: true }));
		this.close();
	}
}

export function warningDescription(descEl: HTMLElement, warning: string): void {
	descEl.empty();
	descEl.addClass("note-compass-warning");
	setIcon(descEl.createSpan({ cls: "note-compass-warning-icon" }), "alert-triangle");
	descEl.createSpan({ text: warning });
}
