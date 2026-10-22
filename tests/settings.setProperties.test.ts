import { test } from "node:test";
import { strict as assert } from "node:assert";
import { defaultSettings } from "../src/settings.ts";
import {
	FLAGS_PREFIX_KEY,
	TEMPLATES_FOLDER_KEY,
	flagKey,
	linkListKey,
	listKey,
	readControl,
	writeControl,
} from "../src/settings/controlKeys.ts";
import {
	LINK_LIST_MODE_OPTIONS,
	checkboxSuggestions,
	linkListName,
	newLinkList,
} from "../src/settings/setPropertiesForm.ts";

test("a link list row is named by its prefix, name, the property it writes to and its mode", () => {
	const [people, , , category] = defaultSettings().setProperties.linkLists;
	assert.equal(linkListName(people), "👤 peop | People → people · multi");
	assert.equal(linkListName(category), "📂 catg | Category → category · single");
	assert.equal(linkListName({ ...people, name: "", property: "" }), "👤 peop | Links to Person 👤 → no property · multi");
});

test("a new link list is disabled, unnamed, writes nowhere and takes the next link list id", () => {
	const { linkLists } = defaultSettings().setProperties;
	const list = newLinkList(linkLists);
	assert.equal(list.id, "list-9");
	assert.equal(list.enabled, false);
	assert.deepEqual([list.prefix, list.name, list.property, list.mode], ["", "", "", "multi"]);
	assert.equal(list.source.kind, "frontmatter");
});

test("the mode dropdown offers multi and single", () => {
	assert.deepEqual(LINK_LIST_MODE_OPTIONS, { multi: "Multi", single: "Single" });
});

test("flags suggest only checkbox properties", () => {
	const suggestions = checkboxSuggestions([
		{ name: "archived", type: "checkbox" },
		{ name: "status", type: "text" },
		{ name: "evergreen", type: "checkbox" },
	]);
	assert.deepEqual(suggestions.map((suggestion) => suggestion.name), ["archived", "evergreen"]);
});

test("the flags prefix and templates folder read and write their own fields", () => {
	const settings = defaultSettings();
	assert.equal(readControl(settings, FLAGS_PREFIX_KEY), "🎛️ meta |");
	assert.equal(readControl(settings, TEMPLATES_FOLDER_KEY), "templates");
	assert.equal(writeControl(settings, FLAGS_PREFIX_KEY, "🚩 flag"), true);
	assert.equal(writeControl(settings, TEMPLATES_FOLDER_KEY, " meta/templates "), true);
	assert.equal(settings.setProperties.flagsPrefix, "🚩 flag");
	assert.equal(settings.setProperties.templatesFolder, "meta/templates");
	assert.equal(writeControl(settings, "setProperties/flags", "x"), false);
});

test("a flag key reads and writes the flag at its position and ignores positions outside the list", () => {
	const settings = defaultSettings();
	assert.equal(readControl(settings, flagKey(1)), "someday");
	assert.equal(writeControl(settings, flagKey(1), " later "), true);
	assert.deepEqual(settings.setProperties.flags, ["active", "later", "evergreen", "blocked", "archived"]);
	assert.equal(writeControl(settings, flagKey(5), "extra"), false);
	assert.equal(writeControl(settings, "flag/x/name", "extra"), false);
	assert.equal(settings.setProperties.flags.length, 5);
});

test("link list keys edit the link list, never the jump list with the same id", () => {
	const settings = defaultSettings();
	const jumpList = JSON.parse(JSON.stringify(settings.lists[0]));
	const category = settings.setProperties.linkLists[3];
	assert.equal(category.id, "list-4");
	assert.equal(readControl(settings, linkListKey("list-4", "name")), "Category");
	assert.equal(readControl(settings, linkListKey("list-4", "writesTo")), "category");
	assert.equal(readControl(settings, linkListKey("list-4", "mode")), "single");
	assert.equal(readControl(settings, linkListKey("list-4", "source")), "inFolder");
	assert.equal(readControl(settings, linkListKey("list-4", "folder")), "categories");

	writeControl(settings, linkListKey("list-1", "name"), "Folks");
	writeControl(settings, linkListKey("list-1", "writesTo"), " folks ");
	writeControl(settings, linkListKey("list-1", "mode"), "single");
	writeControl(settings, linkListKey("list-1", "prefix"), "🧑 folk");
	writeControl(settings, linkListKey("list-1", "enabled"), false);
	const people = settings.setProperties.linkLists[0];
	assert.deepEqual([people.name, people.property, people.mode, people.prefix, people.enabled], ["Folks", "folks", "single", "🧑 folk", false]);
	assert.deepEqual(settings.lists[0], jumpList);
	assert.equal(readControl(settings, listKey("list-1", "prefix")), jumpList.prefix);
});

test("a link list keeps its mode when given an unknown one, and its source fields follow the source", () => {
	const settings = defaultSettings();
	writeControl(settings, linkListKey("list-2", "mode"), "many");
	assert.equal(settings.setProperties.linkLists[1].mode, "multi");
	writeControl(settings, linkListKey("list-2", "source"), "frontmatter");
	writeControl(settings, linkListKey("list-2", "property"), "tracker");
	writeControl(settings, linkListKey("list-2", "operator"), "is true");
	assert.deepEqual(settings.setProperties.linkLists[1].source, {
		kind: "frontmatter",
		property: "tracker",
		condition: { operator: "is true" },
	});
	assert.equal(settings.setProperties.linkLists[1].property, "trackers");
	assert.equal(writeControl(settings, linkListKey("list-99", "name"), "x"), false);
});
