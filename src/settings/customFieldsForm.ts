import { t } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import { newForm } from "../forms/form.ts";
import type { CustomField, Form } from "../forms/form.ts";
import { FIELD_PRESETS } from "../forms/presets.ts";
import type { FieldPreset } from "../forms/presets.ts";
import { fieldBadges, fieldRowName, fieldWarning, readFieldSetting, writeFieldSetting } from "./formsForm.ts";
import type { FieldSetting } from "./formsForm.ts";

export type CustomFieldSetting = FieldSetting | "name";

export const CUSTOM_FIELDS_LIST_ID = "customFields";

export type FieldPickerGroup = "custom" | "builtIn";

export type FieldPickerEntry =
	| { kind: "template"; group: "custom"; template: CustomField; label: string; detail: string }
	| { kind: "preset"; group: "builtIn"; preset: FieldPreset; label: string }
	| { kind: "block"; group: "builtIn"; label: string };

export interface FieldPickerOptions {
	offersBlock: boolean;
}

const PRESET_KEYS: Record<FieldPreset, TranslationKey> = {
	blank: "fieldPresetBlank",
	date: "fieldPresetDate",
	time: "fieldPresetTime",
	timestamp: "fieldPresetTimestamp",
	isoTimestamp: "fieldPresetIsoTimestamp",
	entryDate: "fieldPresetEntryDate",
	entryTime: "fieldPresetEntryTime",
};

const GROUP_KEYS: Record<FieldPickerGroup, TranslationKey> = {
	custom: "fieldPickerCustom",
	builtIn: "fieldPickerBuiltIn",
};

export function presetLabel(preset: FieldPreset): string {
	return t(PRESET_KEYS[preset]);
}

export function fieldPickerGroupLabel(group: FieldPickerGroup): string {
	return t(GROUP_KEYS[group]);
}

export function customFieldLabel(template: CustomField): string {
	return template.name.trim() || fieldRowName(template);
}

export function customFieldDetail(template: CustomField): string {
	const parts = template.name.trim() !== "" && template.key.trim() !== "" ? [template.key.trim()] : [];
	return [...parts, ...fieldBadges(template).map((badge) => badge.text)].join(" · ");
}

export function templateForm(template: CustomField): Form {
	return { ...newForm([]), id: `template-${template.id}`, fields: [template] };
}

export function customFieldWarning(template: CustomField): string | undefined {
	if (template.unreadable) return t("unreadableCustomFieldWarning");
	return fieldWarning(templateForm(template), template);
}

export function findCustomField(customFields: readonly CustomField[], id: string): CustomField | undefined {
	return customFields.find((template) => template.id === id);
}

export function readCustomFieldSetting(template: CustomField, setting: CustomFieldSetting, index?: number): unknown {
	if (setting === "name") return template.name;
	return readFieldSetting(template, setting, index);
}

export function writeCustomFieldSetting(template: CustomField, setting: CustomFieldSetting, value: unknown, index?: number): boolean {
	if (template.unreadable) return false;
	if (setting === "name") {
		template.name = typeof value === "string" ? value : "";
		return true;
	}
	return writeFieldSetting(template, setting, value, index);
}

export function fieldPickerEntries(customFields: readonly CustomField[], options: FieldPickerOptions): FieldPickerEntry[] {
	const entries: FieldPickerEntry[] = [];
	for (const template of customFields) {
		if (template.unreadable) continue;
		entries.push({ kind: "template", group: "custom", template, label: customFieldLabel(template), detail: customFieldDetail(template) });
	}
	for (const preset of FIELD_PRESETS) entries.push({ kind: "preset", group: "builtIn", preset, label: presetLabel(preset) });
	if (options.offersBlock) entries.push({ kind: "block", group: "builtIn", label: t("formBlock") });
	return entries;
}

export function matchingFieldPickerEntries(entries: readonly FieldPickerEntry[], query: string): FieldPickerEntry[] {
	const typed = query.trim().toLowerCase();
	if (typed === "") return [...entries];
	return entries.filter((entry) => entry.label.toLowerCase().includes(typed) || (entry.kind === "template" && entry.detail.toLowerCase().includes(typed)));
}

export function startsGroup(entries: readonly FieldPickerEntry[], entry: FieldPickerEntry): boolean {
	const index = entries.indexOf(entry);
	return index === 0 || (index > 0 && entries[index - 1].group !== entry.group);
}
