import { test } from "node:test";
import { strict as assert } from "node:assert";
import { creatableEntries } from "../src/createNote/choices.ts";
import { noteCreationBlocker } from "../src/createNote/newNotes.ts";
import type { Condition } from "../src/lists/conditions.ts";
import type { FilterGroup, FilterNode, FilterRule } from "../src/lists/filters.ts";
import { buildJumpList } from "../src/lists/jumpList.ts";
import { offeredEntries } from "../src/setProperties/offered.ts";
import { defaultSettings, mergeSettings, storedSettings } from "../src/settings.ts";
import type { EditableProperty, ListSource, NoteList } from "../src/settings.ts";
import { inapplicableCondition, sourceSummary } from "../src/settings/listForm.ts";
import { HOURS_AGO, NOW, fakeVault } from "./fakeVault.ts";
import type { FakeNote } from "./fakeVault.ts";

const DAY = 24;

const TYPES = { active: "checkbox" };

const property = (name: string, condition: Condition): FilterRule => ({ kind: "property", property: name, condition });
const isTrue = (name: string) => property(name, { operator: "is true" });
const all = (...items: FilterNode[]): FilterGroup => ({ kind: "group", mode: "all", items });
const any = (...items: FilterNode[]): FilterGroup => ({ kind: "group", mode: "any", items });
const none = (...items: FilterNode[]): FilterGroup => ({ kind: "group", mode: "none", items });
const filter = (group: FilterGroup): ListSource => ({ kind: "filter", filter: group });

const notes: FakeNote[] = [
	{ path: "projects/Alpha.md", frontmatter: { active: true, status: "doing" }, tags: ["#work"], ctime: NOW, mtime: HOURS_AGO(1) },
	{ path: "projects/sub/Beta.md", frontmatter: { active: false }, tags: ["#Work/Client"], ctime: HOURS_AGO(5 * DAY), mtime: HOURS_AGO(3 * DAY) },
	{ path: "projectsX/Gamma.md", frontmatter: { active: true }, tags: ["#workshop"], links: ["people/Person.md"], ctime: HOURS_AGO(10 * DAY) },
	{ path: "people/Person.md", frontmatter: {}, links: [], ctime: HOURS_AGO(DAY), mtime: HOURS_AGO(DAY) },
	{ path: "Delta.md", frontmatter: { status: "doing" }, links: ["people/Person.md"], ctime: HOURS_AGO(2 * DAY) },
];

function listed(source: ListSource, fakes = notes): string[] {
	const list: NoteList = { id: "list-1", enabled: true, prefix: "", source };
	return buildJumpList([list], fakeVault(fakes.map((fake) => ({ ...fake })), { propertyTypes: TYPES })).map((entry) => entry.name);
}

test("all, any and none combine a group's conditions", () => {
	assert.deepEqual(listed(filter(all(isTrue("active"), property("status", { operator: "is", value: "doing" })))), ["Alpha"]);
	assert.deepEqual(listed(filter(any(isTrue("active"), property("status", { operator: "is", value: "doing" })))), ["Alpha", "Delta", "Gamma"]);
	assert.deepEqual(listed(filter(none(isTrue("active"), property("status", { operator: "is", value: "doing" })))), ["Beta", "Person"]);
});

test("groups nest inside other groups", () => {
	const nested = all({ kind: "folder", folder: "projects" }, any(isTrue("active"), { kind: "tag", tag: "client" }, none({ kind: "tag", tag: "work" })));
	assert.deepEqual(listed(filter(nested)), ["Alpha"]);
	const deeper = any(all({ kind: "tag", tag: "work" }, none(isTrue("active"))), { kind: "linksTo", note: "Person" });
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

test("a tag condition matches the tag and its subtags, with or without #, in any case", () => {
	assert.deepEqual(listed(filter(all({ kind: "tag", tag: "work" }))), ["Alpha", "Beta"]);
	assert.deepEqual(listed(filter(all({ kind: "tag", tag: "#WORK" }))), ["Alpha", "Beta"]);
	assert.deepEqual(listed(filter(all({ kind: "tag", tag: "work/client" }))), ["Beta"]);
	assert.deepEqual(listed(filter(all({ kind: "tag", tag: "wor" }))), []);
	assert.deepEqual(listed(filter(all({ kind: "tag", tag: " " }))), []);
});

test("a folder condition matches notes in the folder and its subfolders", () => {
	assert.deepEqual(listed(filter(all({ kind: "folder", folder: "projects" }))), ["Alpha", "Beta"]);
	assert.deepEqual(listed(filter(all({ kind: "folder", folder: "/projects/sub/" }))), ["Beta"]);
	assert.deepEqual(listed(filter(all({ kind: "folder", folder: "" }))), []);
});

test("a links-to condition matches notes linking to the note named by path or name", () => {
	assert.deepEqual(listed(filter(all({ kind: "linksTo", note: "Person" }))), ["Delta", "Gamma"]);
	assert.deepEqual(listed(filter(all({ kind: "linksTo", note: "people/Person.md" }))), ["Delta", "Gamma"]);
	assert.deepEqual(listed(filter(all({ kind: "linksTo", note: "Nobody" }))), []);
});

test("created and modified conditions compare the note's local day with a fixed or relative date", () => {
	const created = (condition: FilterRule & { kind: "file" }) => listed(filter(all(condition)));
	assert.deepEqual(created({ kind: "file", field: "created", condition: { operator: "on", value: { kind: "relative", days: 0 } } }), ["Alpha"]);
	assert.deepEqual(
		created({ kind: "file", field: "created", condition: { operator: "after", value: { kind: "relative", days: -3 } } }),
		["Alpha", "Delta", "Person"],
	);
	assert.deepEqual(
		created({ kind: "file", field: "created", condition: { operator: "before", value: { kind: "fixed", date: "2024-03-05" } } }),
		["Beta", "Gamma"],
	);
	assert.deepEqual(
		created({ kind: "file", field: "modified", condition: { operator: "after", value: { kind: "relative", days: -2 } } }),
		["Alpha", "Person"],
	);
	assert.deepEqual(
		created({ kind: "file", field: "modified", condition: { operator: "on", value: { kind: "fixed", date: "2024-03-06" } } }),
		["Beta"],
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
		{ kind: "filter", filter: all({ kind: "tag", tag: 4 } as unknown as FilterRule) },
		{ kind: "sorted", by: "name" },
	];
	const lists = mergeSettings({ lists: broken.map((source, index) => ({ id: `list-${index + 1}`, enabled: true, prefix: "x", source })) }).lists;
	assert.deepEqual(lists.map((list) => list.source), broken.map((stored) => ({ kind: "unreadable", stored })));
	const readable = mergeSettings({ lists: [{ id: "list-1", enabled: true, prefix: "", source: filter(all(all(any(isTrue("active"))))) }] });
	assert.equal(readable.lists[0].source.kind, "filter");
});

test("saving keeps a broken list's and a broken property's stored source exactly as it was", () => {
	const stored = {
		lists: [{ id: "list-1", enabled: true, prefix: "?", source: unreadableFilter }],
		setProperties: { properties: [{ id: "p-1", enabled: true, prefix: "", property: "related", type: "links", source: { kind: "nowhere", deep: [1] } }] },
	};
	const saved = JSON.parse(JSON.stringify(storedSettings(mergeSettings(stored))));
	assert.deepEqual(saved.lists, stored.lists);
	assert.deepEqual(saved.setProperties.properties[0].source, stored.setProperties.properties[0].source);
	assert.deepEqual(mergeSettings(saved), mergeSettings(stored));
	assert.deepEqual(JSON.parse(JSON.stringify(storedSettings(defaultSettings()))), JSON.parse(JSON.stringify(defaultSettings())));
});

test("broken lists and properties never contribute notes", () => {
	const settings = mergeSettings({
		lists: [{ id: "list-1", enabled: true, prefix: "?", source: unreadableFilter }],
		setProperties: {
			properties: [
				{ id: "p-1", enabled: true, prefix: "", property: "related", type: "links", source: unreadableFilter, createsNotes: true },
				{ id: "p-2", enabled: true, prefix: "", property: "seen", type: "links", source: { kind: "inFolder", folder: "projects" }, createsNotes: true },
			],
		},
	});
	const vault = fakeVault(notes.map((fake) => ({ ...fake })), { propertyTypes: TYPES });
	assert.deepEqual(buildJumpList(settings.lists, vault), []);
	const offered = offeredEntries(settings, vault, vault.note("Delta.md"));
	assert.deepEqual(offered.map((entry) => entry.entry.property), ["seen"]);
	assert.deepEqual(creatableEntries(settings.setProperties, vault).map((creatable) => creatable.entry.property), ["seen"]);
	const brokenProperty: EditableProperty = settings.setProperties.properties[0];
	assert.ok(noteCreationBlocker(brokenProperty.source!, {}));
});

test("a filter's summary describes its single condition or counts its conditions", () => {
	assert.equal(sourceSummary(filter(all())), "No conditions yet");
	assert.equal(sourceSummary(filter(all(isTrue("active")))), "active is true");
	assert.equal(sourceSummary(filter(all({ kind: "folder", folder: "on" }))), "In on");
	assert.equal(sourceSummary(filter(all({ kind: "tag", tag: "#project" }))), "Tagged project");
	assert.equal(sourceSummary(filter(all({ kind: "linksTo", note: "people/Person.md" }))), "Links to Person");
	assert.equal(
		sourceSummary(filter(all({ kind: "file", field: "modified", condition: { operator: "after", value: { kind: "relative", days: -7 } } }))),
		"Modified after 7 days ago",
	);
	assert.equal(sourceSummary(filter(all(isTrue("a"), any(isTrue("b"), isTrue("c"))))), "All of 3 conditions");
	assert.equal(sourceSummary(filter(any(isTrue("a"), isTrue("b")))), "Any of 2 conditions");
	assert.equal(sourceSummary(filter(none(isTrue("a")))), "None of 1 condition");
	assert.equal(sourceSummary(filter(all(any(isTrue("a"))))), "All of 1 condition");
});

test("a filter warns about a property condition that does not apply anywhere in it", () => {
	const types = { rating: "number" };
	const nested = filter(all({ kind: "tag", tag: "x" }, any(property("rating", { operator: "is", value: "3" }))));
	assert.match(inapplicableCondition(nested, types) ?? "", /"is" does not apply to a number property/);
	assert.equal(inapplicableCondition(filter(all(property("rating", { operator: ">", value: 3 }))), types), undefined);
});

test("a filter can create notes only when it is a single property condition the old property list could satisfy", () => {
	const types = { done: "checkbox", rating: "number" };
	const blocker = (group: FilterGroup) => noteCreationBlocker(filter(group), types);
	assert.equal(blocker(all(isTrue("active"))), undefined);
	assert.equal(blocker(all(property("done", { operator: "is set" }))), undefined);
	assert.equal(blocker(all(property("rating", { operator: ">", value: 3 }))), '">" gives no value to write into a new note');
	assert.equal(blocker(all(property("", { operator: "is true" }))), "choose a property first");
	const reason = "a filter with more than one condition, or with groups, can't decide what a new note needs";
	assert.equal(blocker(all(isTrue("a"), isTrue("b"))), reason);
	assert.equal(blocker(all(all(isTrue("a")))), reason);
	assert.equal(blocker(all()), "add a condition first");
	assert.ok(blocker(any(isTrue("a"))));
	assert.ok(blocker(all({ kind: "folder", folder: "people" })));
});
