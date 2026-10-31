import { t, translatedLabels } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import { operatorLabel } from "../i18n/labels.ts";
import {
	BLOCK_OPERATORS,
	DATE_FORMATS,
	DEFAULT_DATE_FORMATS,
	FIELD_MODES,
	FIELD_TYPES,
	SAVE_AS,
	blockOf,
	fieldSource,
	formFields,
	formIds,
	isBlock,
	isDateType,
	newFormId,
	operatorsFor,
	sourcesFor,
	takesValue,
} from "../forms/form.ts";
import type {
	BlockCondition,
	BlockOperator,
	DateFormat,
	FieldMode,
	FieldSource,
	FieldType,
	Form,
	FormBlock,
	FormField,
	FormItem,
	SaveAs,
} from "../forms/form.ts";
import { duplicateEntry } from "./duplicate.ts";
import { parseNumber } from "../setProperties/values.ts";
import { SET_DATE_PLACEHOLDERS, readsAsDate } from "../forms/dateInput.ts";
import { readListField, sourceOptions, writeListField } from "./listForm.ts";
import type { SourceChoice } from "./listForm.ts";
import { filterRules } from "../lists/filters.ts";
import type { ListSource, NoteList } from "../settings.ts";

export type FormSetting = "enabled" | "name" | "namePattern" | "contentPattern" | "folder" | "opensNote";

export type BlockSetting = "key" | "operator" | "value";

export type FieldRow = { kind: "field"; field: FormField; block?: FormBlock } | { kind: "head"; block: FormBlock } | { kind: "foot"; block: FormBlock };

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
	| "entryTime"
	| "question"
	| "source"
	| "notesSource"
	| "notesNote"
	| "notesFolder"
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

const SOURCE_KEYS: Record<FieldSource, TranslationKey> = {
	typed: "formSourceTyped",
	options: "formSourceOptions",
	notes: "formSourceNotes",
};

const SOURCE_BADGE_KEYS: Record<Exclude<FieldSource, "typed">, TranslationKey> = {
	options: "formSummaryOptions",
	notes: "formSummaryNotes",
};

const NOTES_SOURCE_CHOICES: readonly SourceChoice[] = ["filter", "linksToNote", "inFolder", "modifiedToday", "linksOut", "linksIn", "sameDay"];

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

export function fieldTypeOptions(): Record<string, string> {
	const options: Record<string, string> = {};
	for (const type of FIELD_TYPES) options[type] = fieldTypeLabel(type);
	return options;
}

export function fieldSourceLabel(source: FieldSource): string {
	return t(SOURCE_KEYS[source]);
}

export function fieldSourceOptions(type: FieldType): Record<string, string> {
	const options: Record<string, string> = {};
	for (const source of sourcesFor(type)) options[source] = fieldSourceLabel(source);
	return options;
}

export function notesSourceOptions(field: FormField): Record<string, string> {
	const all = sourceOptions();
	const options: Record<string, string> = {};
	for (const choice of NOTES_SOURCE_CHOICES) options[choice] = all[choice];
	const current = field.notesFrom?.kind;
	if (current !== undefined && current !== "unreadable" && !(current in options)) options[current] = all[current];
	return options;
}

export function saveAsOptions(): Record<SaveAs, string> {
	return translatedLabels(SAVE_AS_KEYS);
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
	for (const other of formFields(form)) {
		if (other === field || other.key === "" || !isDateType(other.type)) continue;
		options[other.key] = t("formFromField", { key: other.key });
	}
	if (field.from !== undefined && !(field.from in options)) options[field.from] = t("formFromMissingField", { key: field.from });
	return options;
}

export function formRowName(form: Form): string {
	return form.name.trim() || t("newForm");
}

export function fieldRowName(field: FormField): string {
	return field.key.trim() || t("newField");
}

export type FieldBadgeKind = "property" | "variable" | "fixed" | "ask" | "type";

export interface FieldBadge {
	kind: FieldBadgeKind;
	text: string;
}

export function fieldBadges(field: FormField): FieldBadge[] {
	const mode = field.mode === "static" ? t("formSummaryFixed") : field.entryTime ? t("formSummaryEntryTime") : field.optional ? t("formSummaryAskOptional") : t("formSummaryAsk");
	return [
		field.saveAs === "property" ? { kind: "property", text: t("formSummaryProperty") } : { kind: "variable", text: t("formSummaryVariable") },
		{ kind: field.mode === "static" ? "fixed" : "ask", text: mode },
		{ kind: "type", text: fieldTypeBadge(field) },
	];
}

function fieldTypeBadge(field: FormField): string {
	const source = fieldSource(field);
	const type = fieldTypeLabel(field.type);
	return source === undefined || source === "typed" ? type : `${type} · ${t(SOURCE_BADGE_KEYS[source])}`;
}

export function fieldSummary(field: FormField): string {
	const [saveAs, mode, type] = fieldBadges(field).map((badge) => badge.text);
	return [fieldRowName(field), mode, type, saveAs].join(" · ");
}

export function fieldWarning(form: Form, field: FormField): string | undefined {
	if (field.key.trim() === "") return t("formFieldNeedsKey");
	if (field.mode === "static" && field.from !== undefined && !formFields(form).some((other) => other !== field && other.key === field.from && isDateType(other.type))) {
		return t("formFromMissingField", { key: field.from });
	}
	if (field.mode === "static" && field.at !== undefined && isDateType(field.type) && !readsAsDate(field.type, field.at)) {
		return t("formSetDateUnreadable", { format: SET_DATE_PLACEHOLDERS[field.type] });
	}
	if (field.entryTime && formFields(form).some((other) => other !== field && other.entryTime && other.mode === "ask" && (other.type === field.type || other.type === "datetime" || field.type === "datetime"))) return t("formSecondEntryTime");
	const source = fieldSource(field);
	if (source === "options" && !(field.choices ?? []).some((choice) => choice.value.trim() !== "")) return t("formNeedsChoices");
	if (source === "notes") return notesSourceWarning(field.notesFrom);
	return undefined;
}

function notesSourceWarning(source: ListSource | undefined): string | undefined {
	if (!source || source.kind === "unreadable") return t("unreadableListWarning");
	if (source.kind === "linksToNote" && source.note.trim() === "") return t("noteNotChosen");
	if (source.kind === "inFolder" && source.folder.trim() === "") return t("folderNotChosen");
	if (source.kind === "filter" && filterRules(source.filter).length === 0) return t("filterEmptyDesc");
	return undefined;
}

export function formWarning(form: Form): string | undefined {
	if (form.unreadable) return t("unreadableFormWarning");
	if (formFields(form).some((field) => fieldWarning(form, field) !== undefined)) return t("formFieldsNeedAttention");
	if (form.fields.some((item) => isBlock(item) && blockWarning(form, item) !== undefined)) return t("formFieldsNeedAttention");
	return undefined;
}

export function fieldRows(form: Pick<Form, "fields">): FieldRow[] {
	const rows: FieldRow[] = [];
	for (const item of form.fields) {
		if (!isBlock(item)) {
			rows.push({ kind: "field", field: item });
			continue;
		}
		rows.push({ kind: "head", block: item });
		for (const field of item.fields) rows.push({ kind: "field", field, block: item });
		rows.push({ kind: "foot", block: item });
	}
	return rows;
}

export function moveFieldRow(form: Pick<Form, "fields">, from: number, to: number): boolean {
	const rows = fieldRows(form);
	const moved = rows[from];
	if (!moved || moved.kind === "foot" || from === to || to < 0 || to >= rows.length) return false;
	if (moved.kind === "head") {
		const footIndex = rows.findIndex((row) => row.kind === "foot" && row.block === moved.block);
		const segment = rows.splice(from, footIndex - from + 1);
		rows.splice(to < from ? to : to - segment.length + 1, 0, ...segment);
	} else {
		rows.splice(to, 0, ...rows.splice(from, 1));
	}
	return replaceItems(form, rows);
}

export function deleteFieldRow(form: Pick<Form, "fields">, index: number): string | undefined {
	const row = fieldRows(form)[index];
	if (!row || row.kind === "foot") return undefined;
	if (row.kind === "head") {
		form.fields.splice(form.fields.indexOf(row.block), 1, ...row.block.fields);
		return row.block.id;
	}
	const container: FormItem[] = row.block ? row.block.fields : form.fields;
	container.splice(container.indexOf(row.field), 1);
	return row.field.id;
}

function replaceItems(form: Pick<Form, "fields">, rows: readonly FieldRow[]): boolean {
	const items: FormItem[] = [];
	const members = new Map<FormBlock, FormField[]>();
	let open: FormBlock | undefined;
	for (const row of rows) {
		if (row.kind === "head") {
			if (open) return false;
			open = row.block;
			members.set(open, []);
			items.push(open);
		} else if (row.kind === "foot") {
			if (open !== row.block) return false;
			open = undefined;
		} else if (open) {
			members.get(open)?.push(row.field);
		} else {
			items.push(row.field);
		}
	}
	if (open) return false;
	for (const [block, fields] of members) block.fields.splice(0, block.fields.length, ...fields);
	form.fields.splice(0, form.fields.length, ...items);
	return true;
}

export function fieldsAbove(form: Pick<Form, "fields">, block: FormBlock): FormField[] {
	const above: FormField[] = [];
	for (const item of form.fields) {
		if (item === block) return above;
		if (isBlock(item)) above.push(...item.fields);
		else above.push(item);
	}
	return above;
}

export function conditionField(form: Pick<Form, "fields">, block: FormBlock, key: string): FormField | undefined {
	if (key === "") return undefined;
	const above = fieldsAbove(form, block);
	for (let index = above.length - 1; index >= 0; index--) if (above[index].key === key) return above[index];
	return undefined;
}

export function conditionOperators(form: Pick<Form, "fields">, block: FormBlock, key: string): readonly BlockOperator[] {
	return operatorsFor(conditionField(form, block, key)?.type ?? "text");
}

export function conditionKeyOptions(form: Pick<Form, "fields">, block: FormBlock, condition: BlockCondition): Record<string, string> {
	const options: Record<string, string> = {};
	if (condition.key === "") options[""] = t("formBlockChooseField");
	for (const field of fieldsAbove(form, block)) if (field.key !== "") options[field.key] = field.key;
	if (condition.key !== "" && !(condition.key in options)) options[condition.key] = t("formBlockMissingField", { key: condition.key });
	return options;
}

export function conditionOperatorOptions(form: Pick<Form, "fields">, block: FormBlock, condition: BlockCondition): Record<string, string> {
	const options: Record<string, string> = {};
	for (const operator of conditionOperators(form, block, condition.key)) options[operator] = operatorLabel(operator);
	if (!(condition.operator in options)) options[condition.operator] = t("operatorDoesNotApply", { operator: operatorLabel(condition.operator) });
	return options;
}

export function conditionValueOptions(form: Pick<Form, "fields">, block: FormBlock, condition: BlockCondition): Record<string, string> | undefined {
	const field = conditionField(form, block, condition.key);
	if (!field || fieldSource(field) !== "options") return undefined;
	const options: Record<string, string> = {};
	for (const choice of field.choices ?? []) if (choice.value !== "") options[choice.value] = choice.label ?? choice.value;
	const value = condition.value ?? "";
	if (!(value in options)) options[value] = value === "" ? t("formBlockChooseValue") : value;
	return options;
}

export function conditionSummary(form: Pick<Form, "fields">, block: FormBlock, condition: BlockCondition): string {
	const key = condition.key === "" ? t("formBlockChooseField") : condition.key;
	const parts = [key, operatorLabel(condition.operator)];
	if (takesValue(condition.operator)) {
		const value = condition.value ?? "";
		const choices = conditionValueOptions(form, block, condition);
		parts.push(choices && value !== "" ? choices[value] : value === "" ? t("formBlockChooseValue") : value);
	}
	return parts.join(" ");
}

export function blockSummary(form: Pick<Form, "fields">, block: FormBlock): string {
	if (block.conditions.length === 0) return t("formBlockNoConditions");
	return block.conditions.map((condition) => conditionSummary(form, block, condition)).join(" · ");
}

export function blockWarning(form: Pick<Form, "fields">, block: FormBlock): string | undefined {
	if (block.conditions.length === 0) return t("formBlockNeedsCondition");
	for (const condition of block.conditions) {
		if (condition.key === "") return t("formBlockConditionNeedsField");
		const field = conditionField(form, block, condition.key);
		if (!field) return t("formBlockMissingField", { key: condition.key });
		if (!operatorsFor(field.type).includes(condition.operator)) {
			return t("formBlockOperatorDoesNotApply", { operator: operatorLabel(condition.operator), type: fieldTypeLabel(field.type) });
		}
		if (takesValue(condition.operator) && (condition.value ?? "").trim() === "") return t("formBlockConditionNeedsValue");
		if (isDateType(field.type) && takesValue(condition.operator) && !readsAsDate(field.type, condition.value ?? "")) {
			return t("formSetDateUnreadable", { format: SET_DATE_PLACEHOLDERS[field.type] });
		}
	}
	if (block.fields.length === 0) return t("formBlockNeedsFields");
	return undefined;
}

export function findBlock(form: Form, blockId: string): FormBlock | undefined {
	return form.fields.find((item): item is FormBlock => isBlock(item) && item.id === blockId);
}

export function readBlockSetting(block: FormBlock, setting: BlockSetting, index?: number): unknown {
	const condition = block.conditions[index ?? -1];
	if (!condition) return undefined;
	if (setting === "value") return condition.value ?? "";
	return condition[setting];
}

export function writeBlockSetting(form: Form, block: FormBlock, setting: BlockSetting, value: unknown, index?: number): boolean {
	const condition = block.conditions[index ?? -1];
	if (!condition) return false;
	const text = typeof value === "string" ? value.trim() : "";
	if (setting === "key") {
		condition.key = text;
		const operators = conditionOperators(form, block, text);
		if (!operators.includes(condition.operator)) condition.operator = operators[0];
	} else if (setting === "operator") {
		const operator = BLOCK_OPERATORS.find((candidate) => candidate === value);
		if (!operator) return false;
		condition.operator = operator;
	} else {
		condition.value = text;
	}
	if (!takesValue(condition.operator)) delete condition.value;
	return true;
}

export function addCondition(block: FormBlock): void {
	block.conditions.push({ key: "", operator: "is" });
}

export function deleteCondition(block: FormBlock, index: number): void {
	block.conditions.splice(index, 1);
}

export function duplicateField(form: Form, field: FormField): FormField | undefined {
	const id = newFormId(formIds(form));
	const block = blockOf(form, field);
	if (block) return duplicateEntry(block.fields, field, id);
	const copy = duplicateEntry<FormItem>(form.fields, field, id);
	return copy && !isBlock(copy) ? copy : undefined;
}

export function duplicateBlock(form: Form, block: FormBlock): FormBlock | undefined {
	const index = form.fields.indexOf(block);
	if (index === -1) return undefined;
	const known = formIds(form);
	const copy: FormBlock = { ...structuredClone(block), id: newFormId(known) };
	known.push(copy);
	copy.fields = copy.fields.map((field) => {
		const minted = { ...field, id: newFormId(known) };
		known.push(minted);
		return minted;
	});
	form.fields.splice(index + 1, 0, copy);
	return copy;
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
	return formFields(form).find((field) => field.id === fieldId);
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
		case "entryTime":
			return field.entryTime === true;
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
		case "source":
			return fieldSource(field);
		case "notesSource":
			return field.notesFrom?.kind;
		case "notesNote":
			return field.notesFrom ? readListField(notesList(field, field.notesFrom), "note") : undefined;
		case "notesFolder":
			return field.notesFrom ? readListField(notesList(field, field.notesFrom), "folder") : undefined;
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
			field.mode = mode;
			normalizeField(field, field.type);
			return true;
		}
		case "type": {
			const type = FIELD_TYPES.find((candidate) => candidate === value);
			if (!type) return false;
			const previous = field.type;
			field.type = type;
			normalizeField(field, previous);
			return true;
		}
		case "source": {
			const source = sourcesFor(field.type).find((candidate) => candidate === value);
			if (!source || field.mode !== "ask") return false;
			field.source = source;
			normalizeField(field, field.type);
			return true;
		}
		case "notesSource":
		case "notesNote":
		case "notesFolder":
			return writeNotesSource(field, setting, value);
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
		case "entryTime":
			if (value === true && isDateType(field.type)) field.entryTime = true;
			else delete field.entryTime;
			return true;
		case "question":
			if (text.trim() === "") delete field.question;
			else field.question = text;
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

function notesList(field: FormField, source: ListSource): NoteList {
	return { id: field.id, enabled: true, prefix: "", source };
}

function writeNotesSource(field: FormField, setting: "notesSource" | "notesNote" | "notesFolder", value: unknown): boolean {
	if (fieldSource(field) !== "notes" || !field.notesFrom) return false;
	const list = notesList(field, field.notesFrom);
	if (setting === "notesSource" && !NOTES_SOURCE_CHOICES.includes(value as SourceChoice)) return false;
	writeListField(list, setting === "notesSource" ? "source" : setting === "notesNote" ? "note" : "folder", value);
	field.notesFrom = list.source;
	return true;
}

function defaultNotesSource(): ListSource {
	return { kind: "modifiedToday" };
}

function normalizeField(field: FormField, previous: FieldType): void {
	if (field.mode === "static") {
		delete field.optional;
		delete field.question;
		delete field.entryTime;
	} else {
		delete field.value;
		delete field.from;
		delete field.at;
	}
	if (previous !== field.type || field.mode === "ask") delete field.value;
	const source = fieldSource(field);
	if (source === undefined) delete field.source;
	else field.source = source;
	if (source === "options") field.choices = field.choices ?? [];
	else delete field.choices;
	if (source === "notes") field.notesFrom = field.notesFrom ?? defaultNotesSource();
	else delete field.notesFrom;
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
		delete field.entryTime;
	}
}
