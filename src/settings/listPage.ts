import type {
	App,
	ColorComponent,
	Setting,
	SettingDefinition,
	SettingDefinitionGroup,
	SettingDefinitionItem,
	SettingDefinitionList,
	SettingDefinitionPage,
	SettingDefinitionRender,
	SettingGroupItem,
	TextComponent,
} from "obsidian";
import { t, tCount } from "../i18n";
import type { TranslationKey } from "../i18n";
import type { Period } from "../lists/dateNotes";
import { hasPresetValues, isLinkType, isMultiRow, isUnreadable } from "../settings";
import type { AdjacentEntry, EditableProperty, ListSource, NoteList } from "../settings";
import { excludedFolderKey, listKey, mainMenuPresetKey, presetValueKey, propertyKey, propertySourceKey } from "./controlKeys";
import {
	CURRENT_PERIOD_FIELDS,
	adjacentEntryField,
	adjacentEntryName,
	currentPeriodName,
	moveSourceChoice,
	sourceChoiceOrder,
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
import { warningDescription } from "./suggest";
import { suggestProperties } from "./fieldEditor";
import type { ExpandingPageContext } from "./fieldEditor";
import { fixedValuesList } from "./fixedValuesPage";
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
	propertyModeOptions,
	propertyRowName,
	propertyTypeOptions,
	propertyTypePreset,
	rowNamePlaceholder,
} from "./setPropertiesForm";
import type { LinkProperty, PropertyField } from "./setPropertiesForm";
import { prefixMenuFor, renderChip, renderPrefixedName } from "./prefixField";
import { linkedRowsText } from "./prefixLinks";
import type { PrefixChange, PrefixPages } from "./prefixLinks";

export interface ListPageContext {
	app: App;
	propertyTypes: Record<string, string>;
	propertySuggestions: () => PropertySuggestion[];
	write: (key: string, value: unknown) => void;
	openPage: (pageId: string) => void;
	change: (change: () => unknown) => void;
	prefixes: PrefixPages;
	prefixChanged: () => void;
	prefixTyped: () => void;
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
	duplicate?: () => void;
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

export function listRow(list: NoteList, context: ListPageContext, duplicate?: () => void): SettingDefinition {
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
			duplicate,
		},
		context,
	);
}

export function propertyRow(
	entry: EditableProperty,
	properties: readonly EditableProperty[],
	context: ListPageContext,
	duplicate?: () => void,
): SettingDefinition {
	const row = (): EditableRow => ({
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
		duplicate,
	});
	const definition = editableRow(row(), context);
	return {
		...definition,
		render: (setting, group) => {
			const current = row();
			setting.setName(current.label);
			setting.setDesc(current.warning ?? "");
			setting.descEl.removeClass("note-compass-warning");
			return editableRow(current, context).render(setting, group);
		},
	};
}

function propertyWarning(
	entry: EditableProperty,
	properties: readonly EditableProperty[],
	context: ListPageContext,
): string | undefined {
	if (isUnreadable(entry.source)) return unreadableListWarning();
	if (isMultiRow(entry)) return undefined;
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
			const prefixKey = row.prefixKey;
			if (context.showPrefixes && prefixKey !== undefined) {
				renderPrefixedName(
					setting.nameEl,
					{
						key: prefixKey,
						prefix: row.prefix ?? "",
						prefixColor: row.prefixColor,
						label: row.label,
						editPrefix: row.broken
							? undefined
							: () => {
									context.prefixes.startEditing(prefixKey);
									context.openPage(row.pageId);
								},
					},
					context,
				);
			}
			if (row.warning) warningDescription(setting.descEl, row.warning);
			setting.addToggle((toggle) =>
				toggle
					.setTooltip(row.enabledTooltip)
					.setValue(row.enabled && !row.broken)
					.setDisabled(row.broken)
					.onChange((enabled) => context.write(row.enabledKey, enabled)),
			);
			if (row.broken) return;
			const duplicate = row.duplicate;
			if (duplicate) {
				setting.addExtraButton((button) => button.setIcon("copy").setTooltip(t("duplicateRow")).onClick(duplicate));
			}
			setting.addExtraButton((button) =>
				button
					.setIcon("pencil")
					.setTooltip(row.editTooltip)
					.onClick(() => context.openPage(row.pageId)),
			);
		},
	};
	return definition;
}

export function propertyPage(
	entry: EditableProperty,
	properties: readonly EditableProperty[],
	context: ExpandingPageContext,
): SettingDefinitionPage {
	const key = (field: PropertyField) => propertyKey(entry.id, field);
	const multiple = isMultiRow(entry);
	const items: SettingDefinitionItem[] = isUnreadable(entry.source)
		? [unreadableItem()]
		: [
				{ name: t("enabled"), desc: t("offerPropertyInPickerDesc"), control: { type: "toggle", key: key("enabled") } },
				{
					type: "group",
					heading: t("label"),
					visible: context.showPrefixes || multiple,
					items: [
						prefixItem(entry, key("prefix"), t("propertyPrefixDesc"), context),
						{
							name: t("rowName"),
							desc: t("rowNameDesc"),
							visible: multiple,
							control: { type: "text", key: key("rowName"), placeholder: rowNamePlaceholder(entry) },
						},
					],
				},
				...(multiple ? multiplePropertiesItems(entry, context) : singlePropertyItems(entry, properties, context)),
			];
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

function modeItem(entry: EditableProperty): SettingGroupItem {
	return {
		name: t("propertyMode"),
		desc: t("propertyModeDesc"),
		control: { type: "dropdown", key: propertyKey(entry.id, "mode"), options: propertyModeOptions() },
	};
}

function multiplePropertiesItems(entry: EditableProperty, context: ExpandingPageContext): SettingDefinitionItem[] {
	return [{ type: "group", heading: t("properties"), items: [modeItem(entry)] }, fixedValuesList(entry, context)];
}

function singlePropertyItems(
	entry: EditableProperty,
	properties: readonly EditableProperty[],
	context: ListPageContext,
): SettingDefinitionItem[] {
	const key = (field: PropertyField) => propertyKey(entry.id, field);
	const chosen = () => entry.property.trim() !== "";
	const mixed = mixedTypeWarning(entry, properties);
	const items: SettingDefinitionItem[] = [
		{
			type: "group",
			heading: t("property"),
			items: [
				modeItem(entry),
				{
					name: t("typeDiffers"),
					desc: mixed,
					searchable: false,
					visible: mixed !== undefined,
					render: (setting) => warningDescription(setting.descEl, mixed ?? ""),
				},
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
			],
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
			...sourceChoices(entry.source, context, (field) => propertySourceKey(entry.id, field), false),
			excludedFoldersList(entry, context),
		);
	}
	return items;
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

export function listPageItems(list: NoteList, context: ListPageContext): SettingDefinitionItem[] {
	const key = (field: ListField) => listKey(list.id, field);
	return [
		{ name: t("enabled"), desc: t("showListInPickerDesc"), control: { type: "toggle", key: key("enabled") } },
		prefixGroup(list, key("prefix"), t("listPrefixDesc"), context),
		{ type: "group", heading: t("offerNotesFrom"), items: sourceItems(list, context, key) },
		...sourceChoices(list.source, context, key, true),
	];
}

function sourceChoices(
	source: ListSource,
	context: ListPageContext,
	key: (field: ListField) => string,
	offersMissingNotes: boolean,
): SettingDefinitionItem[] {
	const hasChoices = source.kind === "currentPeriods" || source.kind === "adjacentDates";
	const list: SettingDefinitionList = {
		type: "list",
		heading: t("notesToList"),
		visible: hasChoices,
		items: sourceChoiceOrder(source).map((choice) => sourceChoiceItem(source, choice, key)),
		onReorder: (from, to) => context.change(() => moveSourceChoice(source, from, to)),
	};
	if (!offersMissingNotes) return [list];
	const missingNotes: SettingDefinitionGroup = {
		type: "group",
		visible: hasChoices,
		items: [{ name: t("showMissingDateNotes"), desc: t("showMissingDateNotesDesc"), control: { type: "toggle", key: key("showsMissing") } }],
	};
	return [missingNotes, list];
}

function sourceChoiceItem(source: ListSource, choice: string, key: (field: ListField) => string): SettingGroupItem {
	if (source.kind === "adjacentDates") {
		const entry = choice as AdjacentEntry;
		return { name: adjacentEntryName(entry), control: { type: "toggle", key: key(adjacentEntryField(entry)) } };
	}
	const period = choice as Period;
	return {
		name: currentPeriodName(period),
		desc: t(CURRENT_PERIOD_DESCRIPTIONS[period]),
		control: { type: "toggle", key: key(CURRENT_PERIOD_FIELDS[period]) },
	};
}

function prefixGroup(
	target: { prefix: string; prefixColor?: string },
	prefixKey: string,
	desc: string,
	context: ListPageContext,
): SettingDefinitionGroup {
	return {
		type: "group",
		heading: t("prefix"),
		visible: context.showPrefixes,
		items: [prefixItem(target, prefixKey, desc, context)],
	};
}

type PrefixEditing = "shared" | "own";

function prefixItem(
	target: { prefix: string; prefixColor?: string },
	prefixKey: string,
	desc: string,
	context: ListPageContext,
): SettingGroupItem {
	const { prefixes } = context;
	return {
		name: t("prefix"),
		desc,
		visible: context.showPrefixes,
		render: (setting) => {
			const win = setting.settingEl.win;
			prefixes.hold(prefixKey);
			setting.settingEl.addClass("note-compass-prefix-setting");
			const focusesInput = prefixes.takeFocus(prefixKey);
			setting.addExtraButton((button) => {
				button
					.setIcon("settings")
					.setTooltip(t("choosePrefix"))
					.onClick(() => {
						const rect = button.extraSettingsEl.getBoundingClientRect();
						menu().showAtPosition({ x: rect.left, y: rect.bottom, width: rect.width }, button.extraSettingsEl.doc);
					});
				button.extraSettingsEl.setAttribute("aria-haspopup", "menu");
			});
			const previewEl = setting.controlEl.createSpan({ cls: "note-compass-prefix-preview-chip" });
			let editing: PrefixEditing = "shared";
			let resetEl: HTMLElement | undefined;
			let textInput: TextComponent | undefined;
			let colourPicker: ColorComponent | undefined;
			const showPreview = () => renderChip(previewEl, target.prefix, target.prefixColor);
			const showReset = () => resetEl?.toggle(target.prefixColor !== undefined);
			const showDesc = () => {
				const linked = prefixes.linkedRows(prefixKey).map((row) => row.label);
				setting.setDesc(editing === "shared" && linked.length > 0 ? `${desc} ${usedByOtherRows(linked)}.` : desc);
			};
			const startNewPrefix = () => {
				editing = "own";
				if (prefixes.startNew(prefixKey)) context.prefixTyped();
				textInput?.setValue(target.prefix);
				colourPicker?.setValue(target.prefixColor ?? NEUTRAL_PREFIX_COLOR);
				showPreview();
				showReset();
				showDesc();
				textInput?.inputEl.focus();
			};
			const edit = (change: PrefixChange) => {
				if (!prefixes.edit(prefixKey, change)) return;
				context.prefixTyped();
				showPreview();
			};
			const menu = () =>
				prefixMenuFor(
					{
						key: prefixKey,
						prefix: target.prefix,
						prefixColor: target.prefixColor,
						label: "",
						newPrefix: target.prefix.trim() === "" ? undefined : startNewPrefix,
					},
					context,
				);
			showPreview();
			setting.addText((text) => {
				textInput = text;
				text.setPlaceholder(t("prefixPlaceholder")).setValue(target.prefix);
				text.onChange((typed) => edit({ prefix: typed }));
				if (focusesInput) text.inputEl.win.setTimeout(() => text.inputEl.focus(), 0);
			});
			setting.addColorPicker((picker) => {
				colourPicker = picker;
				picker.setValue(target.prefixColor ?? NEUTRAL_PREFIX_COLOR).onChange((color) => {
					edit({ color });
					showReset();
				});
				setting.addExtraButton((button) => {
					resetEl = button.extraSettingsEl;
					button
						.setIcon("rotate-ccw")
						.setTooltip(t("removeColour"))
						.onClick(() => {
							edit({ color: "" });
							picker.setValue(NEUTRAL_PREFIX_COLOR);
							showReset();
						});
				});
			});
			const colourInput = setting.controlEl.querySelector<HTMLInputElement>('input[type="color"]');
			colourInput?.setAttribute("aria-label", t("prefixColour"));
			colourInput?.addEventListener("input", () => {
				edit({ color: colourInput.value });
				showReset();
			});
			showReset();
			showDesc();
			return () => {
				prefixes.release(prefixKey);
				win.setTimeout(() => {
					if (prefixes.closeUnheld(prefixKey)) context.prefixChanged();
				}, 0);
			};
		},
	};
}

function usedByOtherRows(labels: readonly string[]): string {
	return tCount("usedByOtherRowsOne", "usedByOtherRowsOther", labels.length, { rows: linkedRowsText(labels) });
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
		{
			name: t("filter"),
			desc: filter && filterRules(filter).length === 0 ? t("filterEmptyDesc") : t("filterDesc"),
			searchable: false,
			visible: () => list.source.kind === "filter",
			render: (setting) => (list.source.kind === "filter" ? renderFilter(setting.settingEl, list.source.filter, context) : undefined),
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
			text.onChange((typed) => {
				if (typed.trim() !== value()) context.write(key, typed);
			});
			suggestProperties(context.app, text.inputEl, suggestions, (suggestion) => {
				context.write(key, suggestion.name);
				picked?.(suggestion);
			});
		});
	};
}
