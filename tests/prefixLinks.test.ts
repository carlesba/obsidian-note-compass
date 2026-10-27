import { test } from "node:test";
import { strict as assert } from "node:assert";
import { defaultSettings } from "../src/settings.ts";
import type { EditableProperty, JumpSettings, NoteList } from "../src/settings.ts";
import { listKey, propertyKey } from "../src/settings/controlKeys.ts";
import {
	PrefixPages,
	applyPrefixChange,
	assignPrefix,
	clearPrefix,
	linkedPrefixKeys,
	linkedRowsText,
	prefixMenu,
	prefixRows,
	samePrefix,
} from "../src/settings/prefixLinks.ts";
import type { PrefixRow } from "../src/settings/prefixLinks.ts";

const list = (id: string, prefix: string, prefixColor?: string): NoteList => ({
	id,
	enabled: true,
	prefix,
	...(prefixColor === undefined ? {} : { prefixColor }),
	source: { kind: "linksOut" },
});

const property = (id: string, prefix: string, prefixColor?: string): EditableProperty => ({
	id,
	enabled: true,
	prefix,
	...(prefixColor === undefined ? {} : { prefixColor }),
	property: id,
	type: "checkbox",
});

const row = (key: string, prefix: string, prefixColor?: string): PrefixRow =>
	prefixColor === undefined ? { key, prefix, label: key } : { key, prefix, prefixColor, label: key };

function settingsWith(lists: NoteList[], properties: EditableProperty[]): JumpSettings {
	const settings = defaultSettings();
	settings.lists = lists;
	settings.setProperties.properties = properties;
	return settings;
}

const shown = (settings: JumpSettings) => prefixRows(settings).map(({ prefix, prefixColor }) => [prefix, prefixColor]);

test("rows share a prefix when the trimmed text and the colour are equal", () => {
	assert.equal(samePrefix({ prefix: " 👤 peop " }, { prefix: "👤 peop" }), true);
	assert.equal(samePrefix({ prefix: "👤 peop", prefixColor: "#ff0000" }, { prefix: "👤 peop", prefixColor: "#ff0000" }), true);
	assert.equal(samePrefix({ prefix: "👤 peop", prefixColor: "#ff0000" }, { prefix: "👤 peop" }), false);
	assert.equal(samePrefix({ prefix: "👤 peop" }, { prefix: "👤 Peop" }), false);
});

test("prefix rows cover every list and every property, keyed by their prefix control and labelled as their row", () => {
	const settings = settingsWith([list("list-1", "🔗 out", "#00ff00")], [property("status", "📅 due")]);
	assert.deepEqual(prefixRows(settings), [
		{ key: listKey("list-1", "prefix"), prefix: "🔗 out", prefixColor: "#00ff00", label: "Outbound links" },
		{ key: propertyKey("status", "prefix"), prefix: "📅 due", prefixColor: undefined, label: "status · checkbox" },
	]);
});

test("a row links to the other rows using its prefix, across lists and properties", () => {
	const rows = [
		row("a", "👤 peop", "#ff0000"),
		row("b", " 👤 peop", "#ff0000"),
		row("c", "👤 peop"),
		row("d", "👤 peop", "#ff0000"),
		row("e", "📅 due", "#ff0000"),
	];
	assert.deepEqual(linkedPrefixKeys(rows, "a"), ["b", "d"]);
	assert.deepEqual(linkedPrefixKeys(rows, "c"), []);
	assert.deepEqual(linkedPrefixKeys(rows, "missing"), []);
});

test("rows with an empty prefix never link", () => {
	const rows = [row("a", ""), row("b", " "), row("c", "")];
	assert.deepEqual(linkedPrefixKeys(rows, "a"), []);
});

test("the prefix menu lists every prefix in use once, with how many rows use it, most used first then by text", () => {
	const rows = [
		row("own", "🔗 out"),
		row("a", "📅 due", "#ff0000"),
		row("b", "📅 due ", "#ff0000"),
		row("c", "👤 peop"),
		row("d", "📅 due"),
		row("e", "📅 due", "#ff0000"),
	];
	assert.deepEqual(prefixMenu(rows, "own").choices, [
		{ prefix: "📅 due", color: "#ff0000", count: 3, checked: false },
		{ prefix: "👤 peop", count: 1, checked: false },
		{ prefix: "📅 due", count: 1, checked: false },
		{ prefix: "🔗 out", count: 1, checked: true },
	]);
});

test("the prefix menu checks the row's own prefix and counts the row in it", () => {
	const rows = [row("own", " 👤 peop", "#ff0000"), row("a", "👤 peop", "#ff0000"), row("b", "👤 peop")];
	assert.deepEqual(prefixMenu(rows, "own").choices, [
		{ prefix: "👤 peop", color: "#ff0000", count: 2, checked: true },
		{ prefix: "👤 peop", count: 1, checked: false },
	]);
});

test("the prefix menu never lists an empty prefix, and offers No prefix only to a row that has one", () => {
	const rows = [row("own", "  "), row("a", ""), row("b", "📅 due")];
	assert.deepEqual(prefixMenu(rows, "own"), { choices: [{ prefix: "📅 due", count: 1, checked: false }], clears: false });
	assert.equal(prefixMenu(rows, "b").clears, true);
	assert.deepEqual(prefixMenu([row("own", "")], "own"), { choices: [], clears: false });
});

test("picking a prefix from the menu gives this row its text and colour, and leaves the other rows alone", () => {
	const settings = settingsWith([list("list-1", "🔗 out", "#00ff00"), list("list-2", "🔗 out", "#00ff00")], [property("status", "📅 due")]);
	assert.equal(assignPrefix(settings, listKey("list-1", "prefix"), { prefix: "📅 due" }), true);
	assert.deepEqual(shown(settings), [
		["📅 due", undefined],
		["🔗 out", "#00ff00"],
		["📅 due", undefined],
	]);
	assert.equal("prefixColor" in settings.lists[0], false);
	assert.equal(assignPrefix(settings, propertyKey("status", "prefix"), { prefix: "🔗 out", color: "#00ff00" }), true);
	assert.deepEqual(shown(settings)[2], ["🔗 out", "#00ff00"]);
});

test("picking the row's own prefix or an unknown row changes nothing", () => {
	const settings = settingsWith([list("list-1", " 🔗 out", "#00ff00")], []);
	assert.equal(assignPrefix(settings, listKey("list-1", "prefix"), { prefix: "🔗 out", color: "#00ff00" }), false);
	assert.equal(settings.lists[0].prefix, " 🔗 out");
	assert.equal(assignPrefix(settings, "list/missing/prefix", { prefix: "x" }), false);
});

test("No prefix clears this row's text and colour only", () => {
	const settings = settingsWith([list("list-1", "🔗 out", "#00ff00"), list("list-2", "🔗 out", "#00ff00")], []);
	assert.equal(clearPrefix(settings, listKey("list-1", "prefix")), true);
	assert.deepEqual(shown(settings), [
		["", undefined],
		["🔗 out", "#00ff00"],
	]);
	assert.equal("prefixColor" in settings.lists[0], false);
});

test("a change can set only the colour, and an empty colour removes it", () => {
	const settings = settingsWith([list("list-1", "👤 peop", "#ff0000"), list("list-2", "👤 peop", "#ff0000")], []);
	const keys = [listKey("list-1", "prefix"), listKey("list-2", "prefix")];
	applyPrefixChange(settings, keys, { color: "#00ff00" });
	assert.deepEqual(shown(settings), [
		["👤 peop", "#00ff00"],
		["👤 peop", "#00ff00"],
	]);
	applyPrefixChange(settings, keys, { color: "" });
	assert.deepEqual(settings.lists.map((entry) => "prefixColor" in entry), [false, false]);
});

test("a change to unknown rows reports that nothing changed", () => {
	const settings = settingsWith([list("list-1", "👤 peop")], []);
	assert.equal(applyPrefixChange(settings, ["list/missing/prefix"], { prefix: "x" }), false);
	assert.equal(settings.lists[0].prefix, "👤 peop");
});

test("the rows sharing a prefix are named by their labels, cut after three", () => {
	assert.equal(linkedRowsText(["a"]), "a");
	assert.equal(linkedRowsText(["a", "b", "c"]), "a, b, c");
	assert.equal(linkedRowsText(["a", "b", "c", "d"]), "a, b, c, …");
});

test("a page's edits change the rows that shared its prefix when it opened, even through an empty prefix", () => {
	const settings = settingsWith(
		[list("list-1", "👤 peop"), list("list-2", "👤 peop"), list("list-3", "📅 due")],
		[property("status", "👤 peop"), property("owner", "👤 peop", "#ff0000")],
	);
	const pages = new PrefixPages(() => settings);
	const key = listKey("list-1", "prefix");
	pages.hold(key);
	assert.deepEqual(
		pages.linkedRows(key).map((linked) => linked.key),
		[listKey("list-2", "prefix"), propertyKey("status", "prefix")],
	);
	for (const typed of ["👤 pe", "", "📅 due", "👥 team"]) pages.edit(key, { prefix: typed });
	pages.edit(key, { color: "#0000ff" });
	assert.deepEqual(shown(settings), [
		["👥 team", "#0000ff"],
		["👥 team", "#0000ff"],
		["📅 due", undefined],
		["👥 team", "#0000ff"],
		["👤 peop", "#ff0000"],
	]);
});

test("a page keeps its linked rows across re-renders and starts over once it closes", () => {
	const settings = settingsWith([list("list-1", "👤 peop"), list("list-2", "👤 peop")], []);
	const pages = new PrefixPages(() => settings);
	const key = listKey("list-1", "prefix");
	pages.hold(key);
	pages.edit(key, { prefix: "" });
	pages.release(key);
	pages.hold(key);
	assert.equal(pages.closeUnheld(key), false);
	assert.equal(pages.linkedRows(key).length, 1);
	pages.release(key);
	assert.equal(pages.closeUnheld(key), true);
	assert.deepEqual(pages.linkedRows(key), []);
});

test("closing a page reports whether it changed anything", () => {
	const settings = settingsWith([list("list-1", "👤 peop")], []);
	const pages = new PrefixPages(() => settings);
	const key = listKey("list-1", "prefix");
	pages.hold(key);
	pages.release(key);
	assert.equal(pages.closeUnheld(key), false);
	assert.equal(pages.closeUnheld(key), false);
});

test("Edit prefix starts the page afresh and focuses its prefix field once", () => {
	const settings = settingsWith([list("list-1", "👤 peop"), list("list-2", "👤 peop")], []);
	const pages = new PrefixPages(() => settings);
	const key = listKey("list-1", "prefix");
	pages.hold(key);
	pages.edit(key, { prefix: "👥 team" });
	pages.startEditing(key);
	assert.equal(pages.closeUnheld(key), false);
	assert.equal(pages.takeFocus(listKey("list-2", "prefix")), false);
	assert.equal(pages.takeFocus(key), true);
	assert.equal(pages.takeFocus(key), false);
});
