import { App, Notice, Platform, SuggestModal, setIcon } from "obsidian";
import { t } from "./i18n";
import { createDateNote } from "./lists/openDateNote";
import type { JumpListEntry, VaultNote } from "./lists/vault";
import { RESULTS_CLASS, entryLabel, entryParts, matchesInOrder, renderRow } from "./render";

export const SET_PROPERTIES_ICON = "sliders-horizontal";

export class JumpModal extends SuggestModal<JumpListEntry> {
	private readonly entries: JumpListEntry[];
	private readonly showPrefixes: boolean;
	private readonly editProperties: (note: VaultNote, query: string) => void;
	private readonly rowEntries = new WeakMap<HTMLElement, JumpListEntry>();

	constructor(
		app: App,
		entries: JumpListEntry[],
		showPrefixes: boolean,
		editProperties: (note: VaultNote, query: string) => void,
	) {
		super(app);
		this.entries = entries;
		this.showPrefixes = showPrefixes;
		this.editProperties = editProperties;
		this.limit = entries.length;
		this.resultContainerEl.addClass(RESULTS_CLASS);
		this.setPlaceholder(t("pickOne"));
		this.scope.register(["Alt"], "Enter", (evt) => {
			if (evt.isComposing) return;
			evt.preventDefault();
			const selected = this.resultContainerEl.querySelector<HTMLElement>(".suggestion-item.is-selected");
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
		return this.entries.filter((entry) => matchesInOrder(query, entryLabel(entry, this.showPrefixes)));
	}

	renderSuggestion(entry: JumpListEntry, el: HTMLElement): void {
		renderRow(el, entryParts(entry, this.showPrefixes));
		this.rowEntries.set(el, entry);
		if (entry.missing) return;
		const bodyEl = el.querySelector<HTMLElement>(".note-compass-row-body") ?? el;
		const actionEl = bodyEl.createSpan({
			cls: ["clickable-icon", "note-compass-row-action"],
			attr: { role: "button", "aria-label": t("setProperties") },
		});
		setIcon(actionEl, SET_PROPERTIES_ICON);
		for (const type of ["pointerdown", "mousedown"]) {
			actionEl.addEventListener(type, (event) => {
				event.preventDefault();
				event.stopPropagation();
			});
		}
		actionEl.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			this.editPropertiesOf(entry);
		});
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
