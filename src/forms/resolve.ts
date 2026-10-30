import { coreDatePlaceholder, isCreatableName } from "./newNotes.ts";
import type { MomentDate, MomentFactory } from "../lists/vault.ts";
import { parseNumber } from "../setProperties/values.ts";
import { confirmedTime, typedTime } from "./dateInput.ts";
import { DEFAULT_DATE_FORMATS, formFields, isBlock, isDateType } from "./form.ts";
import type { BlockCondition, DateFieldType, Form, FormField } from "./form.ts";

export type Answer = { skipped: true } | { skipped: false; value: unknown };

export type Answers = ReadonlyMap<string, Answer>;

export interface FormClock {
	now: number;
	moment: MomentFactory;
	coreTemplatesOptions: unknown;
}

export interface ResolvedField {
	field: FormField;
	skipped: boolean;
	inactive?: true;
	value?: unknown;
	text: string;
	date?: MomentDate;
}

export interface ResolvedForm {
	fields: ResolvedField[];
	name: string;
	content: string;
	frontmatter: [string, unknown][];
}

const PLACEHOLDER = /{{([^{}]+?)}}/g;

const SKIPPED: Omit<ResolvedField, "field"> = { skipped: true, text: "" };

export function answered(value: unknown): Answer {
	return { skipped: false, value };
}

export function skippedAnswer(): Answer {
	return { skipped: true };
}

export function activeQuestions(form: Form, answers: Answers, clock: FormClock): FormField[] {
	const active = activeFieldIds(form, answers, entryClock(form, answers, clock));
	return formFields(form).filter((field) => field.mode === "ask" && active.has(field.id));
}

export function unansweredQuestions(form: Form, answers: Answers, clock: FormClock): FormField[] {
	return activeQuestions(form, answers, clock).filter((field) => {
		const answer = answers.get(field.id);
		if (answer === undefined) return !field.optional;
		return !answer.skipped && isEmptyAnswer(answer.value) && !field.optional;
	});
}

export function isEmptyAnswer(value: unknown): boolean {
	return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

export function entryClock(form: Form, answers: Answers, clock: FormClock): FormClock {
	const fields = formFields(form);
	const active = activeFieldIds(form, answers, entryClockOf(fields, answers, clock));
	return entryClockOf(fields.filter((field) => active.has(field.id)), answers, clock);
}

function entryClockOf(fields: readonly FormField[], answers: Answers, clock: FormClock): FormClock {
	let now = clock.now;
	for (const field of fields) {
		if (field.mode !== "ask") continue;
		if (!field.entryTime || !isDateType(field.type)) continue;
		const answer = answers.get(field.id);
		if (answer && !answer.skipped && typeof answer.value === "number") now = confirmedTime(field.type, answer.value, now, clock.moment);
	}
	return { ...clock, now };
}

export function resolveForm(form: Form, answers: Answers, formClock: FormClock): ResolvedForm {
	const clock = entryClock(form, answers, formClock);
	const fields = resolveFields(form, answers, clock);
	const name = noteName(fillPattern(form.namePattern, fields, clock));
	const content = fillPattern(form.contentPattern, fields, clock, name);
	const written = new Map<string, unknown>();
	for (const resolved of fields) {
		if (resolved.field.saveAs === "property" && !resolved.skipped && resolved.field.key !== "") written.set(resolved.field.key, resolved.value);
	}
	return { fields, name, content, frontmatter: [...written] };
}

export function hasCreatableName(resolved: ResolvedForm): boolean {
	return isCreatableName(resolved.name);
}

export function resolveFields(form: Form, answers: Answers, clock: FormClock): ResolvedField[] {
	const active = activeFieldIds(form, answers, clock);
	const fields = formFields(form);
	const resolve = resolver(fields.filter((field) => active.has(field.id)), answers, clock);
	return fields.map((field) => (active.has(field.id) ? resolve(field) : { field, ...SKIPPED, inactive: true }));
}

function activeFieldIds(form: Form, answers: Answers, clock: FormClock): Set<string> {
	const active: FormField[] = [];
	for (const item of form.fields) {
		if (!isBlock(item)) active.push(item);
		else if (item.conditions.every((condition) => holds(condition, latest(active, condition.key, resolver(active, answers, clock))))) active.push(...item.fields);
	}
	return new Set(active.map((field) => field.id));
}

function resolver(fields: readonly FormField[], answers: Answers, clock: FormClock): (field: FormField) => ResolvedField {
	const resolved = new Map<string, ResolvedField>();
	const visiting = new Set<string>();
	const resolve = (field: FormField): ResolvedField => {
		const known = resolved.get(field.id);
		if (known) return known;
		if (visiting.has(field.id)) return { field, ...SKIPPED };
		visiting.add(field.id);
		const result = { field, ...resolveValue(field, answers, clock, (key) => source(fields, field, key, resolve)) };
		visiting.delete(field.id);
		resolved.set(field.id, result);
		return result;
	};
	return resolve;
}

function source(
	fields: readonly FormField[],
	field: FormField,
	key: string,
	resolve: (field: FormField) => ResolvedField,
): MomentDate | undefined {
	const dates = fields.filter((candidate) => candidate !== field && isDateType(candidate.type));
	return latest(dates, key, resolve)?.date;
}

function latest(fields: readonly FormField[], key: string, resolve: (field: FormField) => ResolvedField): ResolvedField | undefined {
	let skipped: ResolvedField | undefined;
	for (let index = fields.length - 1; index >= 0; index--) {
		if (fields[index].key !== key || key === "") continue;
		const resolved = resolve(fields[index]);
		if (!resolved.skipped) return resolved;
		skipped ??= resolved;
	}
	return skipped;
}

function holds(condition: BlockCondition, resolved: ResolvedField | undefined): boolean {
	const value = resolved && !resolved.skipped ? resolved.value : undefined;
	const expected = condition.value ?? "";
	switch (condition.operator) {
		case "is set":
			return !isEmptyAnswer(value);
		case "is not set":
			return isEmptyAnswer(value);
		case "is true":
			return value === true;
		case "is false":
			return value === false;
		case "is":
			return !isEmptyAnswer(value) && valueText(value) === expected;
		case "is not":
			return isEmptyAnswer(value) || valueText(value) !== expected;
		case "has item":
			return items(value).includes(expected);
		case "does not have item":
			return !items(value).includes(expected);
		default:
			return compares(condition.operator, parseNumber(valueText(value)), parseNumber(expected));
	}
}

function items(value: unknown): string[] {
	if (Array.isArray(value)) return value.map(valueText);
	return isEmptyAnswer(value) ? [] : [valueText(value)];
}

function compares(operator: "=" | "≠" | "<" | ">", actual: number | undefined, expected: number | undefined): boolean {
	if (actual === undefined || expected === undefined) return false;
	if (operator === "=") return actual === expected;
	if (operator === "≠") return actual !== expected;
	return operator === "<" ? actual < expected : actual > expected;
}

function resolveValue(
	field: FormField,
	answers: Answers,
	clock: FormClock,
	dateFrom: (key: string) => MomentDate | undefined,
): Omit<ResolvedField, "field"> {
	if (field.mode === "static") return staticValue(field, clock, dateFrom);
	const answer = answers.get(field.id);
	if (answer === undefined || answer.skipped || isEmptyAnswer(answer.value)) return SKIPPED;
	const { value } = answer;
	if (isDateType(field.type)) {
		if (typeof value !== "number") return SKIPPED;
		return dated(field, field.type, clock.moment(field.entryTime ? confirmedTime(field.type, value, clock.now, clock.moment) : value));
	}
	if (field.type === "select") return valued(storedChoice(field, String(value)));
	if (field.type === "multiselect") {
		const items = Array.isArray(value) ? value.map((item) => storedChoice(field, String(item))) : [];
		return items.length === 0 ? SKIPPED : valued(items);
	}
	return valued(value);
}

function staticValue(field: FormField, clock: FormClock, dateFrom: (key: string) => MomentDate | undefined): Omit<ResolvedField, "field"> {
	if (isDateType(field.type)) {
		const date = field.at !== undefined ? setDate(field.type, field.at, clock) : field.from === undefined ? clock.moment(clock.now) : dateFrom(field.from);
		return date && date.isValid() ? dated(field, field.type, date.clone()) : SKIPPED;
	}
	if (field.type === "checkbox") return valued(field.value === true);
	const { value } = field;
	if (value === undefined || isEmptyAnswer(value)) return SKIPPED;
	return valued(value);
}

function setDate(type: DateFieldType, text: string, clock: FormClock): MomentDate | undefined {
	const time = typedTime(type, text, clock.now, clock.moment);
	return time === undefined ? undefined : clock.moment(time);
}

function storedChoice(field: FormField, value: string): string | number {
	if (field.storeAs !== "number") return value;
	return parseNumber(value) ?? value;
}

function valued(value: unknown): Omit<ResolvedField, "field"> {
	return { skipped: false, value, text: valueText(value) };
}

function dated(field: FormField, type: DateFieldType, date: MomentDate): Omit<ResolvedField, "field"> {
	const text = formatDate(field, type, date);
	return { skipped: false, value: text, text, date };
}

export function formatDate(field: FormField, type: DateFieldType, date: MomentDate): string {
	const format = field.dateFormat ?? DEFAULT_DATE_FORMATS[type];
	if (format === "iso") return date.toISOString();
	if (format === "custom") return date.format(field.customFormat?.trim() || DEFAULT_DATE_FORMATS[type]);
	return date.format(format);
}

export function valueText(value: unknown): string {
	if (Array.isArray(value)) return value.map(valueText).join(", ");
	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
	return "";
}

export function fillPattern(pattern: string, fields: readonly ResolvedField[], clock: FormClock, title?: string): string {
	return pattern.replace(PLACEHOLDER, (match, inner: string) => {
		const separator = inner.indexOf(":");
		const key = (separator === -1 ? inner : inner.slice(0, separator)).trim();
		const format = separator === -1 ? undefined : inner.slice(separator + 1);
		const resolved = latestResolved(fields, key);
		if (resolved) {
			if (resolved.skipped) return "";
			return format !== undefined && resolved.date ? resolved.date.format(format) : resolved.text;
		}
		if (title !== undefined && format === undefined && key.toLowerCase() === "title") return title;
		if (/^(date|time)$/i.test(key)) return coreDatePlaceholder(key, format, clock.moment(clock.now), clock.coreTemplatesOptions);
		return match;
	});
}

function latestResolved(fields: readonly ResolvedField[], key: string): ResolvedField | undefined {
	const matching = fields.filter((candidate) => key !== "" && candidate.field.key === key);
	for (let index = matching.length - 1; index >= 0; index--) if (!matching[index].skipped) return matching[index];
	return matching[0];
}

export function noteName(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}
