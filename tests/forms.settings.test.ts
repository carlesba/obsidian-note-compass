import { test } from "node:test";
import { strict as assert } from "node:assert";
import { presetField } from "../src/forms/presets.ts";
import { newField, newForm, formFields } from "../src/forms/form.ts";
import { defaultSettings } from "../src/settings.ts";
import { formFieldKey, formKey, readControl, writeControl } from "../src/settings/controlKeys.ts";
import {
	addChoice,
	dateSourceOptions,
	fieldBadges,
	fieldSummary,
	fieldWarning,
	formWarning,
	headerClickToggles,
	moveChoice,
	toggleExpandedField,
} from "../src/settings/formsForm.ts";

function settingsWithForm() {
	const settings = defaultSettings();
	const form = newForm(settings.forms);
	settings.forms.push(form);
	const field = newField(form);
	form.fields.push(field);
	return { settings, form, field };
}

test("a new form starts enabled, opens its note and has no fields, with the next free id", () => {
	const form = newForm([{ ...newForm([]), id: "4" }]);
	assert.equal(form.id, "5");
	assert.equal(form.enabled, true);
	assert.equal(form.opensNote, true);
	assert.deepEqual(form.fields, []);
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
	assert.equal(fieldSummary(field), "tags · ask, optional · multiselect, several choices · property");
	writeControl(settings, key("mode"), "static");
	assert.deepEqual(field, { id: field.id, key: "tags", saveAs: "property", mode: "static", type: "list" });
	assert.equal(writeControl(settings, key("saveAs"), "variable"), true);
	assert.equal(writeControl(settings, key("saveAs"), "frontmatter"), false);
	assert.equal(fieldSummary(field), "tags · fixed · list · variable");
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
	form.fields.push(day);
	const dayKey = (setting: Parameters<typeof formFieldKey>[2]) => formFieldKey(form.id, day.id, setting);
	writeControl(settings, dayKey("key"), "day");
	writeControl(settings, dayKey("mode"), "static");
	writeControl(settings, dayKey("type"), "date");
	assert.deepEqual(dateSourceOptions(form, day), { "": "At creation", "@set": "On a set date", started: "From field started" });
	writeControl(settings, dayKey("from"), "started");
	assert.equal(fieldWarning(form, day), undefined);
	writeControl(settings, key("type"), "text");
	assert.equal(fieldWarning(form, day), "Field started is not a date or time of this form.");
	assert.equal(formWarning(form), "Some fields need attention. Edit to see why.");
});

test("toggling a field opens it, closes it again, and keeps one field open per form", () => {
	const expanded = new Map<string, string>();
	assert.equal(toggleExpandedField(expanded, "trip", "city"), true);
	assert.equal(expanded.get("trip"), "city");
	assert.equal(toggleExpandedField(expanded, "trip", "country"), true);
	assert.equal(expanded.get("trip"), "country");
	assert.equal(toggleExpandedField(expanded, "reading", "book"), true);
	assert.equal(toggleExpandedField(expanded, "trip", "country"), false);
	assert.equal(expanded.has("trip"), false);
	assert.equal(expanded.get("reading"), "book");
});

test("a click on the field header or its chevron toggles, while its buttons and the editor do not", () => {
	assert.equal(headerClickToggles({ inEditor: false, inControls: false, onChevron: false }), true);
	assert.equal(headerClickToggles({ inEditor: false, inControls: true, onChevron: true }), true);
	assert.equal(headerClickToggles({ inEditor: false, inControls: true, onChevron: false }), false);
	assert.equal(headerClickToggles({ inEditor: true, inControls: false, onChevron: false }), false);
});

test("a fixed date can be set to a typed date, and switching back clears it", () => {
	const { settings, form, field } = settingsWithForm();
	const key = (setting: Parameters<typeof formFieldKey>[2]) => formFieldKey(form.id, field.id, setting);
	writeControl(settings, key("key"), "due");
	writeControl(settings, key("mode"), "static");
	writeControl(settings, key("type"), "datetime");
	writeControl(settings, key("from"), "@set");
	assert.equal(field.at, "");
	writeControl(settings, key("at"), "202810300900");
	assert.equal(fieldWarning(form, field), undefined);
	writeControl(settings, key("at"), "2028103009");
	assert.equal(fieldWarning(form, field), "Can't read this date. Type it as YYYYMMDDHHmm.");
	writeControl(settings, key("from"), "");
	assert.equal(field.at, undefined);
});

test("a field row shows its name apart from badges for where it is saved, its mode and its type", () => {
	const { field } = settingsWithForm();
	field.key = "tags";
	field.mode = "static";
	field.type = "list";
	field.saveAs = "variable";
	assert.deepEqual(fieldBadges(field), [
		{ kind: "variable", text: "variable" },
		{ kind: "mode", text: "fixed" },
		{ kind: "type", text: "list" },
	]);
});


test("a date and a time confirmation coexist without warnings, while overlapping confirmations warn", () => {
	const form = newForm([]);
	form.fields.push(presetField(form, "entryDate"));
	form.fields.push(presetField(form, "entryTime"));
	assert.deepEqual(formFields(form).map((field) => fieldWarning(form, field)), [undefined, undefined]);
	form.fields.push(presetField(form, "entryDate"));
	assert.equal(fieldWarning(form, formFields(form)[0]), "Another field changes the same part of the entry date/time.");
	assert.equal(fieldWarning(form, formFields(form)[1]), undefined);
});
