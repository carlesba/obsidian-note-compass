import { test } from "node:test";
import { strict as assert } from "node:assert";
import { defaultDateNoteSettings } from "../src/lists/dateNotes.ts";
import { defaultSettings, mergeSettings, newListId } from "../src/settings.ts";
import type { Condition } from "../src/lists/conditions.ts";
import type { EditableProperty, EditablePropertyType, ListSource, NoteList, SetPropertiesSettings } from "../src/settings.ts";

const relationLists = (enabled = [true, true, true, true]): NoteList[] => [
	{ id: "list-1", enabled: enabled[0], prefix: "📅 day", source: { kind: "adjacentDates" } },
	{ id: "list-2", enabled: enabled[1], prefix: "🔗 out", source: { kind: "linksOut" } },
	{ id: "list-3", enabled: enabled[2], prefix: "🔗 in", source: { kind: "linksIn" } },
	{ id: "list-4", enabled: enabled[3], prefix: "🔅 ctx", source: { kind: "sameDay" } },
];

const isTrue = (property: string) => propertyFilter(property, { operator: "is true" });

const propertyFilter = (property: string, condition: Condition): ListSource => ({
	kind: "filter",
	filter: { kind: "group", mode: "all", items: [{ kind: "property", property, condition }] },
});

const linksTo = (note: string) => ({ kind: "linksToNote", note }) as const;

const checkbox = (id: string, property: string, prefix = "🎛️ meta"): EditableProperty => ({
	id,
	enabled: true,
	prefix,
	property,
	type: "checkbox",
});

const linked = (
	id: string,
	prefix: string,
	source: ListSource,
	property: string,
	type: EditablePropertyType = "links",
	excludedFolders = ["templates"],
	createsNotes = false,
): EditableProperty => ({ id, enabled: true, prefix, property, type, source, excludedFolders, createsNotes });

const setPropertiesDefaults = (): SetPropertiesSettings => ({
	properties: [
		checkbox("list-9", "active"),
		checkbox("list-10", "someday"),
		checkbox("list-11", "evergreen"),
		checkbox("list-12", "blocked"),
		checkbox("list-13", "archived"),
		linked("list-1", "👤 peop", linksTo("Person 👤"), "people"),
		linked("list-2", "📍 trak", linksTo("Tracker 📍"), "trackers"),
		linked("list-3", "📚 coll", linksTo("Collection 📚"), "collections"),
		linked("list-4", "📂 catg", { kind: "inFolder", folder: "categories" }, "category", "link"),
		linked("list-5", "🏷️ ever", isTrue("evergreen"), "related"),
		linked("list-6", "📍 actv", isTrue("active"), "related"),
		linked("list-7", "🏢 comp", linksTo("Org 🏢"), "related"),
		linked("list-8", "🔅 tday", { kind: "modifiedToday" }, "related"),
	],
	checkboxMode: "picker",
});

test("defaultSettings enables every relation list in picker order and reads date notes automatically", () => {
	assert.deepEqual(defaultSettings(), {
		showPrefixes: true,
		lists: relationLists(),
		dateNotes: defaultDateNoteSettings(),
		setProperties: setPropertiesDefaults(),
	});
});

test("mergeSettings gives saved jump settings without set-properties data the default properties", () => {
	const lists = [{ id: "list-1", enabled: true, prefix: "🔗", source: { kind: "linksIn" } }];
	const merged = mergeSettings({ lists });
	assert.deepEqual(merged.lists, lists);
	assert.deepEqual(merged.setProperties, setPropertiesDefaults());
});

test("mergeSettings migrates saved flags and link lists into properties, flags first, dropping link list names", () => {
	const setProperties = {
		flagsPrefix: "⚑",
		flags: ["pinned"],
		templatesFolder: "_templates",
		linkLists: [
			{ id: "list-4", enabled: false, prefix: "🧭", name: "Areas", source: { kind: "inFolder", folder: "areas" }, property: "area", mode: "single" },
			{ id: "list-2", enabled: true, prefix: "👤", name: "People", source: linksTo("Person"), property: "related", mode: "multi" },
			{ id: "list-7", enabled: true, prefix: "🏢", name: "Orgs", source: linksTo("Org"), property: "related", mode: "multi" },
		],
	};
	const merged = mergeSettings({ setProperties });
	assert.deepEqual(merged.setProperties, {
		properties: [
			checkbox("list-8", "pinned", "⚑"),
			{ ...linked("list-4", "🧭", { kind: "inFolder", folder: "areas" }, "area", "link", ["_templates"]), enabled: false },
			linked("list-2", "👤", linksTo("Person"), "related", "links", ["_templates"]),
			linked("list-7", "🏢", linksTo("Org"), "related", "links", ["_templates"]),
		],
		checkboxMode: "picker",
	});
	assert.deepEqual(mergeSettings(JSON.parse(JSON.stringify(merged))), merged);
	const withoutTemplates = mergeSettings({ setProperties: { ...setProperties, templatesFolder: " " } }).setProperties.properties;
	assert.deepEqual(withoutTemplates.slice(1).map((property) => property.excludedFolders), [[], [], []]);
});

test("mergeSettings migrates any one legacy key and fills the others from the old defaults", () => {
	const merged = mergeSettings({ setProperties: { flags: ["done"] } });
	assert.deepEqual(merged.setProperties.properties.slice(0, 2), [
		checkbox("list-9", "done"),
		linked("list-1", "👤 peop", linksTo("Person 👤"), "people"),
	]);
	assert.deepEqual(mergeSettings({ setProperties: { linkLists: [] } }).setProperties.properties, [
		checkbox("list-1", "active"),
		checkbox("list-2", "someday"),
		checkbox("list-3", "evergreen"),
		checkbox("list-4", "blocked"),
		checkbox("list-5", "archived"),
	]);
});

test("mergeSettings replaces mistyped legacy fields one by one and keeps unreadable link lists as broken", () => {
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
	assert.deepEqual(merged.setProperties, {
		properties: [
			checkbox("list-4", "done"),
			linked("list-1", "a", { kind: "modifiedToday" }, "seen"),
			linked("list-3", "c", { kind: "unreadable", stored: { kind: "nowhere" } }, "c", "link"),
		],
		checkboxMode: "picker",
	});
	assert.deepEqual(mergeSettings({ setProperties: "nonsense" }).setProperties, setPropertiesDefaults());
});

test("mergeSettings keeps properties already in the new shape untouched", () => {
	const properties: EditableProperty[] = [
		{ id: "p-1", enabled: true, prefix: "📝", property: "summary", type: "text" },
		{ id: "p-2", enabled: false, prefix: "🔢", property: "rating", type: "number" },
		{ id: "p-3", enabled: true, prefix: "📅", property: "due", type: "date" },
		{ id: "p-4", enabled: true, prefix: "⏰", property: "start", type: "datetime" },
		checkbox("p-5", "done", ""),
		linked("p-6", "👤", linksTo("Person"), "owner", "link", []),
		linked("p-7", "🔗", { kind: "linksOut" }, "related", "links", ["archive", "templates"], true),
	];
	const merged = mergeSettings({ setProperties: { properties, flags: ["ignored"] } });
	assert.deepEqual(merged.setProperties, { properties, checkboxMode: "picker" });
	assert.deepEqual(mergeSettings(JSON.parse(JSON.stringify(merged))), merged);
	assert.deepEqual(mergeSettings({ setProperties: { properties: [] } }).setProperties, { properties: [], checkboxMode: "picker" });
});

test("mergeSettings drops unknown properties, keeps unreadable link sources as broken, mints missing ids and keeps sources only on link types", () => {
	const merged = mergeSettings({
		setProperties: {
			properties: [
				{ id: "p-1", enabled: true, prefix: "a", property: "a", type: "colour" },
				{ id: "p-2", enabled: true, prefix: "b", type: "text" },
				{ id: "p-3", enabled: true, prefix: "c", property: "c", type: "links", source: { kind: "nowhere" } },
				{ id: "p-4", prefix: 5, property: "d", type: "text", source: { kind: "linksOut" }, excludedFolder: "x" },
				{ id: "p-4", enabled: true, prefix: "e", property: "e", type: "link", source: { kind: "linksIn" } },
			],
		},
	});
	assert.deepEqual(merged.setProperties.properties, [
		{
			id: "p-3",
			enabled: true,
			prefix: "c",
			property: "c",
			type: "links",
			source: { kind: "unreadable", stored: { kind: "nowhere" } },
			excludedFolders: [],
			createsNotes: false,
		},
		{ id: "p-4", enabled: false, prefix: "", property: "d", type: "text" },
		{ id: "list-1", enabled: true, prefix: "e", property: "e", type: "link", source: { kind: "linksIn" }, excludedFolders: [], createsNotes: false },
	]);
});

test("mergeSettings keeps a prefix colour only when it is a #rgb or #rrggbb hex", () => {
	const list = (prefixColor: unknown) => ({ id: "list-1", enabled: true, prefix: "🔗", prefixColor, source: { kind: "linksOut" } });
	const property = (prefixColor: unknown) => ({ id: "p-1", enabled: true, prefix: "📝", prefixColor, property: "status", type: "text" });
	const colors = ["#e0a030", "#ABC", "e0a030", "#e0a03", "#e0a030ff", "red", 12, null];
	const merged = mergeSettings({ lists: colors.map(list), setProperties: { properties: colors.map(property) } });
	const kept = ["#e0a030", "#ABC", undefined, undefined, undefined, undefined, undefined, undefined];
	assert.deepEqual(merged.lists.map((entry) => entry.prefixColor), kept);
	assert.deepEqual(merged.setProperties.properties.map((entry) => entry.prefixColor), kept);
	assert.equal("prefixColor" in merged.lists[2], false);
	assert.equal("prefixColor" in merged.setProperties.properties[2], false);
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
		showPrefixes: true,
		lists: [
			{ id: "list-1", enabled: true, prefix: "🗓️", source: { kind: "adjacentDates" } },
			{ id: "list-2", enabled: true, prefix: "➡️", source: { kind: "linksOut" } },
			{ id: "list-3", enabled: false, prefix: "⬅️", source: { kind: "linksIn" } },
			{ id: "list-4", enabled: false, prefix: "☀️", source: { kind: "sameDay" } },
			{ id: "list-5", enabled: true, prefix: "⭐", source: propertyFilter("starred", { operator: "is true" }) },
			{
				id: "list-6",
				enabled: true,
				prefix: "📚",
				source: propertyFilter("type", { operator: "is", value: "book" }),
			},
			{
				id: "list-7",
				enabled: true,
				prefix: "💼",
				source: propertyFilter("tags", { operator: "has item", value: "work" }),
			},
			{ id: "list-8", enabled: true, prefix: "📝", source: propertyFilter("summary", { operator: "is set" }) },
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

test("mergeSettings keeps an old empty prefix empty and trims old prefixes", () => {
	const merged = mergeSettings({
		builtIns: { linksOut: { prefix: " ➡️ " } },
		customLists: [{ prefix: "", property: "done", operator: "is true" }],
	});
	assert.equal(merged.lists[1].prefix, "➡️");
	assert.equal(merged.lists[4].prefix, "");
});

test("mergeSettings drops the trailing bar from saved prefixes", () => {
	const lists = mergeSettings({
		lists: [
			{ id: "list-1", enabled: true, prefix: "🔗 in  |", source: { kind: "linksIn" } },
			{ id: "list-2", enabled: true, prefix: "📅 day | ", source: { kind: "adjacentDates" } },
			{ id: "list-3", enabled: true, prefix: "|", source: { kind: "linksOut" } },
			{ id: "list-4", enabled: true, prefix: "a | b", source: { kind: "sameDay" } },
		],
	}).lists;
	assert.deepEqual(lists.map((list) => list.prefix), ["🔗 in", "📅 day", "", "a | b"]);
	const properties = mergeSettings({
		setProperties: { properties: [{ id: "p-1", enabled: true, prefix: "👤 peop |", property: "people", type: "text" }] },
	}).setProperties.properties;
	assert.equal(properties[0].prefix, "👤 peop");
	const legacy = mergeSettings({
		setProperties: {
			flagsPrefix: "🎛️ meta |",
			flags: ["done"],
			linkLists: [{ id: "list-1", enabled: true, prefix: "👤 peop |", source: { kind: "modifiedToday" }, property: "seen", mode: "multi" }],
		},
	}).setProperties.properties;
	assert.deepEqual(legacy.map((property) => property.prefix), ["🎛️ meta", "👤 peop"]);
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
		{ id: "list-5", enabled: true, prefix: "✅", source: propertyFilter("done", { operator: "is true" }) },
	]);
	assert.deepEqual(mergeSettings({ customLists: { prefix: "📚" } }).lists, relationLists());
});

test("mergeSettings keeps saved lists in their order and round-trips its own output", () => {
	const saved = {
		showPrefixes: false,
		lists: [
			{
				id: "list-9",
				enabled: false,
				prefix: "⏰",
				source: propertyFilter("due", { operator: "before", value: { kind: "relative", days: 3 } }),
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

test("mergeSettings reads a saved showPrefixes boolean and shows prefixes otherwise", () => {
	assert.equal(mergeSettings({ showPrefixes: false }).showPrefixes, false);
	assert.equal(mergeSettings({ showPrefixes: true }).showPrefixes, true);
	assert.equal(mergeSettings({ showPrefixes: "no" }).showPrefixes, true);
	assert.equal(mergeSettings({}).showPrefixes, true);
});

test("mergeSettings keeps a list with a condition its property's type no longer offers", () => {
	const lists = [{ id: "list-1", enabled: true, prefix: "#", source: propertyFilter("n", { operator: "has item", value: "x" }) }];
	assert.deepEqual(mergeSettings({ lists }).lists, lists);
});

test("mergeSettings turns a saved property list into a filter with that one condition", () => {
	const condition = { operator: "before", value: { kind: "relative", days: -3 } } as const;
	const merged = mergeSettings({
		lists: [{ id: "list-1", enabled: true, prefix: "⏰", source: { kind: "frontmatter", property: "due", condition } }],
		setProperties: {
			properties: [
				{ id: "p", enabled: true, prefix: "", property: "related", type: "links", source: { kind: "frontmatter", property: "active", condition: { operator: "is true" } } },
			],
		},
	});
	assert.deepEqual(merged.lists[0].source, propertyFilter("due", condition));
	assert.deepEqual(merged.setProperties.properties[0].source, isTrue("active"));
	assert.deepEqual(mergeSettings(JSON.parse(JSON.stringify(merged))), merged);
});

test("mergeSettings keeps unreadable saved lists as broken and mints ids that are missing or repeated", () => {
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
		{ id: "list-7", enabled: true, prefix: "d", source: { kind: "unreadable", stored: { kind: "inFolder" } } },
		{ id: "list-12", enabled: true, prefix: "d", source: { kind: "unreadable", stored: { kind: "linksToNote", note: 3 } } },
		{
			id: "list-8",
			enabled: true,
			prefix: "e",
			source: { kind: "unreadable", stored: { kind: "frontmatter", property: "p", condition: { operator: "is" } } },
		},
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
	first.setProperties.properties.push(checkbox("list-99", "changed"));
	first.setProperties.properties[9].source = { kind: "linksOut" };
	assert.deepEqual(mergeSettings(undefined), defaultSettings());
});

test("newListId mints one above the highest numbered id", () => {
	assert.equal(newListId([]), "list-1");
	assert.equal(newListId(relationLists()), "list-5");
	assert.equal(newListId([{ id: "list-12" }, { id: "custom" }, { id: "list-3" }]), "list-13");
});

test("mergeSettings reads a current date notes list and keeps only known periods in period order", () => {
	const merged = mergeSettings({
		lists: [
			{ id: "list-1", enabled: true, prefix: "🗓️", source: { kind: "currentPeriods", periods: ["year", "day", "decade"] } },
			{ id: "list-2", enabled: true, prefix: "🗓️", source: { kind: "currentPeriods" } },
		],
	});
	assert.deepEqual(
		merged.lists.map((list) => list.source),
		[
			{ kind: "currentPeriods", periods: ["day", "year"] },
			{ kind: "currentPeriods", periods: [] },
		],
	);
});
