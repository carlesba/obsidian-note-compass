import { App, Notice, SuggestModal } from "obsidian";
import { createDateNote } from "./lists/openDateNote";
import type { JumpListEntry } from "./lists/vault";
import { RESULTS_CLASS, entryLabel, entryParts, matchesInOrder, renderRow } from "./render";

export class JumpModal extends SuggestModal<JumpListEntry> {
	private readonly entries: JumpListEntry[];
	private readonly showPrefixes: boolean;

	constructor(app: App, entries: JumpListEntry[], showPrefixes: boolean) {
		super(app);
		this.entries = entries;
		this.showPrefixes = showPrefixes;
		this.limit = entries.length;
		this.resultContainerEl.addClass(RESULTS_CLASS);
		this.setPlaceholder("Pick one…");
	}

	getSuggestions(query: string): JumpListEntry[] {
		if (!query) return this.entries;
		return this.entries.filter((entry) => matchesInOrder(query, entryLabel(entry, this.showPrefixes)));
	}

	renderSuggestion(entry: JumpListEntry, el: HTMLElement): void {
		renderRow(el, entryParts(entry, this.showPrefixes));
	}

	selectSuggestion(entry: JumpListEntry, evt: MouseEvent | KeyboardEvent): void {
		evt.preventDefault();
		evt.stopImmediatePropagation();
		super.selectSuggestion(entry, evt);
	}

	onChooseSuggestion(entry: JumpListEntry): void {
		if (entry.missing) {
			createDateNote(this.app, entry, entry.missing).catch(() => new Notice(`Could not create "${entry.name}".`));
			return;
		}
		const file = this.app.vault.getFileByPath(entry.file.path);
		if (file) void this.app.workspace.getLeaf(false).openFile(file);
	}

	onClose(): void {
		if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
	}
}
