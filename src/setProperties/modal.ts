import { App, Notice, SuggestModal } from "obsidian";
import type { JumpListVault, VaultNote } from "../lists/vault";
import { matchesInOrder } from "../render";
import type { EditableProperty, JumpSettings } from "../settings";
import { initialPropertyState, pickerChoices, propertyType, withValue, writeProperties } from "./picker";
import type { LabelledChoice, PropertyState } from "./picker";
import { valueChoices, valuePicker } from "./valuePicker";
import type { ValueChoice } from "./valuePicker";

interface ChoiceHandlers<Choice> {
	choose(choice: Choice): void;
	dismiss(): void;
}

class ChoiceModal<Choice extends { label: string }> extends SuggestModal<Choice> {
	private readonly suggestions: (query: string) => Choice[];
	private readonly handlers: ChoiceHandlers<Choice>;
	private chosen = false;

	constructor(app: App, placeholder: string, suggestions: (query: string) => Choice[], handlers: ChoiceHandlers<Choice>) {
		super(app);
		this.suggestions = suggestions;
		this.handlers = handlers;
		this.limit = suggestions("").length + 1;
		this.setPlaceholder(placeholder);
	}

	getSuggestions(query: string): Choice[] {
		return this.suggestions(query);
	}

	renderSuggestion(choice: Choice, el: HTMLElement): void {
		el.setText(choice.label);
	}

	selectSuggestion(choice: Choice, evt: MouseEvent | KeyboardEvent): void {
		this.chosen = true;
		evt.preventDefault();
		evt.stopImmediatePropagation();
		super.selectSuggestion(choice, evt);
	}

	onChooseSuggestion(choice: Choice): void {
		this.handlers.choose(choice);
	}

	onClose(): void {
		if (!this.chosen) this.handlers.dismiss();
	}
}

export function setProperties(app: App, vault: JumpListVault, settings: JumpSettings, target: VaultNote): void {
	const properties = settings.setProperties;
	const initial = initialPropertyState(properties, vault.frontmatter(target.path));
	const cancel = () => new Notice("Property changes cancelled.");
	const save = async (state: PropertyState) => {
		try {
			await vault.updateFrontmatter(target.path, (frontmatter) => writeProperties(frontmatter, initial, state));
			new Notice("Properties saved.");
		} catch {
			new Notice("Could not save the properties.");
		}
	};
	const openMain = (state: PropertyState): void => {
		const choices = pickerChoices(properties, initial, state);
		new ChoiceModal<LabelledChoice>(
			app,
			"Set properties…",
			(query) => (query ? choices.filter((choice) => matchesInOrder(query, choice.label)) : choices),
			{
				choose: ({ choice }) => {
					if (choice.action === "edit") openValue(state, choice.entry);
					else if (choice.action === "save") void save(state);
					else cancel();
				},
				dismiss: cancel,
			},
		).open();
	};
	const openValue = (state: PropertyState, entry: EditableProperty): void => {
		const picker = valuePicker(settings, vault, target, entry, propertyType(properties, entry));
		const open = (current: PropertyState): void =>
			new ChoiceModal<ValueChoice>(app, entry.property, (query) => valueChoices(picker, current.get(entry.property), query), {
				choose: (choice) => {
					const next = withValue(current, entry.property, choice.value);
					if (choice.reopens) open(next);
					else openMain(next);
				},
				dismiss: () => openMain(state),
			}).open();
		open(state);
	};
	openMain(initial);
}
