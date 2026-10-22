import type { PropertyType } from "../lists/conditions.ts";
import { EDITABLE_PROPERTY_TYPES, isLinkType, newListId } from "../settings.ts";
import type { EditableProperty, EditablePropertyType, ListSource, NoteList } from "../settings.ts";
import { mixedTypeProperties } from "../setProperties/propertyTypes.ts";
import { readListField, writeListField } from "./listForm.ts";
import type { ListField } from "./listForm.ts";

export type PropertyField = "enabled" | "prefix" | "name" | "type" | LinkPropertyField;

type LinkPropertyField = "excludedFolders" | "createsNotes" | "newNoteFolder" | "newNoteTemplate";

export type LinkProperty = EditableProperty & NoteList;

const TYPE_NAMES: Record<EditablePropertyType, string> = {
	checkbox: "checkbox",
	text: "text",
	number: "number",
	date: "date",
	datetime: "datetime",
	link: "link, one note",
	links: "links, several notes",
};

export const PROPERTY_TYPE_OPTIONS = EDITABLE_PROPERTY_TYPES.reduce<Record<string, string>>(
	(options, type) => ({ ...options, [type]: TYPE_NAMES[type] }),
	{},
);

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
	if (entry.property.trim() === "") return "New property";
	return `${entry.prefix} ${entry.property} · ${entry.type}`.trim();
}

export function newProperty(properties: readonly EditableProperty[]): EditableProperty {
	return { id: newListId(properties), enabled: false, prefix: "", property: "", type: "checkbox" };
}

export function mixedTypeWarning(entry: EditableProperty, properties: readonly EditableProperty[]): string | undefined {
	if (entry.property.trim() === "" || !mixedTypeProperties(properties).includes(entry.property)) return undefined;
	return `Another entry writes ${entry.property} as a different type. The first enabled one decides.`;
}

export function hasSource(entry: EditableProperty): entry is LinkProperty {
	return entry.source !== undefined;
}

export function readPropertyField(entry: EditableProperty, field: PropertyField, index?: string): unknown {
	if (field === "excludedFolders") return entry.excludedFolders?.[Number(index)];
	if (field === "enabled") return entry.enabled;
	if (field === "prefix") return entry.prefix;
	if (field === "name") return entry.property;
	if (field === "type") return entry.type;
	return entry[field];
}

export function writePropertyField(entry: EditableProperty, field: PropertyField, value: unknown, index?: string): boolean {
	const text = typeof value === "string" ? value : "";
	if (field === "excludedFolders") return writeExcludedFolder(entry, Number(index), text);
	if (field === "enabled") entry.enabled = value === true;
	else if (field === "createsNotes") entry.createsNotes = value === true;
	else if (field === "prefix") entry.prefix = text;
	else if (field === "name") entry.property = text.trim();
	else if (field === "type") writeType(entry, EDITABLE_PROPERTY_TYPES.find((type) => type === value) ?? entry.type);
	else entry[field] = text.trim();
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
		entry.createsNotes = entry.createsNotes ?? false;
		return;
	}
	delete entry.source;
	delete entry.excludedFolders;
	delete entry.createsNotes;
	delete entry.newNoteFolder;
	delete entry.newNoteTemplate;
}

function defaultLinkSource(): ListSource {
	return { kind: "modifiedToday" };
}
