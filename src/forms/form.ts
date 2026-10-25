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

export interface Form {
	id: string;
	enabled: boolean;
	name: string;
	namePattern: string;
	contentPattern: string;
	folder: string;
	opensNote: boolean;
	fields: FormField[];
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

export function askedFields(form: Form): FormField[] {
	return form.fields.filter((field) => field.mode === "ask");
}

export function questionText(field: FormField): string {
	return field.question?.trim() || field.key;
}

export function entryTimeField(form: Form): FormField | undefined {
	return form.fields.find((field) => field.entryTime === true && field.mode === "ask" && isDateType(field.type));
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
	return { id: newFormId(form.fields), key: "", saveAs: "property", mode: "ask", type: "text" };
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
	const fields = readFields(storedFields(data));
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

function readFields(stored: unknown): FormField[] | undefined {
	if (stored === undefined) return [];
	if (!Array.isArray(stored)) return undefined;
	const fields: FormField[] = [];
	for (const entry of stored) {
		const field = readField(entry, fields);
		if (!field) return undefined;
		fields.push(field);
	}
	return fields;
}

function readField(entry: unknown, known: readonly FormField[]): FormField | undefined {
	if (!isRecord(entry) || typeof entry.key !== "string") return undefined;
	const mode = FIELD_MODES.find((candidate) => candidate === entry.mode);
	const type = mode && typesFor(mode).find((candidate) => candidate === entry.type);
	if (!mode || !type) return undefined;
	const id =
		typeof entry.id === "string" && /^\d+$/.test(entry.id) && !known.some((field) => field.id === entry.id)
			? entry.id
			: newFormId(known);
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
