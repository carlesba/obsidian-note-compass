import type { EditablePropertyType } from "../settings";

export const UNSET_VALUE = "—";

const PENDING_VALUE_LENGTH = 40;

const DATE_FORMS = [/^(\d{4})(\d{2})(\d{2})$/, /^(\d{4})-(\d{2})-(\d{2})$/];

const DATETIME_FORMS = [
	/^(\d{4})(\d{2})(\d{2}) (\d{2})(\d{2})$/,
	/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/,
	/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/,
];

const TIME_FORMS = [/^(\d{2})(\d{2})$/, /^(\d{1,2}):(\d{2})$/];

const NUMBER_FORM = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

export function parseDate(input: string): string | undefined {
	const parts = matchFirst(DATE_FORMS, input.trim());
	if (!parts) return undefined;
	const [year, month, day] = parts;
	return isCalendarDate(year, month, day) ? `${year}-${month}-${day}` : undefined;
}

export function parseDateTime(input: string): string | undefined {
	const parts = matchFirst(DATETIME_FORMS, input.trim());
	if (!parts) return undefined;
	const [year, month, day, hour, minute] = parts;
	if (!isCalendarDate(year, month, day) || Number(hour) > 23 || Number(minute) > 59) return undefined;
	return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function parseTime(input: string): string | undefined {
	const parts = matchFirst(TIME_FORMS, input.trim());
	if (!parts) return undefined;
	const [hour, minute] = parts;
	if (Number(hour) > 23 || Number(minute) > 59) return undefined;
	return `${hour.padStart(2, "0")}:${minute}`;
}

export function parseNumber(input: string): number | undefined {
	const text = input.trim();
	if (!NUMBER_FORM.test(text)) return undefined;
	const value = Number(text);
	return Number.isFinite(value) ? value : undefined;
}

export function formatPendingValue(type: EditablePropertyType, value: unknown): string {
	const items = (Array.isArray(value) ? value : [value]).filter(
		(item) => item !== undefined && item !== null && item !== "",
	);
	if (!items.length) return UNSET_VALUE;
	const texts = items.map((item) => String(type === "link" || type === "links" ? linkTitle(item) : item));
	return truncated(texts.join(", "));
}

export function isUnset(value: unknown): boolean {
	return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

export function sameValue(left: unknown, right: unknown): boolean {
	if (isUnset(left) || isUnset(right)) return isUnset(left) && isUnset(right);
	if (Array.isArray(left) && Array.isArray(right)) {
		return left.length === right.length && left.every((item, index) => sameValue(item, right[index]));
	}
	return left === right;
}

export function asList(value: unknown): unknown[] {
	if (isUnset(value)) return [];
	return Array.isArray(value) ? value : [value];
}

export function linkTitle(value: unknown): unknown {
	if (typeof value !== "string") return value;
	const link = value.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
	return link ? link[2] ?? link[1] : value.replace(/[[\]"']/g, "").trim();
}

function truncated(text: string): string {
	const characters = Array.from(text);
	if (characters.length <= PENDING_VALUE_LENGTH) return text;
	return `${characters.slice(0, PENDING_VALUE_LENGTH - 1).join("").trimEnd()}…`;
}

function matchFirst(forms: readonly RegExp[], text: string): string[] | undefined {
	for (const form of forms) {
		const match = text.match(form);
		if (match) return match.slice(1);
	}
	return undefined;
}

function isCalendarDate(year: string, month: string, day: string): boolean {
	const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
	return (
		date.getUTCFullYear() === Number(year) &&
		date.getUTCMonth() === Number(month) - 1 &&
		date.getUTCDate() === Number(day)
	);
}
