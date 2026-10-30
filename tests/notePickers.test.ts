import { test } from "node:test";
import { strict as assert } from "node:assert";
import { notePickerChoices } from "../src/lists/notePickers.ts";
import {
	allLists,
	defaultSettings,
	duplicateNotePicker,
	isRunnableNotePicker,
	mergeSettings,
	newNotePicker,
	notePickerName,
	storedSettings,
} from "../src/settings.ts";
import { listKey, notePickerKey, readControl, writeControl } from "../src/settings/controlKeys.ts";
import { prefixRows } from "../src/settings/prefixLinks.ts";

const linksIn = { kind: "linksIn" };
const linksOut = { kind: "linksOut" };

test("saved lists from before navigation pickers become one Default picker with the same lists", () => {
	const lists = [{ id: "list-4", enabled: true, prefix: "🔗", source: linksIn }];
	const [picker, ...others] = mergeSettings({ lists }).notePickers;
	assert.deepEqual(others, []);
	assert.deepEqual(picker, { id: "1", enabled: true, name: "Default", filter: { kind: "group", mode: "all", items: [] }, lists });
	const stored = storedSettings(mergeSettings({ lists })) as Record<string, unknown>;
	assert.equal("lists" in stored, false);
	assert.deepEqual(mergeSettings(JSON.parse(JSON.stringify(stored))).notePickers, [picker]);
});

test("several navigation pickers keep their order, names and lists, and a list id repeated across pickers gets a fresh one", () => {
	const { notePickers } = mergeSettings({
		notePickers: [
			{ id: "2", enabled: true, name: "Daily", lists: [{ id: "list-1", enabled: true, prefix: "a", source: linksIn }] },
			{ id: "5", enabled: false, name: "Projects", lists: [{ id: "list-1", enabled: true, prefix: "b", source: linksOut }, { id: "list-3", enabled: true, prefix: "c", source: linksOut }] },
		],
	});
	assert.deepEqual(notePickers.map((picker) => [picker.id, picker.name, picker.enabled]), [["2", "Daily", true], ["5", "Projects", false]]);
	assert.deepEqual(allLists({ notePickers }).map((list) => [list.id, list.prefix]), [["list-1", "a"], ["list-4", "b"], ["list-3", "c"]]);
	assert.deepEqual(notePickers.map(isRunnableNotePicker), [true, false]);
});

test("a note picker that can't be read is kept switched off and saved back exactly as it was", () => {
	const broken = { id: "3", name: "Old", lists: "nope" };
	const settings = mergeSettings({ notePickers: [broken, 7] });
	const [first, second] = settings.notePickers;
	assert.deepEqual([first.enabled, first.unreadable?.stored, first.name], [false, broken, "Old"]);
	assert.equal(isRunnableNotePicker(second), false);
	assert.deepEqual((storedSettings(settings) as { notePickers: unknown[] }).notePickers, [broken, 7]);
	assert.equal(writeControl(settings, notePickerKey("3", "enabled"), true), false);
});

test("a new note picker starts empty and untitled, and duplicating one copies its lists with fresh ids", () => {
	const settings = defaultSettings();
	const [related] = settings.notePickers;
	const added = newNotePicker(settings.notePickers);
	assert.deepEqual(added, { id: "2", enabled: true, name: "", filter: { kind: "group", mode: "all", items: [] }, lists: [] });
	assert.equal(notePickerName(added), "Untitled navigation picker");
	const copy = duplicateNotePicker(settings.notePickers, related, "Default copy");
	assert.ok(copy);
	assert.equal(settings.notePickers[1], copy);
	assert.equal(copy.name, "Default copy");
	assert.deepEqual(copy.lists.map((list) => list.prefix), related.lists.map((list) => list.prefix));
	assert.equal(new Set(allLists(settings).map((list) => list.id)).size, allLists(settings).length);
	copy.lists[0].prefix = "changed";
	assert.notEqual(related.lists[0].prefix, "changed");
});

test("note picker names, switches and the lists inside any picker are edited through control keys", () => {
	const settings = defaultSettings();
	const copy = duplicateNotePicker(settings.notePickers, settings.notePickers[0], "Copy");
	assert.ok(copy);
	assert.equal(writeControl(settings, notePickerKey(copy.id, "name"), "Projects"), true);
	assert.equal(writeControl(settings, notePickerKey(copy.id, "enabled"), false), true);
	assert.deepEqual([readControl(settings, notePickerKey(copy.id, "name")), copy.enabled], ["Projects", false]);
	assert.equal(writeControl(settings, listKey(copy.lists[1].id, "prefix"), "➡️"), true);
	assert.equal(copy.lists[1].prefix, "➡️");
	assert.notEqual(settings.notePickers[0].lists[1].prefix, "➡️");
	assert.ok(prefixRows(settings).some((row) => row.key === listKey(copy.lists[1].id, "prefix") && row.prefix === "➡️"));
});

test("Select navigation picker offers every picker by name and filters them by the typed text", () => {
	const settings = mergeSettings({
		notePickers: [
			{ id: "1", enabled: true, name: "Daily", lists: [] },
			{ id: "2", enabled: true, name: "", lists: [] },
		],
	});
	assert.deepEqual(notePickerChoices(settings.notePickers, "").map((choice) => choice.label), ["Daily", "Untitled navigation picker"]);
	assert.deepEqual(notePickerChoices(settings.notePickers, "dly").map((choice) => choice.label), ["Daily"]);
});
