import { test } from "node:test";
import { strict as assert } from "node:assert";
import type { Frontmatter } from "../src/lists/vault.ts";
import { defaultSettings } from "../src/settings.ts";
import type { EditableProperty, EditablePropertyType } from "../src/settings.ts";
import { offeredEntries, propertyType } from "../src/setProperties/offered.ts";
import {
	CANCEL_LABEL,
	SAVE_LABEL,
	initialPropertyState,
	pickerChoices,
	pickerState,
	withValue,
	writeProperties,
} from "../src/setProperties/picker.ts";
import type { PickerChoice, PickerState, PropertyState } from "../src/setProperties/picker.ts";
import { CLEAR_LABEL, valueChoices, valuePicker } from "../src/setProperties/valuePicker.ts";
import type { ScalarPropertyType, ValueChoice } from "../src/setProperties/valuePicker.ts";
import { HOURS_AGO, fakeVault } from "./fakeVault.ts";
import type { FakeNote } from "./fakeVault.ts";

const PERSON = { kind: "linksToNote", note: "types/Person.md" } as const;

function vaultNotes(): FakeNote[] {
	return [
		{
			path: "Today.md",
			mtime: HOURS_AGO(1),
			frontmatter: { active: true, status: "doing", people: ["[[people/Ann|Ann]]", "[[Stranger]]"], topic: "x" },
		},
		{ path: "types/Person.md" },
		{ path: "people/Ann.md", mtime: HOURS_AGO(30), links: ["types/Person.md"], frontmatter: { status: "done" } },
		{ path: "people/Bob.md", mtime: HOURS_AGO(2), links: ["types/Person.md"], frontmatter: { status: "Done", rating: 3 } },
		{ path: "people/Cy.md", mtime: HOURS_AGO(5), links: ["types/Person.md"], frontmatter: { rating: 3, status: "done" } },
		{ path: "people/Old.md", mtime: HOURS_AGO(3), links: ["types/Person.md"], frontmatter: { archived: true } },
		{ path: "templates/Person.md", links: ["types/Person.md"], content: "# Person\n" },
		{ path: "Today too.md", links: ["types/Person.md", "Today.md"], frontmatter: { rating: 4.5 } },
	];
}

function entry(property: string, type: EditablePropertyType, extra: Partial<EditableProperty> = {}): EditableProperty {
	const linked = type === "link" || type === "links";
	return {
		id: property + type + (extra.prefix ?? ""),
		enabled: true,
		prefix: "",
		property,
		type,
		...(linked ? { source: PERSON, excludedFolders: ["templates"] } : {}),
		...extra,
	};
}

function setup(
	properties: EditableProperty[],
	fakes: FakeNote[] = vaultNotes(),
	propertyTypes: Record<string, string> = {},
	showPrefixes = true,
) {
	const settings = defaultSettings();
	settings.setProperties.properties = properties;
	const vault = fakeVault(fakes, { propertyTypes });
	const target = vault.note("Today.md");
	const initial = initialPropertyState(settings.setProperties, vault.frontmatter(target.path));
	const entries = offeredEntries(settings, vault, target);
	const choicesFor = (state: PickerState = pickerState(initial), query = "") => pickerChoices(entries, initial, state, query, showPrefixes);
	const valueChoicesFor = (picked: EditableProperty, state: PickerState = pickerState(initial), query = "") =>
		valueChoices(
			valuePicker(vault, picked.property, propertyType(settings.setProperties, picked) as ScalarPropertyType, picked.presetValues),
			state.values.get(picked.property),
			query,
		);
	return { settings, vault, target, initial, choicesFor, valueChoicesFor };
}

const labels = (choices: readonly { label: string }[]) => choices.map((choice) => choice.label);

const pick = <Choice extends { label: string }>(choices: readonly Choice[], label: string) => {
	const found = choices.find((choice) => choice.label === label);
	assert.ok(found, `no row ${label} in ${JSON.stringify(labels(choices))}`);
	return found;
};

const chosen = (choice: PickerChoice): PickerState => {
	assert.equal(choice.action.action, "set");
	return choice.action.action === "set" ? choice.action.state : pickerState(new Map());
};

function written(initial: PropertyState, state: PickerState, frontmatter: Frontmatter = {}): Frontmatter {
	const result = { ...frontmatter };
	writeProperties(result, initial, state.values);
	return result;
}

test("the main picker lists save, cancel, the set values and then each entry's choices", () => {
	const { choicesFor } = setup([
		entry("active", "checkbox", { prefix: "🎛️" }),
		entry("due", "date", { prefix: "📅" }),
		entry("people", "links", { prefix: "👤" }),
		entry("status", "text", { prefix: "📝" }),
		entry("hidden", "text", { enabled: false }),
	]);
	assert.deepEqual(labels(choicesFor()), [
		SAVE_LABEL,
		CANCEL_LABEL,
		"✓ 🎛️ active true",
		"✓ 👤 Ann",
		"✓ 👤 Stranger",
		"✓ 📝 status doing",
		"📅 due",
		"👤 Bob",
		"👤 Cy",
		"👤 Today too",
		"📝 status done",
		"📝 status Done",
	]);
});

test("a row splits into mark, prefix, content and value parts", () => {
	const { choicesFor } = setup([entry("status", "text", { prefix: "📝" }), entry("people", "links", { prefix: "👤" })]);
	const choices = choicesFor();
	assert.deepEqual(pick(choices, "✓ 📝 status doing").parts, { mark: "✓", prefix: "📝", content: "status", value: "doing" });
	assert.deepEqual(pick(choices, "👤 Bob").parts, { prefix: "👤", content: "Bob" });
	assert.deepEqual(pick(choices, SAVE_LABEL).parts, { mark: "🏁", content: "Save & close" });
	assert.deepEqual(pick(choices, CANCEL_LABEL).parts, { mark: "🛑", content: "Cancel" });
	assert.deepEqual([SAVE_LABEL, CANCEL_LABEL], ["🏁 Save & close", "🛑 Cancel"]);
});

test("rows carry their entry's prefix colour outside the label, and drop it with the prefix", () => {
	const properties = [entry("status", "text", { prefix: "📝", prefixColor: "#e0a030" }), entry("people", "links", { prefix: "👤", prefixColor: "#33aa66" })];
	const choices = setup(properties).choicesFor();
	assert.deepEqual(pick(choices, "✓ 📝 status doing").parts, { mark: "✓", prefix: "📝", prefixColor: "#e0a030", content: "status", value: "doing" });
	assert.deepEqual(pick(choices, "👤 Bob").parts, { prefix: "👤", prefixColor: "#33aa66", content: "Bob" });
	assert.deepEqual(pick(choices, SAVE_LABEL).parts, { mark: "🏁", content: "Save & close" });
	const hidden = setup(properties, vaultNotes(), {}, false).choicesFor();
	assert.ok(hidden.every((choice) => choice.parts.prefixColor === undefined));
});

test("with prefixes hidden rows drop the prefix and link rows name the property they write", () => {
	const { choicesFor } = setup(
		[entry("status", "text", { prefix: "📝 stat" }), entry("people", "links", { prefix: "👤 peop" })],
		vaultNotes(),
		{},
		false,
	);
	const choices = choicesFor();
	assert.deepEqual(labels(choices).slice(2), [
		"✓ status doing",
		"✓ Ann people",
		"✓ Stranger people",
		"status done",
		"status Done",
		"Bob people",
		"Cy people",
		"Today too people",
	]);
	assert.deepEqual(pick(choices, "✓ Ann people").parts, { mark: "✓", content: "Ann", value: "people" });
	assert.deepEqual(pick(choices, "Bob people").parts, { content: "Bob", value: "people" });
	assert.deepEqual(pick(choices, "✓ status doing").parts, { mark: "✓", content: "status", value: "doing" });
	assert.deepEqual(labels(choicesFor(undefined, "peop")), [
		"✓ Ann people",
		"✓ Stranger people",
		"Bob people",
		"Cy people",
		"Today too people",
		'✏️ status: use "peop"',
	]);
	assert.deepEqual(labels(choicesFor(undefined, "👤")), ['✏️ status: use "👤"']);
	assert.deepEqual(labels(choicesFor(undefined, "📝 stat Done")), ['✏️ status: use "📝 stat Done"']);
});

test("with prefixes hidden the see-more row names its property and expands to it", () => {
	const many = Array.from({ length: 7 }, (_, index) => ({
		path: `people/P${index}.md`,
		mtime: HOURS_AGO(index + 1),
		links: ["types/Person.md"],
	}));
	const { choicesFor } = setup(
		[entry("people", "links", { prefix: "👤 peop" })],
		[{ path: "Today.md" }, { path: "types/Person.md" }, ...many],
		{},
		false,
	);
	const rows = choicesFor();
	assert.equal(labels(rows)[7], "… 2 more, type to filter people");
	assert.deepEqual(rows[7].action, { action: "expand", query: "people" });
	assert.equal(labels(choicesFor(undefined, "people")).length, 7);
});

test("a link entry leaves out notes inside any of its excluded folders", () => {
	const offered = (excludedFolders: string[]) =>
		labels(setup([entry("people", "links", { prefix: "👤", excludedFolders })]).choicesFor()).slice(4);
	assert.deepEqual(offered([]), ["👤 Bob", "👤 Cy", "👤 Person", "👤 Today too"]);
	assert.deepEqual(offered(["templates", "", " /people/ "]), ["👤 Today too"]);
	assert.deepEqual(offered(["peop", "templates/"]), ["👤 Bob", "👤 Cy", "👤 Today too"]);
});

test("choosing a set link drops only that link and choosing a note adds it", () => {
	const { initial, choicesFor } = setup([entry("people", "links", { prefix: "👤" })]);
	const withoutAnn = chosen(pick(choicesFor(), "✓ 👤 Ann"));
	assert.deepEqual(written(initial, withoutAnn), { people: ["[[Stranger]]"] });
	assert.ok(labels(choicesFor(withoutAnn)).includes("👤 Ann"));
	const withBob = chosen(pick(choicesFor(withoutAnn), "👤 Bob"));
	assert.deepEqual(written(initial, withBob), { people: ["[[Stranger]]", "[[Bob]]"] });
	assert.deepEqual(labels(choicesFor(withBob)).slice(2, 4), ["✓ 👤 Stranger", "✓ • 👤 Bob"]);
});

test("a single link is replaced by the chosen note and cleared by its set row", () => {
	const { initial, choicesFor } = setup([entry("owner", "link", { prefix: "🙋" })]);
	assert.deepEqual(labels(choicesFor()).slice(2), ["🙋 Bob", "🙋 Cy", "🙋 Ann", "🙋 Today too"]);
	const withAnn = chosen(pick(choicesFor(), "🙋 Ann"));
	const withCy = chosen(pick(choicesFor(withAnn), "🙋 Cy"));
	assert.deepEqual(written(initial, withCy), { owner: "[[Cy]]" });
	assert.deepEqual(labels(choicesFor(withCy)).slice(2), ["✓ • 🙋 Cy", "🙋 Bob", "🙋 Ann", "🙋 Today too"]);
	assert.deepEqual(written(initial, chosen(pick(choicesFor(withCy), "✓ • 🙋 Cy"))), {});
});

test("a link matches a note by its link text when its alias differs", () => {
	const { initial, choicesFor } = setup([entry("people", "links")]);
	const state = withValue(pickerState(initial), "people", ["[[people/Ann|Annie]]"]);
	assert.deepEqual(labels(choicesFor(state)).slice(2), ["✓ • Annie", "Bob", "Cy", "Today too"]);
});

test("a text entry replaces from vault values, clears from its set row and uses a typed value", () => {
	const { initial, choicesFor } = setup([entry("status", "text", { prefix: "📝" })]);
	const done = chosen(pick(choicesFor(), "📝 status done"));
	assert.deepEqual(written(initial, done), { status: "done" });
	assert.deepEqual(written(initial, chosen(pick(choicesFor(), "✓ 📝 status doing")), { status: "doing" }), {});
	assert.deepEqual(labels(choicesFor(undefined, "dne")), ["📝 status done", "📝 status Done", '✏️ 📝 status: use "dne"']);
	assert.deepEqual(labels(choicesFor(undefined, "zzz")), ['✏️ 📝 status: use "zzz"']);
	assert.deepEqual(written(initial, chosen(pick(choicesFor(undefined, "zzz"), '✏️ 📝 status: use "zzz"'))), { status: "zzz" });
	assert.deepEqual(labels(choicesFor(undefined, "DONE")), ["📝 status done", "📝 status Done"]);
});

test("a checkbox, number or date entry opens its own picker and hides its entry row once set", () => {
	const active = entry("active", "checkbox", { prefix: "🎛️" });
	const rating = entry("rating", "number", { prefix: "⭐" });
	const { initial, choicesFor } = setup([active, rating]);
	assert.deepEqual(labels(choicesFor()).slice(2), ["✓ 🎛️ active true", "⭐ rating"]);
	assert.deepEqual(pick(choicesFor(), "✓ 🎛️ active true").action, { action: "edit", entry: active });
	assert.deepEqual(pick(choicesFor(), "⭐ rating").action, { action: "edit", entry: rating });
	const changed = withValue(withValue(pickerState(initial), "rating", 3), "active", false);
	assert.deepEqual(labels(choicesFor(changed)).slice(2), ["✓ • 🎛️ active false", "✓ • ⭐ rating 3"]);
});

test("entries writing one property share its set rows and offer each note once", () => {
	const { choicesFor } = setup(
		[
			entry("related", "links", { prefix: "🔅", source: { kind: "modifiedToday" } }),
			entry("related", "links", { prefix: "👤" }),
		],
		[...vaultNotes().slice(1), { path: "Today.md", mtime: HOURS_AGO(1), frontmatter: { related: ["[[Ann]]", "[[Bob]]", "[[Ann]]"] } }],
	);
	assert.deepEqual(labels(choicesFor()).slice(2), ["✓ 👤 Ann", "✓ 🔅 Bob", "🔅 Cy", "👤 Today too"]);
});

test("an entry shows five notes and a row to see more until a query is typed", () => {
	const many = Array.from({ length: 7 }, (_, index) => ({
		path: `people/P${index}.md`,
		mtime: HOURS_AGO(index + 1),
		links: ["types/Person.md"],
	}));
	const { choicesFor } = setup([entry("people", "links", { prefix: "👤 peop" })], [{ path: "Today.md" }, { path: "types/Person.md" }, ...many]);
	const rows = choicesFor();
	assert.deepEqual(labels(rows).slice(2), [
		"👤 peop P0",
		"👤 peop P1",
		"👤 peop P2",
		"👤 peop P3",
		"👤 peop P4",
		"👤 peop … 2 more, type to filter",
	]);
	const more = pick(rows, "👤 peop … 2 more, type to filter").action;
	assert.deepEqual(more, { action: "expand", query: "👤 peop" });
	assert.equal(labels(choicesFor(undefined, "👤 peop")).length, 7);
	assert.deepEqual(labels(choicesFor(undefined, "p6")), ["👤 peop P6"]);
});

test("use rows come after every row the query matches and a typed name offers no new note", () => {
	const people = entry("people", "links", { prefix: "👤" });
	const status = entry("status", "text", { prefix: "📌" });
	const { choicesFor } = setup([status, people]);
	assert.deepEqual(labels(choicesFor(undefined, "bo")), ["👤 Bob", '✏️ 📌 status: use "bo"']);
	assert.deepEqual(labels(choicesFor(undefined, "Zed")), ['✏️ 📌 status: use "Zed"']);
});

test("the first enabled entry decides the type of a shared property", () => {
	const { settings } = setup([entry("due", "text", { enabled: false }), entry("due", "date"), entry("due", "text")]);
	assert.equal(propertyType(settings.setProperties, settings.setProperties.properties[2]), "date");
});

const valueLabels = (choices: readonly ValueChoice[]) => labels(choices);

test("a checkbox offers true, false and clear, marks the pending value and can write false", () => {
	const active = entry("active", "checkbox");
	const { initial, valueChoicesFor } = setup([active]);
	const choices = valueChoicesFor(active);
	assert.deepEqual(valueLabels(choices), ["✓ true", "false", CLEAR_LABEL]);
	const state = withValue(pickerState(initial), "active", pick(choices, "false").value);
	assert.deepEqual(written(initial, state, { active: true }), { active: false });
	assert.deepEqual(valueLabels(valueChoicesFor(active, state)), ["true", "✓ false", CLEAR_LABEL]);
});

test("a number picker offers use only for numbers, with vault numbers by count", () => {
	const rating = entry("rating", "number");
	const { valueChoicesFor } = setup([rating]);
	assert.deepEqual(valueLabels(valueChoicesFor(rating)), ["3 ×2", "4.5 ×1", "✓ Clear"]);
	assert.equal(valueChoicesFor(rating, undefined, "-2.5")[0].value, -2.5);
	assert.deepEqual(valueLabels(valueChoicesFor(rating, undefined, "12a")), []);
});

test("a date picker accepts YYYYMMDD and YYYY-MM-DD and offers presets from today", () => {
	const due = entry("due", "date");
	const { valueChoicesFor } = setup([due]);
	assert.deepEqual(valueLabels(valueChoicesFor(due)), [
		"Today 2024-03-09",
		"Tomorrow 2024-03-10",
		"Next Monday 2024-03-11",
		"In a week 2024-03-16",
		"✓ Clear",
	]);
	assert.deepEqual(valueChoicesFor(due)[0].parts, { mark: "", content: "Today", value: "2024-03-09" });
	assert.equal(valueChoicesFor(due, undefined, "20240402")[0].value, "2024-04-02");
	assert.equal(valueChoicesFor(due, undefined, "2024-04-02")[0].label, '✏️ Use "2024-04-02"');
	assert.deepEqual(valueChoicesFor(due, undefined, "2024-04-02")[0].parts, { mark: "✏️", content: 'Use "2024-04-02"' });
	const setDue = valueChoicesFor(due, withValue(pickerState(new Map()), "due", "2024-03-09"));
	assert.deepEqual([labels(setDue)[0], labels(setDue)[setDue.length - 1]], ["✓ Today 2024-03-09", CLEAR_LABEL]);
	assert.deepEqual(setDue[setDue.length - 1].parts, { mark: "🗑️", content: "Clear" });
	assert.deepEqual(valueLabels(valueChoicesFor(due, undefined, "2024-02-30")), []);
	assert.deepEqual(valueLabels(valueChoicesFor(due, undefined, "tmrw")), ["Tomorrow 2024-03-10"]);
});

test("a datetime picker accepts the three typed forms and offers now", () => {
	const start = entry("start", "datetime");
	const { valueChoicesFor } = setup([start]);
	assert.deepEqual(valueLabels(valueChoicesFor(start)), ["Now 2024-03-09T15:00", "✓ Clear"]);
	for (const input of ["20240402 0930", "2024-04-02 09:30", "2024-04-02T09:30"]) {
		assert.equal(valueChoicesFor(start, undefined, input)[0].value, "2024-04-02T09:30");
	}
	assert.deepEqual(valueLabels(valueChoicesFor(start, undefined, "2024-04-02 24:00")), []);
	assert.deepEqual(valueLabels(valueChoicesFor(start, undefined, "2024-04-02")), []);
});

test("clearing deletes the key and unchanged properties are not written", () => {
	const people = entry("people", "links");
	const status = entry("status", "text");
	const { initial, choicesFor } = setup([people, status, entry("active", "checkbox")]);
	const saved = { people: ["[[people/Ann|Ann]]", "[[Stranger]]"], status: "doing", active: true };
	assert.deepEqual(written(initial, pickerState(initial), saved), saved);
	const withoutAnn = chosen(pick(choicesFor(), "✓ Ann"));
	const cleared = chosen(pick(choicesFor(withoutAnn), "✓ Stranger"));
	assert.deepEqual(written(initial, cleared, saved), { status: "doing", active: true });
	assert.deepEqual(written(initial, withValue(pickerState(initial), "status", "doing"), {}), {});
});

test("a link property on current date notes offers only the date notes that exist", () => {
	const source = { kind: "currentPeriods", periods: ["day", "month"] } as const;
	const settings = defaultSettings();
	settings.setProperties.properties = [entry("period", "links", { source: { ...source, periods: [...source.periods] } })];
	const vault = fakeVault([...vaultNotes(), { path: "on/2024-03.md" }]);
	const [offered] = offeredEntries(settings, vault, vault.note("Today.md"));
	assert.deepEqual(
		offered.notes.map((note) => note.path),
		["on/2024-03.md"],
	);
});

test("a text property offers its preset values first, then the other values the vault has, and still takes a typed one", () => {
	const { choicesFor } = setup([entry("status", "text", { prefix: "📝", presetValues: ["todo", "done", "blocked"] })]);
	assert.deepEqual(labels(choicesFor()).slice(2), ["✓ 📝 status doing", "📝 status todo", "📝 status done", "📝 status blocked", "📝 status Done"]);
	assert.deepEqual(labels(choicesFor(undefined, "waiting")), ['✏️ 📝 status: use "waiting"']);
	assert.deepEqual(labels(choicesFor(undefined, "blocked")), ["📝 status blocked"]);
});

test("a number property offers its preset values before the numbers the vault has", () => {
	const picked = entry("rating", "number", { presetValues: ["1", "3", "x", "5", "3"] });
	const { valueChoicesFor } = setup([picked]);
	assert.deepEqual(
		valueChoicesFor(picked).map((choice) => choice.label),
		["1", "3", "5", "4.5 ×1", "✓ Clear"],
	);
});
