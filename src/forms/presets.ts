import { newField } from "./form.ts";
import type { DateFieldType, DateFormat, Form, FormField } from "./form.ts";

export type FieldPreset = "blank" | "date" | "time" | "timestamp" | "isoTimestamp" | "entryTime";

export const FIELD_PRESETS: readonly FieldPreset[] = ["blank", "date", "time", "timestamp", "isoTimestamp", "entryTime"];

const DATE_PRESETS: Record<Exclude<FieldPreset, "blank" | "entryTime">, { key: string; type: DateFieldType; dateFormat: DateFormat }> = {
	date: { key: "date", type: "date", dateFormat: "YYYY-MM-DD" },
	time: { key: "time", type: "time", dateFormat: "HH:mm" },
	timestamp: { key: "timestamp", type: "datetime", dateFormat: "YYYY-MM-DDTHH:mm" },
	isoTimestamp: { key: "iso-timestamp", type: "datetime", dateFormat: "iso" },
};

export function presetFormat(preset: FieldPreset): DateFormat | undefined {
	return preset === "blank" || preset === "entryTime" ? undefined : DATE_PRESETS[preset].dateFormat;
}

export function presetField(form: Form, preset: FieldPreset): FormField {
	const field = newField(form);
	if (preset === "blank") return field;
	if (preset === "entryTime") {
		return { ...field, key: unusedKey(form, "entry-time"), saveAs: "variable", type: "datetime", dateFormat: "YYYY-MM-DDTHH:mm", entryTime: true };
	}
	const { key, type, dateFormat } = DATE_PRESETS[preset];
	return { ...field, key: unusedKey(form, key), mode: "static", type, dateFormat };
}

function unusedKey(form: Form, key: string): string {
	const taken = new Set(form.fields.map((field) => field.key.trim()));
	if (!taken.has(key)) return key;
	let index = 2;
	while (taken.has(`${key}-${index}`)) index += 1;
	return `${key}-${index}`;
}
