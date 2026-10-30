import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { EDITABLE_PROPERTY_TYPES, defaultSettings, mergeSettings } from "../src/settings.ts";
import type { EditableProperty } from "../src/settings.ts";
import { propertyRowName } from "../src/settings/setPropertiesForm.ts";
import { decidedPropertyType, mixedTypeProperties } from "../src/setProperties/propertyTypes.ts";

const asFilter = (source: { kind: string; property?: string; condition?: unknown }) =>
	source.kind === "frontmatter"
		? { kind: "filter", filter: { kind: "group", mode: "all", items: [{ kind: "property", property: source.property, condition: source.condition }] } }
		: source;

const v2Data = () => JSON.parse(readFileSync(new URL("./fixtures/data.v2.json", import.meta.url), "utf8"));

const entry = (id: string, property: string, type: EditableProperty["type"], enabled = true): EditableProperty => ({
	id,
	enabled,
	prefix: "",
	property,
	type,
});

test("the type list offers every editable type in the spec's order", () => {
	assert.deepEqual(EDITABLE_PROPERTY_TYPES, ["checkbox", "text", "number", "date", "datetime", "link", "links"]);
});

test("the test vault's v2 data migrates to properties and keeps its jump settings", () => {
	const data = v2Data();
	const merged = mergeSettings(data);
	assert.deepEqual(
		merged.notePickers[0].lists.map((list) => list.prefix),
		["📅 day", "🔗 out", "🔗 in", "🔅 ctx", "⭐ fav", "📌 todo", "🗂 proj"],
	);
	assert.deepEqual(
		merged.notePickers[0].lists,
		data.lists.map((list: { prefix: string; source: { kind: string } }, index: number) => ({
			...list,
			prefix: merged.notePickers[0].lists[index].prefix,
			source: asFilter(list.source),
		})),
	);
	assert.deepEqual(merged.dateNotes, data.dateNotes);
	const rows = merged.setProperties.properties.map((property) => [property.id, property.type, property.property]);
	assert.deepEqual(rows, [
		["list-9", "checkbox", "active"],
		["list-10", "checkbox", "someday"],
		["list-11", "checkbox", "evergreen"],
		["list-12", "checkbox", "blocked"],
		["list-13", "checkbox", "archived"],
		["list-2", "links", "trackers"],
		["list-3", "links", "collections"],
		["list-4", "link", "category"],
		["list-1", "links", "people"],
		["list-5", "links", "related"],
		["list-6", "links", "related"],
		["list-7", "links", "related"],
		["list-8", "links", "related"],
	]);
	const related = merged.setProperties.properties.filter((property) => property.property === "related");
	assert.deepEqual(
		related.map((property) => property.source),
		data.setProperties.linkLists.slice(4).map((list: { source: { kind: string } }) => asFilter(list.source)),
	);
	assert.ok(merged.setProperties.properties.every((property) => property.enabled));
	assert.deepEqual(related.map((property) => property.excludedFolders), related.map(() => ["templates"]));
	assert.deepEqual(merged.setProperties.properties.map((property) => property.prefix), [
		"🎛️ meta",
		"🎛️ meta",
		"🎛️ meta",
		"🎛️ meta",
		"🎛️ meta",
		"📍 trak",
		"📚 coll",
		"📂 catg",
		"👤 peop",
		"🏷️ ever",
		"📍 actv",
		"🏢 comp",
		"🔅 tday",
	]);
	assert.deepEqual(mergeSettings(JSON.parse(JSON.stringify(merged))), merged);
});

test("the defaults are the old defaults in the new shape", () => {
	const { properties } = defaultSettings().setProperties;
	assert.deepEqual(properties.map(propertyRowName), [
		"🎛️ meta active · checkbox",
		"🎛️ meta someday · checkbox",
		"🎛️ meta evergreen · checkbox",
		"🎛️ meta blocked · checkbox",
		"🎛️ meta archived · checkbox",
		"👤 peop people · links",
		"📍 trak trackers · links",
		"📚 coll collections · links",
		"📂 catg category · link",
		"🏷️ ever related · links",
		"📍 actv related · links",
		"🏢 comp related · links",
		"🔅 tday related · links",
	]);
	const linked = properties.filter((entry) => entry.source);
	assert.deepEqual(linked.map((entry) => entry.excludedFolders), linked.map(() => ["templates"]));
});

test("the first enabled entry for a property decides its type", () => {
	const properties = [
		entry("a", "status", "links", false),
		entry("b", "status", "text"),
		entry("c", "status", "links"),
		entry("d", "done", "checkbox"),
	];
	assert.equal(decidedPropertyType(properties, "status"), "text");
	assert.equal(decidedPropertyType(properties, "done"), "checkbox");
	assert.equal(decidedPropertyType(properties, "missing"), undefined);
	assert.equal(decidedPropertyType([entry("a", "off", "date", false)], "off"), undefined);
});

test("properties whose entries disagree on type are found, and shared ones that agree are not", () => {
	const properties = [
		entry("a", "status", "text"),
		entry("b", "related", "links"),
		entry("c", "status", "links", false),
		entry("d", "related", "links"),
		entry("e", "due", "date"),
		entry("f", "due", "datetime"),
	];
	assert.deepEqual(mixedTypeProperties(properties), ["status", "due"]);
	assert.deepEqual(mixedTypeProperties(defaultSettings().setProperties.properties), []);
});
