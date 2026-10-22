import type { PropertyType } from "../lists/conditions.ts";
import { EDITABLE_PROPERTY_TYPES, isLinkType, newListId } from "../settings.ts";
import type { EditableProperty, EditablePropertyType, ListSource, NoteList } from "../settings.ts";
import { mixedTypeProperties } from "../setProperties/propertyTypes.ts";
import { readListField, writeListField } from "./listForm.ts";
import type { ListField } from "./listForm.ts";

export type PropertyField = "enabled" | "prefix" | "name" | "type" | "excludedFolder";

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

export function readPropertyField(entry: EditableProperty, field: PropertyField): unknown {
	if (field === "enabled") return entry.enabled;
	if (field === "prefix") return entry.prefix;
	if (field === "name") return entry.property;
	if (field === "type") return entry.type;
	return entry.excludedFolder;
}

export function writePropertyField(entry: EditableProperty, field: PropertyField, value: unknown): void {
	const text = typeof value === "string" ? value : "";
	if (field === "enabled") entry.enabled = value === true;
	else if (field === "prefix") entry.prefix = text;
	else if (field === "name") entry.property = text.trim();
	else if (field === "excludedFolder") entry.excludedFolder = text.trim();
	else writeType(entry, EDITABLE_PROPERTY_TYPES.find((type) => type === value) ?? entry.type);
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
		entry.excludedFolder = entry.excludedFolder ?? "";
		return;
	}
	delete entry.source;
	delete entry.excludedFolder;
}

function defaultLinkSource(): ListSource {
	return { kind: "modifiedToday" };
}
