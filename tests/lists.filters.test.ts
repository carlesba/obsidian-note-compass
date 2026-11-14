import { test } from "node:test";
import { strict as assert } from "node:assert";
import type { Condition, Operator } from "../src/lists/conditions.ts";
import type { FileField, FilterGroup, FilterNode, FilterRule } from "../src/lists/filters.ts";
import { buildJumpList } from "../src/lists/jumpList.ts";
import { offeredEntries } from "../src/setProperties/offered.ts";
import { defaultSettings, mergeSettings, storedSettings } from "../src/settings.ts";
import type { ListSource, NoteList } from "../src/settings.ts";
import { inapplicableCondition, sourceSummary } from "../src/settings/listForm.ts";
import { HOURS_AGO, NOW, fakeVault } from "./fakeVault.ts";
import type { FakeNote } from "./fakeVault.ts";

const DAY = 24;

const TYPES = { active: "checkbox" };

const property = (name: string, condition: Condition): FilterRule => ({ kind: "property", property: name, condition });
const isTrue = (name: string) => property(name, { operator: "is", value: true });
const file = (field: FileField, operator: Operator, value?: Condition["value"]): FilterRule => ({
	kind: "file",
	field,
	condition: value === undefined ? { operator } : { operator, value },
});
const inFolder = (folder: string) => file("file", "in folder", folder);
const hasTag = (tag: string) => file("file", "has tag", tag);
const linksTo = (note: string) => file("file", "links to", note);
const all = (...items: FilterNode[]): FilterGroup => ({ kind: "group", mode: "all", items });
const any = (...items: FilterNode[]): FilterGroup => ({ kind: "group", mode: "any", items });
const none = (...items: FilterNode[]): FilterGroup => ({ kind: "group", mode: "none", items });
const filter = (group: FilterGroup): ListSource => ({ kind: "filter", filter: group });

const notes: FakeNote[] = [
	{ path: "projects/Alpha.md", frontmatter: { active: true, status: "doing" }, tags: ["#work"], ctime: NOW, mtime: HOURS_AGO(1), size: 120, embeds: ["people/Person.md"] },
	{ path: "projects/sub/Beta.md", frontmatter: { active: false }, tags: ["#Work/Client"], ctime: HOURS_AGO(5 * DAY), mtime: HOURS_AGO(3 * DAY), size: 900 },
	{ path: "projectsX/Gamma.md", frontmatter: { active: true }, tags: ["#workshop"], links: ["people/Person.md"], ctime: HOURS_AGO(10 * DAY), size: 40 },
	{ path: "people/Person.md", frontmatter: {}, links: [], ctime: HOURS_AGO(DAY), mtime: HOURS_AGO(DAY) },
	{ path: "Delta.md", frontmatter: { status: "doing" }, links: ["people/Person.md", "projects/Alpha.md"], ctime: HOURS_AGO(2 * DAY) },
];

function listed(source: ListSource, fakes = notes): string[] {
	const list: NoteList = { id: "list-1", prefix: "", source };
	return buildJumpList([list], fakeVault(fakes.map((fake) => ({ ...fake })), { propertyTypes: TYPES })).map((entry) => entry.name);
}

function reloadedSource(source: unknown): ListSource {
	return mergeSettings({ lists: [{ id: "list-1", prefix: "", source }] }).notePickers[0].lists[0].source;
}

test("all, any and none combine a group's conditions", () => {
	assert.deepEqual(listed(filter(all(isTrue("active"), property("status", { operator: "is", value: "doing" })))), ["Alpha"]);
	assert.deepEqual(listed(filter(any(isTrue("active"), property("status", { operator: "is", value: "doing" })))), ["Alpha", "Delta", "Gamma"]);
	assert.deepEqual(listed(filter(none(isTrue("active"), property("status", { operator: "is", value: "doing" })))), ["Beta", "Person"]);
});

test("groups nest inside other groups", () => {
	const nested = all(inFolder("projects"), any(isTrue("active"), hasTag("client"), none(hasTag("work"))));
	assert.deepEqual(listed(filter(nested)), ["Alpha"]);
	const deeper = any(all(hasTag("work"), none(isTrue("active"))), linksTo("Person"));
	assert.deepEqual(listed(filter(deeper)), ["Beta", "Delta", "Gamma"]);
});

test("a filter without any condition lists nothing, and an empty group inside a filter is ignored", () => {
	assert.deepEqual(listed(filter(all())), []);
	assert.deepEqual(listed(filter(none())), []);
	assert.deepEqual(listed(filter(any(all(), none()))), []);
	assert.deepEqual(listed(filter(all(isTrue("active"), any()))), ["Alpha", "Gamma"]);
	assert.deepEqual(listed(filter(any(none(), isTrue("active")))), ["Alpha", "Gamma"]);
	assert.deepEqual(listed(filter(none(all(), isTrue("active")))), ["Beta", "Delta", "Person"]);
});

test("file has tag matches the tag and its subtags, with or without #, in any case", () => {
	assert.deepEqual(listed(filter(all(hasTag("work")))), ["Alpha", "Beta"]);
	assert.deepEqual(listed(filter(all(hasTag("#WORK")))), ["Alpha", "Beta"]);
	assert.deepEqual(listed(filter(all(hasTag("work/client")))), ["Beta"]);
	assert.deepEqual(listed(filter(all(hasTag("wor")))), []);
	assert.deepEqual(listed(filter(all(hasTag(" ")))), []);
	assert.deepEqual(listed(filter(all(file("file", "does not have tag", "work")))), ["Delta", "Gamma", "Person"]);
});

test("file in folder matches notes in the folder and its subfolders", () => {
	assert.deepEqual(listed(filter(all(inFolder("projects")))), ["Alpha", "Beta"]);
	assert.deepEqual(listed(filter(all(inFolder("/projects/sub/")))), ["Beta"]);
	assert.deepEqual(listed(filter(all(inFolder("")))), []);
	assert.deepEqual(listed(filter(all(file("file", "is not in folder", "projects")))), ["Delta", "Gamma", "Person"]);
});

test("file links to matches notes linking to the note named by path or name", () => {
	assert.deepEqual(listed(filter(all(linksTo("Person")))), ["Delta", "Gamma"]);
	assert.deepEqual(listed(filter(all(linksTo("people/Person.md")))), ["Delta", "Gamma"]);
	assert.deepEqual(listed(filter(all(linksTo("Nobody")))), []);
	assert.deepEqual(listed(filter(all(file("file", "does not link to", "Person")))), ["Alpha", "Beta", "Person"]);
});

test("file is matches one note, and file has property matches notes that set the property", () => {
	assert.deepEqual(listed(filter(all(file("file", "is", "Delta")))), ["Delta"]);
	assert.deepEqual(listed(filter(all(file("file", "is not", "Delta")))), ["Alpha", "Beta", "Gamma", "Person"]);
	assert.deepEqual(listed(filter(all(file("file", "has property", "status")))), ["Alpha", "Delta"]);
	assert.deepEqual(listed(filter(all(file("file", "does not have property", "active")))), ["Delta", "Person"]);
});

test("file backlinks lists the notes linked from another note, and file links the notes it links to", () => {
	assert.deepEqual(listed(filter(all(file("backlinks", "contains", "Delta")))), ["Alpha", "Person"]);
	assert.deepEqual(listed(filter(all(file("backlinks", "contains", "[[Gamma]]")))), ["Person"]);
	assert.deepEqual(listed(filter(all(file("backlinks", "is empty")))), ["Beta", "Delta", "Gamma"]);
	assert.deepEqual(listed(filter(all(file("links", "contains all of", ["Person", "Alpha"])))), ["Delta"]);
	assert.deepEqual(listed(filter(all(file("links", "contains any of", ["Alpha", "Person"])))), ["Delta", "Gamma"]);
	assert.deepEqual(listed(filter(all(file("links", "is not empty")))), ["Delta", "Gamma"]);
	assert.deepEqual(listed(filter(all(file("embeds", "contains", "Person")))), ["Alpha"]);
});

test("file tags compares whole tags, and file size compares numbers", () => {
	assert.deepEqual(listed(filter(all(file("tags", "contains", "work")))), ["Alpha"]);
	assert.deepEqual(listed(filter(all(file("tags", "contains any of", ["workshop", "work/client"])))), ["Beta", "Gamma"]);
	assert.deepEqual(listed(filter(all(file("size", "≥", 120)))), ["Alpha", "Beta"]);
	assert.deepEqual(listed(filter(all(file("size", "<", 100)))), ["Delta", "Gamma", "Person"]);
});

test("created and modified time compare the note's local day with a fixed or relative date", () => {
	const times = (field: FileField, condition: Condition) => listed(filter(all(file(field, condition.operator, condition.value))));
	assert.deepEqual(times("ctime", { operator: "on", value: { kind: "relative", days: 0 } }), ["Alpha"]);
	assert.deepEqual(times("ctime", { operator: "after", value: { kind: "relative", days: -3 } }), ["Alpha", "Delta", "Person"]);
	assert.deepEqual(times("ctime", { operator: "on or after", value: { kind: "relative", days: -2 } }), ["Alpha", "Delta", "Person"]);
	assert.deepEqual(times("ctime", { operator: "before", value: { kind: "fixed", date: "2024-03-05" } }), ["Beta", "Gamma"]);
	assert.deepEqual(times("ctime", { operator: "on or before", value: { kind: "fixed", date: "2024-03-04" } }), ["Beta", "Gamma"]);
	assert.deepEqual(times("mtime", { operator: "after", value: { kind: "relative", days: -2 } }), ["Alpha", "Person"]);
	assert.deepEqual(times("mtime", { operator: "on", value: { kind: "fixed", date: "2024-03-06" } }), ["Beta"]);
});

test("file name, base name, full name, path, folder and extension are text, matched like Bases", () => {
	const text = (field: FileField, operator: Operator, value?: Condition["value"]) => listed(filter(all(file(field, operator, value))));
	assert.deepEqual(text("name", "starts with", "Al"), ["Alpha"]);
	assert.deepEqual(text("name", "starts with", "al"), []);
	assert.deepEqual(text("name", "does not start with", "Al"), ["Beta", "Delta", "Gamma", "Person"]);
	assert.deepEqual(text("name", "contains", "MM"), ["Gamma"]);
	assert.deepEqual(text("name", "does not contain", "a"), ["Person"]);
	assert.deepEqual(text("name", "ends with", "ta"), ["Beta", "Delta"]);
	assert.deepEqual(text("name", "ends with", "TA"), []);
	assert.deepEqual(text("name", "is", "Delta"), ["Delta"]);
	assert.deepEqual(text("basename", "contains any of", ["alp", "gam"]), ["Alpha", "Gamma"]);
	assert.deepEqual(text("fullname", "is", "Beta.md"), ["Beta"]);
	assert.deepEqual(text("path", "starts with", "projects/"), ["Alpha", "Beta"]);
	assert.deepEqual(text("path", "contains", "/SUB/"), ["Beta"]);
	assert.deepEqual(text("path", "ends with", "sub/Beta.md"), ["Beta"]);
	assert.deepEqual(text("folder", "is", "/"), ["Delta"]);
	assert.deepEqual(text("folder", "contains all of", ["project", "sub"]), ["Beta"]);
	assert.deepEqual(text("ext", "is", "md").length, notes.length);
});

test("a text condition with no value lists nothing, and its negation lists every note", () => {
	assert.deepEqual(listed(filter(all(file("name", "contains", "")))), []);
	assert.deepEqual(listed(filter(all(file("name", "contains any of", [])))), []);
	assert.deepEqual(listed(filter(all(file("name", "does not contain", "")))).length, notes.length);
});

test("filters saved by earlier versions read as the matching Bases condition", () => {
	const legacy = (items: unknown[]) => reloadedSource({ kind: "filter", filter: { kind: "group", mode: "all", items } });
	assert.deepEqual(
		legacy([
			{ kind: "folder", folder: "projects" },
			{ kind: "folder", folder: "archive", negated: true },
			{ kind: "tag", tag: "work" },
			{ kind: "tag", tag: "done", negated: true },
			{ kind: "linksTo", note: "Person" },
			{ kind: "linksTo", note: "Old", negated: true },
		]),
		filter(
			all(
				inFolder("projects"),
				file("file", "is not in folder", "archive"),
				hasTag("work"),
				file("file", "does not have tag", "done"),
				linksTo("Person"),
				file("file", "does not link to", "Old"),
			),
		),
	);
	assert.deepEqual(
		legacy([
			{ kind: "file", field: "created", condition: { operator: "after", value: { kind: "relative", days: -7 } } },
			{ kind: "file", field: "modified", condition: { operator: "on", value: { kind: "fixed", date: "2024-03-01" } } },
			{ kind: "name", operator: "starts with", value: "Weekly" },
			{ kind: "path", operator: "ends with", value: "sub/beta" },
			{ kind: "path", operator: "does not contain", value: "archive/" },
		]),
		filter(
			all(
				file("ctime", "after", { kind: "relative", days: -7 }),
				file("mtime", "on", { kind: "fixed", date: "2024-03-01" }),
				file("name", "starts with", "Weekly"),
				file("path", "ends with", "sub/beta.md"),
				file("path", "does not contain", "archive/"),
			),
		),
	);
	assert.deepEqual(
		legacy([
			{ kind: "property", property: "done", condition: { operator: "is true" } },
			{ kind: "property", property: "done", condition: { operator: "is false" } },
			{ kind: "property", property: "status", condition: { operator: "is set" } },
			{ kind: "property", property: "status", condition: { operator: "is not set" } },
			{ kind: "property", property: "people", condition: { operator: "has item", value: "[[Ana]]" } },
			{ kind: "property", property: "people", condition: { operator: "does not have item", value: "Bo" } },
		]),
		filter(
			all(
				property("done", { operator: "is", value: true }),
				property("done", { operator: "is", value: false }),
				property("status", { operator: "is not empty" }),
				property("status", { operator: "is empty" }),
				property("people", { operator: "contains", value: "[[Ana]]" }),
				property("people", { operator: "does not contain", value: "Bo" }),
			),
		),
	);
});

const unreadableFilter = {
	kind: "filter",
	filter: { kind: "group", mode: "all", items: [{ kind: "property", property: "active", condition: { operator: "is true" } }, { kind: "colour", colour: "red" }] },
};

test("a filter with any node this version cannot read keeps the whole list as broken", () => {
	const broken = [
		unreadableFilter,
		{ kind: "filter", filter: { kind: "group", mode: "some", items: [] } },
		{ kind: "filter", filter: all(property("rating", { operator: "between", value: 3 } as unknown as Condition)) },
		{ kind: "filter", filter: all(all(all(all(isTrue("active"))))) },
		{ kind: "filter", filter: all({ kind: "file", field: "created", condition: { operator: "is", value: "x" } } as unknown as FilterRule) },
		{ kind: "filter", filter: all({ kind: "file", field: "colour", condition: { operator: "is", value: "x" } } as unknown as FilterRule) },
		{ kind: "filter", filter: all({ kind: "tag", tag: 4 } as unknown as FilterRule) },
		{ kind: "filter", filter: all({ kind: "name", operator: "matches", value: "x" } as unknown as FilterRule) },
		{ kind: "sorted", by: "name" },
	];
	const lists = mergeSettings({ lists: broken.map((source, index) => ({ id: `list-${index + 1}`, prefix: "x", source })) }).notePickers[0].lists;
	assert.deepEqual(lists.map((list) => list.source), broken.map((stored) => ({ kind: "unreadable", stored })));
	const readable = mergeSettings({ lists: [{ id: "list-1", prefix: "", source: filter(all(all(any(isTrue("active"))))) }] });
	assert.equal(readable.notePickers[0].lists[0].source.kind, "filter");
});

test("saving keeps a broken list's and a broken property's stored source exactly as it was", () => {
	const stored = {
		lists: [{ id: "list-1", prefix: "?", source: unreadableFilter }],
		setProperties: { properties: [{ id: "p-1", prefix: "", property: "related", type: "links", source: { kind: "nowhere", deep: [1] } }] },
	};
	const saved = JSON.parse(JSON.stringify(storedSettings(mergeSettings(stored))));
	assert.deepEqual(saved.notePickers[0].lists, stored.lists);
	assert.deepEqual(saved.setProperties.properties[0].source, stored.setProperties.properties[0].source);
	assert.deepEqual(mergeSettings(saved), mergeSettings(stored));
	assert.deepEqual(JSON.parse(JSON.stringify(storedSettings(defaultSettings()))), JSON.parse(JSON.stringify(defaultSettings())));
});

test("broken lists and properties never contribute notes", () => {
	const settings = mergeSettings({
		lists: [{ id: "list-1", prefix: "?", source: unreadableFilter }],
		setProperties: {
			properties: [
				{ id: "p-1", prefix: "", property: "related", type: "links", source: unreadableFilter },
				{ id: "p-2", prefix: "", property: "seen", type: "links", source: { kind: "filter", filter: { kind: "group", mode: "all", items: [{ kind: "file", field: "file", condition: { operator: "in folder", value: "projects" } }] } } },
			],
		},
	});
	const vault = fakeVault(notes.map((fake) => ({ ...fake })), { propertyTypes: TYPES });
	assert.deepEqual(buildJumpList(settings.notePickers[0].lists, vault), []);
	const offered = offeredEntries(settings, vault, vault.note("Delta.md"));
	assert.deepEqual(offered.map((entry) => entry.entry.property), ["seen"]);
});

test("a filter's summary describes its single condition or counts its conditions", () => {
	assert.equal(sourceSummary(filter(all())), "No conditions yet");
	assert.equal(sourceSummary(filter(all(isTrue("active")))), "active is true");
	assert.equal(sourceSummary(filter(all(inFolder("on")))), "file in folder on");
	assert.equal(sourceSummary(filter(all(hasTag("#project")))), "file has tag #project");
	assert.equal(sourceSummary(filter(all(linksTo("people/Person.md")))), "file links to Person");
	assert.equal(sourceSummary(filter(all(file("mtime", "after", { kind: "relative", days: -7 })))), "modified time after 7 days ago");
	assert.equal(sourceSummary(filter(all(file("backlinks", "is empty")))), "file backlinks is empty");
	assert.equal(sourceSummary(filter(all(file("tags", "contains any of", ["a", "b"])))), "file tags contains any of a, b");
	assert.equal(sourceSummary(filter(all(file("name", "starts with", "Weekly")))), "file name starts with Weekly");
	assert.equal(sourceSummary(filter(all(file("path", "contains", "")))), "file path contains …");
	assert.equal(sourceSummary(filter(all(isTrue("a"), any(isTrue("b"), isTrue("c"))))), "All of 3 conditions");
	assert.equal(sourceSummary(filter(any(isTrue("a"), isTrue("b")))), "Any of 2 conditions");
	assert.equal(sourceSummary(filter(none(isTrue("a")))), "None of 1 condition");
	assert.equal(sourceSummary(filter(all(any(isTrue("a"))))), "All of 1 condition");
});

test("a filter warns about a property condition that does not apply anywhere in it", () => {
	const types = { rating: "number" };
	const nested = filter(all(hasTag("x"), any(property("rating", { operator: "is", value: "3" }))));
	assert.match(inapplicableCondition(nested, types) ?? "", /"is" does not apply to a number property/);
	assert.equal(inapplicableCondition(filter(all(property("rating", { operator: ">", value: 3 }))), types), undefined);
});

test("new conditions survive a reload unchanged", () => {
	const source = filter(
		all(
			file("file", "is not in folder", "projects"),
			file("backlinks", "contains", "Delta"),
			file("name", "ends with", "ta"),
			file("size", "≤", 100),
			property("people", { operator: "contains all of", value: ["Ana", "Bo"] }),
			property("status", { operator: "is not empty" }),
		),
	);
	const settings = defaultSettings();
	settings.notePickers[0].lists = [{ id: "list-1", prefix: "", source }];
	const reloaded = mergeSettings(JSON.parse(JSON.stringify(storedSettings(settings))));
	assert.deepEqual(reloaded.notePickers[0].lists[0].source, source);
});

test("a navigation picker's filter narrows every list on top of each list's own filter", () => {
	const vault = fakeVault(notes.map((fake) => ({ ...fake })), { propertyTypes: TYPES });
	const lists: NoteList[] = [
		{ id: "list-1", prefix: "a", source: filter(all(property("status", { operator: "is", value: "doing" }))) },
		{ id: "list-2", prefix: "b", source: { kind: "filter", filter: { kind: "group", mode: "all", items: [{ kind: "file", field: "file", condition: { operator: "in folder", value: "projects" } }] } } },
	];
	const names = (pickerFilter?: FilterGroup) => buildJumpList(lists, vault, undefined, undefined, pickerFilter).map((entry) => `${entry.prefix} ${entry.name}`);
	assert.deepEqual(names(), ["a Alpha", "a Delta", "b Alpha", "b Beta"]);
	assert.deepEqual(names(all()), names());
	assert.deepEqual(names(all(isTrue("active"))), ["a Alpha", "b Alpha"]);
	assert.deepEqual(names(none(inFolder("projects"))), ["a Delta"]);
});

test("a navigation picker's filter round-trips, defaults to empty, and an unreadable one keeps the picker saved but unavailable", () => {
	const pickerFilter = all(isTrue("active"));
	const settings = mergeSettings({ notePickers: [{ id: "1", name: "Work", filter: pickerFilter, lists: [] }, { id: "2", name: "Old", lists: [] }] });
	assert.deepEqual(settings.notePickers.map((picker) => picker.filter), [pickerFilter, all()]);
	assert.deepEqual(mergeSettings(JSON.parse(JSON.stringify(storedSettings(settings)))).notePickers, settings.notePickers);
	const broken = { id: "3", name: "Broken", filter: { kind: "group", mode: "sometimes", items: [] }, lists: [] };
	const [picker] = mergeSettings({ notePickers: [broken] }).notePickers;
	assert.ok(picker.unreadable);
	assert.deepEqual(picker.unreadable, { stored: broken });
	assert.deepEqual((storedSettings(mergeSettings({ notePickers: [broken] })) as { notePickers: unknown[] }).notePickers, [broken]);
});
