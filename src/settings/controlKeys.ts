import type { Period } from "../lists/dateNotes.ts";
import { CHECKBOX_MODES, allLists } from "../settings.ts";
import type { JumpSettings } from "../settings.ts";
import { isPeriod, readPeriodField, writeDateNoteSource, writePeriodField } from "./dateNotesForm.ts";
import type { PeriodField } from "./dateNotesForm.ts";
import { findFixedValue, readFixedValueSetting, writeFixedValueSetting } from "./fixedValuesForm.ts";
import type { FixedValueSetting } from "./fixedValuesForm.ts";
import { findField, readFieldSetting, readFormSetting, writeFieldSetting, writeFormSetting } from "./formsForm.ts";
import type { FieldSetting, FormSetting } from "./formsForm.ts";
import { readListField, writeListField } from "./listForm.ts";
import type { ListField } from "./listForm.ts";
import {
	readPropertyField,
	readPropertySourceField,
	writePropertyField,
	writePropertySourceField,
} from "./setPropertiesForm.ts";
import type { PropertyField } from "./setPropertiesForm.ts";
import {
	findTaskAction,
	findTaskCommand,
	readTaskActionSetting,
	readTaskCommandSetting,
	writeTaskActionSetting,
	writeTaskCommandSetting,
} from "./taskCommandsForm.ts";
import type { TaskActionSetting, TaskCommandSetting } from "./taskCommandsForm.ts";

export const DATE_NOTE_SOURCE_KEY = "dateNotes/from";

export const SHOW_PREFIXES_KEY = "display/showPrefixes";

export const CHECKBOX_MODE_KEY = "setProperties/checkboxMode";

export function listKey(id: string, field: ListField): string {
	return `list/${id}/${field}`;
}

export type NotePickerField = "enabled" | "name";

export function notePickerKey(id: string, field: NotePickerField): string {
	return `notePicker/${id}/${field}`;
}

export function propertyKey(id: string, field: PropertyField): string {
	return `property/${id}/${field}`;
}

export function prefixColorKey(prefixKey: string): string {
	return `${prefixKey}Color`;
}

export function excludedFolderKey(id: string, index: number): string {
	return `property/${id}/excludedFolders/${index}`;
}

export function presetValueKey(id: string, index: number): string {
	return `property/${id}/presetValues/${index}`;
}

export function mainMenuPresetKey(id: string, index: number): string {
	return `property/${id}/mainMenuPreset/${index}`;
}

export function propertySourceKey(id: string, field: ListField): string {
	return `propertySource/${id}/${field}`;
}

export function fixedValueKey(id: string, valueId: string, setting: FixedValueSetting): string {
	return `fixedValue/${id}.${valueId}/${setting}`;
}

export function formKey(id: string, setting: FormSetting): string {
	return `form/${id}/${setting}`;
}

export function formFieldKey(formId: string, fieldId: string, setting: FieldSetting, index?: number): string {
	const key = `formField/${formId}.${fieldId}/${setting}`;
	return index === undefined ? key : `${key}/${index}`;
}

export function taskCommandKey(id: string, setting: TaskCommandSetting, index?: number): string {
	const key = `taskCommand/${id}/${setting}`;
	return index === undefined ? key : `${key}/${index}`;
}

export function taskActionKey(commandId: string, actionId: string, setting: TaskActionSetting, index?: string): string {
	const key = `taskAction/${commandId}.${actionId}/${setting}`;
	return index === undefined ? key : `${key}/${index}`;
}

export function periodKey(period: Period, field: PeriodField): string {
	return `dateNotes/${period}/${field}`;
}

export function readControl(settings: JumpSettings, key: string): unknown {
	if (key === SHOW_PREFIXES_KEY) return settings.showPrefixes;
	if (key === DATE_NOTE_SOURCE_KEY) return settings.dateNotes.from;
	if (key === CHECKBOX_MODE_KEY) return settings.setProperties.checkboxMode;
	const [scope, name, field, index] = key.split("/");
	if (scope === "form" || scope === "formField") return readFormControl(settings, scope, name, field, index);
	if (scope === "taskCommand" || scope === "taskAction") return readTaskControl(settings, scope, name, field, index);
	if (scope === "notePicker") {
		const picker = settings.notePickers.find((candidate) => candidate.id === name && !candidate.unreadable);
		return picker && (field === "enabled" || field === "name") ? picker[field] : undefined;
	}
	if (scope === "list") {
		const list = allLists(settings).find((candidate) => candidate.id === name);
		return list ? readListField(list, field as ListField) : undefined;
	}
	if (scope === "dateNotes" && isPeriod(name)) return readPeriodField(settings.dateNotes, name, field as PeriodField);
	if (scope === "fixedValue") {
		const fixed = fixedValueTarget(settings, name);
		return fixed ? readFixedValueSetting(fixed, field as FixedValueSetting) : undefined;
	}
	const entry = settings.setProperties.properties.find((candidate) => candidate.id === name);
	if (!entry) return undefined;
	if (scope === "property") return readPropertyField(entry, field as PropertyField, index);
	if (scope === "propertySource") return readPropertySourceField(entry, field as ListField);
	return undefined;
}

export function writeControl(settings: JumpSettings, key: string, value: unknown): boolean {
	if (key === SHOW_PREFIXES_KEY) {
		if (typeof value !== "boolean") return false;
		settings.showPrefixes = value;
		return true;
	}
	if (key === DATE_NOTE_SOURCE_KEY) {
		writeDateNoteSource(settings.dateNotes, value);
		return true;
	}
	if (key === CHECKBOX_MODE_KEY) {
		const mode = CHECKBOX_MODES.find((candidate) => candidate === value);
		if (mode) settings.setProperties.checkboxMode = mode;
		return mode !== undefined;
	}
	const [scope, name, field, index] = key.split("/");
	if (scope === "form" || scope === "formField") return writeFormControl(settings, scope, name, field, index, value);
	if (scope === "taskCommand" || scope === "taskAction") return writeTaskControl(settings, scope, name, field, index, value);
	if (scope === "notePicker") {
		const picker = settings.notePickers.find((candidate) => candidate.id === name && !candidate.unreadable);
		if (!picker) return false;
		if (field === "enabled") picker.enabled = value === true;
		else if (field === "name") picker.name = typeof value === "string" ? value : "";
		else return false;
		return true;
	}
	if (scope === "list") {
		const list = allLists(settings).find((candidate) => candidate.id === name);
		if (list) writeListField(list, field as ListField, value);
		return list !== undefined;
	}
	if (scope === "dateNotes" && isPeriod(name)) {
		writePeriodField(settings.dateNotes, name, field as PeriodField, value);
		return true;
	}
	if (scope === "fixedValue") {
		const fixed = fixedValueTarget(settings, name);
		return fixed ? writeFixedValueSetting(fixed, field as FixedValueSetting, value) : false;
	}
	const entry = settings.setProperties.properties.find((candidate) => candidate.id === name);
	if (!entry) return false;
	if (scope === "propertySource") return writePropertySourceField(entry, field as ListField, value);
	if (scope !== "property") return false;
	return writePropertyField(entry, field as PropertyField, value, index);
}

function fixedValueTarget(settings: JumpSettings, name: string) {
	const [entryId, valueId] = name.split(".");
	const entry = settings.setProperties.properties.find((candidate) => candidate.id === entryId);
	return entry ? findFixedValue(entry, valueId ?? "") : undefined;
}

function formTarget(settings: JumpSettings, scope: string, name: string) {
	const [formId, fieldId] = name.split(".");
	const form = settings.forms.find((candidate) => candidate.id === formId && !candidate.unreadable);
	if (!form) return undefined;
	if (scope === "form") return { form, field: undefined };
	const field = findField(form, fieldId ?? "");
	return field ? { form, field } : undefined;
}

function readFormControl(settings: JumpSettings, scope: string, name: string, setting: string, index: string | undefined): unknown {
	const target = formTarget(settings, scope, name);
	if (!target) return undefined;
	if (!target.field) return readFormSetting(target.form, setting as FormSetting);
	return readFieldSetting(target.field, setting as FieldSetting, index === undefined ? undefined : Number(index));
}

function writeFormControl(
	settings: JumpSettings,
	scope: string,
	name: string,
	setting: string,
	index: string | undefined,
	value: unknown,
): boolean {
	const target = formTarget(settings, scope, name);
	if (!target) return false;
	if (!target.field) return writeFormSetting(target.form, setting as FormSetting, value);
	return writeFieldSetting(target.field, setting as FieldSetting, value, index === undefined ? undefined : Number(index));
}

function taskTarget(settings: JumpSettings, scope: string, name: string) {
	const [commandId, actionId] = name.split(".");
	const command = findTaskCommand(settings.taskCommands, commandId ?? "");
	if (!command) return undefined;
	if (scope === "taskCommand") return { command, action: undefined };
	const action = findTaskAction(command, actionId ?? "");
	return action ? { command, action } : undefined;
}

function readTaskControl(settings: JumpSettings, scope: string, name: string, setting: string, index: string | undefined): unknown {
	const target = taskTarget(settings, scope, name);
	if (!target) return undefined;
	if (!target.action) return readTaskCommandSetting(target.command, setting as TaskCommandSetting, index);
	return readTaskActionSetting(target.command, target.action, setting as TaskActionSetting, index);
}

function writeTaskControl(
	settings: JumpSettings,
	scope: string,
	name: string,
	setting: string,
	index: string | undefined,
	value: unknown,
): boolean {
	const target = taskTarget(settings, scope, name);
	if (!target) return false;
	if (!target.action) return writeTaskCommandSetting(target.command, setting as TaskCommandSetting, value, index);
	return writeTaskActionSetting(target.command, target.action, setting as TaskActionSetting, value, index);
}
