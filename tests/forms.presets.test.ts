import { test } from "node:test";
import { strict as assert } from "node:assert";
import { newForm, formFields } from "../src/forms/form.ts";
import { presetField } from "../src/forms/presets.ts";

test("a blank preset is the same new field the + always added", () => {
	const field = presetField(newForm([]), "blank");
	assert.deepEqual(field, { id: "1", key: "", saveAs: "property", mode: "ask", type: "text" });
});

test("time presets are fixed fields set at creation with their format", () => {
	const form = newForm([]);
	assert.deepEqual(presetField(form, "date"), { id: "1", key: "date", saveAs: "property", mode: "static", type: "date", dateFormat: "YYYY-MM-DD" });
	assert.deepEqual(presetField(form, "time"), { id: "1", key: "time", saveAs: "property", mode: "static", type: "time", dateFormat: "HH:mm" });
	assert.deepEqual(presetField(form, "timestamp"), { id: "1", key: "timestamp", saveAs: "property", mode: "static", type: "datetime", dateFormat: "YYYY-MM-DDTHH:mm" });
	assert.deepEqual(presetField(form, "isoTimestamp"), { id: "1", key: "iso-timestamp", saveAs: "property", mode: "static", type: "datetime", dateFormat: "iso" });
});

test("a preset whose key is taken gets the next free numbered key", () => {
	const form = newForm([]);
	form.fields.push(presetField(form, "timestamp"));
	form.fields.push(presetField(form, "timestamp"));
	assert.deepEqual(formFields(form).map((field) => field.key), ["timestamp", "timestamp-2"]);
	assert.equal(presetField(form, "timestamp").key, "timestamp-3");
});

test("the entry time preset asks for a time kept as a variable that sets the form's time", () => {
	assert.deepEqual(presetField(newForm([]), "entryTime"), {
		id: "1",
		key: "entry-time",
		saveAs: "variable",
		mode: "ask",
		type: "time",
		dateFormat: "HH:mm",
		entryTime: true,
	});
});
