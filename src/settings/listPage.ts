import { AbstractInputSuggest } from "obsidian";
import type { App, SettingDefinitionItem, SettingDefinitionPage } from "obsidian";
import { propertyType } from "../lists/conditions";
import type { NoteList } from "../settings";
import { listKey } from "./controlKeys";
import {
	DATE_MODE_OPTIONS,
	DIRECTION_OPTIONS,
	SOURCE_OPTIONS,
	fixedDateError,
	inapplicableCondition,
	listDisplayValue,
	listName,
	matchingSuggestions,
	operatorOptions,
	valueShape,
} from "./listForm";
import type { PropertySuggestion, ValueShape } from "./listForm";

export interface ListPageContext {
	app: App;
	propertyTypes: Record<string, string>;
	propertySuggestions: () => PropertySuggestion[];
	write: (key: string, value: unknown) => void;
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
		el.createDiv({ text: suggestion.type, cls: "setting-item-description" });
	}
}

export function listPage(list: NoteList, context: ListPageContext): SettingDefinitionPage {
	const inapplicable = inapplicableCondition(list.source, context.propertyTypes);
	return {
		type: "page",
		name: listName(list),
		displayValue: listDisplayValue(list),
		status: inapplicable ? "warning" : null,
		items: listPageItems(list, context),
	};
}

export function listPageItems(list: NoteList, context: ListPageContext): SettingDefinitionItem[] {
	const key = (field: Parameters<typeof listKey>[1]) => listKey(list.id, field);
	const property = () => (list.source.kind === "frontmatter" ? list.source : undefined);
	const shape = (): ValueShape => valueShape(property()?.condition.operator ?? "is set");
	const dateMode = () => {
		const condition = property()?.condition;
		return condition && "value" in condition && typeof condition.value === "object" ? condition.value.kind : undefined;
	};
	const relativeToday = () => {
		const condition = property()?.condition;
		return condition !== undefined && "value" in condition && typeof condition.value === "object" && condition.value.kind === "relative" && condition.value.days === 0;
	};
	const source = property();
	const type = propertyType(context.propertyTypes, source?.property ?? "");
	const inapplicable = inapplicableCondition(list.source, context.propertyTypes);
	return [
		{ name: "Enabled", desc: "Show this list in the picker.", control: { type: "toggle", key: key("enabled") } },
		{ name: "Prefix", desc: "Every row from this list starts with it.", control: { type: "text", key: key("prefix") } },
		{ name: "Source", control: { type: "dropdown", key: key("source"), options: SOURCE_OPTIONS } },
		{
			name: "Note",
			desc: "Notes that link to this note, in the text or in a property, are listed.",
			visible: () => list.source.kind === "linksToNote",
			control: { type: "file", key: key("note"), placeholder: "Person", filter: (file) => file.extension === "md" },
		},
		{
			name: "Folder",
			desc: "Notes in this folder and its subfolders are listed.",
			visible: () => list.source.kind === "inFolder",
			control: { type: "folder", key: key("folder") },
		},
		{
			name: "Property",
			desc: "Notes whose property meets the condition are listed.",
			visible: () => property() !== undefined,
			render: (setting) => {
				setting.addText((text) => {
					text.setPlaceholder("Status").setValue(property()?.property ?? "");
					text.onChange((value) => context.write(key("property"), value));
					const suggest = new PropertySuggest(context.app, text.inputEl, context.propertySuggestions);
					suggest.onSelect((suggestion) => {
						suggest.setValue(suggestion.name);
						context.write(key("property"), suggestion.name);
						suggest.close();
					});
				});
			},
		},
		{
			name: "Condition",
			visible: () => property() !== undefined,
			control: { type: "dropdown", key: key("operator"), options: operatorOptions(type, source?.condition.operator) },
		},
		{
			name: "Condition does not apply",
			desc: inapplicable ?? "",
			searchable: false,
			visible: () => property() !== undefined && inapplicable !== undefined,
		},
		{ name: "Value", visible: () => shape() === "text", control: { type: "text", key: key("text") } },
		{ name: "Value", visible: () => shape() === "number", control: { type: "number", key: key("number") } },
		{
			name: "Date",
			visible: () => shape() === "date",
			control: { type: "dropdown", key: key("dateMode"), options: DATE_MODE_OPTIONS },
		},
		{
			name: "Fixed date",
			visible: () => shape() === "date" && dateMode() === "fixed",
			control: { type: "text", key: key("date"), placeholder: "YYYY-MM-DD", validate: fixedDateError },
		},
		{
			name: "When",
			visible: () => shape() === "date" && dateMode() === "relative",
			control: { type: "dropdown", key: key("direction"), options: DIRECTION_OPTIONS },
		},
		{
			name: "Number of days",
			visible: () => shape() === "date" && dateMode() === "relative" && !relativeToday(),
			control: { type: "number", key: key("days"), min: 1, step: 1 },
		},
	];
}
