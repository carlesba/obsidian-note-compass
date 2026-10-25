import { coreDatePlaceholder, isCreatableName } from "../createNote/newNotes.ts";
import type { MomentDate, MomentFactory } from "../lists/vault.ts";
import { parseNumber } from "../setProperties/values.ts";
import { DEFAULT_DATE_FORMATS, askedFields, formFields, isDateType } from "./form.ts";
import type { DateFieldType, Form, FormField } from "./form.ts";

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

export function unansweredQuestions(form: Form, answers: Answers): FormField[] {
	return askedFields(form).filter((field) => {
		const answer = answers.get(field.id);
		if (answer === undefined) return !field.optional;
		return !answer.skipped && isEmptyAnswer(answer.value) && !field.optional;
	});
}

export function isEmptyAnswer(value: unknown): boolean {
	return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

export function resolveForm(form: Form, answers: Answers, clock: FormClock): ResolvedForm {
	const fields = resolveFields(form, answers, clock);
	const name = noteName(fillPattern(form.namePattern, fields, clock));
	const content = fillPattern(form.contentPattern, fields, clock, name);
	const frontmatter: [string, unknown][] = fields
		.filter((resolved) => form.properties.includes(resolved.field) && !resolved.skipped && resolved.field.key !== "")
		.map((resolved) => [resolved.field.key, resolved.value]);
	return { fields, name, content, frontmatter };
}

export function hasCreatableName(resolved: ResolvedForm): boolean {
	return isCreatableName(resolved.name);
}

export function resolveFields(form: Form, answers: Answers, clock: FormClock): ResolvedField[] {
	const all = formFields(form);
	const resolved = new Map<string, ResolvedField>();
	const visiting = new Set<string>();
	const resolve = (field: FormField): ResolvedField => {
		const known = resolved.get(field.id);
		if (known) return known;
		if (visiting.has(field.id)) return { field, ...SKIPPED };
		visiting.add(field.id);
		const result = { field, ...resolveValue(field, answers, clock, (key) => source(all, field, key, resolve)) };
		visiting.delete(field.id);
		resolved.set(field.id, result);
		return result;
	};
	return all.map(resolve);
}

function source(
	all: readonly FormField[],
	field: FormField,
	key: string,
	resolve: (field: FormField) => ResolvedField,
): MomentDate | undefined {
	const referenced = all.find((candidate) => candidate !== field && candidate.key === key && isDateType(candidate.type));
	return referenced ? resolve(referenced).date : undefined;
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
		return dated(field, field.type, clock.moment(value));
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
		const date = field.from === undefined ? clock.moment(clock.now) : dateFrom(field.from);
		return date && date.isValid() ? dated(field, field.type, date.clone()) : SKIPPED;
	}
	if (field.type === "checkbox") return valued(field.value === true);
	const { value } = field;
	if (value === undefined || isEmptyAnswer(value)) return SKIPPED;
	return valued(value);
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
		const resolved = fields.find((candidate) => candidate.field.key !== "" && candidate.field.key === key);
		if (resolved) {
			if (resolved.skipped) return "";
			return format !== undefined && resolved.date ? resolved.date.format(format) : resolved.text;
		}
		if (title !== undefined && format === undefined && key.toLowerCase() === "title") return title;
		if (/^(date|time)$/i.test(key)) return coreDatePlaceholder(key, format, clock.moment(clock.now), clock.coreTemplatesOptions);
		return match;
	});
}

export function noteName(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}
