import { App, SuggestModal } from "obsidian";
import type { JumpListEntry } from "./lists/vault";
import { entryLabel, entryParts, matchesInOrder, renderRow } from "./render";

export class JumpModal extends SuggestModal<JumpListEntry> {
	private readonly entries: JumpListEntry[];
	private readonly showPrefixes: boolean;

	constructor(app: App, entries: JumpListEntry[], showPrefixes: boolean) {
		super(app);
		this.entries = entries;
		this.showPrefixes = showPrefixes;
		this.limit = entries.length;
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
		const file = this.app.vault.getFileByPath(entry.file.path);
		if (file) void this.app.workspace.getLeaf(false).openFile(file);
	}

	onClose(): void {
		if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
	}
}
