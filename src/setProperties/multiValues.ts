import { t } from "../i18n/index.ts";
import type { ContentSegment } from "../render";
import { isMultiRow, isUnreadable } from "../settings.ts";
import type { EditableProperty, SetPropertiesSettings } from "../settings";
import { isUsableFixedValue } from "./fixedValues.ts";
import type { FixedValue, FixedValueType } from "./fixedValues";
import { isPicked, wikiLink } from "./links.ts";
import type { PickableNote } from "./links";
import type { PropertyState } from "./picker";
import { currentDate, currentDateTime } from "./valuePicker.ts";
import { asList, isUnset, sameValue, truncated } from "./values.ts";

export interface AppliedValue {
	property: string;
	type: FixedValueType;
	value: unknown;
	note?: PickableNote;
}

export interface MultiRow {
	entry: EditableProperty;
	values: AppliedValue[];
}

const CHECKED_MARK = "✓";
const UNCHECKED_MARK = "✗";

export function multiRows(settings: SetPropertiesSettings, now: number): MultiRow[] {
	return settings.properties
		.filter((entry) => entry.enabled && isMultiRow(entry) && !isUnreadable(entry.source))
		.map((entry) => ({ entry, values: usableFixedValues(entry).map((fixed) => appliedValue(fixed, now)) }))
		.filter((row) => row.values.length > 0);
}

export function multiRowProperties(settings: SetPropertiesSettings): string[] {
	return [...new Set(multiRows(settings, 0).flatMap((row) => row.values.map((applied) => applied.property)))];
}

export function rowHolds(row: MultiRow, values: PropertyState): boolean {
	return row.values.every((applied) => valueHolds(applied, values.get(applied.property)));
}

export function withRowApplied(row: MultiRow, values: PropertyState): PropertyState {
	const next = new Map(values);
	for (const applied of row.values) {
		const pending = next.get(applied.property);
		if (applied.note && isPicked(applied.note, pending)) continue;
		next.set(applied.property, applied.type === "links" ? [...asList(pending), applied.value] : applied.value);
	}
	return next;
}

export function multiRowName(entry: EditableProperty): string {
	return entry.name?.trim() || fixedValuesSummary(entry);
}

export function fixedValuesSummary(entry: EditableProperty): string {
	const parts = namedFixedValues(entry).map((fixed) => `${fixed.property} ${fixedValueText(fixed)}`);
	return truncated(parts.join(", "));
}

export function multiRowSegments(entry: EditableProperty): ContentSegment[] | undefined {
	if (entry.name?.trim()) return undefined;
	return namedFixedValues(entry).flatMap((fixed, index) => [
		...(index > 0 ? [{ text: ", " }] : []),
		{ text: fixed.property },
		{ text: ` ${fixedValueText(fixed)}`, muted: true },
	]);
}

function namedFixedValues(entry: EditableProperty): FixedValue[] {
	return (entry.fixedValues ?? []).filter((fixed) => fixed.property.trim() !== "");
}

export function fixedValueText(fixed: FixedValue): string {
	if (fixed.type === "clear") return t("clearedValue");
	if (fixed.relative === "today") return t("today");
	if (fixed.relative === "now") return t("now");
	if (fixed.value === undefined || fixed.value === "") return "—";
	if (fixed.type === "checkbox") return fixed.value === true ? CHECKED_MARK : UNCHECKED_MARK;
	if (fixed.type === "link" || fixed.type === "links") return noteName(String(fixed.value));
	return String(fixed.value);
}

export function linkedNote(value: string): string {
	return value.trim().replace(/^\[\[/, "").replace(/\]\]$/, "").trim();
}

function usableFixedValues(entry: EditableProperty): FixedValue[] {
	return (entry.fixedValues ?? []).filter(isUsableFixedValue);
}

function appliedValue(fixed: FixedValue, now: number): AppliedValue {
	const property = fixed.property.trim();
	const { type } = fixed;
	if (type === "clear") return { property, type, value: undefined };
	if (fixed.relative === "today") return { property, type, value: currentDate(now) };
	if (fixed.relative === "now") return { property, type, value: currentDateTime(now) };
	if (type === "link" || type === "links") {
		const note = linkedNote(String(fixed.value));
		return { property, type, value: wikiLink(note), note: pickableNote(note) };
	}
	return { property, type, value: fixed.value };
}

function valueHolds(applied: AppliedValue, pending: unknown): boolean {
	if (applied.type === "clear") return isUnset(pending);
	if (applied.note) return isPicked(applied.note, pending);
	return sameValue(pending, applied.value);
}

function pickableNote(link: string): PickableNote {
	const path = link.split("|")[0].trim();
	return { name: noteName(path), path: `${path}.md`, mtime: 0 };
}

function noteName(link: string): string {
	const path = linkedNote(link).split("|")[0].trim();
	return path.slice(path.lastIndexOf("/") + 1);
}
