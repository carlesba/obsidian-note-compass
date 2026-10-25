import { t, translatedLabels } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import {
	DATE_FORMATS,
	DEFAULT_DATE_FORMATS,
	FIELD_MODES,
	SAVE_AS,
	STORED_CHOICE_TYPES,
	hasChoices,
	isDateType,
	typesFor,
} from "../forms/form.ts";
import type { DateFormat, FieldMode, FieldType, Form, FormField, SaveAs, StoredChoiceType } from "../forms/form.ts";
import { parseNumber } from "../setProperties/values.ts";
import { SET_DATE_PLACEHOLDERS, readsAsDate } from "../forms/dateInput.ts";

export type FormSetting = "enabled" | "name" | "namePattern" | "contentPattern" | "folder" | "opensNote";

export type FieldSetting =
	| "saveAs"
	| "key"
	| "mode"
	| "type"
	| "text"
	| "number"
	| "checked"
	| "listItems"
	| "optional"
	| "question"
	| "storeAs"
	| "dateFormat"
	| "customFormat"
	| "from"
	| "at"
	| "choiceValue"
	| "choiceLabel";

export const AT_CREATION = "";

export const SET_DATE = "@set";

const FORM_SETTINGS: readonly FormSetting[] = ["enabled", "name", "namePattern", "contentPattern", "folder", "opensNote"];

const FIELD_TYPE_KEYS: Record<FieldType, TranslationKey> = {
	text: "typeText",
	number: "typeNumber",
	checkbox: "typeCheckbox",
	list: "formTypeList",
	select: "formTypeSelect",
	multiselect: "formTypeMultiselect",
	date: "typeDate",
	time: "formTypeTime",
	datetime: "typeDatetime",
};

const MODE_KEYS: Record<FieldMode, TranslationKey> = {
	static: "formModeStatic",
	ask: "formModeAsk",
};

const SAVE_AS_KEYS: Record<SaveAs, TranslationKey> = {
	property: "formSaveAsProperty",
	variable: "formSaveAsVariable",
};

const STORED_CHOICE_KEYS: Record<StoredChoiceType, TranslationKey> = {
	text: "typeText",
	number: "typeNumber",
};

const DATE_FORMAT_KEYS: Partial<Record<DateFormat, TranslationKey>> = {
	iso: "formFormatIso",
	custom: "formFormatCustom",
};

export function fieldTypeLabel(type: FieldType): string {
	return t(FIELD_TYPE_KEYS[type]);
}

export function fieldModeOptions(): Record<FieldMode, string> {
	return translatedLabels(MODE_KEYS);
}

export function fieldTypeOptions(mode: FieldMode): Record<string, string> {
	const options: Record<string, string> = {};
	for (const type of typesFor(mode)) options[type] = fieldTypeLabel(type);
	return options;
}

export function saveAsOptions(): Record<SaveAs, string> {
	return translatedLabels(SAVE_AS_KEYS);
}

export function storeAsOptions(): Record<StoredChoiceType, string> {
	return translatedLabels(STORED_CHOICE_KEYS);
}

export function dateFormatOptions(): Record<string, string> {
	const options: Record<string, string> = {};
	for (const format of DATE_FORMATS) {
		const key = DATE_FORMAT_KEYS[format];
		options[format] = key === undefined ? format : t(key);
	}
	return options;
}

export function dateSourceOptions(form: Form, field: FormField): Record<string, string> {
	const options: Record<string, string> = { [AT_CREATION]: t("formAtCreation"), [SET_DATE]: t("formOnSetDate") };
	for (const other of form.fields) {
		if (other === field || other.key === "" || !isDateType(other.type)) continue;
		options[other.key] = t("formFromField", { key: other.key });
	}
	if (field.from !== undefined && !(field.from in options)) options[field.from] = t("formFromMissingField", { key: field.from });
	return options;
}

export function formRowName(form: Form): string {
	return form.name.trim() || t("newForm");
}

export function formSummary(form: Form): string | undefined {
	if (form.unreadable) return undefined;
	const pattern = form.namePattern.trim();
	return pattern === "" ? t("formNoNamePattern") : pattern;
}

export function fieldRowName(field: FormField): string {
	return field.key.trim() || t("newField");
}

export function fieldSummary(field: FormField): string {
	const mode = field.mode === "static" ? t("formSummaryFixed") : field.optional ? t("formSummaryAskOptional") : t("formSummaryAsk");
	const saveAs = field.saveAs === "property" ? t("formSummaryProperty") : t("formSummaryVariable");
	return [fieldRowName(field), mode, fieldTypeLabel(field.type), saveAs].join(" · ");
}

export function fieldWarning(form: Form, field: FormField): string | undefined {
	if (field.key.trim() === "") return t("formFieldNeedsKey");
	if (form.fields.some((other) => other !== field && other.key === field.key)) return t("formFieldKeyRepeated", { key: field.key });
	if (field.mode === "static" && field.from !== undefined && !form.fields.some((other) => other !== field && other.key === field.from && isDateType(other.type))) {
		return t("formFromMissingField", { key: field.from });
	}
	if (field.mode === "static" && field.at !== undefined && isDateType(field.type) && !readsAsDate(field.type, field.at)) {
		return t("formSetDateUnreadable", { format: SET_DATE_PLACEHOLDERS[field.type] });
	}
	if (hasChoices(field.type) && field.mode === "ask" && !(field.choices ?? []).some((choice) => choice.value.trim() !== "")) return t("formNeedsChoices");
	return undefined;
}

export function formWarning(form: Form): string | undefined {
	if (form.unreadable) return t("unreadableFormWarning");
	if (form.fields.some((field) => fieldWarning(form, field) !== undefined)) return t("formFieldsNeedAttention");
	return undefined;
}

export function readFormSetting(form: Form, setting: FormSetting): unknown {
	return FORM_SETTINGS.includes(setting) ? form[setting] : undefined;
}

export function writeFormSetting(form: Form, setting: FormSetting, value: unknown): boolean {
	if (form.unreadable || !FORM_SETTINGS.includes(setting)) return false;
	const text = typeof value === "string" ? value : "";
	if (setting === "enabled" || setting === "opensNote") form[setting] = value === true;
	else if (setting === "folder") form.folder = text.trim();
	else form[setting] = text;
	return true;
}

export function findField(form: Form, fieldId: string): FormField | undefined {
	return form.fields.find((field) => field.id === fieldId);
}

export function readFieldSetting(field: FormField, setting: FieldSetting, index?: number): unknown {
	switch (setting) {
		case "text":
			return typeof field.value === "string" ? field.value : "";
		case "number":
			return typeof field.value === "number" ? String(field.value) : "";
		case "checked":
			return field.value === true;
		case "listItems":
			return Array.isArray(field.value) ? field.value : [];
		case "optional":
			return field.optional === true;
		case "question":
			return field.question ?? "";
		case "dateFormat":
			return field.dateFormat ?? (isDateType(field.type) ? DEFAULT_DATE_FORMATS[field.type] : undefined);
		case "customFormat":
			return field.customFormat ?? "";
		case "from":
			return field.at !== undefined ? SET_DATE : field.from ?? AT_CREATION;
		case "at":
			return field.at ?? "";
		case "choiceValue":
			return field.choices?.[index ?? -1]?.value;
		case "choiceLabel":
			return field.choices?.[index ?? -1]?.label ?? "";
		case "storeAs":
			return field.storeAs ?? "text";
		default:
			return field[setting];
	}
}

export function writeFieldSetting(field: FormField, setting: FieldSetting, value: unknown, index?: number): boolean {
	const text = typeof value === "string" ? value : "";
	switch (setting) {
		case "saveAs": {
			const saveAs = SAVE_AS.find((candidate) => candidate === value);
			if (saveAs) field.saveAs = saveAs;
			return saveAs !== undefined;
		}
		case "key":
			field.key = text.trim();
			return true;
		case "mode": {
			const mode = FIELD_MODES.find((candidate) => candidate === value);
			if (!mode) return false;
			const previous = field.type;
			field.mode = mode;
			field.type = typeForMode(field.type, mode);
			normalizeField(field, previous);
			return true;
		}
		case "type": {
			const type = typesFor(field.mode).find((candidate) => candidate === value);
			if (!type) return false;
			const previous = field.type;
			field.type = type;
			normalizeField(field, previous);
			return true;
		}
		case "text":
			field.value = text;
			return true;
		case "number": {
			const number = parseNumber(text);
			if (number === undefined) delete field.value;
			else field.value = number;
			return true;
		}
		case "checked":
			field.value = value === true;
			return true;
		case "listItems":
			field.value = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "") : [];
			return true;
		case "optional":
			if (value === true) field.optional = true;
			else delete field.optional;
			return true;
		case "question":
			if (text.trim() === "") delete field.question;
			else field.question = text;
			return true;
		case "storeAs":
			field.storeAs = STORED_CHOICE_TYPES.find((candidate) => candidate === value) ?? "text";
			return true;
		case "dateFormat":
			field.dateFormat = DATE_FORMATS.find((candidate) => candidate === value) ?? field.dateFormat;
			return true;
		case "customFormat":
			field.customFormat = text;
			return true;
		case "from":
			if (text === AT_CREATION) {
				delete field.from;
				delete field.at;
			} else if (text === SET_DATE) {
				delete field.from;
				field.at = field.at ?? "";
			} else {
				field.from = text;
				delete field.at;
			}
			return true;
		case "at":
			field.at = text;
			return true;
		case "choiceValue":
		case "choiceLabel":
			return writeChoice(field, setting, index, text);
	}
}

export function fieldValueError(setting: FieldSetting, value: string): string | undefined {
	if (setting !== "number" || value.trim() === "" || parseNumber(value) !== undefined) return undefined;
	return t("presetNumberError");
}

export function toggleExpandedField(expanded: Map<string, string>, formId: string, fieldId: string): boolean {
	if (expanded.get(formId) === fieldId) {
		expanded.delete(formId);
		return false;
	}
	expanded.set(formId, fieldId);
	return true;
}

export interface HeaderClick {
	inEditor: boolean;
	inControls: boolean;
	onChevron: boolean;
}

export function headerClickToggles(click: HeaderClick): boolean {
	if (click.inEditor) return false;
	return click.onChevron || !click.inControls;
}

export function addChoice(field: FormField): void {
	field.choices = [...(field.choices ?? []), { value: "" }];
}

export function deleteChoice(field: FormField, index: number): void {
	field.choices?.splice(index, 1);
}

export function moveChoice(field: FormField, from: number, to: number): void {
	const choices = field.choices;
	if (choices) choices.splice(to, 0, ...choices.splice(from, 1));
}

export function addListItem(field: FormField, item: string): void {
	const items = Array.isArray(field.value) ? field.value : [];
	const trimmed = item.trim();
	if (trimmed === "") return;
	field.value = [...items, trimmed];
}

export function removeListItem(field: FormField, index: number): void {
	if (!Array.isArray(field.value)) return;
	field.value = field.value.filter((_item, position) => position !== index);
}

function writeChoice(field: FormField, setting: "choiceValue" | "choiceLabel", index: number | undefined, text: string): boolean {
	const choice = field.choices?.[index ?? -1];
	if (!choice) return false;
	if (setting === "choiceValue") choice.value = text.trim();
	else if (text.trim() === "") delete choice.label;
	else choice.label = text;
	return true;
}

function typeForMode(type: FieldType, mode: FieldMode): FieldType {
	if (typesFor(mode).includes(type)) return type;
	if (type === "list") return "multiselect";
	if (type === "multiselect") return "list";
	return "text";
}

function normalizeField(field: FormField, previous: FieldType): void {
	if (field.mode === "static") {
		delete field.optional;
		delete field.question;
	} else {
		delete field.value;
		delete field.from;
		delete field.at;
	}
	if (previous !== field.type || field.mode === "ask") delete field.value;
	if (field.mode === "ask" && hasChoices(field.type)) {
		field.choices = field.choices ?? [];
		field.storeAs = field.storeAs ?? "text";
	} else {
		delete field.choices;
		delete field.storeAs;
	}
	if (isDateType(field.type)) {
		const presets = Object.values(DEFAULT_DATE_FORMATS);
		if (field.dateFormat === undefined || (presets.includes(field.dateFormat) && field.dateFormat !== DEFAULT_DATE_FORMATS[field.type])) {
			field.dateFormat = DEFAULT_DATE_FORMATS[field.type];
		}
	} else {
		delete field.dateFormat;
		delete field.customFormat;
		delete field.from;
		delete field.at;
	}
}
