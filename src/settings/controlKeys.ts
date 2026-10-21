import type { Period } from "../lists/dateNotes.ts";
import type { JumpSettings } from "../settings.ts";
import { isPeriod, readPeriodField, writeDateNoteSource, writePeriodField } from "./dateNotesForm.ts";
import type { PeriodField } from "./dateNotesForm.ts";
import { readListField, writeListField } from "./listForm.ts";
import type { ListField } from "./listForm.ts";
import {
	readLinkListField,
	readSetPropertiesField,
	writeFlag,
	writeLinkListField,
	writeSetPropertiesField,
} from "./setPropertiesForm.ts";
import type { LinkListField } from "./setPropertiesForm.ts";

export const DATE_NOTE_SOURCE_KEY = "dateNotes/from";

export const FLAGS_PREFIX_KEY = "setProperties/flagsPrefix";

export const TEMPLATES_FOLDER_KEY = "setProperties/templatesFolder";

export function listKey(id: string, field: ListField): string {
	return `list/${id}/${field}`;
}

export function flagKey(index: number): string {
	return `flag/${index}/name`;
}

export function linkListKey(id: string, field: LinkListField): string {
	return `linkList/${id}/${field}`;
}

export function periodKey(period: Period, field: PeriodField): string {
	return `dateNotes/${period}/${field}`;
}

export function readControl(settings: JumpSettings, key: string): unknown {
	if (key === DATE_NOTE_SOURCE_KEY) return settings.dateNotes.from;
	const [scope, name, field] = key.split("/");
	if (scope === "list") {
		const list = settings.lists.find((candidate) => candidate.id === name);
		return list ? readListField(list, field as ListField) : undefined;
	}
	if (scope === "dateNotes" && isPeriod(name)) return readPeriodField(settings.dateNotes, name, field as PeriodField);
	if (scope === "setProperties") return readSetPropertiesField(settings.setProperties, name);
	if (scope === "flag") return settings.setProperties.flags[Number(name)];
	if (scope === "linkList") {
		const list = settings.setProperties.linkLists.find((candidate) => candidate.id === name);
		return list ? readLinkListField(list, field as LinkListField) : undefined;
	}
	return undefined;
}

export function writeControl(settings: JumpSettings, key: string, value: unknown): boolean {
	if (key === DATE_NOTE_SOURCE_KEY) {
		writeDateNoteSource(settings.dateNotes, value);
		return true;
	}
	const [scope, name, field] = key.split("/");
	if (scope === "list") {
		const list = settings.lists.find((candidate) => candidate.id === name);
		if (list) writeListField(list, field as ListField, value);
		return list !== undefined;
	}
	if (scope === "dateNotes" && isPeriod(name)) {
		writePeriodField(settings.dateNotes, name, field as PeriodField, value);
		return true;
	}
	if (scope === "setProperties") return writeSetPropertiesField(settings.setProperties, name, value);
	if (scope === "flag") return writeFlag(settings.setProperties, Number(name), value);
	if (scope === "linkList") {
		const list = settings.setProperties.linkLists.find((candidate) => candidate.id === name);
		if (list) writeLinkListField(list, field as LinkListField, value);
		return list !== undefined;
	}
	return false;
}
