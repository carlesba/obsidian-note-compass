import { test } from "node:test";
import { strict as assert } from "node:assert";
import { defaultDateNoteSettings } from "../src/lists/dateNotes.ts";
import { defaultSettings, mergeSettings, newListId } from "../src/settings.ts";
import type { NoteList, SetPropertiesSettings } from "../src/settings.ts";

const relationLists = (enabled = [true, true, true, true]): NoteList[] => [
	{ id: "list-1", enabled: enabled[0], prefix: "📅 day", source: { kind: "adjacentDates" } },
	{ id: "list-2", enabled: enabled[1], prefix: "🔗 out", source: { kind: "linksOut" } },
	{ id: "list-3", enabled: enabled[2], prefix: "🔗 in ", source: { kind: "linksIn" } },
	{ id: "list-4", enabled: enabled[3], prefix: "🔅 ctx", source: { kind: "sameDay" } },
];

const isTrue = (property: string) => ({ kind: "frontmatter", property, condition: { operator: "is true" } }) as const;

const linksTo = (note: string) => ({ kind: "linksToNote", note }) as const;

const setPropertiesDefaults = (): SetPropertiesSettings => ({
	flagsPrefix: "🎛️ meta",
	flags: ["active", "someday", "evergreen", "blocked", "archived"],
	templatesFolder: "templates",
	linkLists: [
		{ id: "list-1", enabled: true, prefix: "👤 peop", name: "People", source: linksTo("Person 👤"), property: "people", mode: "multi" },
		{ id: "list-2", enabled: true, prefix: "📍 trak", name: "Trackers", source: linksTo("Tracker 📍"), property: "trackers", mode: "multi" },
		{ id: "list-3", enabled: true, prefix: "📚 coll", name: "Collections", source: linksTo("Collection 📚"), property: "collections", mode: "multi" },
		{ id: "list-4", enabled: true, prefix: "📂 catg", name: "Category", source: { kind: "inFolder", folder: "categories" }, property: "category", mode: "single" },
		{ id: "list-5", enabled: true, prefix: "🏷️ ever", name: "Evergreen", source: isTrue("evergreen"), property: "related", mode: "multi" },
		{ id: "list-6", enabled: true, prefix: "📍 actv", name: "Active", source: isTrue("active"), property: "related", mode: "multi" },
		{ id: "list-7", enabled: true, prefix: "🏢 comp", name: "Companies", source: linksTo("Org 🏢"), property: "related", mode: "multi" },
		{ id: "list-8", enabled: true, prefix: "🔅 tday", name: "Today", source: { kind: "modifiedToday" }, property: "related", mode: "multi" },
	],
});

test("defaultSettings enables every relation list in picker order and reads date notes automatically", () => {
	assert.deepEqual(defaultSettings(), {
		lists: relationLists(),
		dateNotes: defaultDateNoteSettings(),
		setProperties: setPropertiesDefaults(),
	});
});

test("mergeSettings gives saved jump settings without set-properties data the default flags and link lists", () => {
	const lists = [{ id: "list-1", enabled: true, prefix: "🔗", source: { kind: "linksIn" } }];
	const merged = mergeSettings({ lists });
	assert.deepEqual(merged.lists, lists);
	assert.deepEqual(merged.setProperties, setPropertiesDefaults());
});

test("mergeSettings keeps saved set-properties data and round-trips it", () => {
	const setProperties = {
		flagsPrefix: "⚑",
		flags: ["pinned"],
		templatesFolder: "_templates",
		linkLists: [{ id: "list-4", enabled: false, prefix: "🧭", name: "Areas", source: { kind: "inFolder", folder: "areas" }, property: "area", mode: "single" }],
	};
	const merged = mergeSettings({ setProperties });
	assert.deepEqual(merged.setProperties, setProperties);
	assert.deepEqual(mergeSettings(JSON.parse(JSON.stringify(merged))), merged);
});

test("mergeSettings replaces mistyped set-properties fields one by one and drops unreadable link lists", () => {
	const merged = mergeSettings({
		setProperties: {
			flagsPrefix: 4,
			flags: ["done", 7, null],
			templatesFolder: ["t"],
			linkLists: [
				{ id: "list-1", enabled: true, prefix: "a", name: 3, source: { kind: "modifiedToday" }, property: "seen", mode: "both" },
				{ id: "list-2", enabled: true, prefix: "b", name: "B", source: { kind: "modifiedToday" } },
				{ id: "list-3", enabled: true, prefix: "c", name: "C", source: { kind: "nowhere" }, property: "c", mode: "single" },
			],
		},
	});
	const defaults = setPropertiesDefaults();
	assert.deepEqual(merged.setProperties, {
		flagsPrefix: defaults.flagsPrefix,
		flags: ["done"],
		templatesFolder: defaults.templatesFolder,
		linkLists: [{ id: "list-1", enabled: true, prefix: "a", name: "", source: { kind: "modifiedToday" }, property: "seen", mode: "multi" }],
	});
	assert.deepEqual(mergeSettings({ setProperties: "nonsense" }).setProperties, defaults);
	assert.deepEqual(mergeSettings({ setProperties: { linkLists: [] } }).setProperties.linkLists, []);
});

test("mergeSettings falls back to the defaults when nothing is stored", () => {
	assert.deepEqual(mergeSettings(undefined), defaultSettings());
	assert.deepEqual(mergeSettings(null), defaultSettings());
	assert.deepEqual(mergeSettings("nonsense"), defaultSettings());
});

test("mergeSettings ignores keys it does not know", () => {
	assert.deepEqual(mergeSettings({ theme: "dark", builtIns: { recent: { enabled: false } } }), defaultSettings());
});

test("mergeSettings migrates the old shape into lists in picker order with custom lists enabled", () => {
	const merged = mergeSettings({
		builtIns: {
			linksIn: { enabled: false, prefix: "⬅️" },
			linksOut: { enabled: true, prefix: "➡️" },
			sameDay: { enabled: false, prefix: "☀️" },
			adjacentDays: { enabled: true, prefix: "🗓️" },
		},
		customLists: [
			{ prefix: "⭐", property: "starred", operator: "is true", value: "" },
			{ prefix: "📚", property: "type", operator: "equals", value: "book" },
			{ prefix: "💼", property: "tags", operator: "contains", value: "work" },
			{ prefix: "📝", property: "summary", operator: "exists", value: "" },
		],
	});
	assert.deepEqual(merged, {
		lists: [
			{ id: "list-1", enabled: true, prefix: "🗓️", source: { kind: "adjacentDates" } },
			{ id: "list-2", enabled: true, prefix: "➡️", source: { kind: "linksOut" } },
			{ id: "list-3", enabled: false, prefix: "⬅️", source: { kind: "linksIn" } },
			{ id: "list-4", enabled: false, prefix: "☀️", source: { kind: "sameDay" } },
			{ id: "list-5", enabled: true, prefix: "⭐", source: { kind: "frontmatter", property: "starred", condition: { operator: "is true" } } },
			{
				id: "list-6",
				enabled: true,
				prefix: "📚",
				source: { kind: "frontmatter", property: "type", condition: { operator: "is", value: "book" } },
			},
			{
				id: "list-7",
				enabled: true,
				prefix: "💼",
				source: { kind: "frontmatter", property: "tags", condition: { operator: "has item", value: "work" } },
			},
			{ id: "list-8", enabled: true, prefix: "📝", source: { kind: "frontmatter", property: "summary", condition: { operator: "is set" } } },
		],
		dateNotes: defaultDateNoteSettings(),
		setProperties: setPropertiesDefaults(),
	});
});

test("mergeSettings fills partial or mistyped old built-in lists from the defaults", () => {
	const merged = mergeSettings({ builtIns: { linksIn: { enabled: false }, sameDay: { prefix: "☀️" }, adjacentDays: { enabled: "yes", prefix: 7 } } });
	const expected = relationLists([true, true, false, true]);
	expected[3].prefix = "☀️";
	assert.deepEqual(merged.lists, expected);
});

test("mergeSettings drops old custom lists it cannot read", () => {
	const merged = mergeSettings({
		customLists: [
			{ prefix: "?", property: "p", operator: "matches", value: "x" },
			{ prefix: "?", operator: "exists" },
			"nonsense",
			{ prefix: "✅", property: "done", operator: "is true" },
		],
	});
	assert.deepEqual(merged.lists.slice(4), [
		{ id: "list-5", enabled: true, prefix: "✅", source: { kind: "frontmatter", property: "done", condition: { operator: "is true" } } },
	]);
	assert.deepEqual(mergeSettings({ customLists: { prefix: "📚" } }).lists, relationLists());
});

test("mergeSettings keeps saved lists in their order and round-trips its own output", () => {
	const saved = {
		lists: [
			{
				id: "list-9",
				enabled: false,
				prefix: "⏰",
				source: { kind: "frontmatter", property: "due", condition: { operator: "before", value: { kind: "relative", days: 3 } } },
			},
			{ id: "list-2", enabled: true, prefix: "🔗", source: { kind: "linksIn" } },
			{ id: "list-3", enabled: true, prefix: "👤", source: { kind: "linksToNote", note: "types/Person 👤.md" } },
			{ id: "list-4", enabled: true, prefix: "📂", source: { kind: "inFolder", folder: "categories" } },
			{ id: "list-5", enabled: false, prefix: "🔅", source: { kind: "modifiedToday" } },
		],
		dateNotes: { from: "custom", custom: { ...defaultDateNoteSettings().custom, quarter: { enabled: true, folder: "q", format: "YYYY-[Q]Q" } } },
	};
	const merged = mergeSettings(saved);
	assert.deepEqual(merged, { ...saved, setProperties: setPropertiesDefaults() });
	assert.deepEqual(mergeSettings(JSON.parse(JSON.stringify(merged))), merged);
});

test("mergeSettings keeps a list with a condition its property's type no longer offers", () => {
	const lists = [{ id: "list-1", enabled: true, prefix: "#", source: { kind: "frontmatter", property: "n", condition: { operator: "has item", value: "x" } } }];
	assert.deepEqual(mergeSettings({ lists }).lists, lists);
});

test("mergeSettings drops unreadable saved lists and mints ids that are missing or repeated", () => {
	const merged = mergeSettings({
		lists: [
			{ id: "list-3", enabled: true, prefix: "a", source: { kind: "linksOut" } },
			{ id: "list-3", enabled: true, prefix: "b", source: { kind: "sameDay" } },
			{ enabled: true, prefix: "c", source: { kind: "linksIn" } },
			{ id: "list-7", enabled: true, prefix: "d", source: { kind: "inFolder" } },
			{ id: "list-7", enabled: true, prefix: "d", source: { kind: "linksToNote", note: 3 } },
			{ id: "list-8", enabled: true, prefix: "e", source: { kind: "frontmatter", property: "p", condition: { operator: "is" } } },
			{ id: "list-9", source: { kind: "adjacentDates" } },
		],
	});
	assert.deepEqual(merged.lists, [
		{ id: "list-3", enabled: true, prefix: "a", source: { kind: "linksOut" } },
		{ id: "list-10", enabled: true, prefix: "b", source: { kind: "sameDay" } },
		{ id: "list-11", enabled: true, prefix: "c", source: { kind: "linksIn" } },
		{ id: "list-9", enabled: false, prefix: "", source: { kind: "adjacentDates" } },
	]);
	assert.deepEqual(mergeSettings({ lists: [] }).lists, []);
});

test("mergeSettings reads saved date-note settings and replaces missing or mistyped parts with the defaults", () => {
	const defaults = defaultDateNoteSettings();
	assert.deepEqual(mergeSettings({ lists: [] }).dateNotes, defaults);
	assert.deepEqual(mergeSettings({ dateNotes: { from: "somewhere" } }).dateNotes, defaults);
	const merged = mergeSettings({ dateNotes: { from: "dailyNotes", custom: { day: { folder: "journal", enabled: "no" }, week: 3 } } });
	assert.equal(merged.dateNotes.from, "dailyNotes");
	assert.deepEqual(merged.dateNotes.custom, { ...defaults.custom, day: { ...defaults.custom.day, folder: "journal" } });
});

test("mergeSettings returns fresh defaults that callers can change without affecting later merges", () => {
	const first = mergeSettings(undefined);
	first.lists[0].prefix = "changed";
	first.dateNotes.custom.day.folder = "changed";
	first.setProperties.flags.push("changed");
	first.setProperties.linkLists[4].source = { kind: "modifiedToday" };
	assert.deepEqual(mergeSettings(undefined), defaultSettings());
});

test("newListId mints one above the highest numbered id", () => {
	assert.equal(newListId([]), "list-1");
	assert.equal(newListId(relationLists()), "list-5");
	assert.equal(newListId([{ id: "list-12" }, { id: "custom" }, { id: "list-3" }]), "list-13");
});
