import { test } from "node:test";
import { strict as assert } from "node:assert";
import type { Frontmatter } from "../src/lists/vault.ts";
import { defaultSettings, mergeSettings, storedSettings } from "../src/settings.ts";
import type { EditableProperty, SetPropertiesSettings } from "../src/settings.ts";
import { readFixedValues } from "../src/setProperties/fixedValues.ts";
import type { FixedValue } from "../src/setProperties/fixedValues.ts";
import { fixedValuesSummary, multiRowName, multiRowSegments, multiRows, rowHolds, withRowApplied } from "../src/setProperties/multiValues.ts";
import { decidedPropertyType, mixedTypeProperties } from "../src/setProperties/propertyTypes.ts";
import { offeredProperties } from "../src/setProperties/offered.ts";
import { initialPropertyState, keptEmptyValues, pickerChoices, pickerState, writeProperties } from "../src/setProperties/picker.ts";
import type { PickerChoice, PickerState } from "../src/setProperties/picker.ts";
import { fixedValueKey, propertyKey, readControl, writeControl } from "../src/settings/controlKeys.ts";
import { addFixedValue, fixedValueTitle } from "../src/settings/fixedValuesForm.ts";
import { mixedTypeWarning, propertyLabel, propertyRowName, rowNamePlaceholder } from "../src/settings/setPropertiesForm.ts";
import { NOW } from "./fakeVault.ts";

const fixed = (id: string, property: string, type: FixedValue["type"], extra: Partial<FixedValue> = {}): FixedValue => ({
	id,
	property,
	type,
	...extra,
});

function multiRow(id: string, fixedValues: FixedValue[], extra: Partial<EditableProperty> = {}): EditableProperty {
	return { id, enabled: true, prefix: "", property: "", type: "checkbox", mode: "multiple", fixedValues, ...extra };
}

const DONE_ROW = multiRow(
	"list-1",
	[
		fixed("value-1", "status", "text", { value: "done" }),
		fixed("value-2", "archived", "checkbox", { value: true }),
		fixed("value-3", "active", "clear"),
	],
	{ prefix: "🏁" },
);

function settingsWith(properties: EditableProperty[]): SetPropertiesSettings {
	return { properties: structuredClone(properties), checkboxMode: "picker" };
}

function stateOf(frontmatter: Frontmatter, settings: SetPropertiesSettings): PickerState {
	return pickerState(initialPropertyState(settings, frontmatter));
}

const contents = (choices: readonly PickerChoice[]) => choices.slice(2).map((choice) => [choice.parts.mark ?? "", choice.parts.content]);

test("a multiple properties row round-trips through storage and existing single rows load unchanged", () => {
	const stored = {
		setProperties: {
			properties: [
				{ id: "list-1", enabled: true, prefix: "🏁", property: "status", type: "text", presetValues: ["doing"] },
				{ ...DONE_ROW, name: "Finish" },
			],
		},
	};
	const settings = mergeSettings(stored);
	const [single, multiple] = settings.setProperties.properties;
	assert.deepEqual(single, { id: "list-1", enabled: true, prefix: "🏁", property: "status", type: "text", presetValues: ["doing"] });
	assert.equal(multiple.mode, "multiple");
	assert.equal(multiple.name, "Finish");
	assert.notEqual(multiple.id, "list-1");
	assert.deepEqual(multiple.fixedValues, DONE_ROW.fixedValues);
	assert.deepEqual(mergeSettings(JSON.parse(JSON.stringify(storedSettings(settings)))), settings);
});

test("a row without a mode reads as a single property row", () => {
	const [entry] = mergeSettings({ setProperties: { properties: [{ id: "list-1", property: "a", type: "text", mode: "steps", name: 3 }] } }).setProperties.properties;
	assert.equal(entry.mode, undefined);
	assert.equal(entry.name, undefined);
	assert.equal(entry.fixedValues, undefined);
});

test("fixed values keep their typed value and drop entries whose value does not match the type", () => {
	const values = readFixedValues([
		{ id: "value-1", property: " archived ", type: "checkbox", value: false },
		{ id: "value-2", property: "archived", type: "checkbox", value: "true" },
		{ id: "value-3", property: "rating", type: "number", value: 3 },
		{ id: "value-4", property: "rating", type: "number", value: "3" },
		{ id: "value-5", property: "due", type: "date", value: "2024-03-09" },
		{ id: "value-6", property: "due", type: "date", value: "09/03/2024" },
		{ id: "value-7", property: "due", type: "date", relative: "today" },
		{ id: "value-8", property: "at", type: "datetime", relative: "today" },
		{ id: "value-9", property: "at", type: "datetime", value: "2024-03-09T10:30", relative: "now" },
		{ id: "value-10", property: "status", type: "steps", value: "x" },
		{ id: "value-11", property: "active", type: "clear", value: true },
		{ property: "active", type: "clear" },
		{ id: "value-3", property: "people", type: "links", value: "people/Ann" },
		"bad",
	]);
	assert.deepEqual(values, [
		{ id: "value-1", property: "archived", type: "checkbox", value: false },
		{ id: "value-3", property: "rating", type: "number", value: 3 },
		{ id: "value-5", property: "due", type: "date", value: "2024-03-09" },
		{ id: "value-7", property: "due", type: "date", relative: "today" },
		{ id: "value-9", property: "at", type: "datetime", value: "2024-03-09T10:30", relative: "now" },
		{ id: "value-12", property: "active", type: "clear" },
		{ id: "value-13", property: "people", type: "links", value: "people/Ann" },
	]);
});

test("switching a row to multiple properties and back keeps its single property setup", () => {
	const settings = defaultSettings();
	const entry: EditableProperty = { id: "list-9", enabled: true, prefix: "", property: "status", type: "text", presetValues: ["done"], keepsEmpty: true };
	settings.setProperties.properties = [entry];
	writeControl(settings, propertyKey("list-9", "mode"), "multiple");
	assert.equal(readControl(settings, propertyKey("list-9", "mode")), "multiple");
	const added = addFixedValue(entry);
	writeControl(settings, fixedValueKey("list-9", added.id, "property"), " archived ");
	writeControl(settings, fixedValueKey("list-9", added.id, "type"), "checkbox");
	writeControl(settings, propertyKey("list-9", "rowName"), "Archive");
	writeControl(settings, propertyKey("list-9", "mode"), "single");
	assert.equal(readControl(settings, propertyKey("list-9", "mode")), "single");
	assert.deepEqual(entry, {
		id: "list-9",
		enabled: true,
		prefix: "",
		property: "status",
		type: "text",
		presetValues: ["done"],
		keepsEmpty: true,
		name: "Archive",
		fixedValues: [{ id: "value-1", property: "archived", type: "checkbox", value: true }],
	});
});

test("a fixed value's editor stores values by its type and refuses values the type cannot hold", () => {
	const settings = defaultSettings();
	const entry = multiRow("list-9", []);
	settings.setProperties.properties = [entry];
	const value = addFixedValue(entry);
	const key = (setting: Parameters<typeof fixedValueKey>[2]) => fixedValueKey("list-9", value.id, setting);
	writeControl(settings, key("type"), "number");
	assert.equal(writeControl(settings, key("value"), "3.5"), true);
	assert.equal(value.value, 3.5);
	assert.equal(writeControl(settings, key("value"), "three"), false);
	assert.equal(value.value, 3.5);
	writeControl(settings, key("type"), "date");
	assert.equal(value.relative, "today");
	assert.equal(readControl(settings, key("relative")), "relative");
	writeControl(settings, key("relative"), "fixed");
	writeControl(settings, key("value"), "20240309");
	assert.deepEqual({ ...value }, { id: value.id, property: "", type: "date", value: "2024-03-09" });
	writeControl(settings, key("type"), "links");
	writeControl(settings, key("value"), "[[people/Ann]]");
	assert.equal(value.value, "people/Ann");
	writeControl(settings, key("type"), "checkbox");
	assert.equal(readControl(settings, key("value")), true);
	writeControl(settings, key("value"), false);
	assert.equal(value.value, false);
	writeControl(settings, key("type"), "clear");
	assert.equal(writeControl(settings, key("value"), "x"), false);
	assert.deepEqual({ ...value }, { id: value.id, property: "", type: "clear" });
});

test("a fixed value's title shows its property and value", () => {
	assert.deepEqual(fixedValueTitle(fixed("a", "status", "text", { value: "done" })), { property: "status", value: "done" });
	assert.deepEqual(fixedValueTitle(fixed("a", "archived", "checkbox", { value: true })), { property: "archived", value: "✓" });
	assert.deepEqual(fixedValueTitle(fixed("a", "active", "clear")), { property: "active", value: "cleared" });
	assert.deepEqual(fixedValueTitle(fixed("a", "people", "links", { value: "people/Ann" })), { property: "people", value: "Ann" });
	assert.deepEqual(fixedValueTitle(fixed("a", "", "date", { relative: "today" })), { property: "New property", value: "Today" });
});

test("a multiple properties row is named by its name, or by a short summary of its values", () => {
	assert.equal(multiRowName(DONE_ROW), "status done, archived ✓, active cleared");
	assert.equal(multiRowName({ ...DONE_ROW, name: " Finish " }), "Finish");
	assert.equal(propertyLabel({ ...DONE_ROW, name: "Finish" }), "Finish");
	assert.equal(propertyRowName({ ...DONE_ROW, name: "Finish" }), "🏁 Finish");
	assert.equal(propertyRowName(multiRow("list-2", [])), "New property");
	assert.equal(rowNamePlaceholder(DONE_ROW), "status done, archived ✓, active cleared");
	const long = multiRow("list-3", [fixed("v", "status", "text", { value: "a very long status value that goes on and on" })]);
	assert.equal(Array.from(fixedValuesSummary(long)).length, 40);
	assert.ok(fixedValuesSummary(long).endsWith("…"));
});

test("an unnamed row shows each property plainly and its value muted, and a named row shows only its name", () => {
	assert.deepEqual(multiRowSegments(DONE_ROW), [
		{ text: "status" },
		{ text: " done", muted: true },
		{ text: ", " },
		{ text: "archived" },
		{ text: " ✓", muted: true },
		{ text: ", " },
		{ text: "active" },
		{ text: " cleared", muted: true },
	]);
	assert.equal(multiRowSegments({ ...DONE_ROW, name: "Finish" }), undefined);
});

test("single property code paths ignore the property and type of multiple properties rows", () => {
	const single: EditableProperty = { id: "list-2", enabled: true, prefix: "", property: "status", type: "text", keepsEmpty: true };
	const multiple = multiRow("list-1", [], { property: "status", type: "checkbox", keepsEmpty: true });
	const settings = settingsWith([multiple, single]);
	assert.deepEqual(offeredProperties(settings).map((entry) => entry.id), ["list-2"]);
	assert.equal(decidedPropertyType(settings.properties, "status"), "text");
	assert.deepEqual(mixedTypeProperties(settings.properties), []);
	assert.equal(mixedTypeWarning(multiple, settings.properties), undefined);
	assert.deepEqual([...keptEmptyValues(settings)], [["status", null]]);
});

test("a row holds when every fixed value holds, with links matched by the note they point at", () => {
	const row = multiRow("list-1", [
		fixed("v1", "people", "links", { value: "Ann" }),
		fixed("v2", "project", "link", { value: "work/Site" }),
		fixed("v3", "active", "clear"),
		fixed("v4", "rating", "number", { value: 3 }),
	]);
	const [resolved] = multiRows(settingsWith([row]), NOW);
	const holds = (values: Record<string, unknown>) => rowHolds(resolved, new Map(Object.entries(values)));
	assert.equal(holds({ people: ["[[people/Ann|Ann]]", "[[Bob]]"], project: "[[Site]]", rating: 3 }), true);
	assert.equal(holds({ people: ["[[people/Ann|Ann]]"], project: "[[work/Site]]", active: "", rating: 3 }), true);
	assert.equal(holds({ people: ["[[Bob]]"], project: "[[Site]]", rating: 3 }), false);
	assert.equal(holds({ people: ["[[Ann]]"], project: "[[Site]]", active: false, rating: 3 }), false);
	assert.equal(holds({ people: ["[[Ann]]"], project: "[[Site]]", rating: "3" }), false);
});

test("today and now resolve when the picker opens", () => {
	const row = multiRow("list-1", [fixed("v1", "due", "date", { value: "2020-01-01", relative: "today" }), fixed("v2", "at", "datetime", { relative: "now" })]);
	const [resolved] = multiRows(settingsWith([row]), NOW);
	assert.deepEqual(
		resolved.values.map((applied) => applied.value),
		["2024-03-09", "2024-03-09T15:00"],
	);
});

test("applying a row sets every value at once, adding links and clearing what it clears", () => {
	const row = multiRow("list-1", [
		fixed("v1", "people", "links", { value: "people/Cy" }),
		fixed("v2", "project", "link", { value: "Site" }),
		fixed("v3", "active", "clear"),
		fixed("v4", "archived", "checkbox", { value: true }),
		fixed("v5", "tags", "links", { value: "Ann" }),
	]);
	const [resolved] = multiRows(settingsWith([row]), NOW);
	const applied = withRowApplied(resolved, new Map<string, unknown>([["people", ["[[Bob]]"]], ["project", "[[Old]]"], ["active", true], ["tags", "[[people/Ann|Ann]]"]]));
	assert.deepEqual(Object.fromEntries(applied), {
		people: ["[[Bob]]", "[[people/Cy]]"],
		project: "[[Site]]",
		active: undefined,
		archived: true,
		tags: "[[people/Ann|Ann]]",
	});
	assert.equal(rowHolds(resolved, applied), true);
});

test("disabled rows and rows with no usable fixed values offer nothing", () => {
	const rows = multiRows(
		settingsWith([
			{ ...DONE_ROW, enabled: false },
			multiRow("list-2", [fixed("v1", " ", "checkbox", { value: true }), fixed("v2", "status", "text")]),
			multiRow("list-3", [fixed("v1", "archived", "checkbox", { value: true })], { mode: undefined }),
		]),
		NOW,
	);
	assert.deepEqual(rows, []);
});

test("the picker offers a row that does not hold among the values to add, and choosing it applies every value", () => {
	const settings = settingsWith([DONE_ROW]);
	const rows = multiRows(settings, NOW);
	const initial = initialPropertyState(settings, { status: "doing", active: true, topic: "x" });
	assert.deepEqual(Object.fromEntries(initial), { status: "doing", archived: undefined, active: true });
	const choices = pickerChoices([], initial, pickerState(initial), "", "picker", rows);
	assert.deepEqual(contents(choices), [["", "status done, archived ✓, active cleared"]]);
	assert.equal(choices[2].parts.prefix, "🏁");
	const action = choices[2].action;
	assert.equal(action.action, "set");
	if (action.action !== "set") return;
	const next = pickerChoices([], initial, action.state, "", "picker", rows);
	assert.deepEqual(contents(next), [["✓ •", "status done, archived ✓, active cleared"]]);
});

test("a row that already holds shows as set with a tick, and choosing it changes nothing", () => {
	const settings = settingsWith([{ ...DONE_ROW, name: "Finish" }]);
	const rows = multiRows(settings, NOW);
	const state = stateOf({ status: "done", archived: true }, settings);
	const choices = pickerChoices([], state.values, state, "", "picker", rows);
	assert.deepEqual(contents(choices), [["✓", "Finish"]]);
	assert.equal(choices[2].parts.prefix, "🏁");
	assert.deepEqual(choices[2].action, { action: "set", state });
});

test("saving writes the properties only a multiple properties row touches", () => {
	const settings = settingsWith([DONE_ROW]);
	const [row] = multiRows(settings, NOW);
	const frontmatter: Frontmatter = { status: "doing", active: true, topic: "x" };
	const initial = initialPropertyState(settings, frontmatter);
	writeProperties(frontmatter, initial, withRowApplied(row, initial));
	assert.deepEqual(frontmatter, { status: "done", archived: true, topic: "x" });
});
