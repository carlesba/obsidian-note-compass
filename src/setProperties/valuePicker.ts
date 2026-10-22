import type { JumpListVault, PropertyValueCount } from "../lists/vault";
import { matchesInOrder, rowLabel } from "../render.ts";
import type { RowParts } from "../render";
import type { EditablePropertyType } from "../settings";
import { isUnset, parseDate, parseDateTime, parseNumber, sameValue } from "./values.ts";

export type ScalarPropertyType = Extract<EditablePropertyType, "checkbox" | "number" | "date" | "datetime">;

export interface ValuePicker {
	type: ScalarPropertyType;
	counts: PropertyValueCount[];
	now: number;
}

export interface ValueChoice {
	label: string;
	parts: RowParts;
	value: unknown;
	typed: boolean;
}

export const CLEAR_LABEL = "🗑️ Clear";

const SELECTED_MARK = "✓";

export function isScalarType(type: EditablePropertyType): type is ScalarPropertyType {
	return type === "checkbox" || type === "number" || type === "date" || type === "datetime";
}

export function valuePicker(vault: JumpListVault, property: string, type: ScalarPropertyType): ValuePicker {
	return {
		type,
		counts: type === "number" ? vault.propertyValueCounts(property) : [],
		now: vault.now(),
	};
}

export function valueChoices(picker: ValuePicker, pending: unknown, query: string): ValueChoice[] {
	const choices = typeChoices(picker, pending, query);
	if (!query) return choices;
	return choices.filter((choice) => choice.typed || matchesInOrder(query, choice.label));
}

function typeChoices(picker: ValuePicker, pending: unknown, query: string): ValueChoice[] {
	const clear = choice(CLEAR_LABEL, undefined, isUnset(pending));
	const offer = (label: string, value: unknown, detail?: string) => choice(label, value, sameValue(value, pending), detail);
	switch (picker.type) {
		case "checkbox":
			return [offer("true", true), offer("false", false), clear];
		case "number":
			return [...useChoice(parseNumber(query), pending), ...vaultNumbers(picker, pending), clear];
		case "date":
			return [
				...useChoice(parseDate(query), pending),
				...datePresets(picker.now).map(([name, date]) => offer(name, date, date)),
				clear,
			];
		case "datetime": {
			const now = `${localDate(picker.now)}T${localTime(picker.now)}`;
			return [...useChoice(parseDateTime(query), pending), offer("Now", now, now), clear];
		}
	}
}

function choice(content: string, value: unknown, selected: boolean, detail?: string): ValueChoice {
	const parts: RowParts = { mark: selected ? SELECTED_MARK : "", content };
	if (detail !== undefined) parts.value = detail;
	return { label: rowLabel(parts), parts, value, typed: false };
}

function useChoice(value: string | number | undefined, pending: unknown): ValueChoice[] {
	if (value === undefined) return [];
	return [{ ...choice(`✏️ Use "${value}"`, value, sameValue(value, pending)), typed: true }];
}

function vaultNumbers(picker: ValuePicker, pending: unknown): ValueChoice[] {
	return picker.counts
		.filter((count) => typeof count.value === "number")
		.sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)))
		.map((count) => choice(String(count.value), count.value, sameValue(count.value, pending), `×${count.count}`));
}

function datePresets(now: number): [string, string][] {
	const weekday = new Date(now).getDay();
	const untilMonday = (8 - weekday) % 7 || 7;
	return [
		["Today", localDate(now)],
		["Tomorrow", localDate(now, 1)],
		["Next Monday", localDate(now, untilMonday)],
		["In a week", localDate(now, 7)],
	];
}

function localDate(time: number, days = 0): string {
	const date = new Date(time);
	date.setDate(date.getDate() + days);
	return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
}

function localTime(time: number): string {
	const date = new Date(time);
	return `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

function twoDigits(value: number): string {
	return String(value).padStart(2, "0");
}
