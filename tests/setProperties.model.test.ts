import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { EDITABLE_PROPERTY_TYPES, defaultSettings, mergeSettings } from "../src/settings.ts";
import type { EditableProperty } from "../src/settings.ts";
import { applyLegacyView, editLegacyView, legacyView } from "../src/setProperties/legacyView.ts";
import { decidedPropertyType, mixedTypeProperties } from "../src/setProperties/propertyTypes.ts";

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
	assert.deepEqual(merged.lists, data.lists);
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
		data.setProperties.linkLists.slice(4).map((list: { source: unknown }) => list.source),
	);
	assert.ok(merged.setProperties.properties.every((property) => property.enabled));
	assert.ok(related.every((property) => property.excludedFolder === "templates"));
	assert.equal(merged.setProperties.properties[0].prefix, "🎛️ meta |");
	assert.deepEqual(mergeSettings(JSON.parse(JSON.stringify(merged))), merged);
});

test("the defaults are the old defaults in the new shape", () => {
	const { setProperties } = defaultSettings();
	const view = legacyView(setProperties);
	assert.equal(view.flagsPrefix, "🎛️ meta |");
	assert.deepEqual(view.flags, ["active", "someday", "evergreen", "blocked", "archived"]);
	assert.equal(view.templatesFolder, "templates");
	assert.deepEqual(
		view.linkLists.map((list) => `${list.prefix} ${list.property} ${list.mode}`),
		[
			"👤 peop | people multi",
			"📍 trak | trackers multi",
			"📚 coll | collections multi",
			"📂 catg | category single",
			"🏷️ ever | related multi",
			"📍 actv | related multi",
			"🏢 comp | related multi",
			"🔅 tday | related multi",
		],
	);
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

test("the legacy view writes back without losing ids, enabled flags or other types", () => {
	const settings = defaultSettings().setProperties;
	settings.properties[1].enabled = false;
	settings.properties.push(entry("list-20", "summary", "text"));
	const before = JSON.parse(JSON.stringify(settings));
	applyLegacyView(settings, legacyView(settings));
	assert.deepEqual(settings, before);
});

test("legacy edits reach the properties, and a flag never takes a link list's id", () => {
	const settings = defaultSettings().setProperties;
	editLegacyView(settings, (view) => {
		view.flagsPrefix = "⚑";
		view.templatesFolder = "_t";
		view.flags.splice(0, 1);
		view.linkLists.push({ ...view.linkLists[0], id: "list-9", property: "owner", mode: "single" });
	});
	const flags = settings.properties.filter((property) => property.type === "checkbox");
	assert.deepEqual(
		flags.map((flag) => [flag.id, flag.prefix, flag.property]),
		[
			["list-10", "⚑", "someday"],
			["list-11", "⚑", "evergreen"],
			["list-12", "⚑", "blocked"],
			["list-13", "⚑", "archived"],
		],
	);
	const owner = settings.properties.find((property) => property.property === "owner");
	assert.deepEqual([owner?.id, owner?.type, owner?.excludedFolder], ["list-9", "link", "_t"]);
	const ids = settings.properties.map((property) => property.id);
	assert.equal(new Set(ids).size, ids.length);
});
