import { formFields, newField } from "./form.ts";
import type { DateFieldType, DateFormat, Form, FormField } from "./form.ts";

export type FieldPreset = "blank" | "date" | "time" | "timestamp" | "isoTimestamp" | "entryDate" | "entryTime";

export const FIELD_PRESETS: readonly FieldPreset[] = ["blank", "date", "time", "timestamp", "isoTimestamp", "entryDate", "entryTime"];

const DATE_PRESETS: Record<Exclude<FieldPreset, "blank" | "entryDate" | "entryTime">, { key: string; type: DateFieldType; dateFormat: DateFormat }> = {
	date: { key: "date", type: "date", dateFormat: "YYYY-MM-DD" },
	time: { key: "time", type: "time", dateFormat: "HH:mm" },
	timestamp: { key: "timestamp", type: "datetime", dateFormat: "YYYY-MM-DDTHH:mm" },
	isoTimestamp: { key: "iso-timestamp", type: "datetime", dateFormat: "iso" },
};

export function presetFormat(preset: FieldPreset): DateFormat | undefined {
	return preset === "blank" || preset === "entryTime" || preset === "entryDate" ? undefined : DATE_PRESETS[preset].dateFormat;
}

export function presetField(form: Form, preset: FieldPreset): FormField {
	const blank = newField(form);
	if (preset === "blank") return blank;
	const field = withoutSource(blank);
	if (preset === "entryDate") {
		return { ...field, key: unusedKey(form, "entry-date"), saveAs: "variable", type: "date", dateFormat: "YYYY-MM-DD", entryTime: true };
	}
	if (preset === "entryTime") {
		return { ...field, key: unusedKey(form, "entry-time"), saveAs: "variable", type: "time", dateFormat: "HH:mm", entryTime: true };
	}
	const { key, type, dateFormat } = DATE_PRESETS[preset];
	return { ...field, key: unusedKey(form, key), mode: "static", type, dateFormat };
}

function withoutSource(field: FormField): FormField {
	const dated = { ...field };
	delete dated.source;
	return dated;
}

function unusedKey(form: Form, key: string): string {
	const taken = new Set(formFields(form).map((field) => field.key.trim()));
	if (!taken.has(key)) return key;
	let index = 2;
	while (taken.has(`${key}-${index}`)) index += 1;
	return `${key}-${index}`;
}
