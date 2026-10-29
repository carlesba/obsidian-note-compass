import { t, tCount } from "../i18n/index.ts";
import { matchesInOrder, rowLabel } from "../render.ts";
import type { RowParts } from "../render";
import type { ResolvedDestination } from "./destinations.ts";
import { OPEN_STATUS, primaryAction, secondaryActions } from "./taskCommand.ts";
import type { TaskAction, TaskCommand } from "./taskCommand.ts";
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

const ALL_MARK = "☑️";

const FINISH_MARK = "🏁";

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
		choices.push(choice({ content: t("cancelTaskProcessing") }, { action: "cancel" }));
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

export function taskSelectionPlan(command: TaskCommand): { plan: "run"; action: TaskAction } | { plan: "menu"; actions: TaskAction[] } {
	const primary = primaryAction(command);
	return primary ? { plan: "run", action: primary } : { plan: "menu", actions: secondaryActions(command) };
}
