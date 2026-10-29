import { test } from "node:test";
import { strict as assert } from "node:assert";
import { defaultSettings, mergeSettings, storedSettings } from "../src/settings.ts";
import { readControl, taskActionKey, taskCommandKey, writeControl } from "../src/settings/controlKeys.ts";
import {
	addTaskAction,
	addStatus,
	availableStatuses,
	removeStatus,
	statusLabel,
	addTaskDestination,
	deleteTaskAction,
	destinationNoteWarning,
	destinationOptions,
	moveTaskDestination,
	primaryActionOptions,
	removeTaskDestination,
	taskActionWarning,
	taskCommandWarning,
} from "../src/settings/taskCommandsForm.ts";
import { isRunnableTaskCommand, newTaskCommand, noteDestination, periodicDestination, primaryAction, secondaryActions } from "../src/tasks/taskCommand.ts";
import type { CopyAction } from "../src/tasks/taskCommand.ts";

function settingsWithCommand() {
	const settings = defaultSettings();
	const command = newTaskCommand(settings.taskCommands);
	settings.taskCommands.push(command);
	return { settings, command };
}

test("settings saved before task commands load with none and unchanged otherwise", () => {
	const stored = JSON.parse(JSON.stringify(storedSettings(defaultSettings())));
	delete stored.taskCommands;
	const merged = mergeSettings(stored);
	assert.deepEqual(merged.taskCommands, []);
	assert.deepEqual(merged, defaultSettings());
});

test("a new task command processes open tasks in batch with the Bullet Journal actions", () => {
	const command = newTaskCommand([{ ...newTaskCommand([]), id: "3" }]);
	assert.equal(command.id, "4");
	assert.equal(command.name, "Process open tasks");
	assert.deepEqual([command.statuses, command.skippedStatuses, command.selectAll, command.batch, command.enabled], [" ", "", false, true, true]);
	assert.equal(isRunnableTaskCommand(command), true);
	const primary = primaryAction(command);
	assert.deepEqual(primary, { id: "1", label: "Complete", kind: "status", status: "x", completionDate: "off" });
	const [cancel, migrate, schedule] = secondaryActions(command) as [unknown, CopyAction, CopyAction];
	assert.deepEqual(cancel, { id: "2", label: "Cancel", kind: "status", status: "-", completionDate: "off" });
	assert.deepEqual([migrate.label, migrate.status, migrate.mentionSource], ["Migrate", ">", false]);
	assert.deepEqual(migrate.destinations, [
		{ kind: "periodic", period: "day", relation: "next" },
		{ kind: "periodic", period: "week", relation: "this" },
		{ kind: "periodic", period: "week", relation: "next" },
	]);
	assert.deepEqual([schedule.label, schedule.status, schedule.mentionSource], ["Schedule", "<", true]);
	assert.deepEqual(schedule.destinations, [
		{ kind: "periodic", period: "month", relation: "next" },
		{ kind: "periodic", period: "quarter", relation: "next" },
		{ kind: "periodic", period: "year", relation: "next" },
	]);
	assert.equal(taskCommandWarning(command), undefined);
});

test("task commands round-trip through storedSettings and mergeSettings", () => {
	const { settings } = settingsWithCommand();
	const reloaded = mergeSettings(JSON.parse(JSON.stringify(storedSettings(settings))));
	assert.deepEqual(reloaded.taskCommands, settings.taskCommands);
});

test("task commands that can't be read are kept as saved and switched off", () => {
	const unreadable = { id: "1", name: "Future", actions: [{ id: "1", kind: "teleport", status: "x" }] };
	const notARecord = "garbage";
	const settings = mergeSettings({ taskCommands: [unreadable, notARecord] });
	assert.equal(settings.taskCommands.length, 2);
	assert.deepEqual(settings.taskCommands[0].unreadable, { stored: unreadable });
	assert.equal(settings.taskCommands[0].enabled, false);
	assert.equal(isRunnableTaskCommand(settings.taskCommands[0]), false);
	assert.equal(taskCommandWarning(settings.taskCommands[0]), "This task command can't be read by this version of Note Compass. Remove it and build a new one.");
	const stored = storedSettings(settings) as { taskCommands: unknown[] };
	assert.deepEqual(stored.taskCommands, [unreadable, notARecord]);
});

test("mistyped task command fields fall back and a missing primary becomes the first action", () => {
	const [command] = mergeSettings({
		taskCommands: [
			{
				id: "7",
				enabled: true,
				name: 3,
				statuses: " xx/",
				primary: "9",
				actions: [{ id: "2", kind: "copy", label: "Later", status: ">", periodic: [{ period: "week", relation: "next" }, { period: "week", relation: "next" }] }],
			},
		],
	}).taskCommands;
	assert.equal(command.name, "");
	assert.equal(command.statuses, " x/");
	assert.equal(command.primary, "2");
	assert.equal(command.batch, true);
	assert.equal(command.skippedStatuses, "");
	const [action] = command.actions as [CopyAction];
	assert.deepEqual(action.destinations, [periodicDestination("week", "next")]);
	assert.deepEqual([action.mentionDestination, action.mentionSource], [false, false]);
});

test("destinations are read in order, keeping repeats and dropping entries that can't be read", () => {
	const [command] = mergeSettings({
		taskCommands: [
			{
				id: "1",
				enabled: true,
				skippedStatuses: "x-x",
				actions: [
					{
						id: "1",
						kind: "copy",
						status: ">",
						destinations: [
							{ kind: "note", path: "projects/Alpha.md" },
							{ kind: "periodic", period: "day", relation: "next" },
							{ kind: "note", path: "projects/Alpha.md" },
							{ kind: "periodic", period: "decade", relation: "next" },
							{ kind: "note" },
							"garbage",
						],
						periodic: [{ period: "year", relation: "next" }],
					},
				],
			},
		],
	}).taskCommands;
	assert.equal(command.unreadable, undefined);
	assert.equal(command.skippedStatuses, "x-");
	assert.deepEqual((command.actions[0] as CopyAction).destinations, [
		noteDestination("projects/Alpha.md"),
		periodicDestination("day", "next"),
		noteDestination("projects/Alpha.md"),
	]);
});

test("copy actions saved with periods become periodic destinations in picker order and lose their note filter", () => {
	const [command] = mergeSettings({
		taskCommands: [
			{
				id: "1",
				actions: [
					{
						id: "1",
						kind: "copy",
						status: ">",
						periodic: [
							{ period: "year", relation: "next" },
							{ period: "day", relation: "this" },
							{ period: "week", relation: "later" },
							{ period: "day", relation: "this" },
						],
						filter: { kind: "group", operator: "and", children: [{ kind: "folder", folder: "projects" }] },
					},
					{ id: "2", kind: "copy", status: "<", periodic: "garbage" },
				],
			},
		],
	}).taskCommands;
	const [legacy, broken] = command.actions as [CopyAction, CopyAction];
	assert.deepEqual(legacy.destinations, [periodicDestination("day", "this"), periodicDestination("year", "next")]);
	assert.deepEqual(Object.keys(legacy).sort(), ["destinations", "id", "kind", "label", "mentionDestination", "mentionSource", "status"]);
	assert.deepEqual(broken.destinations, []);
	const stored = JSON.parse(JSON.stringify(storedSettings({ ...defaultSettings(), taskCommands: [command] }))) as { taskCommands: Record<string, unknown>[] };
	assert.deepEqual(mergeSettings(stored).taskCommands, [command]);
});

test("task command settings are read and written through their control keys", () => {
	const { settings, command } = settingsWithCommand();
	assert.equal(writeControl(settings, taskCommandKey(command.id, "name"), "Review"), true);
	assert.equal(writeControl(settings, taskCommandKey(command.id, "statuses"), " x x"), true);
	assert.equal(writeControl(settings, taskCommandKey(command.id, "skippedStatuses"), "--x"), true);
	assert.equal(writeControl(settings, taskCommandKey(command.id, "selectAll"), true), true);
	assert.deepEqual([command.name, command.statuses, command.skippedStatuses, command.selectAll], ["Review", " x", "-x", true]);
	assert.equal(readControl(settings, taskCommandKey(command.id, "batch")), true);
	const [complete, cancel] = command.actions;
	assert.deepEqual(primaryActionOptions(command), [
		["menu", "Show the actions menu"],
		["1", "Complete"],
		["2", "Cancel"],
		["3", "Migrate"],
		["4", "Schedule"],
	]);
	assert.equal(readControl(settings, taskCommandKey(command.id, "primary")), complete.id);
	assert.equal(writeControl(settings, taskCommandKey(command.id, "primary"), cancel.id), true);
	assert.equal(primaryAction(command), cancel);
	assert.equal(readControl(settings, taskCommandKey(command.id, "primary")), cancel.id);
	assert.equal(writeControl(settings, taskCommandKey(command.id, "primary"), "99"), false);
	assert.equal(primaryAction(command), cancel);
	assert.equal(writeControl(settings, taskActionKey(command.id, complete.id, "status"), ""), false);
	assert.equal(writeControl(settings, taskActionKey(command.id, complete.id, "completionDate"), "link"), true);
	assert.equal(readControl(settings, taskActionKey(command.id, complete.id, "completionDate")), "link");
});

test("a primary action that is gone falls back to the first action", () => {
	const { command } = settingsWithCommand();
	command.primary = "99";
	assert.equal(primaryAction(command)?.label, "Complete");
	assert.equal(secondaryActions(command).length, 3);
	const [reloaded] = mergeSettings({ taskCommands: [{ ...command, primary: 7 }] }).taskCommands;
	assert.equal(reloaded.primary, "1");
});

test("changing an action's kind swaps its fields and destinations are edited one entry at a time", () => {
	const { settings, command } = settingsWithCommand();
	const complete = command.actions[0];
	const key = (setting: Parameters<typeof taskActionKey>[2], index?: number) => taskActionKey(command.id, complete.id, setting, index === undefined ? undefined : String(index));
	assert.equal(writeControl(settings, key("kind"), "copy"), true);
	assert.equal(complete.kind, "copy");
	assert.equal("completionDate" in complete, false);
	assert.equal(taskActionWarning(complete), "Choose at least one destination note.");
	assert.equal(taskCommandWarning(command), "Some actions need attention. Edit to see why.");
	const copy = complete as CopyAction;
	addTaskDestination(copy);
	addTaskDestination(copy);
	assert.deepEqual(copy.destinations, [periodicDestination("day", "this"), periodicDestination("day", "this")]);
	assert.equal(taskActionWarning(complete), undefined);
	assert.equal(readControl(settings, key("destination", 0)), "day-this");
	assert.equal(writeControl(settings, key("destination", 1), "week-next"), true);
	assert.equal(writeControl(settings, key("destination", 1), "day-later"), false);
	assert.equal(writeControl(settings, key("destination", 2), "day-next"), false);
	assert.equal(writeControl(settings, key("destination", 0), "note"), true);
	assert.equal(readControl(settings, key("destination", 0)), "note");
	assert.equal(writeControl(settings, key("destinationNote", 0), " projects/Alpha.md "), true);
	assert.equal(writeControl(settings, key("destinationNote", 1), "projects/Alpha.md"), false);
	assert.equal(writeControl(settings, key("destination", 0), "note"), true);
	assert.equal(readControl(settings, key("destinationNote", 0)), "projects/Alpha.md");
	assert.deepEqual(copy.destinations, [noteDestination("projects/Alpha.md"), periodicDestination("week", "next")]);
	moveTaskDestination(copy, 1, 0);
	assert.deepEqual(copy.destinations, [periodicDestination("week", "next"), noteDestination("projects/Alpha.md")]);
	removeTaskDestination(copy, 0);
	assert.deepEqual(copy.destinations, [noteDestination("projects/Alpha.md")]);
	assert.equal(writeControl(settings, key("kind"), "status"), true);
	assert.deepEqual(Object.keys(complete).sort(), ["completionDate", "id", "kind", "label", "status"]);
});

test("destination options list each period's this and next, then a specific note, and warn about missing notes", () => {
	assert.deepEqual(Object.values(destinationOptions()), [
		"Today",
		"Tomorrow",
		"This week",
		"Next week",
		"This month",
		"Next month",
		"This quarter",
		"Next quarter",
		"This year",
		"Next year",
		"Specific note",
	]);
	const notes = [{ path: "projects/Alpha.md", basename: "Alpha", ctime: 0 }];
	assert.equal(destinationNoteWarning("projects/Alpha.md", notes), undefined);
	assert.equal(destinationNoteWarning("Alpha", notes), undefined);
	assert.equal(destinationNoteWarning("", notes), "Choose a note.");
	assert.equal(destinationNoteWarning("projects/Gone.md", notes), "This note doesn't exist, so it isn't offered. Choose another note or remove this destination.");
});

test("deleting the primary action makes the next one primary, and the first added action is primary", () => {
	const { command } = settingsWithCommand();
	deleteTaskAction(command, 0);
	assert.equal(primaryAction(command)?.label, "Cancel");
	while (command.actions.length > 0) deleteTaskAction(command, 0);
	assert.equal(command.primary, "");
	assert.equal(taskCommandWarning(command), "Add an action so the command can run.");
	assert.equal(isRunnableTaskCommand(command), false);
	const added = addTaskAction(command);
	assert.equal(command.primary, added.id);
});

test("the actions menu selection survives settings writes, reloads, additions and deletions", () => {
	const { settings, command } = settingsWithCommand();
	const key = taskCommandKey(command.id, "primary");
	assert.equal(writeControl(settings, key, "menu"), true);
	assert.equal(readControl(settings, key), "menu");
	assert.equal(primaryAction(command), undefined);
	assert.deepEqual(secondaryActions(command), command.actions);
	const reloaded = mergeSettings(JSON.parse(JSON.stringify(storedSettings(settings)))).taskCommands[0];
	assert.equal(reloaded.primary, "menu");
	assert.equal(primaryAction(reloaded), undefined);
	while (command.actions.length) deleteTaskAction(command, 0);
	addTaskAction(command);
	assert.equal(command.primary, "menu");
});

test("status pills add only valid distinct characters and remove one chosen status", () => {
	assert.equal(addStatus(" x", "/"), " x/");
	for (const invalid of ["", "xx", "x", " ", "\n", "\r", "]"]) assert.equal(addStatus(" x", invalid), " x");
	assert.equal(addStatus("", "d"), "d");
	assert.equal(removeStatus(" x/", "x"), " /");
	assert.equal(removeStatus("x", "x"), "");
	assert.deepEqual(availableStatuses(" x-"), [[">", "Migrated [>]"], ["<", "Scheduled [<]"], ["/", "In progress [/]"]]);
	assert.equal(statusLabel("x"), "Completed [x]");
	assert.equal(statusLabel("d"), "[d]");
});
