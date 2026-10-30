import { App, Notice, Platform, SuggestModal } from "obsidian";
import { t } from "./i18n";
import { createDateNote } from "./lists/openDateNote";
import type { JumpListEntry, VaultNote } from "./lists/vault";
import { RESULTS_CLASS, entryLabel, entryParts, matchesInOrder, renderRow } from "./render";
import { renderRowAction, selectedRow } from "./rowAction";

export const SET_PROPERTIES_ICON = "sliders-horizontal";

export class JumpModal extends SuggestModal<JumpListEntry> {
	private readonly entries: JumpListEntry[];
	private readonly editProperties: (note: VaultNote, query: string) => void;
	private readonly rowEntries = new WeakMap<HTMLElement, JumpListEntry>();

	constructor(
		app: App,
		entries: JumpListEntry[],
		editProperties: (note: VaultNote, query: string) => void,
	) {
		super(app);
		this.entries = entries;
		this.editProperties = editProperties;
		this.limit = entries.length;
		this.resultContainerEl.addClass(RESULTS_CLASS);
		this.setPlaceholder(t("pickOne"));
		this.scope.register(["Alt"], "Enter", (evt) => {
			if (evt.isComposing) return;
			evt.preventDefault();
			const selected = selectedRow(this.resultContainerEl);
			const entry = selected ? this.rowEntries.get(selected) : undefined;
			if (entry && !entry.missing) this.editPropertiesOf(entry);
			return false;
		});
		if (!Platform.isMobile) {
			this.setInstructions([
				{ command: "↵", purpose: t("instructionOpen") },
				{ command: "⌥ ↵", purpose: t("instructionSetProperties") },
				{ command: "esc", purpose: t("instructionDismiss") },
			]);
		}
	}

	openWithQuery(query: string): void {
		this.open();
		if (!query) return;
		this.inputEl.value = query;
		this.inputEl.dispatchEvent(new Event("input"));
	}

	getSuggestions(query: string): JumpListEntry[] {
		if (!query) return this.entries;
		return this.entries.filter((entry) => matchesInOrder(query, entryLabel(entry)));
	}

	renderSuggestion(entry: JumpListEntry, el: HTMLElement): void {
		renderRow(el, entryParts(entry));
		this.rowEntries.set(el, entry);
		if (entry.missing) return;
		renderRowAction(el, SET_PROPERTIES_ICON, t("setProperties"), () => this.editPropertiesOf(entry));
	}

	selectSuggestion(entry: JumpListEntry, evt: MouseEvent | KeyboardEvent): void {
		evt.preventDefault();
		evt.stopImmediatePropagation();
		super.selectSuggestion(entry, evt);
	}

	onChooseSuggestion(entry: JumpListEntry): void {
		if (entry.missing) {
			createDateNote(this.app, entry, entry.missing).catch(() => new Notice(t("couldNotCreate", { name: entry.name })));
			return;
		}
		const file = this.app.vault.getFileByPath(entry.file.path);
		if (file) void this.app.workspace.getLeaf(false).openFile(file);
	}

	onClose(): void {
		if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
	}

	private editPropertiesOf(entry: JumpListEntry): void {
		const query = this.inputEl.value;
		this.close();
		this.editProperties(entry.file, query);
	}
}
