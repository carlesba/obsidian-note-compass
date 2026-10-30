import { t, translatedLabels } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import { PERIODS } from "../lists/dateNotes.ts";
import type { Period } from "../lists/dateNotes.ts";
import type { VaultNote } from "../lists/vault";
import { noteDestinationTarget, periodicDestinationName } from "../tasks/destinations.ts";
import { actionName, taskKeyLabel } from "../tasks/picker.ts";
import {
	ACTIONS_MENU,
	COMPLETION_DATES,
	FINISH_PROCESSING,
	TASK_KEYS,
	PERIOD_RELATIONS,
	TASK_ACTION_KINDS,
	isStatus,
	newNumericId,
	newStatusAction,
	noteDestination,
	periodicDestination,
	uniqueStatuses,
} from "../tasks/taskCommand.ts";
import type {
	CompletionDate,
	CopyAction,
	Destination,
	PeriodRelation,
	TaskAction,
	TaskActionKind,
	TaskCommand,
	TaskKey,
	TaskKeyBinding,
} from "../tasks/taskCommand.ts";

export type TaskCommandSetting = "enabled" | "name" | "statuses" | "skippedStatuses" | "selectAll" | "batch" | "bindingKey" | "bindingAction";

export type TaskActionSetting =
	| "prefix"
	| "suffix"
	| "label"
	| "kind"
	| "status"
	| "completionDate"
	| "destination"
	| "destinationNote"
	| "mentionDestination"
	| "mentionSource";

const TASK_COMMAND_SETTINGS: readonly TaskCommandSetting[] = ["enabled", "name", "statuses", "skippedStatuses", "selectAll", "batch", "bindingKey", "bindingAction"];

export const NOTE_DESTINATION_OPTION = "note";

const KIND_KEYS: Record<TaskActionKind, TranslationKey> = {
	status: "taskActionKindStatus",
	copy: "taskActionKindCopy",
};

const COMPLETION_DATE_KEYS: Record<CompletionDate, TranslationKey> = {
	off: "completionDateOff",
	text: "completionDateText",
	link: "completionDateLink",
	timestamp: "completionDateTimestamp",
};

export function taskActionKindOptions(): Record<TaskActionKind, string> {
	return translatedLabels(KIND_KEYS);
}

export function completionDateOptions(): Record<CompletionDate, string> {
	return translatedLabels(COMPLETION_DATE_KEYS);
}

export function taskActionKindLabel(kind: TaskActionKind): string {
	return t(KIND_KEYS[kind]);
}

export function periodicOption(period: Period, relation: PeriodRelation): string {
	return `${period}-${relation}`;
}

export function destinationOption(destination: Destination): string {
	return destination.kind === "note" ? NOTE_DESTINATION_OPTION : periodicOption(destination.period, destination.relation);
}

export function destinationOptions(): Record<string, string> {
	const options: Record<string, string> = {};
	for (const period of PERIODS) {
		for (const relation of PERIOD_RELATIONS) options[periodicOption(period, relation)] = periodicDestinationName(period, relation);
	}
	options[NOTE_DESTINATION_OPTION] = t("destinationSpecificNote");
	return options;
}

function destinationFromOption(option: unknown, current: Destination | undefined): Destination | undefined {
	if (option === NOTE_DESTINATION_OPTION) return current?.kind === "note" ? current : noteDestination();
	const [periodText, relationText] = typeof option === "string" ? option.split("-") : [];
	const period = PERIODS.find((candidate) => candidate === periodText);
	const relation = PERIOD_RELATIONS.find((candidate) => candidate === relationText);
	return period && relation ? periodicDestination(period, relation) : undefined;
}

export function destinationNoteWarning(path: string, notes: readonly VaultNote[]): string | undefined {
	if (path.trim() === "") return t("taskDestinationNoteRequired");
	return noteDestinationTarget(notes, path) ? undefined : t("taskDestinationNoteMissing");
}

export function keyBindingKeyOptions(command: TaskCommand, index: number, mac: boolean): [TaskKey, string][] {
	const own = command.keymap[index]?.key;
	return TASK_KEYS.filter((key) => key === own || !command.keymap.some((binding) => binding.key === key)).map((key) => [key, taskKeyLabel(key, mac)]);
}

export function keyBindingActionOptions(command: TaskCommand, index: number): [string, string][] {
	const own = command.keymap[index]?.action;
	const options: [string, string][] = [[ACTIONS_MENU, t("showTaskActionsMenu")], ...command.actions.map((action): [string, string] => [action.id, actionName(action)])];
	if (command.batch || own === FINISH_PROCESSING) options.push([FINISH_PROCESSING, `🏁 ${t("finishProcessing")}`]);
	if (own !== undefined && !options.some(([id]) => id === own)) options.push([own, t("taskKeyMissingActionOption")]);
	return options;
}

export function keyBindingWarning(command: TaskCommand, index: number): string | undefined {
	const binding = command.keymap[index];
	if (!binding) return undefined;
	if (command.keymap.findIndex((candidate) => candidate.key === binding.key) !== index) return t("taskKeyDuplicate");
	if (binding.action === FINISH_PROCESSING) return command.batch ? undefined : t("taskKeyNeedsBatch");
	if (binding.action === ACTIONS_MENU) return undefined;
	return command.actions.some((action) => action.id === binding.action) ? undefined : t("taskKeyMissingAction");
}

export function addKeyBinding(command: TaskCommand): TaskKeyBinding | undefined {
	const key = TASK_KEYS.find((candidate) => !command.keymap.some((binding) => binding.key === candidate));
	if (!key) return undefined;
	const binding = { key, action: command.actions[0]?.id ?? ACTIONS_MENU };
	command.keymap.push(binding);
	return binding;
}

export function deleteKeyBinding(command: TaskCommand, index: number): void {
	command.keymap.splice(index, 1);
}

export function taskActionWarning(action: TaskAction): string | undefined {
	if (action.kind === "copy" && action.destinations.length === 0) return t("taskActionNeedsDestination");
	return undefined;
}

export function taskCommandWarning(command: TaskCommand): string | undefined {
	if (command.unreadable) return t("unreadableTaskCommandWarning");
	if (command.actions.length === 0) return t("taskCommandNeedsAction");
	if (command.actions.some((action) => taskActionWarning(action) !== undefined)) return t("taskActionsNeedAttention");
	if (command.keymap.some((_binding, index) => keyBindingWarning(command, index) !== undefined)) return t("taskKeymapNeedsAttention");
	return undefined;
}

export function findTaskCommand(commands: readonly TaskCommand[], id: string): TaskCommand | undefined {
	return commands.find((command) => command.id === id && !command.unreadable);
}

export function findTaskAction(command: TaskCommand, id: string): TaskAction | undefined {
	return command.actions.find((action) => action.id === id);
}

function bindingAt(command: TaskCommand, index: string | undefined): TaskKeyBinding | undefined {
	return index !== undefined && /^\d+$/.test(index) ? command.keymap[Number(index)] : undefined;
}

export function readTaskCommandSetting(command: TaskCommand, setting: TaskCommandSetting, index?: string): unknown {
	if (!TASK_COMMAND_SETTINGS.includes(setting)) return undefined;
	if (setting === "bindingKey") return bindingAt(command, index)?.key;
	if (setting === "bindingAction") return bindingAt(command, index)?.action;
	return command[setting];
}

export function writeTaskCommandSetting(command: TaskCommand, setting: TaskCommandSetting, value: unknown, index?: string): boolean {
	if (command.unreadable || !TASK_COMMAND_SETTINGS.includes(setting)) return false;
	const text = typeof value === "string" ? value : "";
	if (setting === "bindingKey" || setting === "bindingAction") return writeKeyBinding(command, setting, value, index);
	if (setting === "name") command.name = text;
	else if (setting === "statuses" || setting === "skippedStatuses") command[setting] = uniqueStatuses(text);
	else command[setting] = value === true;
	return true;
}

function writeKeyBinding(command: TaskCommand, setting: "bindingKey" | "bindingAction", value: unknown, index: string | undefined): boolean {
	const binding = bindingAt(command, index);
	if (!binding) return false;
	if (setting === "bindingKey") {
		const key = TASK_KEYS.find((candidate) => candidate === value);
		if (!key || command.keymap.some((other) => other !== binding && other.key === key)) return false;
		binding.key = key;
		return true;
	}
	const known = value === ACTIONS_MENU || value === FINISH_PROCESSING || command.actions.some((action) => action.id === value);
	if (!known || typeof value !== "string") return false;
	binding.action = value;
	return true;
}

export function readTaskActionSetting(command: TaskCommand, action: TaskAction, setting: TaskActionSetting, index?: string): unknown {
	switch (setting) {
		case "label":
			return action.label;
		case "kind":
			return action.kind;
		case "status":
			return action.status;
		case "completionDate":
			return action.kind === "status" ? action.completionDate : undefined;
		case "destination": {
			const destination = destinationAt(action, index);
			return destination ? destinationOption(destination) : undefined;
		}
		case "destinationNote": {
			const destination = destinationAt(action, index);
			return destination?.kind === "note" ? destination.path : undefined;
		}
		case "prefix":
		case "suffix":
		case "mentionDestination":
		case "mentionSource":
			return action.kind === "copy" ? action[setting] : undefined;
	}
}

export function writeTaskActionSetting(
	command: TaskCommand,
	action: TaskAction,
	setting: TaskActionSetting,
	value: unknown,
	index?: string,
): boolean {
	switch (setting) {
		case "label":
			action.label = typeof value === "string" ? value : "";
			return true;
		case "kind": {
			const kind = TASK_ACTION_KINDS.find((candidate) => candidate === value);
			if (!kind) return false;
			changeKind(action, kind);
			return true;
		}
		case "status":
			if (!isStatus(value)) return false;
			action.status = value;
			return true;
		case "completionDate": {
			const completionDate = COMPLETION_DATES.find((candidate) => candidate === value);
			if (action.kind !== "status" || !completionDate) return false;
			action.completionDate = completionDate;
			return true;
		}
		case "destination": {
			const position = destinationPosition(action, index);
			const destination = action.kind === "copy" && position !== undefined ? destinationFromOption(value, action.destinations[position]) : undefined;
			if (action.kind !== "copy" || position === undefined || !destination) return false;
			action.destinations[position] = destination;
			return true;
		}
		case "destinationNote": {
			const destination = destinationAt(action, index);
			if (destination?.kind !== "note" || typeof value !== "string") return false;
			destination.path = value.trim();
			return true;
		}
		case "prefix":
		case "suffix":
			if (action.kind !== "copy" || typeof value !== "string") return false;
			action[setting] = value;
			return true;
		case "mentionDestination":
		case "mentionSource":
			if (action.kind !== "copy") return false;
			action[setting] = value === true;
			return true;
	}
}

function destinationPosition(action: TaskAction, index: string | undefined): number | undefined {
	if (action.kind !== "copy" || index === undefined || !/^\d+$/.test(index)) return undefined;
	const position = Number(index);
	return position < action.destinations.length ? position : undefined;
}

function destinationAt(action: TaskAction, index: string | undefined): Destination | undefined {
	const position = destinationPosition(action, index);
	return action.kind === "copy" && position !== undefined ? action.destinations[position] : undefined;
}

export function addTaskDestination(action: CopyAction): void {
	action.destinations.push(periodicDestination("day", "this"));
}

export function removeTaskDestination(action: CopyAction, index: number): void {
	action.destinations.splice(index, 1);
}

export function moveTaskDestination(action: CopyAction, from: number, to: number): void {
	action.destinations.splice(to, 0, ...action.destinations.splice(from, 1));
}

function changeKind(action: TaskAction, kind: TaskActionKind): void {
	if (action.kind === kind) return;
	const fields = action as unknown as Record<string, unknown>;
	if (kind === "status") {
		for (const key of ["destinations", "mentionDestination", "mentionSource", "prefix", "suffix"]) delete fields[key];
		Object.assign(fields, { kind, completionDate: "off" });
		return;
	}
	delete fields.completionDate;
	Object.assign(fields, { kind, destinations: [], mentionDestination: true, mentionSource: false, prefix: "", suffix: "" });
}

export function addTaskAction(command: TaskCommand): TaskAction {
	const action = newStatusAction(command.actions);
	command.actions.push(action);
	return action;
}

export function deleteTaskAction(command: TaskCommand, index: number): TaskAction | undefined {
	const [removed] = command.actions.splice(index, 1);
	if (removed) command.keymap = command.keymap.filter((binding) => binding.action !== removed.id);
	return removed;
}

export function moveTaskAction(command: TaskCommand, from: number, to: number): void {
	command.actions.splice(to, 0, ...command.actions.splice(from, 1));
}

export function duplicatedActionId(command: TaskCommand): string {
	return newNumericId(command.actions);
}

const STATUS_KEYS: readonly [string, TranslationKey][] = [
	[" ", "taskStatusOpen"],
	["x", "taskStatusCompleted"],
	["-", "taskStatusCancelled"],
	[">", "taskStatusMigrated"],
	["<", "taskStatusScheduled"],
	["/", "taskStatusInProgress"],
];

export function statusLabel(status: string): string {
	const predefined = STATUS_KEYS.find(([character]) => character === status);
	return predefined ? `${t(predefined[1])} [${status}]` : `[${status}]`;
}

export function availableStatuses(chosen: string): [string, string][] {
	return STATUS_KEYS.filter(([status]) => !chosen.includes(status)).map(([status]) => [status, statusLabel(status)]);
}

export function addStatus(chosen: string, status: string): string {
	return isStatus(status) && !chosen.includes(status) ? chosen + status : chosen;
}

export function removeStatus(chosen: string, status: string): string {
	return chosen.split("").filter((character) => character !== status).join("");
}
