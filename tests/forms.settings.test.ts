import { test } from "node:test";
import { strict as assert } from "node:assert";
import { newField, newForm } from "../src/forms/form.ts";
import { defaultSettings } from "../src/settings.ts";
import { formFieldKey, formKey, readControl, writeControl } from "../src/settings/controlKeys.ts";
import { addChoice, dateSourceOptions, fieldSummary, fieldWarning, formWarning, moveChoice } from "../src/settings/formsForm.ts";

function settingsWithForm() {
	const settings = defaultSettings();
	const form = newForm(settings.forms);
	settings.forms.push(form);
	const field = newField(form);
	form.properties.push(field);
	return { settings, form, field };
}

test("a new form starts enabled, opens its note and has no fields, with the next free id", () => {
	const form = newForm([{ ...newForm([]), id: "4" }]);
	assert.equal(form.id, "5");
	assert.equal(form.enabled, true);
	assert.equal(form.opensNote, true);
	assert.deepEqual([form.variables, form.properties], [[], []]);
});

test("form settings are read and written through their control keys", () => {
	const { settings, form } = settingsWithForm();
	assert.equal(writeControl(settings, formKey(form.id, "name"), "Meeting note"), true);
	assert.equal(writeControl(settings, formKey(form.id, "folder"), " meetings "), true);
	writeControl(settings, formKey(form.id, "opensNote"), false);
	assert.deepEqual([form.name, form.folder, form.opensNote], ["Meeting note", "meetings", false]);
	assert.equal(readControl(settings, formKey(form.id, "namePattern")), "");
	assert.equal(writeControl(settings, "form/9/name", "x"), false);
});

test("switching a field to fixed keeps a type it can hold and drops the question settings", () => {
	const { settings, form, field } = settingsWithForm();
	const key = (setting: Parameters<typeof formFieldKey>[2], index?: number) => formFieldKey(form.id, field.id, setting, index);
	writeControl(settings, key("key"), " tags ");
	writeControl(settings, key("type"), "multiselect");
	writeControl(settings, key("optional"), true);
	assert.deepEqual(field.choices, []);
	assert.equal(field.storeAs, "text");
	assert.equal(fieldSummary(field), "multiselect, several choices · asked, optional");
	writeControl(settings, key("mode"), "static");
	assert.deepEqual(field, { id: field.id, key: "tags", mode: "static", type: "list" });
	writeControl(settings, key("listItems"), ["[[Books]]", " ", "[[Reading]]"]);
	assert.deepEqual(readControl(settings, key("listItems")), ["[[Books]]", "[[Reading]]"]);
});

test("a fixed number only keeps numbers and choices keep their value and label", () => {
	const { settings, form, field } = settingsWithForm();
	const key = (setting: Parameters<typeof formFieldKey>[2], index?: number) => formFieldKey(form.id, field.id, setting, index);
	writeControl(settings, key("mode"), "static");
	writeControl(settings, key("type"), "number");
	writeControl(settings, key("number"), "12");
	assert.equal(field.value, 12);
	writeControl(settings, key("number"), "twelve");
	assert.equal(field.value, undefined);
	writeControl(settings, key("mode"), "ask");
	writeControl(settings, key("type"), "select");
	addChoice(field);
	addChoice(field);
	writeControl(settings, key("choiceValue", 0), " 4 ");
	writeControl(settings, key("choiceLabel", 0), "4 · Great");
	writeControl(settings, key("choiceValue", 1), "2");
	moveChoice(field, 1, 0);
	assert.deepEqual(field.choices, [{ value: "2" }, { value: "4", label: "4 · Great" }]);
});

test("date fields default their format per type and offer other date fields as a source", () => {
	const { settings, form, field } = settingsWithForm();
	const key = (setting: Parameters<typeof formFieldKey>[2]) => formFieldKey(form.id, field.id, setting);
	writeControl(settings, key("key"), "started");
	writeControl(settings, key("type"), "datetime");
	assert.equal(field.dateFormat, "YYYY-MM-DDTHH:mm");
	writeControl(settings, key("type"), "time");
	assert.equal(field.dateFormat, "HH:mm");
	const day = newField(form);
	form.properties.push(day);
	const dayKey = (setting: Parameters<typeof formFieldKey>[2]) => formFieldKey(form.id, day.id, setting);
	writeControl(settings, dayKey("key"), "day");
	writeControl(settings, dayKey("mode"), "static");
	writeControl(settings, dayKey("type"), "date");
	assert.deepEqual(dateSourceOptions(form, day), { "": "At creation", started: "From field started" });
	writeControl(settings, dayKey("from"), "started");
	assert.equal(fieldWarning(form, day), undefined);
	writeControl(settings, key("type"), "text");
	assert.equal(fieldWarning(form, day), "Field started is not a date or time of this form.");
	assert.equal(formWarning(form), "Some fields need attention. Edit to see why.");
});
