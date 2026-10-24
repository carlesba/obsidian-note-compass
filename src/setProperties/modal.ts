import { Notice } from "obsidian";
import type { App } from "obsidian";
import { ChoiceModal } from "../choiceModal";
import type { JumpListVault, VaultNote } from "../lists/vault";
import type { EditableProperty, JumpSettings } from "../settings";
import { offeredEntries, propertyType } from "./offered";
import { initialPropertyState, keptEmptyValues, pickerChoices, pickerState, withValue, writeProperties } from "./picker";
import type { PickerChoice, PickerState } from "./picker";
import { isScalarType, valueChoices, valuePicker } from "./valuePicker";
import type { ValueChoice } from "./valuePicker";

export function setProperties(
	app: App,
	vault: JumpListVault,
	settings: JumpSettings,
	target: VaultNote,
	back?: () => void,
): void {
	const entries = offeredEntries(settings, vault, target);
	const initial = initialPropertyState(settings.setProperties, vault.frontmatter(target.path));
	const keptEmpty = keptEmptyValues(settings.setProperties);
	const cancel = () => {
		new Notice("Property changes cancelled.");
		back?.();
	};
	const save = async (state: PickerState) => {
		try {
			await vault.updateFrontmatter(target.path, (frontmatter) => writeProperties(frontmatter, initial, state.values, keptEmpty));
			new Notice("Properties saved.");
		} catch {
			new Notice("Could not save the properties.");
		}
	};
	const openMain = (state: PickerState, query: string): void => {
		new ChoiceModal<PickerChoice>(app, "Set properties…", (typed) => pickerChoices(entries, initial, state, typed, settings.showPrefixes, settings.setProperties.checkboxMode), {
			choose: ({ action }, typed) => {
				if (action.action === "set") openMain(action.state, "");
				else if (action.action === "expand") openMain(state, action.query);
				else if (action.action === "edit") openValue(state, action.entry, typed);
				else if (action.action === "save") void save(state);
				else cancel();
			},
			dismiss: cancel,
			save: () => void save(state),
		}).openWithQuery(query);
	};
	const openValue = (state: PickerState, entry: EditableProperty, query: string): void => {
		const type = propertyType(settings.setProperties, entry);
		if (!isScalarType(type)) return openMain(state, query);
		const picker = valuePicker(vault, entry.property, type, entry.presetValues);
		new ChoiceModal<ValueChoice>(
			app,
			entry.property,
			(typed) => valueChoices(picker, state.values.get(entry.property), typed),
			{
				choose: (choice) => openMain(withValue(state, entry.property, choice.value), ""),
				dismiss: () => openMain(state, query),
				save: () => void save(state),
			},
		).openWithQuery("");
	};
	openMain(pickerState(initial), "");
}
