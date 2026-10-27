import { t, translatedLabels } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import { typeLabel } from "../i18n/labels.ts";
import type { PropertyType } from "../lists/conditions.ts";
import { EDITABLE_PROPERTY_TYPES, isLinkType, newListId, writePrefixColor } from "../settings.ts";
import type { CheckboxMode, EditableProperty, EditablePropertyType, ListSource, NoteList } from "../settings.ts";
import { mixedTypeProperties } from "../setProperties/propertyTypes.ts";
import { parseNumber } from "../setProperties/values.ts";
import { readListField, writeListField } from "./listForm.ts";
import type { ListField } from "./listForm.ts";

export type PropertyField =
	| "enabled"
	| "prefix"
	| "prefixColor"
	| "name"
	| "type"
	| "presetValues"
	| "mainMenuPreset"
	| "removesEmpty"
	| LinkPropertyField;

const CHECKBOX_MODE_KEYS: Record<CheckboxMode, TranslationKey> = {
	picker: "checkboxModePicker",
	toggle: "checkboxModeToggle",
	cycle: "checkboxModeCycle",
};

export function checkboxModeOptions(): Record<CheckboxMode, string> {
	return translatedLabels(CHECKBOX_MODE_KEYS);
}

type LinkPropertyField = "excludedFolders";

export type LinkProperty = EditableProperty & NoteList;

const TYPE_OPTION_KEYS: Record<EditablePropertyType, TranslationKey> = {
	checkbox: "typeCheckbox",
	text: "typeText",
	number: "typeNumber",
	date: "typeDate",
	datetime: "typeDatetime",
	link: "typeOptionLink",
	links: "typeOptionLinks",
};

export function propertyTypeOptions(): Record<string, string> {
	return EDITABLE_PROPERTY_TYPES.reduce<Record<string, string>>(
		(options, type) => ({ ...options, [type]: t(TYPE_OPTION_KEYS[type]) }),
		{},
	);
}

const PRESETS: Partial<Record<PropertyType, EditablePropertyType>> = {
	checkbox: "checkbox",
	number: "number",
	date: "date",
	datetime: "datetime",
	multitext: "links",
	tags: "links",
};

export function propertyTypePreset(vaultType: PropertyType): EditablePropertyType {
	return PRESETS[vaultType] ?? "text";
}

export function propertyRowName(entry: EditableProperty): string {
	if (entry.property.trim() === "") return t("newProperty");
	return `${entry.prefix} ${propertyLabel(entry)}`.trim();
}

export function propertyLabel(entry: EditableProperty): string {
	if (entry.property.trim() === "") return t("newProperty");
	return `${entry.property} · ${typeLabel(entry.type)}`;
}

export function newProperty(properties: readonly EditableProperty[]): EditableProperty {
	return { id: newListId(properties), enabled: true, prefix: "", property: "", type: "checkbox" };
}

export function mixedTypeWarning(entry: EditableProperty, properties: readonly EditableProperty[]): string | undefined {
	if (entry.property.trim() === "" || !mixedTypeProperties(properties).includes(entry.property)) return undefined;
	return t("mixedTypeWarning", { property: entry.property });
}

export function hasSource(entry: EditableProperty): entry is LinkProperty {
	return entry.source !== undefined;
}

export function readPropertyField(entry: EditableProperty, field: PropertyField, index?: string): unknown {
	if (field === "excludedFolders") return entry.excludedFolders?.[Number(index)];
	if (field === "presetValues") return entry.presetValues?.[Number(index)];
	if (field === "mainMenuPreset") return isMainMenuPreset(entry, Number(index));
	if (field === "removesEmpty") return entry.keepsEmpty !== true;
	if (field === "enabled") return entry.enabled;
	if (field === "prefix") return entry.prefix;
	if (field === "prefixColor") return entry.prefixColor ?? "";
	if (field === "name") return entry.property;
	if (field === "type") return entry.type;
	return entry[field];
}

export function writePropertyField(entry: EditableProperty, field: PropertyField, value: unknown, index?: string): boolean {
	const text = typeof value === "string" ? value : "";
	if (field === "excludedFolders") return writeExcludedFolder(entry, Number(index), text);
	if (field === "presetValues") return writePresetValue(entry, Number(index), text);
	if (field === "mainMenuPreset") return writeMainMenuPreset(entry, Number(index), value === true);
	if (field === "removesEmpty") writeFlag(entry, "keepsEmpty", value !== true);
	else if (field === "enabled") entry.enabled = value === true;
	else if (field === "prefix") entry.prefix = text;
	else if (field === "prefixColor") writePrefixColor(entry, value);
	else if (field === "name") entry.property = text.trim();
	else if (field === "type") writeType(entry, EDITABLE_PROPERTY_TYPES.find((type) => type === value) ?? entry.type);
	return true;
}

export function addExcludedFolder(entry: EditableProperty): void {
	entry.excludedFolders = [...(entry.excludedFolders ?? []), ""];
}

export function deleteExcludedFolder(entry: EditableProperty, index: number): void {
	entry.excludedFolders?.splice(index, 1);
}

function writeExcludedFolder(entry: EditableProperty, index: number, folder: string): boolean {
	const folders = entry.excludedFolders;
	if (!folders || !Number.isInteger(index) || index < 0 || index >= folders.length) return false;
	folders[index] = folder.trim();
	return true;
}

function writeFlag(entry: EditableProperty, flag: "keepsEmpty", on: boolean): void {
	if (on) entry[flag] = true;
	else delete entry[flag];
}

export function isMainMenuPreset(entry: EditableProperty, index: number): boolean {
	const value = entry.presetValues?.[index];
	return value !== undefined && value !== "" && (entry.mainMenuPresets ?? []).includes(value);
}

function writeMainMenuPreset(entry: EditableProperty, index: number, shown: boolean): boolean {
	const value = entry.presetValues?.[index];
	if (value === undefined) return false;
	const others = (entry.mainMenuPresets ?? []).filter((preset) => preset !== value);
	setMainMenuPresets(entry, shown && value !== "" ? [...others, value] : others);
	return true;
}

function setMainMenuPresets(entry: EditableProperty, values: string[]): void {
	const ordered = (entry.presetValues ?? []).filter((value, index, all) => values.includes(value) && all.indexOf(value) === index);
	if (ordered.length > 0) entry.mainMenuPresets = ordered;
	else delete entry.mainMenuPresets;
}

export function addPresetValue(entry: EditableProperty): void {
	entry.presetValues = [...(entry.presetValues ?? []), ""];
}

export function deletePresetValue(entry: EditableProperty, index: number): void {
	const [removed] = entry.presetValues?.splice(index, 1) ?? [];
	if (entry.presetValues?.length === 0) delete entry.presetValues;
	setMainMenuPresets(entry, (entry.mainMenuPresets ?? []).filter((value) => value !== removed || entry.presetValues?.includes(value)));
}

export function movePresetValue(entry: EditableProperty, from: number, to: number): void {
	const values = entry.presetValues;
	if (values) values.splice(to, 0, ...values.splice(from, 1));
	setMainMenuPresets(entry, entry.mainMenuPresets ?? []);
}

export function presetValueError(entry: EditableProperty, value: string): string | undefined {
	if (entry.type !== "number" || value.trim() === "" || parseNumber(value) !== undefined) return undefined;
	return t("presetNumberError");
}

function writePresetValue(entry: EditableProperty, index: number, value: string): boolean {
	const values = entry.presetValues;
	if (!values || !Number.isInteger(index) || index < 0 || index >= values.length) return false;
	const previous = values[index];
	const shown = (entry.mainMenuPresets ?? []).includes(previous);
	values[index] = value.trim();
	if (shown) setMainMenuPresets(entry, [...(entry.mainMenuPresets ?? []).filter((preset) => preset !== previous), values[index]]);
	return true;
}

export function readPropertySourceField(entry: EditableProperty, field: ListField): unknown {
	return hasSource(entry) ? readListField(entry, field) : undefined;
}

export function writePropertySourceField(entry: EditableProperty, field: ListField, value: unknown): boolean {
	if (!hasSource(entry)) return false;
	writeListField(entry, field, value);
	return true;
}

function writeType(entry: EditableProperty, type: EditablePropertyType): void {
	entry.type = type;
	if (isLinkType(type)) {
		entry.source = entry.source ?? defaultLinkSource();
		entry.excludedFolders = entry.excludedFolders ?? [];
		return;
	}
	delete entry.source;
	delete entry.excludedFolders;
}

function defaultLinkSource(): ListSource {
	return { kind: "modifiedToday" };
}
