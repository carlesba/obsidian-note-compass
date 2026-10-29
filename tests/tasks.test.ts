import { test } from "node:test";
import { strict as assert } from "node:assert";
import { defaultDateNoteSettings, resolveDateNotes } from "../src/lists/dateNotes.ts";
import { applyCopyAction, applyStatusAction, applyStagedChanges, cancelBatch, completionSuffix, finishBatch, groupChanges, prepareChanges, remainingTasks, shouldFinishBatch, stageChanges } from "../src/tasks/apply.ts";
import type { ApplyContext } from "../src/tasks/apply.ts";
import { actionDestinations, fallbackLinkText } from "../src/tasks/destinations.ts";
import type { DestinationContext } from "../src/tasks/destinations.ts";
import { actionChoices, choiceTargets, destinationChoices, planAction, taskChoices, taskSelectionPlan } from "../src/tasks/picker.ts";
import { newCopyAction, newStatusAction, newTaskCommand, noteDestination, periodicDestination, secondaryActions } from "../src/tasks/taskCommand.ts";
import type { CopyAction, Destination, StatusAction, TaskCommand } from "../src/tasks/taskCommand.ts";
import {
	appendLines,
	applyLineEdits,
	copiedLine,
	destinationMention,
	noteTasks,
	parseTaskLine,
	withStatus,
	withSuffix,
} from "../src/tasks/taskLines.ts";
import type { TaskLine } from "../src/tasks/taskLines.ts";
import { fakeVault } from "./fakeVault.ts";
import type { FakeNote } from "./fakeVault.ts";
import { moment } from "./moment.ts";

const TODAY = moment("2026-10-28", "YYYY-MM-DD", true);

function task(text: string, line = 0): TaskLine {
	const parsed = parseTaskLine(text, line);
	assert.ok(parsed, `${text} is a task`);
	return parsed;
}

function dateNotes(enabledQuarter = true) {
	const settings = defaultDateNoteSettings();
	settings.from = "custom";
	settings.custom.quarter.enabled = enabledQuarter;
	return resolveDateNotes(settings, fakeVault([]));
}

function copyAction(destinations: Destination[], changes: Partial<CopyAction> = {}): CopyAction {
	return { ...newCopyAction([], "Migrate", ">", destinations), ...changes };
}

function listing(statuses: string, skippedStatuses = "") {
	return { statuses, skippedStatuses };
}

function statusAction(changes: Partial<StatusAction> = {}): StatusAction {
	return { ...newStatusAction([], "Complete", "x"), ...changes };
}

function command(changes: Partial<TaskCommand> = {}): TaskCommand {
	return { ...newTaskCommand([]), ...changes };
}

test("task lines are read with indentation, blockquotes and every list marker", () => {
	const cases: [string, string, string, string][] = [
		["- [ ] Buy milk", "-", " ", "Buy milk"],
		["\t\t* [x] Done thing", "*", "x", "Done thing"],
		["+ [/] Half done", "+", "/", "Half done"],
		["12. [-] Numbered", "12.", "-", "Numbered"],
		["3) [>] Paren", "3)", ">", "Paren"],
		["> - [ ] Quoted", "-", " ", "Quoted"],
		["> > \t- [ ] Nested quote", "-", " ", "Nested quote"],
		["- [ ]", "-", " ", ""],
	];
	for (const [text, marker, status, body] of cases) {
		const parsed = task(text);
		assert.deepEqual([parsed.marker, parsed.status, parsed.body], [marker, status, body], text);
		assert.equal(parsed.text[parsed.statusIndex], status, text);
	}
	for (const text of ["- plain item", "[ ] no marker", "-[ ] no gap", "- [] empty box", "- [ ]no space"]) assert.equal(parseTaskLine(text, 0), undefined, text);
});

test("note tasks are read at the cached task lines and filtered by status characters", () => {
	const content = ["# Today", "- [ ] open", "- [x] done", "  - [-] cancelled", "- not a task", "> - [ ] quoted"].join("\n");
	const lines = [1, 2, 3, 4, 5];
	assert.deepEqual(noteTasks(content, lines, listing(" ")).map((found) => found.body), ["open", "quoted"]);
	assert.deepEqual(noteTasks(content, lines, listing(" x")).map((found) => found.body), ["open", "done", "quoted"]);
	assert.deepEqual(noteTasks(content, lines, listing("")).map((found) => found.body), ["open", "done", "cancelled", "quoted"]);
	assert.deepEqual(noteTasks(content, [5, 1, 1, 99], listing(" ")).map((found) => found.line), [1, 5]);
});

test("tasks to skip leave tasks out of every task or of the tasks to list", () => {
	const content = ["- [ ] open", "- [x] done", "- [-] cancelled", "- [>] migrated"].join("\n");
	const lines = [0, 1, 2, 3];
	const bodies = (statuses: string, skipped: string) => noteTasks(content, lines, listing(statuses, skipped)).map((found) => found.body);
	assert.deepEqual(bodies("", ""), ["open", "done", "cancelled", "migrated"]);
	assert.deepEqual(bodies("", "x-"), ["open", "migrated"]);
	assert.deepEqual(bodies(" x", "x"), ["open"]);
	assert.deepEqual(bodies(" x", ">"), ["open", "done"]);
	assert.deepEqual(bodies(" ", " "), []);
});

test("status changes keep the rest of the line, and suffixes go before a block id", () => {
	assert.equal(withStatus(task("  > - [ ] Call Ana ^call"), "x"), "  > - [x] Call Ana ^call");
	assert.equal(withStatus(task("1. [ ] First"), "-"), "1. [-] First");
	assert.equal(withSuffix("- [x] Call Ana", " ✅ 2026-10-28"), "- [x] Call Ana ✅ 2026-10-28");
	assert.equal(withSuffix("- [x] Call Ana ^call-1", " ✅ 2026-10-28"), "- [x] Call Ana ✅ 2026-10-28 ^call-1");
	assert.equal(withSuffix("- [>] Call Ana", destinationMention("2026-10-29")), "- [>] Call Ana → [[2026-10-29]]");
});

test("completion dates are written as text in the daily format or as a link to today's daily note", () => {
	const vault = fakeVault([{ path: "on/2026-10-28.md" }, { path: "inbox/Plan.md" }]);
	const context = { vault, source: vault.note("inbox/Plan.md"), today: TODAY, dateNotes: dateNotes() };
	assert.equal(completionSuffix(statusAction(), context), "");
	assert.equal(completionSuffix(statusAction({ completionDate: "text" }), context), " ✅ 2026-10-28");
	assert.equal(completionSuffix(statusAction({ completionDate: "link" }), context), " ✅ [[2026-10-28]]");
});

test("a copied task keeps its marker and body, drops indentation and blockquotes, and can link back", () => {
	assert.equal(copiedLine(task("\t> * [ ] Write report ^r1")), "* [ ] Write report ^r1");
	assert.equal(copiedLine(task("  2. [/] Started")), "2. [ ] Started");
	assert.equal(copiedLine(task("- [ ] Write report"), "Plan"), "- [ ] Write report ← [[Plan]]");
});

test("line edits re-check each line, keep CRLF endings and skip lines that changed", () => {
	const content = "- [ ] a\r\n- [ ] b\r\n";
	const edited = applyLineEdits(content, [
		{ line: 0, expected: "- [ ] a", replacement: "- [x] a" },
		{ line: 1, expected: "- [ ] changed", replacement: "- [x] b" },
		{ line: 7, expected: "- [ ] gone", replacement: "x" },
	]);
	assert.equal(edited.content, "- [x] a\r\n- [ ] b\r\n");
	assert.deepEqual([edited.applied.length, edited.skipped.length], [1, 2]);
});

test("copies are appended at the end of the note on their own lines", () => {
	assert.equal(appendLines("", ["- [ ] a"]), "- [ ] a\n");
	assert.equal(appendLines("# Day", ["- [ ] a", "- [ ] b"]), "# Day\n- [ ] a\n- [ ] b\n");
	assert.equal(appendLines("# Day\n", ["- [ ] a"]), "# Day\n- [ ] a\n");
	assert.equal(appendLines("# Day", []), "# Day");
});

test("periodic destinations resolve this and next for every period from today", () => {
	const vault = fakeVault([{ path: "inbox/Plan.md" }, { path: "on/2026-W44.md" }]);
	const context: DestinationContext = { vault, dateNotes: dateNotes(), today: TODAY };
	const every = (["day", "week", "month", "quarter", "year"] as const).flatMap((period) => [periodicDestination(period, "this"), periodicDestination(period, "next")]);
	const { destinations } = actionDestinations(copyAction(every), "inbox/Plan.md", context);
	assert.deepEqual(
		destinations.map((destination) => [destination.label, destination.path]),
		[
			["Today · 2026-10-28", "on/2026-10-28.md"],
			["Tomorrow · 2026-10-29", "on/2026-10-29.md"],
			["This week · 2026-W44", "on/2026-W44.md"],
			["Next week · 2026-W45", "on/2026-W45.md"],
			["This month · 2026-10", "on/2026-10.md"],
			["Next month · 2026-11", "on/2026-11.md"],
			["This quarter · 2026-Q4", "on/2026-Q4.md"],
			["Next quarter · 2027-Q1", "on/2027-Q1.md"],
			["This year · 2026", "on/2026.md"],
			["Next year · 2027", "on/2027.md"],
		],
	);
	assert.equal(destinations.find((destination) => destination.path === "on/2026-W44.md")?.missing, undefined);
	assert.equal(destinations.find((destination) => destination.path === "on/2026-10-29.md")?.missing?.period, "day");
});

test("destinations keep their order, skip disabled periods, the source note and repeats, and report missing notes", () => {
	const vault = fakeVault([{ path: "on/2026-10-29.md" }, { path: "projects/Alpha.md" }, { path: "projects/Beta.md" }]);
	const context: DestinationContext = { vault, dateNotes: dateNotes(false), today: TODAY };
	const action = copyAction([
		noteDestination("projects/Beta.md"),
		periodicDestination("day", "next"),
		periodicDestination("quarter", "next"),
		noteDestination("projects/Alpha.md"),
		noteDestination("Beta"),
		noteDestination("on/2026-10-29.md"),
		noteDestination("projects/Gone.md"),
		noteDestination(" "),
	]);
	const fromAlpha = actionDestinations(action, "projects/Alpha.md", context);
	assert.deepEqual(fromAlpha.destinations.map((destination) => [destination.label, destination.path]), [
		["Beta", "projects/Beta.md"],
		["Tomorrow · 2026-10-29", "on/2026-10-29.md"],
	]);
	assert.deepEqual(fromAlpha.missingNotes, ["projects/Gone.md"]);
	const fromTomorrow = actionDestinations(action, "on/2026-10-29.md", context);
	assert.deepEqual(fromTomorrow.destinations.map((destination) => destination.path), ["projects/Beta.md", "projects/Alpha.md"]);
	assert.deepEqual(actionDestinations(copyAction([]), "projects/Alpha.md", context), { destinations: [], missingNotes: [] });
	assert.equal(vault.createdPeriodNotes.length, 0);
});

test("links use the note name unless another note shares it", () => {
	assert.equal(fallbackLinkText("on/2026-10-29.md", ["on/2026-10-29.md", "a/Plan.md"]), "2026-10-29");
	assert.equal(fallbackLinkText("a/Plan.md", ["a/Plan.md", "b/Plan.md"]), "a/Plan");
});

test("the task picker adds an apply-to-all row first and a finish row last when asked", () => {
	const tasks = [task("- [ ] Alpha", 1), task("- [ ] Beta", 2), task("- [x] Gamma", 3)];
	const plain = taskChoices(command({ selectAll: false, batch: false }), tasks, "");
	assert.deepEqual(plain.map((choice) => choice.label), ["Alpha", "Beta", "Gamma [x]"]);
	const full = taskChoices(command({ selectAll: true, batch: true }), tasks, "");
	assert.deepEqual(full.map((choice) => choice.parts.content), ["Apply to all 3 tasks", "Alpha", "Beta", "Gamma", "Finish processing", "Cancel"]);
	assert.deepEqual(choiceTargets(full[0].action), tasks);
	assert.deepEqual(choiceTargets(full[2].action), [tasks[1]]);
	assert.deepEqual(choiceTargets(full[4].action), []);
	const typed = taskChoices(command({ selectAll: true, batch: true }), tasks, "a");
	assert.deepEqual(typed.map((choice) => choice.parts.content), ["Apply to all 3 tasks", "Alpha", "Beta", "Gamma", "Finish processing", "Cancel"]);
	const narrowed = taskChoices(command({ selectAll: true, batch: true }), tasks, "be");
	assert.deepEqual(narrowed.map((choice) => choice.parts.content), ["Beta", "Finish processing", "Cancel"]);
	const two = taskChoices(command({ selectAll: true, batch: false }), tasks, "ph");
	assert.deepEqual(two.map((choice) => choice.parts.content), ["Alpha"]);
});

test("copy actions run directly with one destination and ask with several", () => {
	const one = [{ path: "a.md", label: "A" }];
	const two = [...one, { path: "b.md", label: "B" }];
	assert.deepEqual(planAction(statusAction(), []), { plan: "run" });
	assert.deepEqual(planAction(copyAction([]), []), { plan: "none" });
	assert.deepEqual(planAction(copyAction([]), one), { plan: "run", destination: one[0] });
	assert.deepEqual(planAction(copyAction([]), two), { plan: "pick", destinations: two });
	assert.deepEqual(destinationChoices([{ path: "x.md", label: "Tomorrow · x", missing: { period: "day", date: TODAY } }], "").map((choice) => choice.label), ["Tomorrow · x new note"]);
	const defaults = newTaskCommand([]);
	assert.deepEqual(actionChoices(secondaryActions(defaults), "mi").map((choice) => choice.label), ["Migrate"]);
});

function applyContext(notes: FakeNote[], sourcePath: string): ApplyContext & { vault: ReturnType<typeof fakeVault> } {
	const vault = fakeVault(notes);
	return { vault, source: vault.note(sourcePath), today: TODAY, dateNotes: dateNotes() };
}

test("a status action rewrites each chosen task in place and leaves changed lines alone", async () => {
	const context = applyContext([{ path: "inbox/Plan.md", content: "# Plan\n- [ ] Alpha\n- [ ] Beta\n" }], "inbox/Plan.md");
	const tasks = await remainingTasks(context.vault, context.source, context.vault.taskLineNumbers("inbox/Plan.md"), listing(" "));
	const stale = { ...tasks[1], text: "- [ ] Beta before" };
	const result = await applyStatusAction(context, statusAction({ completionDate: "text" }), [tasks[0], stale]);
	assert.deepEqual(result, { applied: 1, skipped: 1 });
	assert.equal(context.vault.content("inbox/Plan.md"), "# Plan\n- [x] Alpha ✅ 2026-10-28\n- [ ] Beta\n");
	const left = await remainingTasks(context.vault, context.source, [1, 2], listing(" "));
	assert.deepEqual(left.map((found) => found.body), ["Beta"]);
});

test("a copy action appends to the destination, creates a missing periodic note and marks the source", async () => {
	const context = applyContext(
		[
			{ path: "inbox/Plan.md", content: "- [ ] Alpha ^a1\n  > - [ ] Beta\n" },
			{ path: "on/2026-W44.md", content: "# Week" },
		],
		"inbox/Plan.md",
	);
	const tasks = await remainingTasks(context.vault, context.source, [0, 1], listing(" "));
	const action = copyAction([periodicDestination("day", "next")], { mentionDestination: true, mentionSource: true });
	const [tomorrow] = actionDestinations(action, "inbox/Plan.md", { vault: context.vault, dateNotes: context.dateNotes, today: TODAY }).destinations;
	const result = await applyCopyAction(context, action, tasks, tomorrow);
	assert.deepEqual(result, { applied: 2, skipped: 0 });
	assert.deepEqual(context.vault.createdPeriodNotes, ["on/2026-10-29.md"]);
	assert.equal(context.vault.content("on/2026-10-29.md"), "- [ ] Alpha ← [[Plan]] ^a1\n- [ ] Beta ← [[Plan]]\n");
	assert.equal(context.vault.content("inbox/Plan.md"), "- [>] Alpha → [[2026-10-29]] ^a1\n  > - [>] Beta → [[2026-10-29]]\n");
	const week = { path: "on/2026-W44.md", label: "This week · 2026-W44" };
	const plain = copyAction([], { status: "<", mentionDestination: false });
	const source = await remainingTasks(context.vault, context.source, [0, 1], listing(""));
	await applyCopyAction(context, plain, [source[0]], week);
	assert.equal(context.vault.content("on/2026-W44.md"), "# Week\n- [ ] Alpha → [[2026-10-29]] ^a1\n");
	assert.equal(context.vault.content("inbox/Plan.md"), "- [<] Alpha → [[2026-10-29]] ^a1\n  > - [>] Beta → [[2026-10-29]]\n");
});

test("a copy action skips tasks whose line changed and writes nothing when all changed", async () => {
	const context = applyContext([{ path: "a.md", content: "- [ ] Alpha\n" }, { path: "b.md", content: "" }], "a.md");
	const stale = task("- [ ] Old text", 0);
	const result = await applyCopyAction(context, copyAction([]), [stale], { path: "b.md", label: "b" });
	assert.deepEqual(result, { applied: 0, skipped: 1 });
	assert.equal(context.vault.content("b.md"), "");
	assert.equal(context.vault.content("a.md"), "- [ ] Alpha\n");
});

test("Enter plans the full actions menu for task and apply-to-all rows when selected", () => {
	const menuCommand = command({ primary: "menu", selectAll: true });
	const choices = taskChoices(menuCommand, [task("- [ ] One", 0), task("- [ ] Two", 1)], "");
	for (const choice of choices.filter((choice) => choice.action.action === "task" || choice.action.action === "all")) {
		assert.ok(choiceTargets(choice.action).length > 0);
		assert.deepEqual(taskSelectionPlan(menuCommand), { plan: "menu", actions: menuCommand.actions });
	}
	assert.deepEqual(taskSelectionPlan(command({ primary: "missing" })), { plan: "run", action: menuCommand.actions[0] });
	assert.equal(secondaryActions(menuCommand).length, 4);
	assert.equal(secondaryActions(command()).length, 3);
});

test("timestamp completion uses the daily-note date format and core Templates time format", async () => {
	const source = { path: "Today.md", basename: "Today", ctime: 0 };
	const vault = fakeVault([{ ...source, content: "- [ ] Work" }]);
	const notes = dateNotes();
	notes.periods.day.format = "DD.MM.YYYY";
	const context: ApplyContext = { vault, source, today: TODAY, dateNotes: notes, now: moment("2026-10-28 17:43", "YYYY-MM-DD HH:mm", true), templatesOptions: { timeFormat: "h:mm A" } };
	const action = statusAction({ completionDate: "timestamp" });
	assert.equal(completionSuffix(action, context), " ✅ 28.10.2026 5:43 PM");
	assert.equal(completionSuffix(action, { ...context, templatesOptions: undefined }), " ✅ 28.10.2026 17:43");
	await applyStatusAction(context, action, [task("- [ ] Work")]);
	assert.equal(await vault.readNote(source.path), "- [x] Work ✅ 28.10.2026 5:43 PM");
});

test("batch staging defers writes, removes chosen tasks and supports finish, cancel and automatic finish", async () => {
	const context = applyContext([{ path: "a.md", content: "- [ ] One\n- [ ] Two" }], "a.md");
	const tasks = [task("- [ ] One"), task("- [ ] Two", 1)];
	const initial = { remaining: tasks, changes: [] };
	const staged = stageChanges(initial, prepareChanges(context, statusAction(), [tasks[0]]));
	assert.equal(context.vault.content("a.md"), "- [ ] One\n- [ ] Two");
	assert.deepEqual(staged.remaining, [tasks[1]]);
	assert.equal(shouldFinishBatch(staged), false);
	assert.equal(finishBatch(staged).length, 1);
	assert.deepEqual(cancelBatch(staged).changes, []);
	assert.deepEqual(initial.remaining, tasks);
	assert.equal(context.vault.content("a.md"), "- [ ] One\n- [ ] Two");
	const last = stageChanges(staged, prepareChanges(context, statusAction(), [tasks[1]]));
	assert.equal(shouldFinishBatch(last), true);
	assert.deepEqual(await applyStagedChanges(context, finishBatch(last)), { applied: 2, skipped: 0 });
	assert.equal(context.vault.content("a.md"), "- [x] One\n- [x] Two");
	const finishChoice = taskChoices(command(), staged.remaining, "", staged.changes.length).find((choice) => choice.action.action === "finish");
	assert.equal(finishChoice?.parts.value, "1 change");
});

test("batch select-all stages every matching task and finishes even with unmatched tasks left", () => {
	const context = applyContext([{ path: "a.md", content: "" }], "a.md");
	const tasks = [task("- [ ] Alpha"), task("- [ ] Alpine", 1), task("- [ ] Beta", 2)];
	const all = taskChoices(command({ selectAll: true }), tasks, "a")[0];
	assert.equal(all.action.action, "all");
	const staged = stageChanges({ remaining: tasks, changes: [] }, prepareChanges(context, statusAction(), choiceTargets(all.action)));
	assert.equal(staged.changes.length, 3);
	const narrowed = taskChoices(command({ selectAll: true }), tasks, "al")[0];
	const partial = stageChanges({ remaining: tasks, changes: [] }, prepareChanges(context, statusAction(), choiceTargets(narrowed.action)));
	assert.equal(narrowed.action.action, "all");
	assert.equal(partial.changes.length, 2);
	assert.equal(shouldFinishBatch(partial, true), true);
	assert.equal(shouldFinishBatch(partial), false);
});

test("batch applies once per file, preserving staging order and skipping changed source lines and their copies", async () => {
	const context = applyContext([{ path: "a.md", content: "- [ ] One\n- [ ] Two\n- [ ] Changed\n- [ ] Four" }, { path: "b.md", content: "# B" }], "a.md");
	const destination = { path: "b.md", label: "B" };
	const missing = { path: "on/2026-10-29.md", label: "Tomorrow", missing: { period: "day" as const, date: TODAY.clone().add(1, "day") } };
	const action = copyAction([], { mentionDestination: false });
	const changes = [
		...prepareChanges(context, action, [task("- [ ] Two", 1)], destination),
		...prepareChanges(context, action, [task("- [ ] One")], destination),
		...prepareChanges(context, action, [task("- [ ] Old", 2)], missing),
		...prepareChanges(context, statusAction(), [task("- [ ] Four", 3)]),
	];
	const grouped = groupChanges("a.md", changes);
	assert.deepEqual(grouped.map((file) => file.path), ["a.md", "b.md", "on/2026-10-29.md"]);
	assert.deepEqual(grouped[1].appends, ["- [ ] Two", "- [ ] One"]);
	assert.equal(context.vault.createdPeriodNotes.length, 0);
	const calls: string[] = [];
	const process = context.vault.processNote;
	context.vault.processNote = async (path, edit) => { calls.push(path); return process(path, edit); };
	assert.deepEqual(await applyStagedChanges(context, changes), { applied: 3, skipped: 1 });
	assert.deepEqual(calls, ["a.md", "b.md"]);
	assert.equal(context.vault.createdPeriodNotes.length, 0);
	assert.equal(context.vault.content("b.md"), "# B\n- [ ] Two\n- [ ] One\n");
	assert.equal(context.vault.content("a.md"), "- [>] One\n- [>] Two\n- [ ] Changed\n- [x] Four");
	assert.deepEqual(await applyStagedChanges(context, []), { applied: 0, skipped: 0 });
	assert.deepEqual(calls, ["a.md", "b.md"]);
});

test("batch creates periodic destinations only when applying and groups repeated copies", async () => {
	const context = applyContext([{ path: "a.md", content: "- [ ] One\n- [ ] Two" }], "a.md");
	const action = copyAction([periodicDestination("day", "next")]);
	const destination = actionDestinations(action, "a.md", context).destinations[0];
	const changes = prepareChanges(context, action, [task("- [ ] Two", 1), task("- [ ] One")], destination);
	assert.deepEqual(context.vault.createdPeriodNotes, []);
	await applyStagedChanges(context, changes);
	assert.deepEqual(context.vault.createdPeriodNotes, ["on/2026-10-29.md"]);
	assert.equal(context.vault.content(destination.path), "- [ ] Two\n- [ ] One\n");
});

test("actions menu lists every action in list order", () => {
	const configured = command();
	const choices = actionChoices(configured.actions, "");
	assert.deepEqual(choices.map((choice) => choice.action), configured.actions);
	assert.ok(choices.every((choice) => choice.parts.value === undefined));
});


test("literal affixes change only copied bodies in immediate and batch execution", async () => {
	for (const batch of [false, true]) {
		const context = applyContext([{ path: "a.md", content: "> - [ ] Alpha ^a1" }, { path: "b.md", content: "" }], "a.md");
		const action = copyAction([], { prefix: "pre ", suffix: " post", mentionSource: true, mentionDestination: false });
		const tasks = [task("> - [ ] Alpha ^a1")];
		const destination = { path: "b.md", label: "B" };
		if (batch) await applyStagedChanges(context, prepareChanges(context, action, tasks, destination));
		else await applyCopyAction(context, action, tasks, destination);
		assert.equal(context.vault.content("a.md"), "> - [>] Alpha ^a1");
		assert.equal(context.vault.content("b.md"), "- [ ] pre Alpha post ← [[a]] ^a1\n");
	}
	assert.equal(copiedLine(task("- [ ] Alpha"), undefined, "(", ")"), "- [ ] (Alpha)");
});
