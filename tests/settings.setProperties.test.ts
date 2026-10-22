import { test } from "node:test";
import { strict as assert } from "node:assert";
import { PROPERTY_TYPES } from "../src/lists/conditions.ts";
import type { Frontmatter, JumpListVault } from "../src/lists/vault.ts";
import { EDITABLE_PROPERTY_TYPES, defaultSettings, mergeSettings } from "../src/settings.ts";
import type { EditableProperty } from "../src/settings.ts";
import { propertyKey, propertySourceKey, readControl, writeControl } from "../src/settings/controlKeys.ts";
import { propertySuggestions } from "../src/settings/listForm.ts";
import {
	PROPERTY_TYPE_OPTIONS,
	mixedTypeWarning,
	newProperty,
	propertyRowName,
	propertyTypePreset,
} from "../src/settings/setPropertiesForm.ts";
import { moment } from "./moment.ts";

function fakeVault(frontmatter: Record<string, Frontmatter>, propertyTypes: Record<string, string>): JumpListVault {
	return {
		notes: () => Object.keys(frontmatter).map((path) => ({ path, basename: path.replace(/\.md$/, ""), ctime: 0 })),
		frontmatter: (path) => frontmatter[path],
		updateFrontmatter: async () => {},
		linksFrom: () => [],
		linksTo: () => [],
		mtime: () => 0,
		periodicNotesSettings: () => undefined,
		dailyNotesOptions: () => undefined,
		propertyTypes: () => propertyTypes,
		propertyValueCounts: () => [],
		now: () => 0,
		moment,
	};
}

const entry = (fields: Partial<EditableProperty>): EditableProperty => ({
	id: "list-1",
	enabled: true,
	prefix: "",
	property: "",
	type: "checkbox",
	...fields,
});

test("picking a known property presets the type from its vault type", () => {
	const vault = fakeVault(
		{ "a.md": { notes: "x", rating: 3 } },
		{
			done: "checkbox",
			rating: "number",
			due: "date",
			meeting: "datetime",
			people: "multitext",
			tags: "tags",
			status: "text",
			aliases: "aliases",
		},
	);
	const presets = propertySuggestions(vault).map((suggestion) => `${suggestion.name} ${propertyTypePreset(suggestion.type)}`);
	assert.deepEqual(presets, [
		"aliases text",
		"done checkbox",
		"due date",
		"meeting datetime",
		"notes text",
		"people links",
		"rating number",
		"status text",
		"tags links",
	]);
	for (const type of PROPERTY_TYPES) assert.ok(EDITABLE_PROPERTY_TYPES.includes(propertyTypePreset(type)));
});

test("a property row is named by its prefix, property and type, or New property while the property is blank", () => {
	assert.equal(propertyRowName(entry({ prefix: "👤 peop |", property: "people", type: "links" })), "👤 peop | people · links");
	assert.equal(propertyRowName(entry({ property: "active" })), "active · checkbox");
	assert.equal(propertyRowName(entry({ prefix: "🎛️ meta |", property: " ", type: "date" })), "New property");
});

test("adding a property appends a disabled checkbox entry with the next id", () => {
	const { properties } = defaultSettings().setProperties;
	assert.deepEqual(newProperty(properties), {
		id: "list-14",
		enabled: false,
		prefix: "",
		property: "",
		type: "checkbox",
	});
	assert.deepEqual(newProperty([]).id, "list-1");
});

test("entries that write one property with different types carry a warning, and agreeing ones do not", () => {
	const properties = [
		entry({ id: "a", property: "status", type: "text" }),
		entry({ id: "b", property: "status", type: "links", enabled: false }),
		entry({ id: "c", property: "related", type: "links" }),
		entry({ id: "d", property: "related", type: "links" }),
		entry({ id: "e", property: "", type: "text" }),
		entry({ id: "f", property: "", type: "date" }),
	];
	const warnings = properties.map((property) => mixedTypeWarning(property, properties));
	assert.match(warnings[0] ?? "", /status as a different type/);
	assert.match(warnings[1] ?? "", /status as a different type/);
	assert.deepEqual(warnings.slice(2), [undefined, undefined, undefined, undefined]);
});

test("the type dropdown offers every editable type", () => {
	assert.deepEqual(Object.keys(PROPERTY_TYPE_OPTIONS), EDITABLE_PROPERTY_TYPES);
});

test("property keys read and write the entry's fields and ignore unknown ids", () => {
	const settings = defaultSettings();
	assert.equal(readControl(settings, propertyKey("list-9", "name")), "active");
	assert.equal(readControl(settings, propertyKey("list-9", "type")), "checkbox");
	assert.equal(writeControl(settings, propertyKey("list-9", "name"), " pinned "), true);
	assert.equal(writeControl(settings, propertyKey("list-9", "prefix"), "📌"), true);
	assert.equal(writeControl(settings, propertyKey("list-9", "enabled"), false), true);
	assert.equal(writeControl(settings, propertyKey("list-9", "type"), "nonsense"), true);
	assert.deepEqual(settings.setProperties.properties[0], {
		id: "list-9",
		enabled: false,
		prefix: "📌",
		property: "pinned",
		type: "checkbox",
	});
	assert.equal(writeControl(settings, propertyKey("list-99", "name"), "x"), false);
	assert.equal(readControl(settings, propertyKey("list-99", "name")), undefined);
});

test("property keys never touch the jump list with the same id", () => {
	const settings = defaultSettings();
	const jumpLists = JSON.stringify(settings.lists);
	writeControl(settings, propertyKey("list-1", "prefix"), "x");
	writeControl(settings, propertySourceKey("list-1", "source"), "inFolder");
	assert.equal(JSON.stringify(settings.lists), jumpLists);
});

test("a link type gets a source and an excluded folder, and other types drop them", () => {
	const settings = defaultSettings();
	const key = (field: Parameters<typeof propertyKey>[1]) => propertyKey("list-9", field);
	writeControl(settings, key("type"), "links");
	assert.deepEqual(settings.setProperties.properties[0].source, { kind: "modifiedToday" });
	assert.equal(settings.setProperties.properties[0].excludedFolder, "");
	writeControl(settings, key("excludedFolder"), " templates ");
	assert.equal(readControl(settings, key("excludedFolder")), "templates");
	writeControl(settings, key("type"), "text");
	assert.deepEqual(settings.setProperties.properties[0], {
		id: "list-9",
		enabled: true,
		prefix: "🎛️ meta |",
		property: "active",
		type: "text",
	});
	assert.equal(readControl(settings, propertySourceKey("list-9", "source")), undefined);
	assert.equal(writeControl(settings, propertySourceKey("list-9", "source"), "linksOut"), false);
	assert.equal(settings.setProperties.properties[0].source, undefined);
});

test("source keys edit a link property's source with the jump list's form", () => {
	const settings = defaultSettings();
	const key = (field: Parameters<typeof propertySourceKey>[1]) => propertySourceKey("list-4", field);
	assert.equal(readControl(settings, key("source")), "inFolder");
	assert.equal(readControl(settings, key("folder")), "categories");
	writeControl(settings, key("source"), "frontmatter");
	writeControl(settings, key("property"), "tracker");
	writeControl(settings, key("operator"), "is true");
	assert.deepEqual(settings.setProperties.properties[8].source, {
		kind: "frontmatter",
		property: "tracker",
		condition: { operator: "is true" },
	});
	assert.deepEqual(mergeSettings(JSON.parse(JSON.stringify(settings))).setProperties, settings.setProperties);
});
