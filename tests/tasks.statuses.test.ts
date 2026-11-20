import { test } from "node:test";
import { strict as assert } from "node:assert";
import { defaultSettings, mergeSettings, storedSettings } from "../src/settings.ts";
import { CYCLE_ON_CLICK_KEY, DRAW_STATUS_ICONS_KEY, readControl, taskStatusKey, writeControl } from "../src/settings/controlKeys.ts";
import { heroiconSvg, statusIconCss } from "../src/tasks/statusIcons.ts";
import {
	applyLineChange,
	changedContent,
	clickCycleSymbols,
	convertsPlainLine,
	cursorAfterChange,
	cycleChange,
	cycleSymbols,
	lineSymbol,
	newTaskStatus,
	nextCycleSymbol,
	readIcon,
	readTaskStatuses,
	typeForSymbol,
	symbolChange,
	taskStatusChoices,
	taskStatusLabel,
	taskStatusWarning,
	usableStatuses,
} from "../src/tasks/taskStatuses.ts";
import type { StatusColor, TaskStatus, TaskStatusType } from "../src/tasks/taskStatuses.ts";

function status(id: string, symbol: string, name: string, inCycle = false, icon = "", color: StatusColor = "", type: TaskStatusType = typeForSymbol(symbol)): TaskStatus {
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
			[">", "Migrated", false, "other", "paper-airplane"],
			["<", "Scheduled", false, "other", "calendar"],
		],
	);
});

test("statuses keep their id, symbol, name and cycle mark through a save and reload, and broken entries are repaired", () => {
	const statuses = [status("4", "i", "Info", false, "information-circle", "blue"), status("7", "", "Note", true)];
	const settings = mergeSettings({ taskStatuses: { cycleOnClick: true, drawIcons: true, statuses } });
	assert.deepEqual(settings.taskStatuses, { cycleOnClick: true, drawIcons: true, statuses });
	assert.deepEqual(mergeSettings(JSON.parse(JSON.stringify(storedSettings(settings)))).taskStatuses, settings.taskStatuses);
	assert.deepEqual(readTaskStatuses({ statuses: [null, { id: "4", symbol: 3, color: "#e5534b" }, { id: "4", name: "Again" }] }).statuses, [
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
	assert.equal(writeControl(settings, taskStatusKey(id, "icon"), "no-symbol"), true);
	assert.equal(writeControl(settings, taskStatusKey(id, "icon"), "ban"), false);
	assert.equal(writeControl(settings, taskStatusKey(id, "color"), "red"), true);
	assert.equal(writeControl(settings, taskStatusKey(id, "color"), "#e5534b"), false);
	assert.equal(writeControl(settings, DRAW_STATUS_ICONS_KEY, true), true);
	assert.deepEqual(settings.taskStatuses.statuses[3], status(id, "c", "Dropped", true, "no-symbol", "red", "other"));
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
		status("1", " ", "Open", true, "information-circle"),
		status("2", "x", "Done", true, "information-circle", "accent"),
		status("3", "/", "In progress", true),
		status("4", "-", "Cancelled", true, "", "red"),
		status("5", "i", "Info", false, "information-circle"),
		status("6", "?", "Question"),
		status("7", "", "List item", false, "information-circle", "", "other"),
	];
	assert.equal(statusIconCss({ cycleOnClick: false, drawIcons: false, statuses }), "");
	const css = statusIconCss({ cycleOnClick: false, drawIcons: true, statuses });
	assert.doesNotMatch(css, /data-task=" "/);
	assert.doesNotMatch(css, /data-task="x"/);
	assert.match(css, /body input\.task-list-item-checkbox\[data-task="\/"\]/);
	assert.match(css, /body li\[data-task="-"\] > input\.task-list-item-checkbox::after/);
	assert.match(css, /background-color: var\(--color-red\) !important/);
	assert.match(css, /\.HyperMD-task-line\[data-task="-"\][^{]*\{\n\ttext-decoration: var\(--checklist-done-decoration\)/);
	assert.match(css, /data-task="i"/);
	assert.doesNotMatch(css, /data-task="\?"/);
	assert.doesNotMatch(css, /data-task=""/);
});

test("icons come from the bundled Heroicons, and icons saved from Obsidian's set move to their closest match or to the theme", () => {
	assert.equal(readIcon("paper-airplane"), "paper-airplane");
	assert.equal(readIcon("info"), "information-circle");
	assert.equal(readIcon("send-horizontal"), "paper-airplane");
	assert.equal(readIcon("calendar"), "calendar");
	assert.equal(readIcon("lucide-only-icon"), "");
	assert.equal(readIcon(3), "");
	assert.match(heroiconSvg("paper-airplane") ?? "", /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 20 20" fill="black"><path d="M3\.105/);
	assert.match(heroiconSvg("check-circle") ?? "", /fill-rule="evenodd" clip-rule="evenodd"/);
	assert.equal(heroiconSvg("missing"), undefined);
});

test("a plain or empty line becomes a list item or a task when the command converts it, keeping its indent and quote", () => {
	assert.equal(changed("", symbolChange("", " ", true)), "- [ ] ");
	assert.equal(changed("\tBuy milk", symbolChange("\tBuy milk", "", true)), "\t- Buy milk");
	assert.equal(changed("> Note", symbolChange("> Note", "x", true)), "> - [x] Note");
	assert.equal(symbolChange("Paragraph", " "), undefined);
	assert.equal(changed("", cycleChange(["", " ", "x"], "", undefined, true)), "- ");
	assert.equal(changed("Idea", cycleChange([" ", "x"], "Idea", undefined, true)), "- [ ] Idea");
	assert.equal(cycleChange([" ", "x"], "Idea"), undefined);
	assert.equal(cycleChange([], "", undefined, true), undefined);
});

test("a lone line converts even when empty, while a selection of several lines skips its blank ones", () => {
	assert.equal(convertsPlainLine("", 1), true);
	assert.equal(convertsPlainLine("   ", 3), false);
	assert.equal(convertsPlainLine("Text", 3), true);
});

test("the cursor stays with the text it was on after a status change", () => {
	assert.equal(cursorAfterChange(0, { from: 0, to: 0, insert: "- [ ] " }), 6);
	assert.equal(cursorAfterChange(9, { from: 3, to: 4, insert: "x" }), 9);
	assert.equal(cursorAfterChange(10, { from: 2, to: 6, insert: "" }), 6);
	assert.equal(cursorAfterChange(1, { from: 2, to: 6, insert: "" }), 1);
});

test("a click steps only through the cycle's checkbox statuses, so a task never loses its checkbox", () => {
	const statuses = [status("1", "", "List item", true), status("2", " ", "Open", true), status("3", "x", "Done", true), status("4", "-", "Cancelled")];
	assert.deepEqual(cycleSymbols(statuses), ["", " ", "x"]);
	assert.deepEqual(clickCycleSymbols(statuses), [" ", "x"]);
	assert.equal(changed("- [x] Done", cycleChange(clickCycleSymbols(statuses), "- [x] Done")), "- [ ] Done");
});
