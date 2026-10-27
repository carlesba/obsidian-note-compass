import type { EditablePropertyType } from "../settings.ts";
import { parseDate, parseDateTime } from "./values.ts";

export type FixedValueType = EditablePropertyType | "clear";

export const FIXED_VALUE_TYPES: readonly FixedValueType[] = ["checkbox", "text", "number", "date", "datetime", "link", "links", "clear"];

export type RelativeDate = "today" | "now";

export interface FixedValue {
	id: string;
	property: string;
	type: FixedValueType;
	value?: string | boolean | number;
	relative?: RelativeDate;
}

export function relativeDateOf(type: FixedValueType): RelativeDate | undefined {
	if (type === "date") return "today";
	if (type === "datetime") return "now";
	return undefined;
}

export function newFixedValueId(values: readonly { id: string }[]): string {
	const highest = Math.max(0, ...values.map((value) => Number(value.id.match(/^value-(\d+)$/)?.[1] ?? 0)));
	return `value-${highest + 1}`;
}

export function isUsableFixedValue(fixed: FixedValue): boolean {
	if (fixed.property.trim() === "") return false;
	if (fixed.type === "clear" || fixed.relative !== undefined) return true;
	return fixed.value !== undefined && fixed.value !== "";
}

export function typedFixedValue(type: FixedValueType, value: unknown): string | boolean | number | undefined {
	switch (type) {
		case "checkbox":
			return typeof value === "boolean" ? value : undefined;
		case "number":
			return typeof value === "number" && Number.isFinite(value) ? value : undefined;
		case "date":
			return typeof value === "string" && parseDate(value) === value ? value : undefined;
		case "datetime":
			return typeof value === "string" && parseDateTime(value) === value ? value : undefined;
		case "clear":
			return undefined;
		default:
			return typeof value === "string" ? value : undefined;
	}
}

export function readFixedValues(stored: unknown): FixedValue[] {
	if (!Array.isArray(stored)) return [];
	const storedIds = stored.filter(isRecord).map((entry) => ({ id: typeof entry.id === "string" ? entry.id : "" }));
	const values: FixedValue[] = [];
	for (const entry of stored) {
		if (!isRecord(entry)) continue;
		const fixed = readFixedValue(entry);
		if (!fixed) continue;
		const id = typeof entry.id === "string" && entry.id !== "" && !values.some((value) => value.id === entry.id) ? entry.id : newFixedValueId([...storedIds, ...values]);
		values.push({ ...fixed, id });
	}
	return values;
}

function readFixedValue(entry: Record<string, unknown>): Omit<FixedValue, "id"> | undefined {
	if (typeof entry.property !== "string") return undefined;
	const type = FIXED_VALUE_TYPES.find((candidate) => candidate === entry.type);
	if (!type) return undefined;
	const fixed: Omit<FixedValue, "id"> = { property: entry.property.trim(), type };
	if (entry.value !== undefined) {
		const value = typedFixedValue(type, entry.value);
		if (value === undefined) return undefined;
		fixed.value = value;
	}
	if (entry.relative !== undefined) {
		const relative = relativeDateOf(type);
		if (relative === undefined || entry.relative !== relative) return undefined;
		fixed.relative = relative;
	}
	return fixed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
