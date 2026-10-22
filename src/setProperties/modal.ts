import { App, Notice, SuggestModal } from "obsidian";
import type { JumpListVault, NewNoteVault, VaultNote } from "../lists/vault";
import { renderRow } from "../render";
import type { RowParts } from "../render";
import type { EditableProperty, JumpSettings } from "../settings";
import { createNotes } from "./newNotes";
import { offeredEntries, propertyType } from "./offered";
import {
	initialPropertyState,
	pendingCreations,
	pickerChoices,
	pickerState,
	withValue,
	writeProperties,
} from "./picker";
import type { PickerChoice, PickerState } from "./picker";
import { isScalarType, valueChoices, valuePicker } from "./valuePicker";
import type { ValueChoice } from "./valuePicker";

interface ChoiceHandlers<Choice> {
	choose(choice: Choice, query: string): void;
	dismiss(): void;
}

class ChoiceModal<Choice extends { parts: RowParts }> extends SuggestModal<Choice> {
	private readonly suggestions: (query: string) => Choice[];
	private readonly handlers: ChoiceHandlers<Choice>;
	private chosen = false;

	constructor(app: App, placeholder: string, suggestions: (query: string) => Choice[], handlers: ChoiceHandlers<Choice>) {
		super(app);
		this.suggestions = suggestions;
		this.handlers = handlers;
		this.limit = Number.MAX_SAFE_INTEGER;
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

export function setProperties(
	app: App,
	vault: JumpListVault & NewNoteVault,
	settings: JumpSettings,
	target: VaultNote,
): void {
	const entries = offeredEntries(settings, vault, target);
	const initial = initialPropertyState(settings.setProperties, vault.frontmatter(target.path));
	const cancel = () => new Notice("Property changes cancelled.");
	const save = async (state: PickerState) => {
		try {
			await createNotes(vault, target.path, pendingCreations(state));
			await vault.updateFrontmatter(target.path, (frontmatter) => writeProperties(frontmatter, initial, state.values));
			new Notice("Properties saved.");
		} catch {
			new Notice("Could not save the properties.");
		}
	};
	const openMain = (state: PickerState, query: string): void => {
		new ChoiceModal<PickerChoice>(app, "Set properties…", (typed) => pickerChoices(entries, initial, state, typed), {
			choose: ({ action }, typed) => {
				if (action.action === "set") openMain(action.state, typed);
				else if (action.action === "expand") openMain(state, action.query);
				else if (action.action === "edit") openValue(state, action.entry, typed);
				else if (action.action === "save") void save(state);
				else cancel();
			},
			dismiss: cancel,
		}).openWithQuery(query);
	};
	const openValue = (state: PickerState, entry: EditableProperty, query: string): void => {
		const type = propertyType(settings.setProperties, entry);
		if (!isScalarType(type)) return openMain(state, query);
		const picker = valuePicker(vault, entry.property, type);
		new ChoiceModal<ValueChoice>(
			app,
			entry.property,
			(typed) => valueChoices(picker, state.values.get(entry.property), typed),
			{
				choose: (choice) => openMain(withValue(state, entry.property, choice.value), query),
				dismiss: () => openMain(state, query),
			},
		).openWithQuery("");
	};
	openMain(pickerState(initial), "");
}
