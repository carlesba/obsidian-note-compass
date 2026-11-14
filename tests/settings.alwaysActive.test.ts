import { test } from "node:test";
import { strict as assert } from "node:assert";
import { isRunnableNotePicker, mergeSettings, storedSettings } from "../src/settings.ts";
import { isRunnableTaskCommand } from "../src/tasks/taskCommand.ts";
import { buildJumpList, notesFromLists } from "../src/lists/jumpList.ts";
import { mentionPicker } from "../src/mentions/settings.ts";
import { offeredProperties } from "../src/setProperties/offered.ts";
import { multiRows } from "../src/setProperties/multiValues.ts";
import { decidedPropertyType } from "../src/setProperties/propertyTypes.ts";
import { NOW, fakeVault } from "./fakeVault.ts";

for (const legacy of [{ enabled: false }, {}]) {
	test(`entries stay active with legacy activation ${JSON.stringify(legacy)}`, () => {
		const settings = mergeSettings({
			notePickers: [{ id: "7", ...legacy, name: "Work", placeholder: "Find", lists: [
				{ id: "list-8", ...legacy, prefix: "out", source: { kind: "linksOut" } },
			] }],
			forms: [{ id: "4", ...legacy, name: "Log", namePattern: "Daily", fields: [] }],
			setProperties: { properties: [
				{ id: "p1", ...legacy, prefix: "", property: "status", type: "text" },
				{ id: "p2", property: "status", type: "number" },
				{ id: "p3", ...legacy, property: "", type: "checkbox", mode: "multiple", fixedValues: [{ id: "v1", property: "done", type: "checkbox", value: true }] },
			] },
			taskCommands: [{ id: "9", ...legacy, name: "Finish", sources: [
				{ id: "2", ...legacy, prefix: "", source: { kind: "linksOut" } },
			], actions: [{ id: "1", kind: "status", status: "x" }] }],
		});
		const picker = settings.notePickers[0];
		const command = settings.taskCommands[0];
		const vault = fakeVault([{ path: "current.md", links: ["other.md"] }, { path: "other.md" }]);
		assert.equal(isRunnableNotePicker(picker), true);
		assert.equal(mentionPicker({ enabled: true, trigger: "@", pickerId: "7" }, settings.notePickers), picker);
		assert.deepEqual(buildJumpList(picker.lists, vault, vault.note("current.md")).map((item) => item.file.path), ["other.md"]);
		assert.equal(settings.forms[0].unreadable, undefined);
		assert.equal(settings.forms[0].namePattern, "Daily");
		assert.equal(isRunnableTaskCommand(command), true);
		assert.deepEqual(notesFromLists(command.sources, vault, vault.note("current.md"), settings.dateNotes).map((note) => note.path), ["other.md"]);
		assert.deepEqual(offeredProperties(settings.setProperties).map((entry) => entry.id), ["p1", "p2"]);
		assert.equal(decidedPropertyType(settings.setProperties.properties, "status"), "text");
		assert.deepEqual(multiRows(settings.setProperties, NOW).map((row) => row.values), [[{ property: "done", type: "checkbox", value: true }]]);
		const entries = [picker, ...picker.lists, ...settings.forms, ...settings.setProperties.properties, command, ...command.sources];
		for (const entry of entries) assert.equal("enabled" in entry, false);
		for (const entry of entries) Object.assign(entry, { enabled: false });
		const saved = storedSettings(settings) as typeof settings;
		for (const entry of [saved.notePickers[0], ...saved.notePickers[0].lists, ...saved.forms, ...saved.setProperties.properties, saved.taskCommands[0], ...saved.taskCommands[0].sources]) {
			assert.equal("enabled" in entry, false);
		}
		const reloaded = mergeSettings(JSON.parse(JSON.stringify(saved)));
		assert.deepEqual(reloaded.notePickers, saved.notePickers);
		assert.deepEqual(reloaded.forms, saved.forms);
		assert.deepEqual(reloaded.setProperties, saved.setProperties);
		assert.deepEqual(reloaded.taskCommands, saved.taskCommands);
	});
}

test("unreadable entries and sources stay unavailable and preserve their raw data", () => {
	const source = { kind: "future", enabled: false, options: [1, 2] };
	const picker = { id: "1", enabled: false, lists: "future" };
	const form = { id: "1", enabled: false, fields: "future" };
	const command = { id: "1", enabled: false, actions: [{ kind: "future" }] };
	const settings = mergeSettings({
		notePickers: [picker, { id: "2", lists: [{ id: "list-1", enabled: false, source }] }],
		forms: [form],
		taskCommands: [command, { id: "2", actions: [], sources: [{ id: "1", enabled: false, source }] }],
		setProperties: { properties: [{ id: "p1", enabled: false, property: "related", type: "links", source }] },
	});
	assert.equal(isRunnableNotePicker(settings.notePickers[0]), false);
	assert.equal(isRunnableTaskCommand(settings.taskCommands[0]), false);
	assert.ok(settings.forms[0].unreadable);
	assert.deepEqual(offeredProperties(settings.setProperties), []);
	const vault = fakeVault([{ path: "current.md" }]);
	assert.deepEqual(buildJumpList(settings.notePickers[1].lists, vault, vault.note("current.md")), []);
	assert.deepEqual(notesFromLists(settings.taskCommands[1].sources, vault, vault.note("current.md"), settings.dateNotes), []);
	const saved = storedSettings(settings) as typeof settings;
	assert.deepEqual(saved.notePickers[0], picker);
	assert.deepEqual(saved.forms[0], form);
	assert.deepEqual(saved.taskCommands[0], command);
	assert.deepEqual(saved.notePickers[1].lists[0].source, source);
	assert.deepEqual(saved.taskCommands[1].sources[0].source, source);
	assert.deepEqual(saved.setProperties.properties[0].source, source);
});
