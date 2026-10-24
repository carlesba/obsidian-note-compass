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
import type { Period } from "../lists/dateNotes";
import { noteCreationBlocker } from "../createNote/newNotes";
import { hasPresetValues, isLinkType, isUnreadable } from "../settings";
import type { EditableProperty, ListSource, NoteList } from "../settings";
import { excludedFolderKey, listKey, presetValueKey, propertyKey, propertySourceKey } from "./controlKeys";
import { PERIODS } from "../lists/dateNotes";
import {
	CURRENT_PERIOD_FIELDS,
	CURRENT_PERIOD_NAMES,
	SOURCE_OPTIONS,
	UNREADABLE_LIST_WARNING,
	inapplicableCondition,
	listDisplayValue,
	listName,
	sourceSummary,
} from "./listForm";
import type { ListField, PropertySuggestion } from "./listForm";
import { filterRules } from "../lists/filters";
import { renderFilter } from "./filterEditor";
import { PropertySuggest, warningDescription } from "./suggest";
import {
	PROPERTY_TYPE_OPTIONS,
	addExcludedFolder,
	addPresetValue,
	deleteExcludedFolder,
	deletePresetValue,
	movePresetValue,
	presetValueError,
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

const NEUTRAL_PREFIX_COLOR = "#888888";

const PERIOD_NOUNS: Record<Period, string> = {
	day: "daily",
	week: "weekly",
	month: "monthly",
	quarter: "quarterly",
	year: "yearly",
};

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
	broken: boolean;
	enabled: boolean;
	enabledKey: string;
	enabledTooltip: string;
	pageId: string;
	editTooltip: string;
}

export function listPage(list: NoteList, context: ListPageContext): SettingDefinitionPage {
	const items = isUnreadable(list.source) ? [unreadableItem()] : listPageItems(list, context);
	return pageEntry(listPageId(list), listName(list), list, context, items);
}

function unreadableItem(): SettingDefinitionItem {
	return {
		name: "List can't be read",
		desc: UNREADABLE_LIST_WARNING,
		searchable: false,
		render: (setting) => warningDescription(setting.descEl, UNREADABLE_LIST_WARNING),
	};
}

function sourceWarning(source: ListSource, context: ListPageContext): string | undefined {
	if (isUnreadable(source)) return UNREADABLE_LIST_WARNING;
	return inapplicableCondition(source, context.propertyTypes) ? "Condition does not apply. Edit to see why." : undefined;
}

export function listRow(list: NoteList, context: ListPageContext): SettingDefinition {
	return editableRow(
		{
			name: listName(list),
			label: sourceSummary(list.source),
			prefix: list.prefix,
			prefixColor: list.prefixColor,
			prefixKey: listKey(list.id, "prefix"),
			warning: sourceWarning(list.source, context),
			broken: isUnreadable(list.source),
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
			broken: isUnreadable(entry.source),
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
	if (isUnreadable(entry.source)) return UNREADABLE_LIST_WARNING;
	if (mixedTypeWarning(entry, properties)) return "Type differs from another row. Edit to see why.";
	return hasSource(entry) ? sourceWarning(entry.source, context) : undefined;
}

function editableRow(row: EditableRow, context: ListPageContext): SettingDefinition {
	const definition: SettingDefinitionRender & { id: string } = {
		id: `${row.pageId}-row`,
		name: row.label,
		aliases: [row.name],
		desc: row.warning,
		render: (setting) => {
			setting.settingEl.addClass("note-compass-draggable-row");
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
					.setValue(row.enabled && !row.broken)
					.setDisabled(row.broken)
					.onChange((enabled) => context.write(row.enabledKey, enabled)),
			);
			if (row.broken) return stopEditing;
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

export function propertyPage(
	entry: EditableProperty,
	properties: readonly EditableProperty[],
	context: ListPageContext,
): SettingDefinitionPage {
	const key = (field: PropertyField) => propertyKey(entry.id, field);
	const chosen = () => entry.property.trim() !== "";
	const mixed = mixedTypeWarning(entry, properties);
	const items: SettingDefinitionItem[] = isUnreadable(entry.source) ? [unreadableItem()] : [
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
	if (hasPresetValues(entry.type)) items.push(presetValuesList(entry, context));
	if (isLinkType(entry.type) && hasSource(entry) && !isUnreadable(entry.source)) {
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
		displayValue: entry.enabled && !isUnreadable(entry.source) ? "" : "off",
		status: propertyWarning(entry, properties, context) ? "warning" : null,
		items,
	};
	return page;
}

function presetValuesList(entry: EditableProperty, context: ListPageContext): SettingDefinitionList {
	const values = entry.presetValues ?? [];
	return {
		type: "list",
		heading: "Preset values",
		emptyState: "No preset values. The picker still offers the values this property already has in the vault.",
		items: values.map((_value, index) => ({
			name: `Preset value ${index + 1}`,
			control: {
				type: "text",
				key: presetValueKey(entry.id, index),
				placeholder: entry.type === "number" ? "3" : "Doing",
				validate: (value: string) => presetValueError(entry, value),
			},
		})),
		onReorder: (from, to) => context.change(() => movePresetValue(entry, from, to)),
		onDelete: (index) => context.change(() => deletePresetValue(entry, index)),
		addItem: { name: "Add preset value", action: () => context.change(() => addPresetValue(entry)) },
	};
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
	return [
		{
			name: "Prefix colour",
			desc: target.prefixColor === undefined ? "No colour. Pick one to tint the prefix chip." : "Tints the prefix chip.",
			visible: context.showPrefixes,
			render: (setting) => {
				setting.settingEl.addClass("note-compass-prefix-colour");
				setting.addColorPicker((picker) =>
					picker.setValue(target.prefixColor ?? NEUTRAL_PREFIX_COLOR).onChange((color) => context.write(key, color)),
				);
				if (target.prefixColor === undefined) return;
				setting.addExtraButton((button) =>
					button
						.setIcon("rotate-ccw")
						.setTooltip("Remove colour")
						.onClick(() => context.write(key, "")),
				);
			},
		},
	];
}

function sourceItems(
	list: NoteList,
	context: ListPageContext,
	key: (field: ListField) => string,
): SettingGroupItem[] {
	const filter = list.source.kind === "filter" ? list.source.filter : undefined;
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
		...PERIODS.map((period) => ({
			name: CURRENT_PERIOD_NAMES[period],
			desc: `List the ${PERIOD_NOUNS[period]} note for the current ${period}, when it exists.`,
			visible: () => list.source.kind === "currentPeriods",
			control: { type: "toggle" as const, key: key(CURRENT_PERIOD_FIELDS[period]) },
		})),
		{
			name: "Filter",
			desc: filter && filterRules(filter).length === 0 ? "Add a condition to list notes." : "Notes that match the filter are listed.",
			searchable: false,
			visible: () => list.source.kind === "filter",
			render: (setting) => (list.source.kind === "filter" ? renderFilter(setting, list.source.filter, context) : undefined),
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
	const status = sourceWarning(list.source, context) ? "warning" : null;
	return { type: "page", id, name, displayValue: listDisplayValue(list), status, items };
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
