import { App, Notice, SuggestModal } from "obsidian";
import type { JumpListVault, VaultNote } from "../lists/vault";
import { matchesInOrder } from "../render";
import type { JumpSettings } from "../settings";
import { initialPropertyState, pickerChoices, propertyRows, toggleRow, writeProperties } from "./picker";
import type { LabelledChoice, PickerChoice, PropertyState } from "./picker";

interface PickerHandlers {
	choose(choice: PickerChoice): void;
	dismiss(): void;
}

class SetPropertiesModal extends SuggestModal<LabelledChoice> {
	private readonly choices: LabelledChoice[];
	private readonly handlers: PickerHandlers;
	private chosen = false;

	constructor(app: App, choices: LabelledChoice[], handlers: PickerHandlers) {
		super(app);
		this.choices = choices;
		this.handlers = handlers;
		this.limit = choices.length;
		this.setPlaceholder("Set properties…");
	}

	getSuggestions(query: string): LabelledChoice[] {
		if (!query) return this.choices;
		return this.choices.filter((choice) => matchesInOrder(query, choice.label));
	}

	renderSuggestion(choice: LabelledChoice, el: HTMLElement): void {
		el.setText(choice.label);
	}

	selectSuggestion(choice: LabelledChoice, evt: MouseEvent | KeyboardEvent): void {
		this.chosen = true;
		evt.preventDefault();
		evt.stopImmediatePropagation();
		super.selectSuggestion(choice, evt);
	}

	onChooseSuggestion(choice: LabelledChoice): void {
		this.handlers.choose(choice.choice);
	}

	onClose(): void {
		if (!this.chosen) this.handlers.dismiss();
	}
}

export function setProperties(app: App, vault: JumpListVault, settings: JumpSettings, target: VaultNote): void {
	const rows = propertyRows(settings, vault, target);
	const cancel = () => new Notice("Property changes cancelled.");
	const initial = initialPropertyState(settings.setProperties, vault.frontmatter(target.path));
	const save = async (state: PropertyState) => {
		try {
			await vault.updateFrontmatter(target.path, (frontmatter) => writeProperties(frontmatter, initial, state));
			new Notice("Properties saved.");
		} catch {
			new Notice("Could not save the properties.");
		}
	};
	const open = (state: PropertyState): void =>
		new SetPropertiesModal(app, pickerChoices(rows, state), {
			choose: (choice) => {
				if (choice.action === "toggle") open(toggleRow(state, choice.row));
				else if (choice.action === "save") void save(state);
				else cancel();
			},
			dismiss: cancel,
		}).open();
	open(initial);
}
