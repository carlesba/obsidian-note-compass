import { test } from "node:test";
import { strict as assert } from "node:assert";
import { PROPERTY_TYPES } from "../src/lists/conditions.ts";
import type { Frontmatter, JumpListVault } from "../src/lists/vault.ts";
import { EDITABLE_PROPERTY_TYPES, defaultSettings, mergeSettings } from "../src/settings.ts";
import type { EditableProperty } from "../src/settings.ts";
import { excludedFolderKey, propertyKey, propertySourceKey, readControl, writeControl } from "../src/settings/controlKeys.ts";
import { propertySuggestions } from "../src/settings/listForm.ts";
import {
	PROPERTY_TYPE_OPTIONS,
	addExcludedFolder,
	addPresetValue,
	deleteExcludedFolder,
	deletePresetValue,
	mixedTypeWarning,
	movePresetValue,
	newProperty,
	propertyLabel,
	propertyRowName,
	presetValueError,
	propertyTypePreset,
	readPropertyField,
	writePropertyField,
} from "../src/settings/setPropertiesForm.ts";
import { moment } from "./moment.ts";

function fakeVault(frontmatter: Record<string, Frontmatter>, propertyTypes: Record<string, string>): JumpListVault {
	return {
		notes: () => Object.keys(frontmatter).map((path) => ({ path, basename: path.replace(/\.md$/, ""), ctime: 0 })),
		frontmatter: (path) => frontmatter[path],
		tags: () => [],
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
	assert.equal(propertyRowName(entry({ prefix: "👤 peop", property: "people", type: "links" })), "👤 peop people · links");
	assert.equal(propertyRowName(entry({ property: "active" })), "active · checkbox");
	assert.equal(propertyRowName(entry({ prefix: "🎛️ meta", property: " ", type: "date" })), "New property");
});

test("a property row's label leaves the prefix to its chip", () => {
	assert.equal(propertyLabel(entry({ prefix: "👤 peop", property: "people", type: "links" })), "people · links");
	assert.equal(propertyLabel(entry({ prefix: "🎛️ meta", property: "active" })), "active · checkbox");
	assert.equal(propertyLabel(entry({ prefix: "🎛️ meta", property: " ", type: "date" })), "New property");
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

test("a property's prefix colour key reads blank until set and keeps only valid hex", () => {
	const settings = defaultSettings();
	const key = propertyKey("list-9", "prefixColor");
	assert.equal(readControl(settings, key), "");
	assert.equal(writeControl(settings, key, "#33aa66"), true);
	assert.equal(settings.setProperties.properties[0].prefixColor, "#33aa66");
	assert.equal(readControl(settings, key), "#33aa66");
	writeControl(settings, key, "nope");
	assert.equal("prefixColor" in settings.setProperties.properties[0], false);
	assert.equal(settings.lists.some((list) => "prefixColor" in list), false);
});

test("property keys never touch the jump list with the same id", () => {
	const settings = defaultSettings();
	const jumpLists = JSON.stringify(settings.lists);
	writeControl(settings, propertyKey("list-1", "prefix"), "x");
	writeControl(settings, propertySourceKey("list-1", "source"), "inFolder");
	assert.equal(JSON.stringify(settings.lists), jumpLists);
});

test("a link type gets a source, excluded folders and new note options, and other types drop them", () => {
	const settings = defaultSettings();
	const key = (field: Parameters<typeof propertyKey>[1]) => propertyKey("list-9", field);
	writeControl(settings, key("type"), "links");
	const [property] = settings.setProperties.properties;
	assert.deepEqual(property.source, { kind: "modifiedToday" });
	assert.deepEqual(property.excludedFolders, []);
	assert.equal(readControl(settings, key("createsNotes")), false);
	assert.equal(writeControl(settings, key("createsNotes"), true), true);
	assert.equal(readControl(settings, key("createsNotes")), true);
	addExcludedFolder(property);
	writeControl(settings, excludedFolderKey("list-9", 0), " templates ");
	assert.equal(readControl(settings, excludedFolderKey("list-9", 0)), "templates");
	writeControl(settings, key("newNoteFolder"), " people ");
	writeControl(settings, key("newNoteTemplate"), "templates/Person.md");
	assert.equal(readControl(settings, key("newNoteFolder")), "people");
	assert.equal(readControl(settings, key("newNoteTemplate")), "templates/Person.md");
	assert.deepEqual(mergeSettings(JSON.parse(JSON.stringify(settings))).setProperties, settings.setProperties);
	writeControl(settings, key("type"), "text");
	assert.deepEqual(settings.setProperties.properties[0], {
		id: "list-9",
		enabled: true,
		prefix: "🎛️ meta",
		property: "active",
		type: "text",
	});
	assert.equal(writeControl(settings, excludedFolderKey("list-9", 0), "x"), false);
	assert.equal(readControl(settings, propertySourceKey("list-9", "source")), undefined);
	assert.equal(writeControl(settings, propertySourceKey("list-9", "source"), "linksOut"), false);
	assert.equal(settings.setProperties.properties[0].source, undefined);
});

test("source keys edit a link property's source with the jump list's form", () => {
	const settings = defaultSettings();
	const key = (field: Parameters<typeof propertySourceKey>[1]) => propertySourceKey("list-4", field);
	assert.equal(readControl(settings, key("source")), "inFolder");
	assert.equal(readControl(settings, key("folder")), "categories");
	writeControl(settings, key("source"), "filter");
	assert.deepEqual(settings.setProperties.properties[8].source, { kind: "filter", filter: { kind: "group", mode: "all", items: [] } });
	assert.deepEqual(mergeSettings(JSON.parse(JSON.stringify(settings))).setProperties, settings.setProperties);
});

test("a stored new note folder or template that is not text is left out", () => {
	const stored = {
		setProperties: {
			properties: [
				{ id: "a", enabled: true, prefix: "", property: "people", type: "links", source: { kind: "modifiedToday" }, newNoteFolder: 3, newNoteTemplate: "t.md" },
			],
		},
	};
	const [property] = mergeSettings(stored).setProperties.properties;
	assert.equal(property.newNoteFolder, undefined);
	assert.equal(property.newNoteTemplate, "t.md");
});

test("excluded folder rows are added empty, edited by index and deleted", () => {
	const settings = defaultSettings();
	const property = settings.setProperties.properties[5];
	const key = (index: number) => excludedFolderKey(property.id, index);
	assert.equal(key(1), `property/${property.id}/excludedFolders/1`);
	addExcludedFolder(property);
	assert.deepEqual(property.excludedFolders, ["templates", ""]);
	assert.equal(readControl(settings, key(1)), "");
	assert.equal(writeControl(settings, key(1), " archive/ "), true);
	assert.equal(writeControl(settings, key(2), "nope"), false);
	assert.equal(writeControl(settings, propertyKey(property.id, "excludedFolders"), "nope"), false);
	assert.equal(readControl(settings, key(2)), undefined);
	assert.deepEqual(property.excludedFolders, ["templates", "archive/"]);
	deleteExcludedFolder(property, 0);
	assert.deepEqual(property.excludedFolders, ["archive/"]);
	addExcludedFolder(property);
	assert.deepEqual(mergeSettings(JSON.parse(JSON.stringify(settings))).setProperties.properties[5].excludedFolders, ["archive/"]);
});

test("stored excluded folders are cleaned and an old single folder becomes a list", () => {
	const link = (fields: Record<string, unknown>) => ({
		id: "a",
		enabled: true,
		prefix: "",
		property: "people",
		type: "links",
		source: { kind: "modifiedToday" },
		...fields,
	});
	const excluded = (fields: Record<string, unknown>) =>
		mergeSettings({ setProperties: { properties: [link(fields)] } }).setProperties.properties[0].excludedFolders;
	assert.deepEqual(excluded({ excludedFolders: [" templates ", "", 3, "  ", "archive"] }), ["templates", "archive"]);
	assert.deepEqual(excluded({ excludedFolders: ["kept"], excludedFolder: "ignored" }), ["kept"]);
	assert.deepEqual(excluded({ excludedFolder: " templates " }), ["templates"]);
	assert.deepEqual(excluded({ excludedFolder: "" }), []);
	assert.deepEqual(excluded({ excludedFolder: 4 }), []);
	assert.deepEqual(excluded({}), []);
});

test("stored link properties without the create notes switch get it on only when they set a folder or template", () => {
	const creates = (fields: Record<string, unknown>) =>
		mergeSettings({
			setProperties: {
				properties: [{ id: "a", enabled: true, prefix: "", property: "people", type: "links", source: { kind: "modifiedToday" }, ...fields }],
			},
		}).setProperties.properties[0].createsNotes;
	assert.equal(creates({}), false);
	assert.equal(creates({ newNoteFolder: " ", newNoteTemplate: "" }), false);
	assert.equal(creates({ newNoteFolder: "people" }), true);
	assert.equal(creates({ newNoteTemplate: "t.md" }), true);
	assert.equal(creates({ newNoteFolder: "people", createsNotes: false }), false);
	assert.equal(creates({ createsNotes: true }), true);
	assert.equal(creates({ createsNotes: "yes" }), false);
});

test("preset values are kept trimmed and without blanks or repeats, and the form adds, edits, moves and removes them", () => {
	const settings = mergeSettings({
		setProperties: { properties: [{ id: "p", enabled: true, prefix: "", property: "status", type: "text", presetValues: [" todo ", "", "done", "todo", 3] }] },
	});
	const [status] = settings.setProperties.properties;
	assert.deepEqual(status.presetValues, ["todo", "done"]);
	addPresetValue(status);
	assert.equal(writePropertyField(status, "presetValues", " blocked ", "2"), true);
	movePresetValue(status, 2, 0);
	assert.deepEqual(status.presetValues, ["blocked", "todo", "done"]);
	deletePresetValue(status, 1);
	assert.equal(readPropertyField(status, "presetValues", "1"), "done");
	assert.equal(presetValueError(status, "anything"), undefined);
	assert.equal(presetValueError({ ...status, type: "number" }, "many"), "Write a number, such as 3 or 2.5.");
	assert.equal(presetValueError({ ...status, type: "number" }, "2.5"), undefined);
});

test("checkbox mode, preset values in the main picker and keeping empty values are read, written and stored only when they differ from the default", () => {
	const settings = mergeSettings({
		setProperties: {
			properties: [
				{ id: "a", enabled: true, prefix: "", property: "done", type: "checkbox", checkboxMode: "cycle", keepsEmpty: true },
				{ id: "b", enabled: true, prefix: "", property: "status", type: "text", presetValues: ["todo", "done"], presetsInMainMenu: true, checkboxMode: "bogus" },
			],
		},
	});
	const [done, status] = settings.setProperties.properties;
	assert.equal(readPropertyField(done, "checkboxMode"), "cycle");
	assert.equal(readPropertyField(done, "removesEmpty"), false);
	assert.equal(readPropertyField(status, "checkboxMode"), "picker");
	assert.equal(readPropertyField(status, "removesEmpty"), true);
	assert.deepEqual(status.mainMenuPresets, ["todo", "done"]);
	assert.equal(readPropertyField(status, "mainMenuPreset", "1"), true);
	writePropertyField(done, "checkboxMode", "picker");
	writePropertyField(done, "removesEmpty", true);
	writePropertyField(status, "mainMenuPreset", false, "0");
	writePropertyField(status, "mainMenuPreset", false, "1");
	assert.deepEqual([done.checkboxMode, done.keepsEmpty, status.mainMenuPresets], [undefined, undefined, undefined]);
	writePropertyField(done, "checkboxMode", "toggle");
	writePropertyField(done, "removesEmpty", false);
	assert.deepEqual([done.checkboxMode, done.keepsEmpty], ["toggle", true]);
});

test("each preset value has its own main menu switch, which follows the value when it is edited, moved or deleted", () => {
	const settings = mergeSettings({
		setProperties: {
			properties: [
				{ id: "p", enabled: true, prefix: "", property: "status", type: "text", presetValues: ["todo", "doing", "done"], mainMenuPresets: ["done", "ghost", "todo"] },
			],
		},
	});
	const [status] = settings.setProperties.properties;
	assert.deepEqual(status.mainMenuPresets, ["todo", "done"]);
	assert.deepEqual([0, 1, 2].map((index) => readPropertyField(status, "mainMenuPreset", String(index))), [true, false, true]);
	writePropertyField(status, "mainMenuPreset", true, "1");
	assert.deepEqual(status.mainMenuPresets, ["todo", "doing", "done"]);
	writePropertyField(status, "presetValues", "finished", "2");
	assert.deepEqual(status.mainMenuPresets, ["todo", "doing", "finished"]);
	movePresetValue(status, 2, 0);
	assert.deepEqual(status.mainMenuPresets, ["finished", "todo", "doing"]);
	deletePresetValue(status, 1);
	assert.deepEqual(status.presetValues, ["finished", "doing"]);
	assert.deepEqual(status.mainMenuPresets, ["finished", "doing"]);
	writePropertyField(status, "mainMenuPreset", false, "0");
	assert.deepEqual(status.mainMenuPresets, ["doing"]);
});
