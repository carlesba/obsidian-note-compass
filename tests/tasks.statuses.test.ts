import { test } from "node:test";
import { strict as assert } from "node:assert";
import { defaultSettings, mergeSettings, storedSettings } from "../src/settings.ts";
import { CYCLE_ON_CLICK_KEY, DRAW_STATUS_ICONS_KEY, readControl, taskStatusKey, writeControl } from "../src/settings/controlKeys.ts";
import { maskSvg, statusIconCss } from "../src/tasks/statusIcons.ts";
import {
	applyLineChange,
	changedContent,
	cycleChange,
	cycleSymbols,
	lineSymbol,
	newTaskStatus,
	nextCycleSymbol,
	readTaskStatuses,
	typeForSymbol,
	symbolChange,
	taskStatusChoices,
	taskStatusLabel,
	taskStatusWarning,
	usableStatuses,
} from "../src/tasks/taskStatuses.ts";
import type { TaskStatus, TaskStatusType } from "../src/tasks/taskStatuses.ts";

function status(id: string, symbol: string, name: string, inCycle = false, icon = "", color = "", type: TaskStatusType = typeForSymbol(symbol)): TaskStatus {
	return { id, symbol, name, inCycle, type, icon, color };
}

function changed(text: string, change: ReturnType<typeof symbolChange>): string | undefined {
	return change ? applyLineChange(text, change) : undefined;
}

test("a fresh install cycles open, in progress, completed and cancelled, also offers migrated and scheduled, and leaves clicks and drawing to the theme", () => {
	const { taskStatuses } = defaultSettings();
	assert.equal(taskStatuses.cycleOnClick, false);
	assert.equal(taskStatuses.drawIcons, false);
	assert.deepEqual(
		taskStatuses.statuses.map(({ symbol, name, inCycle, type, icon }) => [symbol, name, inCycle, type, icon]),
		[
			[" ", "Open", true, "todo", ""],
			["/", "In progress", true, "inProgress", ""],
			["x", "Completed", true, "done", ""],
			["-", "Cancelled", true, "cancelled", ""],
			[">", "Migrated", false, "other", "arrow-right"],
			["<", "Scheduled", false, "other", "calendar"],
		],
	);
});

test("statuses keep their id, symbol, name and cycle mark through a save and reload, and broken entries are repaired", () => {
	const statuses = [status("4", "i", "Info", false, "info", "#3a7bd5"), status("7", "", "Note", true)];
	const settings = mergeSettings({ taskStatuses: { cycleOnClick: true, drawIcons: true, statuses } });
	assert.deepEqual(settings.taskStatuses, { cycleOnClick: true, drawIcons: true, statuses });
	assert.deepEqual(mergeSettings(JSON.parse(JSON.stringify(storedSettings(settings)))).taskStatuses, settings.taskStatuses);
	assert.deepEqual(readTaskStatuses({ statuses: [null, { id: "4", symbol: 3, color: "red" }, { id: "4", name: "Again" }] }).statuses, [
		status("4", "", ""),
		status("5", "", "Again"),
	]);
});

test("the click toggle and each status's fields read and write through control keys", () => {
	const settings = defaultSettings();
	const id = settings.taskStatuses.statuses[3].id;
	assert.equal(writeControl(settings, CYCLE_ON_CLICK_KEY, true), true);
	assert.equal(readControl(settings, CYCLE_ON_CLICK_KEY), true);
	assert.equal(writeControl(settings, taskStatusKey(id, "symbol"), "-c"), true);
	assert.equal(writeControl(settings, taskStatusKey(id, "name"), "Dropped"), true);
	assert.equal(writeControl(settings, taskStatusKey(id, "inCycle"), true), true);
	assert.equal(writeControl(settings, taskStatusKey(id, "type"), "other"), true);
	assert.equal(writeControl(settings, taskStatusKey(id, "type"), "unknown"), false);
	assert.equal(writeControl(settings, taskStatusKey(id, "icon"), "ban"), true);
	assert.equal(writeControl(settings, taskStatusKey(id, "color"), "#e5534b"), true);
	assert.equal(writeControl(settings, taskStatusKey(id, "color"), "e5534b"), false);
	assert.equal(writeControl(settings, DRAW_STATUS_ICONS_KEY, true), true);
	assert.deepEqual(settings.taskStatuses.statuses[3], status(id, "c", "Dropped", true, "ban", "#e5534b", "other"));
	assert.equal(settings.taskStatuses.drawIcons, true);
	assert.equal(readControl(settings, taskStatusKey(id, "inCycle")), true);
	assert.equal(writeControl(settings, taskStatusKey("99", "name"), "Missing"), false);
});

test("a status shows its name and symbol, a list item has no checkbox, and invalid or repeated symbols warn and are skipped", () => {
	const statuses = [status("1", "x", "Done"), status("2", "", ""), status("3", "]", "Bad"), status("4", "x", "Again"), status("5", "?", " ")];
	assert.deepEqual(statuses.map(taskStatusLabel), ["Done [x]", "List item -", "Bad []]", "Again [x]", "Untitled status [?]"]);
	assert.deepEqual(
		statuses.map((entry) => taskStatusWarning(statuses, entry)),
		[undefined, undefined, "Enter one character other than ], or leave it empty for a list item.", "Another status already uses this symbol.", undefined],
	);
	assert.deepEqual(usableStatuses(statuses).map((entry) => entry.id), ["1", "2", "5"]);
});

test("the cycle holds only the statuses marked for it, in list order", () => {
	assert.deepEqual(cycleSymbols([status("1", " ", "", true), status("2", "-", ""), status("3", "", "", true), status("4", "x", "", true)]), [" ", "", "x"]);
	assert.equal(nextCycleSymbol([" ", "/", "x"], "x"), " ");
	assert.equal(nextCycleSymbol([" ", "/", "x"], "?"), " ");
	assert.equal(nextCycleSymbol([], " "), undefined);
});

test("a line's symbol is its checkbox character, empty for a plain list item, and missing for other text", () => {
	assert.equal(lineSymbol("- [/] Task"), "/");
	assert.equal(lineSymbol("> 1. Item"), "");
	assert.equal(lineSymbol("Paragraph"), undefined);
});

test("setting a symbol changes the checkbox, adds one to a list item, or removes it for a list item", () => {
	assert.equal(changed("- [ ] Task", symbolChange("- [ ] Task", "x")), "- [x] Task");
	assert.equal(changed("\t- Item", symbolChange("\t- Item", " ")), "\t- [ ] Item");
	assert.equal(changed("> - [x] Done", symbolChange("> - [x] Done", "")), "> - Done");
	assert.equal(changed("- [x]", symbolChange("- [x]", "")), "- ");
	assert.equal(symbolChange("- [x] Task", "x"), undefined);
	assert.equal(symbolChange("- Item", ""), undefined);
	assert.equal(symbolChange("Paragraph", "x"), undefined);
});

test("cycling moves a line to the next cycle status, through a plain list item when the cycle has one", () => {
	const cycle = ["", " ", "x"];
	assert.equal(changed("- Item", cycleChange(cycle, "- Item")), "- [ ] Item");
	assert.equal(changed("- [x] Done", cycleChange(cycle, "- [x] Done")), "- Done");
	assert.equal(changed("- [-] Dropped", cycleChange(cycle, "- [-] Dropped")), "- Dropped");
	assert.equal(cycleChange(cycle, "- [ ] Task", "x"), undefined);
	assert.equal(cycleChange(cycle, "Paragraph"), undefined);
});

test("cycling a note's content edits the expected line and leaves it alone when the line changed", () => {
	const content = "# Today\r\n- [ ] One\r\n- [/] Two\r\n";
	const cycle = (text: string) => cycleChange([" ", "/", "x"], text);
	assert.equal(changedContent(content, 2, "- [/] Two", cycle), "# Today\r\n- [ ] One\r\n- [x] Two\r\n");
	assert.equal(changedContent(content, 2, "- [/] Changed", cycle), content);
	assert.equal(changedContent(content, 9, "- [/] Two", cycle), content);
});

test("the status picker lists usable statuses, marks the current one and filters by typing", () => {
	const statuses = [status("1", " ", "Open"), status("2", "x", "Completed"), status("3", "", "")];
	assert.deepEqual(
		taskStatusChoices(statuses, "x", "").map((choice) => choice.label),
		["Open [ ]", "➡️ Completed [x]", "List item -"],
	);
	assert.deepEqual(
		taskStatusChoices(statuses, undefined, "cmp").map((choice) => choice.status.id),
		["2"],
	);
});

test("a new status takes the first suggested symbol not in use, outside the cycle", () => {
	const statuses = [status("1", " ", "Open"), status("2", "/", "In progress")];
	assert.deepEqual(newTaskStatus(statuses), status("3", "x", "Completed", false, "", "", "done"));
});

test("a status saved without a type gets the one its symbol implies", () => {
	assert.deepEqual(
		readTaskStatuses({ statuses: [{ symbol: " " }, { symbol: "X" }, { symbol: "/" }, { symbol: "-" }, { symbol: "i" }] }).statuses.map((entry) => entry.type),
		["todo", "done", "inProgress", "cancelled", "other"],
	);
});

test("the theme keeps drawing todo and done; in progress and cancelled get the standard look; other draws its chosen icon", () => {
	const statuses = [
		status("1", " ", "Open", true, "info"),
		status("2", "x", "Done", true, "info", "#123456"),
		status("3", "/", "In progress", true),
		status("4", "-", "Cancelled", true, "", "#e5534b"),
		status("5", "i", "Info", false, "info"),
		status("6", "?", "Question"),
		status("7", "", "List item", false, "info", "", "other"),
	];
	const icons: Record<string, string> = { info: '<svg viewBox="0 0 24 24" stroke="currentColor"><circle r="10"/></svg>' };
	assert.equal(statusIconCss({ cycleOnClick: false, drawIcons: false, statuses }, (icon) => icons[icon]), "");
	const css = statusIconCss({ cycleOnClick: false, drawIcons: true, statuses }, (icon) => icons[icon]);
	assert.doesNotMatch(css, /data-task=" "/);
	assert.doesNotMatch(css, /data-task="x"/);
	assert.match(css, /body input\.task-list-item-checkbox\[data-task="\/"\]/);
	assert.match(css, /body li\[data-task="-"\] > input\.task-list-item-checkbox::after/);
	assert.match(css, /background-color: #e5534b !important/);
	assert.match(css, /\.HyperMD-task-line\[data-task="-"\][^{]*\{\n\ttext-decoration: var\(--checklist-done-decoration\)/);
	assert.match(css, /data-task="i"/);
	assert.doesNotMatch(css, /data-task="\?"/);
	assert.doesNotMatch(css, /data-task=""/);
});

test("a Lucide icon becomes a mask that keeps its shape whatever the current colour", () => {
	assert.equal(maskSvg('<svg stroke="currentColor"></svg>'), '<svg xmlns="http://www.w3.org/2000/svg" stroke="black"></svg>');
});
