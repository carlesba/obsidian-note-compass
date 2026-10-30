export type FieldMode = "static" | "ask";

export type FieldType = "text" | "number" | "checkbox" | "list" | "select" | "multiselect" | "date" | "time" | "datetime";

export type DateFieldType = Extract<FieldType, "date" | "time" | "datetime">;

export type DateFormat = "YYYY-MM-DD" | "HH:mm" | "YYYY-MM-DDTHH:mm" | "iso" | "custom";

export type StoredChoiceType = "text" | "number";

export type StaticValue = string | number | boolean | string[];

export type SaveAs = "property" | "variable";

export const FIELD_MODES: readonly FieldMode[] = ["static", "ask"];

export const SAVE_AS: readonly SaveAs[] = ["property", "variable"];

export const STATIC_FIELD_TYPES: readonly FieldType[] = ["text", "number", "checkbox", "list", "date", "time", "datetime"];

export const ASK_FIELD_TYPES: readonly FieldType[] = ["text", "number", "checkbox", "select", "multiselect", "date", "time", "datetime"];

export const DATE_FORMATS: readonly DateFormat[] = ["YYYY-MM-DD", "HH:mm", "YYYY-MM-DDTHH:mm", "iso", "custom"];

export const STORED_CHOICE_TYPES: readonly StoredChoiceType[] = ["text", "number"];

export const DEFAULT_DATE_FORMATS: Record<DateFieldType, DateFormat> = {
	date: "YYYY-MM-DD",
	time: "HH:mm",
	datetime: "YYYY-MM-DDTHH:mm",
};

export interface FormChoice {
	value: string;
	label?: string;
}

export interface FormField {
	id: string;
	key: string;
	saveAs: SaveAs;
	mode: FieldMode;
	type: FieldType;
	value?: StaticValue;
	optional?: boolean;
	question?: string;
	choices?: FormChoice[];
	storeAs?: StoredChoiceType;
	dateFormat?: DateFormat;
	customFormat?: string;
	from?: string;
	at?: string;
	entryTime?: true;
}

export const BLOCK_OPERATORS = ["is", "is not", "has item", "does not have item", "=", "≠", "<", ">", "on", "not on", "before", "after", "is true", "is false", "is set", "is not set"] as const;

export type BlockOperator = (typeof BLOCK_OPERATORS)[number];

export const VALUELESS_BLOCK_OPERATORS: readonly BlockOperator[] = ["is true", "is false", "is set", "is not set"];

export interface BlockCondition {
	key: string;
	operator: BlockOperator;
	value?: string;
}

export interface FormBlock {
	id: string;
	kind: "block";
	conditions: BlockCondition[];
	fields: FormField[];
}

export type FormItem = FormField | FormBlock;

export interface Form {
	id: string;
	enabled: boolean;
	name: string;
	namePattern: string;
	contentPattern: string;
	folder: string;
	opensNote: boolean;
	fields: FormItem[];
	unreadable?: { stored: unknown };
}

export function isDateType(type: FieldType): type is DateFieldType {
	return type === "date" || type === "time" || type === "datetime";
}

export function hasChoices(type: FieldType): boolean {
	return type === "select" || type === "multiselect";
}

export function typesFor(mode: FieldMode): readonly FieldType[] {
	return mode === "ask" ? ASK_FIELD_TYPES : STATIC_FIELD_TYPES;
}

export function isBlock(item: FormItem): item is FormBlock {
	return "kind" in item && item.kind === "block";
}

export function formFields(form: Pick<Form, "fields">): FormField[] {
	return form.fields.flatMap((item) => (isBlock(item) ? item.fields : [item]));
}

export function formIds(form: Pick<Form, "fields">): { id: string }[] {
	return [...form.fields, ...form.fields.flatMap((item) => (isBlock(item) ? item.fields : []))];
}

export function blockOf(form: Pick<Form, "fields">, field: FormField): FormBlock | undefined {
	return form.fields.find((item): item is FormBlock => isBlock(item) && item.fields.includes(field));
}

export function askedFields(form: Form): FormField[] {
	return formFields(form).filter((field) => field.mode === "ask");
}

export function operatorsFor(type: FieldType): readonly BlockOperator[] {
	if (type === "select" || type === "text") return ["is", "is not", "is set", "is not set"];
	if (type === "multiselect" || type === "list") return ["has item", "does not have item", "is set", "is not set"];
	if (type === "number") return ["=", "≠", "<", ">", "is set", "is not set"];
	if (type === "checkbox") return ["is true", "is false"];
	return ["on", "not on", "before", "after", "is set", "is not set"];
}

export function takesValue(operator: BlockOperator): boolean {
	return !VALUELESS_BLOCK_OPERATORS.includes(operator);
}

export function questionText(field: FormField): string {
	return field.question?.trim() || field.key;
}

export function newFormId(forms: readonly { id: string }[]): string {
	return String(Math.max(0, ...forms.map((form) => Number(form.id.match(/^\d+$/)?.[0] ?? 0))) + 1);
}

export function newForm(forms: readonly Form[]): Form {
	return {
		id: newFormId(forms),
		enabled: true,
		name: "",
		namePattern: "",
		contentPattern: "",
		folder: "",
		opensNote: true,
		fields: [],
	};
}

export function newField(form: Form): FormField {
	return { id: newFormId(formIds(form)), key: "", saveAs: "property", mode: "ask", type: "text" };
}

export function newBlock(form: Form): FormBlock {
	return { id: newFormId(formIds(form)), kind: "block", conditions: [{ key: "", operator: "is" }], fields: [] };
}

export function readForms(stored: unknown): Form[] {
	if (!Array.isArray(stored)) return [];
	const forms: Form[] = [];
	for (const entry of stored) {
		const id = isRecord(entry) && typeof entry.id === "string" && /^\d+$/.test(entry.id) && !forms.some((form) => form.id === entry.id)
			? entry.id
			: newFormId([...storedIds(stored), ...forms]);
		forms.push(readForm(entry, id));
	}
	return forms;
}

export function storedForms(forms: readonly Form[]): unknown[] {
	return forms.map((form) => (form.unreadable ? form.unreadable.stored : withoutUnreadable(form)));
}

function withoutUnreadable(form: Form): Form {
	const stored = { ...form };
	delete stored.unreadable;
	return stored;
}

function storedIds(stored: unknown[]): { id: string }[] {
	return stored.filter(isRecord).map((entry) => ({ id: typeof entry.id === "string" ? entry.id : "" }));
}

function readForm(entry: unknown, id: string): Form {
	const data = isRecord(entry) ? entry : {};
	const form: Form = {
		id,
		enabled: typeof data.enabled === "boolean" ? data.enabled : false,
		name: text(data.name),
		namePattern: text(data.namePattern),
		contentPattern: text(data.contentPattern),
		folder: text(data.folder).trim(),
		opensNote: typeof data.opensNote === "boolean" ? data.opensNote : true,
		fields: [],
	};
	const fields = readItems(storedFields(data));
	if (!isRecord(entry) || fields === undefined) return { ...form, enabled: false, unreadable: { stored: entry } };
	return { ...form, fields };
}

function storedFields(data: Record<string, unknown>): unknown {
	if (data.fields !== undefined || (data.variables === undefined && data.properties === undefined)) return data.fields;
	const variables = withSaveAs(data.variables ?? [], "variable");
	const properties = withSaveAs(data.properties ?? [], "property");
	return variables && properties ? [...variables, ...properties] : null;
}

function withSaveAs(stored: unknown, saveAs: SaveAs): unknown[] | undefined {
	if (!Array.isArray(stored)) return undefined;
	return stored.map((entry: unknown) => (isRecord(entry) ? { ...entry, saveAs } : entry));
}

function readItems(stored: unknown): FormItem[] | undefined {
	if (stored === undefined) return [];
	if (!Array.isArray(stored)) return undefined;
	const items: FormItem[] = [];
	const known: { id: string }[] = [];
	for (const entry of stored) {
		const item = isRecord(entry) && entry.kind === "block" ? readBlock(entry, known) : readField(entry, known);
		if (!item) return undefined;
		items.push(item);
	}
	return items;
}

function readBlock(entry: Record<string, unknown>, known: { id: string }[]): FormBlock | undefined {
	if (!Array.isArray(entry.conditions) || !Array.isArray(entry.fields)) return undefined;
	const conditions: BlockCondition[] = [];
	for (const stored of entry.conditions) {
		const condition = readCondition(stored);
		if (!condition) return undefined;
		conditions.push(condition);
	}
	const block: FormBlock = { id: knownId(entry.id, known), kind: "block", conditions, fields: [] };
	for (const stored of entry.fields) {
		const field = readField(stored, known);
		if (!field) return undefined;
		block.fields.push(field);
	}
	return block;
}

function readCondition(stored: unknown): BlockCondition | undefined {
	if (!isRecord(stored) || typeof stored.key !== "string") return undefined;
	const operator = BLOCK_OPERATORS.find((candidate) => candidate === stored.operator);
	if (!operator) return undefined;
	const condition: BlockCondition = { key: stored.key.trim(), operator };
	if (takesValue(operator) && typeof stored.value === "string") condition.value = stored.value;
	return condition;
}

function knownId(stored: unknown, known: { id: string }[]): string {
	const id = typeof stored === "string" && /^\d+$/.test(stored) && !known.some((other) => other.id === stored) ? stored : newFormId(known);
	known.push({ id });
	return id;
}

function readField(entry: unknown, known: { id: string }[]): FormField | undefined {
	if (!isRecord(entry) || typeof entry.key !== "string") return undefined;
	const mode = FIELD_MODES.find((candidate) => candidate === entry.mode);
	const type = mode && typesFor(mode).find((candidate) => candidate === entry.type);
	if (!mode || !type) return undefined;
	const id = knownId(entry.id, known);
	const saveAs = SAVE_AS.find((candidate) => candidate === entry.saveAs) ?? "property";
	const field: FormField = { id, key: entry.key.trim(), saveAs, mode, type };
	if (mode === "static") {
		const value = readStaticValue(type, entry.value);
		if (value !== undefined) field.value = value;
		if (isDateType(type) && typeof entry.from === "string" && entry.from.trim() !== "") field.from = entry.from.trim();
		else if (isDateType(type) && typeof entry.at === "string") field.at = entry.at;
	} else {
		if (entry.optional === true) field.optional = true;
		if (entry.entryTime === true && isDateType(type)) field.entryTime = true;
		if (typeof entry.question === "string" && entry.question.trim() !== "") field.question = entry.question;
	}
	if (mode === "ask" && hasChoices(type)) {
		field.choices = readChoices(entry.choices);
		field.storeAs = STORED_CHOICE_TYPES.find((candidate) => candidate === entry.storeAs) ?? "text";
	}
	if (isDateType(type)) {
		field.dateFormat = DATE_FORMATS.find((candidate) => candidate === entry.dateFormat) ?? DEFAULT_DATE_FORMATS[type];
		if (typeof entry.customFormat === "string") field.customFormat = entry.customFormat;
	}
	return field;
}

function readStaticValue(type: FieldType, value: unknown): StaticValue | undefined {
	if (type === "text") return typeof value === "string" ? value : undefined;
	if (type === "number") return typeof value === "number" && Number.isFinite(value) ? value : undefined;
	if (type === "checkbox") return typeof value === "boolean" ? value : undefined;
	if (type === "list") {
		if (!Array.isArray(value)) return undefined;
		return value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
	}
	return undefined;
}

function readChoices(stored: unknown): FormChoice[] {
	if (!Array.isArray(stored)) return [];
	const choices: FormChoice[] = [];
	for (const entry of stored) {
		if (!isRecord(entry) || typeof entry.value !== "string") continue;
		const choice: FormChoice = { value: entry.value };
		if (typeof entry.label === "string" && entry.label !== "") choice.label = entry.label;
		choices.push(choice);
	}
	return choices;
}

function text(value: unknown): string {
	return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
