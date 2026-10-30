import { t } from "../i18n/index.ts";
import type { MomentFactory, PropertyValueCount } from "../lists/vault.ts";
import { matchesInOrder, rowLabel } from "../render.ts";
import type { RowParts } from "../render.ts";
import { datePresets } from "../setProperties/valuePicker.ts";
import { parseNumber, sameValue } from "../setProperties/values.ts";
import { confirmedTime, DIGIT_DATE_FORMATS, typedTime } from "./dateInput.ts";

export { typedTime };
import { fieldSource, isDateType, picksSeveral, questionText } from "./form.ts";
import type { DateFieldType, Form, FormChoice as FieldOption, FormField } from "./form.ts";
import type { NoteOption } from "./notes.ts";
import { answered, skippedAnswer } from "./resolve.ts";
import type { Answer, ResolvedForm } from "./resolve.ts";

export interface Question {
	field: FormField;
	vaultValues: PropertyValueCount[];
	notes: NoteOption[];
	now: number;
	moment: MomentFactory;
}

export type QuestionAction =
	| { action: "answer"; answer: Answer }
	| { action: "toggle"; value: string }
	| { action: "done" };

export type ConfirmAction = { action: "create" } | { action: "edit"; field: FormField } | { action: "stay" } | { action: "cancel" };

export interface Row<Action> {
	label: string;
	parts: RowParts;
	action: Action;
	kept: boolean;
	typed: boolean;
}

export type QuestionChoice = Row<QuestionAction>;

export type ConfirmChoice = Row<ConfirmAction>;

export type FormChoice = Row<{ action: "run"; form: Form }>;

const SELECTED_MARK = "✓";
const SKIP_MARK = "⏭️";
const DONE_MARK = "🏁";
const USE_MARK = "✏️";
const CREATE_MARK = "✅";
const CANCEL_MARK = "🛑";

const SHOWN_DATE_FORMATS: Record<DateFieldType, string> = {
	date: "YYYY-MM-DD",
	time: "HH:mm",
	datetime: "YYYY-MM-DD HH:mm",
};

export function formChoices(forms: readonly Form[], query: string): FormChoice[] {
	const rows = forms.map((form) => row({ content: formName(form) }, { action: "run" as const, form }));
	return query ? rows.filter((choice) => matchesInOrder(query, choice.label)) : rows;
}

export function formName(form: Form): string {
	return form.name.trim() || t("untitledForm");
}

export function questionPlaceholder(field: FormField, now: number, moment: MomentFactory): string {
	if (field.entryTime && isDateType(field.type)) return moment(now).format(DIGIT_DATE_FORMATS[field.type]);
	return questionText(field) || t("untitledField");
}

export function questionChoices(question: Question, answer: Answer | undefined, query: string): QuestionChoice[] {
	const { field } = question;
	const kept: QuestionChoice[] = [];
	if (field.optional) kept.push(keptRow(markOf(answer?.skipped === true, SKIP_MARK), t("skip"), { action: "answer", answer: skippedAnswer() }));
	if (picksSeveral(field)) kept.push(keptRow(DONE_MARK, t("done"), { action: "done" }));
	const pending = answer && !answer.skipped ? answer.value : undefined;
	const rows = typeRows(question, pending, query);
	if (!query) return [...kept, ...rows];
	return [...rows.filter((choice) => choice.typed || matchesInOrder(query, choice.label)), ...kept];
}

function typeRows(question: Question, pending: unknown, query: string): QuestionChoice[] {
	const { field } = question;
	const source = fieldSource(field);
	const offer = (content: string, value: unknown, detail?: string) =>
		row({ mark: markOf(sameValue(value, pending)), content, value: detail }, answerWith(value));
	switch (field.type) {
		case "checkbox":
			return [offer("true", true), offer("false", false)];
		case "list":
			return listRows(question, pending, query);
		case "number":
			if (source === "options") return options(field).map((choice) => offer(choiceLabel(choice), choice.value));
			return knownValueRows(question, pending, parseNumber(query), "number");
		case "text": {
			if (source === "options") return options(field).map((choice) => offer(choiceLabel(choice), choice.value));
			if (source === "notes") return question.notes.map((note) => offer(note.name, note.link));
			const typed = query.trim();
			return knownValueRows(question, pending, typed === "" ? undefined : typed, "string");
		}
		default:
			return isDateType(field.type) ? dateRows(question, field.type, pending, query) : [];
	}
}

function options(field: FormField): FieldOption[] {
	return (field.choices ?? []).filter((choice) => choice.value !== "");
}

function choiceLabel(choice: FieldOption): string {
	return choice.label?.trim() || choice.value;
}

function listRows(question: Question, pending: unknown, query: string): QuestionChoice[] {
	const { field } = question;
	const picked = Array.isArray(pending) ? pending.map(String) : [];
	const toggle = (content: string, value: string, detail?: string) =>
		row({ mark: markOf(picked.includes(value)), content, value: detail }, { action: "toggle" as const, value });
	const source = fieldSource(field);
	if (source === "options") return options(field).map((choice) => toggle(choiceLabel(choice), choice.value));
	if (source === "notes") return question.notes.map((note) => toggle(note.name, note.link));
	const typed = query.trim();
	const known = question.vaultValues
		.filter((count) => typeof count.value === "string")
		.sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
	const rows: QuestionChoice[] = [];
	if (typed !== "" && !picked.includes(typed) && !known.some((count) => count.value === typed)) {
		rows.push({ ...row({ mark: USE_MARK, content: t("useValue", { value: typed }) }, { action: "toggle", value: typed }), typed: true });
	}
	for (const item of picked) if (!known.some((count) => count.value === item)) rows.push(toggle(item, item));
	for (const count of known) rows.push(toggle(String(count.value), String(count.value), `×${count.count}`));
	return rows;
}

function knownValueRows(
	question: Question,
	pending: unknown,
	typed: string | number | undefined,
	kind: "number" | "string",
): QuestionChoice[] {
	const values = question.vaultValues
		.filter((count) => typeof count.value === kind)
		.sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
	const known = values.map((count) => count.value);
	const rows: QuestionChoice[] = [];
	if (typed !== undefined && !known.some((value) => sameValue(value, typed))) rows.push(useRow(typed, pending));
	if ((typeof pending === "string" || typeof pending === "number") && !sameValue(pending, typed) && !known.some((value) => sameValue(value, pending))) {
		rows.push(row({ mark: SELECTED_MARK, content: String(pending) }, answerWith(pending)));
	}
	for (const count of values) {
		rows.push(row({ mark: markOf(sameValue(count.value, pending)), content: String(count.value), value: `×${count.count}` }, answerWith(count.value)));
	}
	return rows;
}

function dateRows(question: Question, type: DateFieldType, pending: unknown, query: string): QuestionChoice[] {
	const { moment, now } = question;
	const compose = (time: number) => question.field.entryTime ? confirmedTime(type, time, now, moment) : time;
	if (typeof pending === "number") pending = compose(pending);
	const shown = (time: number) => moment(compose(time)).format(question.field.entryTime ? SHOWN_DATE_FORMATS.datetime : SHOWN_DATE_FORMATS[type]);
	const offer = (content: string, time: number) =>
		row({ mark: markOf(compose(time) === pending), content, value: shown(time) }, answerWith(compose(time)));
	const rows: QuestionChoice[] = [];
	const typed = typedTime(type, query, now, moment);
	if (typed !== undefined) rows.push({ ...row({ mark: markOf(compose(typed) === pending, USE_MARK), content: t("useValue", { value: shown(typed) }) }, answerWith(compose(typed))), typed: true });
	const presets: [string, number][] = [[question.field.entryTime ? t("keepEntryTime") : t("now"), now]];
	if (type === "date") {
		for (const [name, date] of datePresets(now)) presets.push([name, moment(date, "YYYY-MM-DD", true).valueOf()]);
	}
	if (typeof pending === "number" && (typed === undefined || compose(typed) !== pending) && !presets.some(([, time]) => compose(time) === pending)) {
		rows.push(row({ mark: SELECTED_MARK, content: shown(pending) }, answerWith(compose(pending))));
	}
	return [...rows, ...presets.map(([name, time]) => offer(name, time))];
}

export function toggledChoice(answer: Answer | undefined, value: string, question: Question): Answer {
	const current = answer && !answer.skipped && Array.isArray(answer.value) ? answer.value.map(String) : [];
	const chosen = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
	const order = pickOrder(question);
	return answered(order ? order.filter((item) => chosen.includes(item)) : chosen);
}

function pickOrder(question: Question): string[] | undefined {
	const source = fieldSource(question.field);
	if (source === "options") return options(question.field).map((choice) => choice.value);
	if (source === "notes") return question.notes.map((note) => note.link);
	return undefined;
}

export function confirmChoices(resolved: ResolvedForm, query: string): ConfirmChoice[] {
	const create = keptRow<ConfirmAction>(CREATE_MARK, resolved.name === "" ? t("createNote") : t("createNamed", { name: resolved.name }), { action: "create" });
	const cancel = keptRow<ConfirmAction>(CANCEL_MARK, t("cancel"), { action: "cancel" });
	const fields = resolved.fields.filter((resolvedField) => !resolvedField.inactive).map((resolvedField) =>
		row<ConfirmAction>(
			{ content: resolvedField.field.key || t("untitledField"), value: resolvedField.skipped ? t("skipped") : resolvedField.field.entryTime && resolvedField.date ? resolvedField.date.format(SHOWN_DATE_FORMATS.datetime) : resolvedField.text },
			resolvedField.field.mode === "ask" ? { action: "edit", field: resolvedField.field } : { action: "stay" },
		),
	);
	if (!query) return [create, ...fields, cancel];
	return [...fields.filter((choice) => matchesInOrder(query, choice.label)), create, cancel];
}

function answerWith(value: unknown): QuestionAction {
	return { action: "answer", answer: answered(value) };
}

function useRow(value: string | number, pending: unknown): QuestionChoice {
	return { ...row({ mark: markOf(sameValue(value, pending), USE_MARK), content: t("useValue", { value }) }, answerWith(value)), typed: true };
}

function markOf(selected: boolean, mark = ""): string {
	return selected ? SELECTED_MARK : mark;
}

function keptRow<Action>(mark: string, content: string, action: Action): Row<Action> {
	return { ...row({ mark, content }, action), kept: true };
}

function row<Action>(parts: RowParts, action: Action): Row<Action> {
	const cleaned: RowParts = { ...parts };
	if (cleaned.value === undefined) delete cleaned.value;
	return { label: rowLabel(cleaned), parts: cleaned, action, kept: false, typed: false };
}
