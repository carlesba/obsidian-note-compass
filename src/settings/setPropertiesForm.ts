import { LINK_LIST_MODES } from "../settings.ts";
import type { LegacySetPropertiesSettings, LinkList, LinkListMode } from "../settings.ts";
import { newList, readListField, sourceSummary, writeListField } from "./listForm.ts";
import type { ListField, PropertySuggestion } from "./listForm.ts";

export type LinkListField = ListField | "name" | "writesTo" | "mode";

const MODE_NAMES: Record<LinkListMode, string> = { multi: "Multi", single: "Single" };

export const LINK_LIST_MODE_OPTIONS = LINK_LIST_MODES.reduce<Record<string, string>>(
	(options, mode) => ({ ...options, [mode]: MODE_NAMES[mode] }),
	{},
);

export function newLinkList(lists: readonly LinkList[]): LinkList {
	return { ...newList(lists), name: "", property: "", mode: "multi" };
}

export function linkListName(list: LinkList): string {
	const name = list.name.trim() === "" ? sourceSummary(list.source) : list.name.trim();
	const property = list.property === "" ? "no property" : list.property;
	return `${list.prefix} ${name} → ${property} · ${list.mode}`.trim();
}

export function checkboxSuggestions(suggestions: readonly PropertySuggestion[]): PropertySuggestion[] {
	return suggestions.filter((suggestion) => suggestion.type === "checkbox");
}

export function readSetPropertiesField(settings: LegacySetPropertiesSettings, field: string | undefined): unknown {
	if (field === "flagsPrefix") return settings.flagsPrefix;
	if (field === "templatesFolder") return settings.templatesFolder;
	return undefined;
}

export function writeSetPropertiesField(settings: LegacySetPropertiesSettings, field: string | undefined, value: unknown): boolean {
	const text = typeof value === "string" ? value : "";
	if (field === "flagsPrefix") settings.flagsPrefix = text;
	else if (field === "templatesFolder") settings.templatesFolder = text.trim();
	else return false;
	return true;
}

export function writeFlag(settings: LegacySetPropertiesSettings, index: number, value: unknown): boolean {
	if (!Number.isInteger(index) || index < 0 || index >= settings.flags.length) return false;
	settings.flags[index] = typeof value === "string" ? value.trim() : "";
	return true;
}

export function readLinkListField(list: LinkList, field: LinkListField): unknown {
	if (field === "name") return list.name;
	if (field === "writesTo") return list.property;
	if (field === "mode") return list.mode;
	return readListField(list, field);
}

export function writeLinkListField(list: LinkList, field: LinkListField, value: unknown): void {
	if (field === "name") list.name = typeof value === "string" ? value : "";
	else if (field === "writesTo") list.property = typeof value === "string" ? value.trim() : "";
	else if (field === "mode") list.mode = LINK_LIST_MODES.find((mode) => mode === value) ?? list.mode;
	else writeListField(list, field, value);
}
