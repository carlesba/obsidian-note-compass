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
import { t, tCount } from "../i18n";
import type { TranslationKey } from "../i18n";
import type { Period } from "../lists/dateNotes";
import { noteCreationBlocker } from "../createNote/newNotes";
import { hasPresetValues, isLinkType, isUnreadable } from "../settings";
import type { EditableProperty, ListSource, NoteList } from "../settings";
import { excludedFolderKey, listKey, mainMenuPresetKey, presetValueKey, propertyKey, propertySourceKey } from "./controlKeys";
import { PERIODS } from "../lists/dateNotes";
import {
	CURRENT_PERIOD_FIELDS,
	currentPeriodName,
	inapplicableCondition,
	listDisplayValue,
	listName,
	sourceOptions,
	sourceSummary,
	unreadableListWarning,
} from "./listForm";
import type { ListField, PropertySuggestion } from "./listForm";
import { filterRules } from "../lists/filters";
import { renderFilter } from "./filterEditor";
import { PrefixSuggest, PropertySuggest, warningDescription } from "./suggest";
import {
	addExcludedFolder,
	addPresetValue,
	deleteExcludedFolder,
	deletePresetValue,
	isMainMenuPreset,
	movePresetValue,
	presetValueError,
	hasSource,
	mixedTypeWarning,
	propertyLabel,
	propertyRowName,
	propertyTypeOptions,
	propertyTypePreset,
} from "./setPropertiesForm";
import type { LinkProperty, PropertyField } from "./setPropertiesForm";
import type { PrefixDraft } from "./prefixChip";
import { renderPrefixedName } from "./prefixField";
import { prefixSuggestions } from "./prefixLinks";
import type { PrefixEdits } from "./prefixLinks";

export interface ListPageContext {
	app: App;
	propertyTypes: Record<string, string>;
	propertySuggestions: () => PropertySuggestion[];
	write: (key: string, value: unknown) => void;
	openPage: (pageId: string) => void;
	change: (change: () => unknown) => void;
	prefixDrafts: Map<string, PrefixDraft>;
	prefixes: PrefixEdits;
	showPrefixes: boolean;
}

type IdentifiedPage = SettingDefinitionPage & { id: string };

const NEUTRAL_PREFIX_COLOR = "#888888";

const CURRENT_PERIOD_DESCRIPTIONS: Record<Period, TranslationKey> = {
	day: "currentDayDesc",
	week: "currentWeekDesc",
	month: "currentMonthDesc",
	quarter: "currentQuarterDesc",
	year: "currentYearDesc",
};

export function listPageId(list: NoteList): string {
	return `list-${list.id}`;
}

export function propertyPageId(entry: EditableProperty): string {
	return `property-${entry.id}`;
}

export interface EditableRow {
	name: string;
	label: string;
	prefix?: string;
	prefixColor?: string;
	prefixKey?: string;
	warning?: string;
	desc?: string;
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
		name: t("listUnreadable"),
		desc: unreadableListWarning(),
		searchable: false,
		render: (setting) => warningDescription(setting.descEl, unreadableListWarning()),
	};
}

function sourceWarning(source: ListSource, context: ListPageContext): string | undefined {
	if (isUnreadable(source)) return unreadableListWarning();
	return inapplicableCondition(source, context.propertyTypes) ? t("conditionDoesNotApply") : undefined;
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
			enabledTooltip: t("showListInPicker"),
			pageId: listPageId(list),
			editTooltip: t("editList"),
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
			enabledTooltip: t("offerPropertyInPicker"),
			pageId: propertyPageId(entry),
			editTooltip: t("editProperty"),
		},
		context,
	);
}

function propertyWarning(
	entry: EditableProperty,
	properties: readonly EditableProperty[],
	context: ListPageContext,
): string | undefined {
	if (isUnreadable(entry.source)) return unreadableListWarning();
	if (mixedTypeWarning(entry, properties)) return t("typeDiffersWarning");
	return hasSource(entry) ? sourceWarning(entry.source, context) : undefined;
}

export function editableRow(row: EditableRow, context: ListPageContext): SettingDefinitionRender & { id: string } {
	const definition: SettingDefinitionRender & { id: string } = {
		id: `${row.pageId}-row`,
		name: row.label,
		aliases: [row.name],
		desc: row.warning ?? row.desc,
		render: (setting) => {
			setting.settingEl.addClass("note-compass-draggable-row");
			const stopEditing =
				context.showPrefixes && row.prefixKey !== undefined
					? renderPrefixedName(
							setting.nameEl,
							{ key: row.prefixKey, prefix: row.prefix ?? "", prefixColor: row.prefixColor, label: row.label },
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
			name: t("typeDiffers"),
			desc: mixed,
			searchable: false,
			visible: mixed !== undefined,
			render: (setting) => warningDescription(setting.descEl, mixed ?? ""),
		},
		{ name: t("enabled"), desc: t("offerPropertyInPickerDesc"), control: { type: "toggle", key: key("enabled") } },
		...prefixItems(entry, key("prefix"), t("propertyPrefixDesc"), context),
		{
			name: t("property"),
			desc: t("propertyDesc"),
			render: propertyInput(context, key("name"), () => entry.property, t("propertyPlaceholder"), context.propertySuggestions, (suggestion) =>
				context.write(key("type"), propertyTypePreset(suggestion.type)),
			),
		},
		{
			name: t("type"),
			desc: chosen() ? t("typeDesc") : t("chooseAPropertyFirst"),
			control: { type: "dropdown", disabled: () => !chosen(), key: key("type"), options: propertyTypeOptions() },
		},
		{
			name: t("removeWhenEmpty"),
			desc: t("removeWhenEmptyDesc"),
			control: { type: "toggle", key: key("removesEmpty") },
		},
	];
	if (hasPresetValues(entry.type)) {
		items.push(presetValuesList(entry, context), {
			name: t("presetsInMainMenu"),
			desc: t("presetsInMainMenuDesc"),
			searchable: false,
			render: () => undefined,
		});
	}
	if (isLinkType(entry.type) && hasSource(entry) && !isUnreadable(entry.source)) {
		items.push(
			{
				type: "group",
				heading: t("offerNotesFrom"),
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
		displayValue: entry.enabled && !isUnreadable(entry.source) ? "" : t("off"),
		status: propertyWarning(entry, properties, context) ? "warning" : null,
		items,
	};
	return page;
}

function presetValuesList(entry: EditableProperty, context: ListPageContext): SettingDefinitionList {
	const values = entry.presetValues ?? [];
	return {
		type: "list",
		heading: t("presetValues"),
		emptyState: t("noPresetValues"),
		items: values.map((value, index) => ({
			name: t("presetValueNumber", { number: index + 1 }),
			searchable: false,
			render: (setting: Setting) => {
				setting.settingEl.addClass("note-compass-preset-value");
				setting.addText((text) => {
					text.setPlaceholder(entry.type === "number" ? "3" : t("presetTextPlaceholder")).setValue(value);
					text.onChange((typed) => {
						const error = presetValueError(entry, typed);
						setting.setDesc(error ?? "");
						setting.settingEl.toggleClass("has-error", error !== undefined);
						if (error === undefined) context.write(presetValueKey(entry.id, index), typed);
					});
				});
				setting.addToggle((toggle) =>
					toggle
						.setTooltip(t("showInMainMenu"))
						.setValue(isMainMenuPreset(entry, index))
						.onChange((shown) => context.write(mainMenuPresetKey(entry.id, index), shown)),
				);
			},
		})),
		onReorder: (from, to) => context.change(() => movePresetValue(entry, from, to)),
		onDelete: (index) => context.change(() => deletePresetValue(entry, index)),
		addItem: { name: t("addPresetValue"), action: () => context.change(() => addPresetValue(entry)) },
	};
}

function excludedFoldersList(entry: LinkProperty, context: ListPageContext): SettingDefinitionList {
	const folders = entry.excludedFolders ?? [];
	return {
		type: "list",
		heading: t("excludedFolders"),
		emptyState: t("noExcludedFolders"),
		items: folders.map((_folder, index) => ({
			name: t("excludedFolderNumber", { number: index + 1 }),
			control: { type: "folder", key: excludedFolderKey(entry.id, index) },
		})),
		onDelete: (index) => context.change(() => deleteExcludedFolder(entry, index)),
		addItem: { name: t("addExcludedFolder"), action: () => context.change(() => addExcludedFolder(entry)) },
	};
}

function createNotesGroup(entry: LinkProperty, context: ListPageContext): SettingDefinitionGroup {
	const key = (field: PropertyField) => propertyKey(entry.id, field);
	const blocker = noteCreationBlocker(entry.source, context.propertyTypes);
	const creating = () => entry.createsNotes === true && blocker === undefined;
	return {
		type: "group",
		heading: t("createNotes"),
		items: [
			{
				name: t("allowCreatingNotes"),
				desc: blocker ? t("sourceCannotCreate", { reason: blocker }) : t("allowCreatingNotesDesc"),
				control: { type: "toggle", disabled: blocker !== undefined, key: key("createsNotes") },
			},
			{
				name: t("folder"),
				desc: t("newNoteFolderDesc"),
				visible: () => creating() && entry.source.kind !== "inFolder",
				control: { type: "folder", key: key("newNoteFolder") },
			},
			{
				name: t("template"),
				desc: t("templateDesc"),
				visible: creating,
				control: { type: "file", key: key("newNoteTemplate"), filter: (file) => file.extension === "md" },
			},
		],
	};
}

export function listPageItems(list: NoteList, context: ListPageContext): SettingDefinitionItem[] {
	const key = (field: ListField) => listKey(list.id, field);
	return [
		{ name: t("enabled"), desc: t("showListInPickerDesc"), control: { type: "toggle", key: key("enabled") } },
		...prefixItems(list, key("prefix"), t("listPrefixDesc"), context),
		...sourceItems(list, context, key),
	];
}

function prefixItems(
	target: { prefix: string; prefixColor?: string },
	prefixKey: string,
	desc: string,
	context: ListPageContext,
): SettingDefinitionItem[] {
	const { prefixes } = context;
	const linked = prefixes.linked(prefixKey);
	return [
		{
			name: t("prefix"),
			desc,
			visible: context.showPrefixes,
			render: (setting) => {
				setting.addText((text) => {
					text.setValue(target.prefix);
					text.onChange((typed) => prefixes.type(prefixKey, { prefix: typed }));
					const suggest = new PrefixSuggest(context.app, text.inputEl, (query) =>
						prefixSuggestions(prefixes.rows(), prefixKey, query),
					);
					suggest.onSelect((suggestion) => {
						suggest.setValue(suggestion.prefix);
						prefixes.type(prefixKey, { prefix: suggestion.prefix, color: suggestion.color ?? "" }, "now");
						suggest.close();
					});
				});
			},
		},
		{
			name: t("prefixColour"),
			desc: target.prefixColor === undefined ? t("noPrefixColour") : t("prefixColourDesc"),
			visible: context.showPrefixes,
			render: (setting) => {
				setting.settingEl.addClass("note-compass-prefix-colour");
				setting.addColorPicker((picker) =>
					picker
						.setValue(target.prefixColor ?? NEUTRAL_PREFIX_COLOR)
						.onChange((color) => prefixes.type(prefixKey, { color })),
				);
				if (target.prefixColor === undefined) return;
				setting.addExtraButton((button) =>
					button
						.setIcon("rotate-ccw")
						.setTooltip(t("removeColour"))
						.onClick(() => prefixes.type(prefixKey, { color: "" }, "now")),
				);
			},
		},
		{
			name: tCount("linkedPrefixRowsOne", "linkedPrefixRowsOther", linked.length, {
				prefix: prefixes.linkedPrefix(prefixKey),
			}),
			desc: t("linkedPrefixRowsDesc"),
			searchable: false,
			visible: context.showPrefixes && linked.length > 0,
			render: (setting) => {
				setting.addToggle((toggle) =>
					toggle
						.setValue(prefixes.updatesLinked(prefixKey))
						.onChange((updatesLinked) => prefixes.setUpdatesLinked(prefixKey, updatesLinked)),
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
		{ name: t("source"), control: { type: "dropdown", key: key("source"), options: sourceOptions() } },
		{
			name: t("note"),
			desc: t("noteDesc"),
			visible: () => list.source.kind === "linksToNote",
			control: { type: "file", key: key("note"), placeholder: t("notePlaceholder"), filter: (file) => file.extension === "md" },
		},
		{
			name: t("folder"),
			desc: t("folderDesc"),
			visible: () => list.source.kind === "inFolder",
			control: { type: "folder", key: key("folder") },
		},
		...PERIODS.map((period) => ({
			name: currentPeriodName(period),
			desc: t(CURRENT_PERIOD_DESCRIPTIONS[period]),
			visible: () => list.source.kind === "currentPeriods",
			control: { type: "toggle" as const, key: key(CURRENT_PERIOD_FIELDS[period]) },
		})),
		{
			name: t("filter"),
			desc: filter && filterRules(filter).length === 0 ? t("filterEmptyDesc") : t("filterDesc"),
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

export function propertyInput(
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
