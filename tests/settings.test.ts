import { test } from "node:test";
import { strict as assert } from "node:assert";
import { defaultDateNoteSettings } from "../src/lists/dateNotes.ts";
import { defaultSettings, mergeSettings, newListId } from "../src/settings.ts";
import type { NoteList } from "../src/settings.ts";

const relationLists = (enabled = [true, true, true, true]): NoteList[] => [
	{ id: "list-1", enabled: enabled[0], prefix: "📅 day", source: { kind: "adjacentDates" } },
	{ id: "list-2", enabled: enabled[1], prefix: "🔗 out", source: { kind: "linksOut" } },
	{ id: "list-3", enabled: enabled[2], prefix: "🔗 in ", source: { kind: "linksIn" } },
	{ id: "list-4", enabled: enabled[3], prefix: "🔅 ctx", source: { kind: "sameDay" } },
];

test("defaultSettings enables every relation list in picker order and reads date notes automatically", () => {
	assert.deepEqual(defaultSettings(), { lists: relationLists(), dateNotes: defaultDateNoteSettings() });
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
		],
		dateNotes: { from: "custom", custom: { ...defaultDateNoteSettings().custom, quarter: { enabled: true, folder: "q", format: "YYYY-[Q]Q" } } },
	};
	const merged = mergeSettings(saved);
	assert.deepEqual(merged, saved);
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
	assert.deepEqual(mergeSettings(undefined), defaultSettings());
});

test("newListId mints one above the highest numbered id", () => {
	assert.equal(newListId([]), "list-1");
	assert.equal(newListId(relationLists()), "list-5");
	assert.equal(newListId([{ id: "list-12" }, { id: "custom" }, { id: "list-3" }]), "list-13");
});
