import { t } from "../i18n/index.ts";
import type { JumpListVault, PropertyValueCount } from "../lists/vault";
import { matchesInOrder, rowLabel } from "../render.ts";
import type { RowParts } from "../render";
import type { EditablePropertyType } from "../settings";
import { isUnset, parseDate, parseDateTime, parseNumber, sameValue } from "./values.ts";

export type ScalarPropertyType = Extract<EditablePropertyType, "checkbox" | "text" | "number" | "date" | "datetime">;

export interface ValuePicker {
	type: ScalarPropertyType;
	counts: PropertyValueCount[];
	presets: (string | number)[];
	now: number;
}

export interface ValueChoice {
	label: string;
	parts: RowParts;
	value: unknown;
	typed: boolean;
}

const CLEAR_MARK = "🗑️";
const USE_MARK = "✏️";
const SELECTED_MARK = "✓";

export function clearLabel(): string {
	return rowLabel({ mark: CLEAR_MARK, content: t("clear") });
}

export function isScalarType(type: EditablePropertyType): type is ScalarPropertyType {
	return type === "checkbox" || type === "text" || type === "number" || type === "date" || type === "datetime";
}

export function valuePicker(
	vault: JumpListVault,
	property: string,
	type: ScalarPropertyType,
	presetValues: readonly string[] = [],
): ValuePicker {
	const presets: (string | number)[] =
		type === "number"
			? presetValues.map(parseNumber).filter((value): value is number => value !== undefined)
			: type === "text"
				? presetValues.map((value) => value.trim()).filter((value) => value !== "")
				: [];
	return {
		type,
		counts: type === "number" || type === "text" ? vault.propertyValueCounts(property) : [],
		presets: [...new Set(presets)],
		now: vault.now(),
	};
}

export function valueChoices(picker: ValuePicker, pending: unknown, query: string): ValueChoice[] {
	const choices = typeChoices(picker, pending, query);
	if (!query) return choices;
	return choices.filter((choice) => choice.typed || matchesInOrder(query, choice.label));
}

function typeChoices(picker: ValuePicker, pending: unknown, query: string): ValueChoice[] {
	const clear = choice(t("clear"), undefined, isUnset(pending), undefined, CLEAR_MARK);
	const offer = (label: string, value: unknown, detail?: string) => choice(label, value, sameValue(value, pending), detail);
	switch (picker.type) {
		case "checkbox":
			return [offer("true", true), offer("false", false), clear];
		case "number":
			return [
				...useChoice(parseNumber(query), pending),
				...picker.presets.map((value) => offer(String(value), value)),
				...vaultValues(picker, pending, "number"),
				clear,
			];
		case "text": {
			const typed = query.trim();
			const known = [...picker.presets, ...picker.counts.map((count) => count.value)];
			const use = typed !== "" && !known.some((value) => sameValue(value, typed)) ? useChoice(typed, pending) : [];
			return [...use, ...picker.presets.map((value) => offer(String(value), value)), ...vaultValues(picker, pending, "string"), clear];
		}
		case "date":
			return [
				...useChoice(parseDate(query), pending),
				...datePresets(picker.now).map(([name, date]) => offer(name, date, date)),
				clear,
			];
		case "datetime": {
			const now = `${localDate(picker.now)}T${localTime(picker.now)}`;
			return [...useChoice(parseDateTime(query), pending), offer(t("now"), now, now), clear];
		}
	}
}

function choice(content: string, value: unknown, selected: boolean, detail?: string, mark = ""): ValueChoice {
	const parts: RowParts = { mark: selected ? SELECTED_MARK : mark, content };
	if (detail !== undefined) parts.value = detail;
	return { label: rowLabel(parts), parts, value, typed: false };
}

function useChoice(value: string | number | undefined, pending: unknown): ValueChoice[] {
	if (value === undefined) return [];
	return [{ ...choice(t("useValue", { value }), value, sameValue(value, pending), undefined, USE_MARK), typed: true }];
}

function vaultValues(picker: ValuePicker, pending: unknown, kind: "number" | "string"): ValueChoice[] {
	return picker.counts
		.filter((count) => typeof count.value === kind && !picker.presets.some((preset) => preset === count.value))
		.sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)))
		.map((count) => choice(String(count.value), count.value, sameValue(count.value, pending), `×${count.count}`));
}

export function datePresets(now: number): [string, string][] {
	const weekday = new Date(now).getDay();
	const untilMonday = (8 - weekday) % 7 || 7;
	return [
		[t("today"), localDate(now)],
		[t("tomorrow"), localDate(now, 1)],
		[t("nextMonday"), localDate(now, untilMonday)],
		[t("inAWeek"), localDate(now, 7)],
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
