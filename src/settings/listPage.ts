import { AbstractInputSuggest, setIcon } from "obsidian";
import type {
	App,
	Setting,
	SettingDefinition,
	SettingDefinitionGroup,
	SettingDefinitionItem,
	SettingDefinitionList,
	SettingDefinitionPage,
	SettingDefinitionRender,
	SettingGroupItem,
} from "obsidian";
import { propertyType } from "../lists/conditions";
import { noteCreationBlocker } from "../createNote/newNotes";
import { isLinkType } from "../settings";
import type { EditableProperty, NoteList } from "../settings";
import { excludedFolderKey, listKey, propertyKey, propertySourceKey } from "./controlKeys";
import {
	DATE_MODE_OPTIONS,
	DIRECTION_OPTIONS,
	SOURCE_OPTIONS,
	fixedDateError,
	hasProperty,
	inapplicableCondition,
	listDisplayValue,
	listName,
	matchingSuggestions,
	operatorOptions,
	sourceSummary,
	valueShape,
} from "./listForm";
import type { ListField, PropertySuggestion, ValueShape } from "./listForm";
import {
	PROPERTY_TYPE_OPTIONS,
	addExcludedFolder,
	deleteExcludedFolder,
	hasSource,
	mixedTypeWarning,
	propertyLabel,
	propertyRowName,
	propertyTypePreset,
} from "./setPropertiesForm";
import type { LinkProperty, PropertyField } from "./setPropertiesForm";
import type { PrefixDraft } from "./prefixChip";
import { renderPrefixedName } from "./prefixField";

export interface ListPageContext {
	app: App;
	propertyTypes: Record<string, string>;
	propertySuggestions: () => PropertySuggestion[];
	write: (key: string, value: unknown) => void;
	openPage: (pageId: string) => void;
	change: (change: () => unknown) => void;
	prefixDrafts: Map<string, PrefixDraft>;
	showPrefixes: boolean;
}

type IdentifiedPage = SettingDefinitionPage & { id: string };

export function listPageId(list: NoteList): string {
	return `list-${list.id}`;
}

export function propertyPageId(entry: EditableProperty): string {
	return `property-${entry.id}`;
}

interface EditableRow {
	name: string;
	label: string;
	prefix: string;
	prefixColor?: string;
	prefixKey: string;
	warning?: string;
	enabled: boolean;
	enabledKey: string;
	enabledTooltip: string;
	pageId: string;
	editTooltip: string;
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
	return pageEntry(listPageId(list), listName(list), list, context, listPageItems(list, context));
}

export function listRow(list: NoteList, context: ListPageContext): SettingDefinition {
	const inapplicable = inapplicableCondition(list.source, context.propertyTypes);
	return editableRow(
		{
			name: listName(list),
			label: sourceSummary(list.source),
			prefix: list.prefix,
			prefixColor: list.prefixColor,
			prefixKey: listKey(list.id, "prefix"),
			warning: inapplicable ? "Condition does not apply. Edit to see why." : undefined,
			enabled: list.enabled,
			enabledKey: listKey(list.id, "enabled"),
			enabledTooltip: "Show this list in the picker",
			pageId: listPageId(list),
			editTooltip: "Edit list",
		},
		context,
	);
}

export function propertyRow(
	entry: EditableProperty,
	properties: readonly EditableProperty[],
	context: ListPageContext,
): SettingDefinition {
	return editableRow(
		{
			name: propertyRowName(entry),
			label: propertyLabel(entry),
			prefix: entry.prefix,
			prefixColor: entry.prefixColor,
			prefixKey: propertyKey(entry.id, "prefix"),
			warning: propertyWarning(entry, properties, context),
			enabled: entry.enabled,
			enabledKey: propertyKey(entry.id, "enabled"),
			enabledTooltip: "Offer this property in the picker",
			pageId: propertyPageId(entry),
			editTooltip: "Edit property",
		},
		context,
	);
}

function propertyWarning(
	entry: EditableProperty,
	properties: readonly EditableProperty[],
	context: ListPageContext,
): string | undefined {
	if (mixedTypeWarning(entry, properties)) return "Type differs from another row. Edit to see why.";
	if (!hasSource(entry) || !inapplicableCondition(entry.source, context.propertyTypes)) return undefined;
	return "Condition does not apply. Edit to see why.";
}

function editableRow(row: EditableRow, context: ListPageContext): SettingDefinition {
	const definition: SettingDefinitionRender & { id: string } = {
		id: `${row.pageId}-row`,
		name: row.label,
		aliases: [row.name],
		desc: row.warning,
		render: (setting) => {
			const stopEditing = context.showPrefixes
				? renderPrefixedName(
						setting.nameEl,
						{ key: row.prefixKey, prefix: row.prefix, prefixColor: row.prefixColor, label: row.label },
						context,
					)
				: undefined;
			if (row.warning) warningDescription(setting.descEl, row.warning);
			setting.addToggle((toggle) =>
				toggle
					.setTooltip(row.enabledTooltip)
					.setValue(row.enabled)
					.onChange((enabled) => context.write(row.enabledKey, enabled)),
			);
			setting.addExtraButton((button) =>
				button
					.setIcon("pencil")
					.setTooltip(row.editTooltip)
					.onClick(() => context.openPage(row.pageId)),
			);
			return stopEditing;
		},
	};
	return definition;
}

function warningDescription(descEl: HTMLElement, warning: string): void {
	descEl.empty();
	descEl.addClass("note-compass-warning");
	setIcon(descEl.createSpan({ cls: "note-compass-warning-icon" }), "alert-triangle");
	descEl.createSpan({ text: warning });
}

export function propertyPage(
	entry: EditableProperty,
	properties: readonly EditableProperty[],
	context: ListPageContext,
): SettingDefinitionPage {
	const key = (field: PropertyField) => propertyKey(entry.id, field);
	const chosen = () => entry.property.trim() !== "";
	const mixed = mixedTypeWarning(entry, properties);
	const items: SettingDefinitionItem[] = [
		{
			name: "Type differs from another row",
			desc: mixed,
			searchable: false,
			visible: mixed !== undefined,
			render: (setting) => warningDescription(setting.descEl, mixed ?? ""),
		},
		{ name: "Enabled", desc: "Offer this property in the picker.", control: { type: "toggle", key: key("enabled") } },
		{
			name: "Prefix",
			desc: "Text shown before this property's rows in the picker, such as an emoji and a short tag.",
			visible: context.showPrefixes,
			control: { type: "text", key: key("prefix") },
		},
		...prefixColorItems(entry, key("prefixColor"), context),
		{
			name: "Property",
			desc: "The property the picker writes.",
			render: propertyInput(context, key("name"), () => entry.property, "Status", context.propertySuggestions, (suggestion) =>
				context.write(key("type"), propertyTypePreset(suggestion.type)),
			),
		},
		{
			name: "Type",
			desc: chosen() ? "Which value picker the property opens." : "Choose a property first.",
			control: { type: "dropdown", disabled: () => !chosen(), key: key("type"), options: PROPERTY_TYPE_OPTIONS },
		},
	];
	if (isLinkType(entry.type) && hasSource(entry)) {
		items.push(
			{
				type: "group",
				heading: "Offer notes from",
				items: sourceItems(entry, context, (field) => propertySourceKey(entry.id, field)),
			},
			excludedFoldersList(entry, context),
			createNotesGroup(entry, context),
		);
	}
	const page: IdentifiedPage = {
		type: "page",
		id: propertyPageId(entry),
		name: propertyRowName(entry),
		displayValue: entry.enabled ? "" : "off",
		status: propertyWarning(entry, properties, context) ? "warning" : null,
		items,
	};
	return page;
}

function excludedFoldersList(entry: LinkProperty, context: ListPageContext): SettingDefinitionList {
	const folders = entry.excludedFolders ?? [];
	return {
		type: "list",
		heading: "Excluded folders",
		emptyState: "No folders are excluded.",
		items: folders.map((_folder, index) => ({
			name: `Excluded folder ${index + 1}`,
			control: { type: "folder", key: excludedFolderKey(entry.id, index) },
		})),
		onDelete: (index) => context.change(() => deleteExcludedFolder(entry, index)),
		addItem: { name: "Add excluded folder", action: () => context.change(() => addExcludedFolder(entry)) },
	};
}

function createNotesGroup(entry: LinkProperty, context: ListPageContext): SettingDefinitionGroup {
	const key = (field: PropertyField) => propertyKey(entry.id, field);
	const blocker = noteCreationBlocker(entry.source, context.propertyTypes);
	const creating = () => entry.createsNotes === true && blocker === undefined;
	return {
		type: "group",
		heading: "Create notes",
		items: [
			{
				name: "Allow creating notes",
				desc: blocker ? `This source cannot create notes: ${blocker}.` : "Offer this property in the Create note command.",
				control: { type: "toggle", disabled: blocker !== undefined, key: key("createsNotes") },
			},
			{
				name: "Folder",
				desc: "New notes go here. Empty uses the default location for new notes.",
				visible: () => creating() && entry.source.kind !== "inFolder",
				control: { type: "folder", key: key("newNoteFolder") },
			},
			{
				name: "Template",
				desc: "New notes start from this template. Templater runs it when enabled; otherwise {{title}}, {{date}} and {{time}} are filled in as the core Templates plugin does.",
				visible: creating,
				control: { type: "file", key: key("newNoteTemplate"), filter: (file) => file.extension === "md" },
			},
		],
	};
}

export function listPageItems(list: NoteList, context: ListPageContext): SettingDefinitionItem[] {
	const key = (field: ListField) => listKey(list.id, field);
	return [
		{ name: "Enabled", desc: "Show this list in the picker.", control: { type: "toggle", key: key("enabled") } },
		{
			name: "Prefix",
			desc: "Text shown before each note from this list, such as an emoji and a short tag.",
			visible: context.showPrefixes,
			control: { type: "text", key: key("prefix") },
		},
		...prefixColorItems(list, key("prefixColor"), context),
		...sourceItems(list, context, key),
	];
}

function prefixColorItems(
	target: { prefixColor?: string },
	key: string,
	context: ListPageContext,
): SettingDefinitionItem[] {
	const colored = () => context.showPrefixes && target.prefixColor !== undefined;
	return [
		{
			name: "Prefix colour",
			desc: target.prefixColor === undefined ? "No colour. Pick one to tint the prefix chip." : "Tints the prefix chip.",
			visible: context.showPrefixes,
			control: { type: "color", key },
		},
		{
			name: "Remove prefix colour",
			desc: "Show the prefix chip in plain grey again.",
			visible: colored,
			action: () => context.write(key, ""),
		},
	];
}

function sourceItems(
	list: NoteList,
	context: ListPageContext,
	key: (field: ListField) => string,
): SettingGroupItem[] {
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
			render: propertyInput(context, key("property"), () => property()?.property ?? "", "Status", context.propertySuggestions),
		},
		{
			name: "Condition",
			desc: hasProperty(list) ? `Conditions for a ${type} property.` : "Choose a property first.",
			visible: () => property() !== undefined,
			control: { type: "dropdown", disabled: () => !hasProperty(list), key: key("operator"), options: operatorOptions(type, source?.condition.operator) },
		},
		{
			name: "Condition does not apply",
			desc: inapplicable ?? "",
			searchable: false,
			render: (setting) => warningDescription(setting.descEl, inapplicable ?? ""),
			visible: () => property() !== undefined && inapplicable !== undefined,
		},
		{ name: "Value", visible: () => shape() === "text", control: { type: "text", disabled: () => !hasProperty(list), key: key("text") } },
		{ name: "Value", visible: () => shape() === "number", control: { type: "number", disabled: () => !hasProperty(list), key: key("number") } },
		{
			name: "Date",
			visible: () => shape() === "date",
			control: { type: "dropdown", disabled: () => !hasProperty(list), key: key("dateMode"), options: DATE_MODE_OPTIONS },
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

function pageEntry(
	id: string,
	name: string,
	list: NoteList,
	context: ListPageContext,
	items: SettingDefinitionItem[],
): IdentifiedPage {
	const inapplicable = inapplicableCondition(list.source, context.propertyTypes);
	return { type: "page", id, name, displayValue: listDisplayValue(list), status: inapplicable ? "warning" : null, items };
}

function propertyInput(
	context: ListPageContext,
	key: string,
	value: () => string,
	placeholder: string,
	suggestions: () => PropertySuggestion[],
	picked?: (suggestion: PropertySuggestion) => void,
): (setting: Setting) => void {
	return (setting) => {
		setting.addText((text) => {
			text.setPlaceholder(placeholder).setValue(value());
			text.onChange((typed) => context.write(key, typed));
			const suggest = new PropertySuggest(context.app, text.inputEl, suggestions);
			suggest.onSelect((suggestion) => {
				suggest.setValue(suggestion.name);
				context.write(key, suggestion.name);
				picked?.(suggestion);
				suggest.close();
			});
		});
	};
}
