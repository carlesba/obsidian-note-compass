import { test } from "node:test";
import { strict as assert } from "node:assert";
import { defaultSettings } from "../src/settings.ts";
import type { EditableProperty, JumpSettings, NoteList } from "../src/settings.ts";
import { listKey, propertyKey } from "../src/settings/controlKeys.ts";
import {
	applyPrefixChange,
	linkedPrefixKeys,
	prefixRows,
	prefixSuggestions,
	samePrefix,
	updatedPrefixKeys,
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
	prefixColor === undefined ? { key, prefix } : { key, prefix, prefixColor };

function settingsWith(lists: NoteList[], properties: EditableProperty[]): JumpSettings {
	const settings = defaultSettings();
	settings.lists = lists;
	settings.setProperties.properties = properties;
	return settings;
}

test("rows share a prefix when the trimmed text and the colour are equal", () => {
	assert.equal(samePrefix({ prefix: " 👤 peop " }, { prefix: "👤 peop" }), true);
	assert.equal(samePrefix({ prefix: "👤 peop", prefixColor: "#ff0000" }, { prefix: "👤 peop", prefixColor: "#ff0000" }), true);
	assert.equal(samePrefix({ prefix: "👤 peop", prefixColor: "#ff0000" }, { prefix: "👤 peop" }), false);
	assert.equal(samePrefix({ prefix: "👤 peop" }, { prefix: "👤 Peop" }), false);
});

test("prefix rows cover every list and every property, keyed by their prefix control", () => {
	const settings = settingsWith([list("list-1", "🔗 out", "#00ff00")], [property("property-1", "📅 due")]);
	assert.deepEqual(prefixRows(settings), [
		{ key: listKey("list-1", "prefix"), prefix: "🔗 out", prefixColor: "#00ff00" },
		{ key: propertyKey("property-1", "prefix"), prefix: "📅 due", prefixColor: undefined },
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

test("suggestions group the other rows' prefixes by text and colour, with how many rows use each", () => {
	const rows = [
		row("own", "🔗 out"),
		row("a", "📅 due", "#ff0000"),
		row("b", "📅 due ", "#ff0000"),
		row("c", "📅 due"),
		row("d", "👤 peop"),
		row("e", "📅 due", "#ff0000"),
	];
	assert.deepEqual(prefixSuggestions(rows, "own", ""), [
		{ prefix: "📅 due", color: "#ff0000", count: 3 },
		{ prefix: "📅 due", count: 1 },
		{ prefix: "👤 peop", count: 1 },
	]);
});

test("suggestions leave out empty prefixes and the row's own prefix", () => {
	const rows = [row("own", "🔗 out"), row("a", ""), row("b", "  "), row("c", "🔗 out"), row("d", "🔗 out", "#00ff00")];
	assert.deepEqual(prefixSuggestions(rows, "own", ""), [{ prefix: "🔗 out", color: "#00ff00", count: 1 }]);
});

test("suggestions are filtered by in-order matching, ignoring case", () => {
	const rows = [row("own", ""), row("a", "👤 peop"), row("b", "📅 due"), row("c", "🏢 Comp")];
	assert.deepEqual(
		prefixSuggestions(rows, "own", "pp").map((suggestion) => suggestion.prefix),
		["👤 peop"],
	);
	assert.deepEqual(
		prefixSuggestions(rows, "own", "CMP").map((suggestion) => suggestion.prefix),
		["🏢 Comp"],
	);
	assert.deepEqual(prefixSuggestions(rows, "own", "xyz"), []);
});

test("a linked change sets the text and colour of the row and every linked row only", () => {
	const settings = settingsWith(
		[list("list-1", "👤 peop", "#ff0000"), list("list-2", "👤 peop", "#ff0000"), list("list-3", "👤 peop")],
		[property("property-1", "👤 peop", "#ff0000"), property("property-2", "📅 due", "#ff0000")],
	);
	const key = listKey("list-1", "prefix");
	const keys = updatedPrefixKeys(key, linkedPrefixKeys(prefixRows(settings), key), true);
	assert.equal(applyPrefixChange(settings, keys, { prefix: "👥 team", color: "#0000ff" }), true);
	assert.deepEqual(
		prefixRows(settings).map(({ prefix, prefixColor }) => [prefix, prefixColor]),
		[
			["👥 team", "#0000ff"],
			["👥 team", "#0000ff"],
			["👤 peop", undefined],
			["👥 team", "#0000ff"],
			["📅 due", "#ff0000"],
		],
	);
});

test("an unlinked change updates only the edited row", () => {
	const settings = settingsWith([list("list-1", "👤 peop"), list("list-2", "👤 peop")], []);
	const key = listKey("list-1", "prefix");
	const keys = updatedPrefixKeys(key, linkedPrefixKeys(prefixRows(settings), key), false);
	applyPrefixChange(settings, keys, { prefix: "👥 team" });
	assert.deepEqual(
		settings.lists.map((entry) => entry.prefix),
		["👥 team", "👤 peop"],
	);
});

test("a change can set only the colour, and an empty colour removes it", () => {
	const settings = settingsWith([list("list-1", "👤 peop", "#ff0000"), list("list-2", "👤 peop", "#ff0000")], []);
	const keys = [listKey("list-1", "prefix"), listKey("list-2", "prefix")];
	applyPrefixChange(settings, keys, { color: "#00ff00" });
	assert.deepEqual(settings.lists.map((entry) => [entry.prefix, entry.prefixColor]), [
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
