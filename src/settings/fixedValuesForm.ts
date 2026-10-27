import { t, translatedLabels } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import type { EditableProperty } from "../settings.ts";
import { FIXED_VALUE_TYPES, newFixedValueId, relativeDateOf } from "../setProperties/fixedValues.ts";
import type { FixedValue, FixedValueType } from "../setProperties/fixedValues.ts";
import { fixedValueText, linkedNote } from "../setProperties/multiValues.ts";
import { parseDate, parseDateTime, parseNumber } from "../setProperties/values.ts";
import { propertyTypeOptions } from "./setPropertiesForm.ts";

export type FixedValueSetting = "property" | "type" | "value" | "relative";

export type DateChoice = "relative" | "fixed";

const RELATIVE = "relative";

const FIXED = "fixed";

const FIXED_DATE_KEYS: Record<"date" | "datetime", Record<DateChoice, TranslationKey>> = {
	date: { relative: "today", fixed: "fixedDate" },
	datetime: { relative: "now", fixed: "fixedDateTime" },
};

export const FIXED_VALUE_PLACEHOLDERS: Record<"date" | "datetime", string> = {
	date: "YYYY-MM-DD",
	datetime: "YYYY-MM-DD HH:mm",
};

export function fixedValueTypeOptions(): Record<FixedValueType, string> {
	return { ...propertyTypeOptions(), clear: t("typeOptionClear") } as Record<FixedValueType, string>;
}

export function dateChoiceOptions(type: "date" | "datetime"): Record<DateChoice, string> {
	return translatedLabels(FIXED_DATE_KEYS[type]);
}

export function fixedValueTitle(fixed: FixedValue): { property: string; value: string } {
	return { property: fixed.property.trim() || t("newProperty"), value: fixedValueText(fixed) };
}

export function findFixedValue(entry: EditableProperty, id: string): FixedValue | undefined {
	return entry.fixedValues?.find((fixed) => fixed.id === id);
}

export function addFixedValue(entry: EditableProperty): FixedValue {
	const values = entry.fixedValues ?? [];
	const fixed: FixedValue = { id: newFixedValueId(values), property: "", type: "text" };
	entry.fixedValues = [...values, fixed];
	return fixed;
}

export function deleteFixedValue(entry: EditableProperty, index: number): FixedValue | undefined {
	return entry.fixedValues?.splice(index, 1)[0];
}

export function moveFixedValue(entry: EditableProperty, from: number, to: number): void {
	const values = entry.fixedValues;
	if (values) values.splice(to, 0, ...values.splice(from, 1));
}

export function readFixedValueSetting(fixed: FixedValue, setting: FixedValueSetting): unknown {
	if (setting === "property") return fixed.property;
	if (setting === "type") return fixed.type;
	if (setting === "relative") return fixed.relative === undefined ? FIXED : RELATIVE;
	if (fixed.type === "checkbox") return fixed.value === true;
	return fixed.value === undefined ? "" : String(fixed.value);
}

export function writeFixedValueSetting(fixed: FixedValue, setting: FixedValueSetting, value: unknown): boolean {
	const text = typeof value === "string" ? value : "";
	if (setting === "property") {
		fixed.property = text.trim();
		return true;
	}
	if (setting === "type") {
		const type = FIXED_VALUE_TYPES.find((candidate) => candidate === value);
		if (!type) return false;
		if (type !== fixed.type) writeFixedType(fixed, type);
		return true;
	}
	if (setting === "relative") {
		const relative = relativeDateOf(fixed.type);
		if (relative === undefined) return false;
		if (value === RELATIVE) fixed.relative = relative;
		else delete fixed.relative;
		return true;
	}
	return writeFixedValue(fixed, value, text);
}

export function fixedValueError(type: FixedValueType, typed: string): string | undefined {
	if (typed.trim() === "") return undefined;
	if (type === "number" && parseNumber(typed) === undefined) return t("presetNumberError");
	if (type === "date" && parseDate(typed) === undefined) return t("fixedDateFormat");
	if (type === "datetime" && parseDateTime(typed) === undefined) return t("fixedDateTimeFormat");
	return undefined;
}

function writeFixedType(fixed: FixedValue, type: FixedValueType): void {
	fixed.type = type;
	delete fixed.value;
	delete fixed.relative;
	if (type === "checkbox") fixed.value = true;
	const relative = relativeDateOf(type);
	if (relative !== undefined) fixed.relative = relative;
}

function writeFixedValue(fixed: FixedValue, value: unknown, text: string): boolean {
	if (fixed.type === "clear") return false;
	if (fixed.type === "checkbox") {
		fixed.value = value === true;
		return true;
	}
	if (fixedValueError(fixed.type, text) !== undefined) return false;
	const stored = storedText(fixed.type, text);
	if (stored === undefined || stored === "") delete fixed.value;
	else fixed.value = stored;
	return true;
}

function storedText(type: FixedValueType, text: string): string | number | undefined {
	if (text.trim() === "") return undefined;
	if (type === "number") return parseNumber(text);
	if (type === "date") return parseDate(text);
	if (type === "datetime") return parseDateTime(text);
	if (type === "link" || type === "links") return linkedNote(text);
	return text;
}
