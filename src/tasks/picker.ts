import { t, tCount } from "../i18n/index.ts";
import { matchesInOrder, rowLabel } from "../render.ts";
import type { RowParts } from "../render";
import type { ResolvedDestination } from "./destinations.ts";
import { OPEN_STATUS, TASK_KEYS, keyBehavior } from "./taskCommand.ts";
import type { TaskAction, TaskCommand, TaskKey } from "./taskCommand.ts";
import type { TaskLine } from "./taskLines.ts";

export type TaskPickerAction = { action: "task"; task: TaskLine } | { action: "all"; tasks: TaskLine[] } | { action: "finish" } | { action: "cancel" };

export interface TaskChoice {
	label: string;
	parts: RowParts;
	action: TaskPickerAction;
}

export interface ActionChoice {
	label: string;
	parts: RowParts;
	action: TaskAction;
}

export interface DestinationChoice {
	label: string;
	parts: RowParts;
	destination: ResolvedDestination;
}

export type ActionPlan = { plan: "run"; destination?: ResolvedDestination } | { plan: "pick"; destinations: ResolvedDestination[] } | { plan: "none" };

const ALL_MARK = "⚡";

const FINISH_MARK = "🏁";

const CANCEL_MARK = "🛑";

export function taskText(task: TaskLine): string {
	return task.body.trim() || t("emptyTask");
}

export function taskChoices(command: TaskCommand, tasks: readonly TaskLine[], query: string, stagedCount = 0): TaskChoice[] {
	const matching = query ? tasks.filter((task) => matchesInOrder(query, taskText(task))) : [...tasks];
	const choices: TaskChoice[] = [];
	if (command.selectAll && matching.length > 1) {
		choices.push(choice({ mark: ALL_MARK, content: t("applyToAllTasks", { count: matching.length }) }, { action: "all", tasks: matching }));
	}
	for (const task of matching) choices.push(choice(taskParts(task), { action: "task", task }));
	if (command.batch) {
		choices.push(choice({ mark: FINISH_MARK, content: t("finishProcessing"), value: tCount("stagedChangeOne", "stagedChangeOther", stagedCount) }, { action: "finish" }));
		choices.push(choice({ mark: CANCEL_MARK, content: t("cancelTaskProcessing") }, { action: "cancel" }));
	}
	return choices;
}

export function choiceTargets(action: TaskPickerAction): TaskLine[] {
	if (action.action === "task") return [action.task];
	if (action.action === "all") return action.tasks;
	return [];
}

export function planAction(action: TaskAction, destinations: readonly ResolvedDestination[]): ActionPlan {
	if (action.kind === "status") return { plan: "run" };
	if (destinations.length === 0) return { plan: "none" };
	if (destinations.length === 1) return { plan: "run", destination: destinations[0] };
	return { plan: "pick", destinations: [...destinations] };
}

export function actionName(action: TaskAction): string {
	return action.label.trim() || t("untitledTaskAction");
}

export function actionChoices(actions: readonly TaskAction[], query: string): ActionChoice[] {
	const choices = actions.map((action) => {
		const parts: RowParts = { content: actionName(action) };
		return { label: rowLabel(parts), parts, action };
	});
	return query ? choices.filter((candidate) => matchesInOrder(query, candidate.label)) : choices;
}

export function destinationChoices(destinations: readonly ResolvedDestination[], query: string): DestinationChoice[] {
	const choices = destinations.map((destination) => {
		const parts: RowParts = destination.missing ? { content: destination.label, value: t("destinationCreated") } : { content: destination.label };
		return { label: rowLabel(parts), parts, destination };
	});
	return query ? choices.filter((candidate) => matchesInOrder(query, candidate.label)) : choices;
}

function taskParts(task: TaskLine): RowParts {
	const parts: RowParts = { content: taskText(task) };
	if (task.status !== OPEN_STATUS) parts.value = `[${task.status}]`;
	return parts;
}

function choice(parts: RowParts, action: TaskPickerAction): TaskChoice {
	return { label: rowLabel(parts), parts, action };
}

export interface KeyInstruction {
	command: string;
	purpose: string;
}

export function keyInstructions(command: TaskCommand, mac: boolean): KeyInstruction[] {
	const menuKey = MENU_HINT_ORDER.find((key) => keyBehavior(command, key).behavior === "menu");
	return TASK_KEYS.flatMap((key): KeyInstruction[] => {
		const behavior = keyBehavior(command, key);
		const symbol = taskKeySymbol(key, mac);
		if (behavior.behavior === "run") return [{ command: symbol, purpose: t("instructionApplyTaskAction", { action: actionName(behavior.action) }) }];
		if (behavior.behavior === "finish") return [{ command: symbol, purpose: t("instructionFinishProcessing") }];
		return key === menuKey ? [{ command: symbol, purpose: t("instructionTaskActionsMenu") }] : [];
	});
}

const MENU_HINT_ORDER: readonly TaskKey[] = ["enter", "alt-enter", "mod-enter", "shift-enter"];

const KEY_MODIFIERS: Record<TaskKey, { mac: string; other: string }> = {
	enter: { mac: "", other: "" },
	"mod-enter": { mac: "Cmd+", other: "Ctrl+" },
	"alt-enter": { mac: "Alt+", other: "Alt+" },
	"shift-enter": { mac: "Shift+", other: "Shift+" },
};

const KEY_SYMBOLS: Record<TaskKey, { mac: string; other: string }> = {
	enter: { mac: "↵", other: "↵" },
	"mod-enter": { mac: "⌘ ↵", other: "ctrl ↵" },
	"alt-enter": { mac: "⌥ ↵", other: "alt ↵" },
	"shift-enter": { mac: "⇧ ↵", other: "shift ↵" },
};

export function taskKeyLabel(key: TaskKey, mac: boolean): string {
	return (mac ? KEY_MODIFIERS[key].mac : KEY_MODIFIERS[key].other) + t("keyEnter");
}

export function taskKeySymbol(key: TaskKey, mac: boolean): string {
	return mac ? KEY_SYMBOLS[key].mac : KEY_SYMBOLS[key].other;
}

