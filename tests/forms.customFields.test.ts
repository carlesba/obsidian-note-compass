import { test } from "node:test";
import { strict as assert } from "node:assert";
import { formFields, newCustomField, newForm, readCustomFields, storedCustomFields, templateField } from "../src/forms/form.ts";
import type { CustomField } from "../src/forms/form.ts";
import { FIELD_PRESETS } from "../src/forms/presets.ts";
import { defaultSettings, mergeSettings, storedSettings } from "../src/settings.ts";
import { customFieldKey, readControl, writeControl } from "../src/settings/controlKeys.ts";
import {
	customFieldDetail,
	customFieldLabel,
	customFieldWarning,
	fieldPickerEntries,
	matchingFieldPickerEntries,
	readCustomFieldSetting,
	startsGroup,
	templateForm,
	writeCustomFieldSetting,
} from "../src/settings/customFieldsForm.ts";
import { placeholderEntries } from "../src/settings/placeholderMenu.ts";

function ratingTemplate(): CustomField {
	return {
		id: "1",
		name: "Rating 1–5",
		key: "rating",
		saveAs: "property",
		mode: "ask",
		type: "number",
		source: "options",
		choices: [
			{ value: "1", label: "1 · Poor" },
			{ value: "5", label: "5 · Great" },
		],
	};
}

function peopleTemplate(): CustomField {
	return {
		id: "2",
		name: "",
		key: "people",
		saveAs: "property",
		mode: "ask",
		type: "list",
		source: "notes",
		notesFrom: { kind: "filter", filter: { kind: "group", mode: "all", items: [{ kind: "property", property: "kind", condition: { operator: "is", value: "person" } }] } },
	};
}

test("custom fields are read with the form field reader and round-trip through storage", () => {
	const stored = [ratingTemplate(), peopleTemplate(), { id: "3", name: "Started", key: "started", saveAs: "property", mode: "static", type: "date", dateFormat: "YYYY-MM-DD" }];
	const read = readCustomFields(stored);
	assert.deepEqual(read, stored);
	assert.deepEqual(readCustomFields(JSON.parse(JSON.stringify(storedCustomFields(read)))), read);
	assert.deepEqual(readCustomFields([{ id: "9", key: "legacy", mode: "ask", type: "select", choices: [{ value: "a" }] }]), [
		{ id: "9", name: "", key: "legacy", saveAs: "property", mode: "ask", type: "text", source: "options", choices: [{ value: "a" }] },
	]);
});

test("absent or mistyped custom fields read as none", () => {
	assert.deepEqual(readCustomFields(undefined), []);
	assert.deepEqual(readCustomFields("nonsense"), []);
	assert.deepEqual(mergeSettings({}).customFields, []);
	assert.deepEqual(defaultSettings().customFields, []);
});

test("a custom field this version cannot read is kept as saved, warns and is left out of the picker", () => {
	const broken = { id: "1", name: "Mood", key: "mood", mode: "ask", type: "feelings" };
	const [field] = readCustomFields([broken, "nonsense"]);
	assert.equal(field.name, "Mood");
	assert.deepEqual(field.unreadable, { stored: broken });
	assert.equal(customFieldWarning(field), "This custom field can't be read by this version of Note Compass. Remove it and build a new one.");
	const settings = mergeSettings({ customFields: [broken, ratingTemplate()] });
	assert.deepEqual(settings.customFields.map((template) => template.id), ["1", "2"]);
	const stored = storedSettings(settings) as { customFields: unknown[] };
	assert.deepEqual(stored.customFields, [broken, { ...ratingTemplate(), id: "2" }]);
	assert.deepEqual(fieldPickerEntries(settings.customFields, { offersBlock: true }).filter((entry) => entry.kind === "template").map((entry) => entry.label), ["Rating 1–5"]);
	assert.equal(writeCustomFieldSetting(settings.customFields[0], "key", "x"), false);
});

test("settings with custom fields round-trip through storedSettings and mergeSettings", () => {
	const settings = defaultSettings();
	settings.customFields.push(ratingTemplate(), peopleTemplate());
	const merged = mergeSettings(JSON.parse(JSON.stringify(storedSettings(settings))));
	assert.deepEqual(merged, settings);
	assert.ok(!("unreadable" in (storedSettings(settings) as { customFields: Record<string, unknown>[] }).customFields[0]));
});

test("reset all settings clears the custom fields", () => {
	const settings = defaultSettings();
	settings.customFields.push(ratingTemplate());
	assert.deepEqual(defaultSettings().customFields, []);
	assert.notDeepEqual(settings.customFields, defaultSettings().customFields);
});

test("a new custom field is a blank asked text field with the next free id and no name", () => {
	assert.deepEqual(newCustomField([]), { id: "1", name: "", key: "", saveAs: "property", mode: "ask", type: "text", source: "typed" });
	assert.equal(newCustomField([ratingTemplate(), peopleTemplate()]).id, "3");
});

test("inserting a template copies it with a fresh id and nested arrays of its own", () => {
	const form = newForm([]);
	form.fields.push({ id: "1", key: "book", saveAs: "property", mode: "ask", type: "text", source: "typed" });
	const rating = ratingTemplate();
	const people = peopleTemplate();
	const ratingCopy = templateField(form, rating);
	form.fields.push(ratingCopy);
	const peopleCopy = templateField(form, people);
	form.fields.push(peopleCopy);
	const { name: ratingName, ...ratingWithoutName } = rating;
	assert.equal(ratingName, "Rating 1–5");
	assert.deepEqual(ratingCopy, { ...ratingWithoutName, id: "2" });
	assert.equal("name" in ratingCopy, false);
	assert.equal("unreadable" in ratingCopy, false);
	assert.equal(peopleCopy.id, "3");
	assert.notEqual(ratingCopy.choices, rating.choices);
	assert.notEqual(peopleCopy.notesFrom, people.notesFrom);
	rating.choices?.push({ value: "3" });
	rating.key = "score";
	assert.equal(ratingCopy.choices?.length, 2);
	assert.equal(ratingCopy.key, "rating");
	ratingCopy.choices?.pop();
	assert.equal(rating.choices?.length, 3);
	const peopleFilter = people.notesFrom?.kind === "filter" ? people.notesFrom.filter : undefined;
	peopleFilter?.items.pop();
	assert.equal(peopleCopy.notesFrom?.kind === "filter" ? peopleCopy.notesFrom.filter.items.length : 0, 1);
});

test("inserting a template whose key the form already has keeps the key", () => {
	const form = newForm([]);
	form.fields.push(templateField(form, ratingTemplate()));
	form.fields.push(templateField(form, ratingTemplate()));
	assert.deepEqual(
		formFields(form).map((field) => [field.id, field.key]),
		[
			["1", "rating"],
			["2", "rating"],
		],
	);
});

test("the + picker lists the custom fields in their order before the built-ins, naming each by its name or key", () => {
	const entries = fieldPickerEntries([peopleTemplate(), ratingTemplate(), { ...newCustomField([]), id: "3" }], { offersBlock: true });
	assert.deepEqual(
		entries.map((entry) => [entry.group, entry.kind, entry.label]),
		[
			["custom", "template", "people"],
			["custom", "template", "Rating 1–5"],
			["custom", "template", "New field"],
			...FIELD_PRESETS.map((preset) => ["builtIn", "preset", entries.find((entry) => entry.kind === "preset" && entry.preset === preset)?.label]),
			["builtIn", "block", "Conditional block"],
		],
	);
	assert.deepEqual(
		entries.filter((entry) => entry.kind === "preset").map((entry) => entry.label),
		["Blank field", "Date", "Time", "Timestamp", "ISO timestamp", "Confirm entry date", "Confirm entry time"],
	);
	assert.equal(fieldPickerEntries([], { offersBlock: false }).some((entry) => entry.kind === "block"), false);
	assert.deepEqual(
		entries.map((entry) => startsGroup(entries, entry)),
		[true, false, false, true, false, false, false, false, false, false, false],
	);
});

test("a template's picker detail shows its key when it has a name, then its badges", () => {
	assert.equal(customFieldDetail(ratingTemplate()), "rating · property · ask · number · options");
	assert.equal(customFieldDetail(peopleTemplate()), "property · ask · list · notes");
	assert.equal(customFieldLabel(peopleTemplate()), "people");
});

test("typing in the picker filters by label and detail, keeping the order", () => {
	const entries = fieldPickerEntries([peopleTemplate(), ratingTemplate()], { offersBlock: true });
	assert.deepEqual(matchingFieldPickerEntries(entries, "").length, entries.length);
	assert.deepEqual(matchingFieldPickerEntries(entries, "rat").map((entry) => entry.label), ["Rating 1–5"]);
	assert.deepEqual(matchingFieldPickerEntries(entries, "notes").map((entry) => entry.label), ["people"]);
	assert.deepEqual(matchingFieldPickerEntries(entries, "time").map((entry) => entry.label), ["Time", "Timestamp", "ISO timestamp", "Confirm entry time"]);
	assert.deepEqual(matchingFieldPickerEntries(entries, "block").map((entry) => entry.label), ["Conditional block"]);
});

test("custom field settings are read and written through their control keys, including the name", () => {
	const settings = defaultSettings();
	const template = newCustomField(settings.customFields);
	settings.customFields.push(template);
	assert.equal(writeControl(settings, customFieldKey(template.id, "name"), "Mood"), true);
	assert.equal(writeControl(settings, customFieldKey(template.id, "key"), " mood "), true);
	assert.equal(writeControl(settings, customFieldKey(template.id, "source"), "options"), true);
	assert.equal(writeControl(settings, customFieldKey(template.id, "choiceValue"), "x"), false);
	assert.deepEqual(template, { id: "1", name: "Mood", key: "mood", saveAs: "property", mode: "ask", type: "text", source: "options", choices: [] });
	assert.equal(readControl(settings, customFieldKey(template.id, "name")), "Mood");
	assert.equal(readControl(settings, customFieldKey(template.id, "key")), "mood");
	assert.equal(readCustomFieldSetting(template, "source"), "options");
	assert.equal(writeControl(settings, customFieldKey("9", "name"), "x"), false);
	assert.equal(readControl(settings, customFieldKey("9", "name")), undefined);
});

test("a template warns like a form field and its stand-in form offers only its own key as a placeholder", () => {
	const blank = newCustomField([]);
	assert.equal(customFieldWarning(blank), "Give this field a name.");
	assert.equal(customFieldWarning(ratingTemplate()), undefined);
	const form = templateForm(ratingTemplate());
	const keys = placeholderEntries(form, { inContent: false, preview: () => undefined }).filter((entry) => !entry.link).map((entry) => entry.key);
	assert.deepEqual(keys, ["today", "tomorrow", "yesterday", "rating", "date", "time"]);
});
