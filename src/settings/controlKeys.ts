import type { Period } from "../lists/dateNotes.ts";
import type { JumpSettings } from "../settings.ts";
import { isPeriod, readPeriodField, writeDateNoteSource, writePeriodField } from "./dateNotesForm.ts";
import type { PeriodField } from "./dateNotesForm.ts";
import { readListField, writeListField } from "./listForm.ts";
import type { ListField } from "./listForm.ts";

export const DATE_NOTE_SOURCE_KEY = "dateNotes/from";

export function listKey(id: string, field: ListField): string {
	return `list/${id}/${field}`;
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
	return false;
}
