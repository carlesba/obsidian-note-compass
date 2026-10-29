import { t } from "../i18n/index.ts";
import { PERIODS } from "../lists/dateNotes.ts";
import type { Period } from "../lists/dateNotes.ts";

export type CompletionDate = "off" | "text" | "link" | "timestamp";

export const COMPLETION_DATES: readonly CompletionDate[] = ["off", "text", "link", "timestamp"];

export type PeriodRelation = "this" | "next";

export const PERIOD_RELATIONS: readonly PeriodRelation[] = ["this", "next"];

export type TaskActionKind = "status" | "copy";

export const TASK_ACTION_KINDS: readonly TaskActionKind[] = ["status", "copy"];

export interface PeriodicDestination {
	kind: "periodic";
	period: Period;
	relation: PeriodRelation;
}

export interface NoteDestination {
	kind: "note";
	path: string;
}

export type Destination = PeriodicDestination | NoteDestination;

export interface StatusAction {
	id: string;
	label: string;
	kind: "status";
	status: string;
	completionDate: CompletionDate;
}

export interface CopyAction {
	id: string;
	label: string;
	kind: "copy";
	status: string;
	destinations: Destination[];
	mentionDestination: boolean;
	mentionSource: boolean;
	prefix: string;
	suffix: string;
}

export type TaskAction = StatusAction | CopyAction;

export interface TaskCommand {
	id: string;
	enabled: boolean;
	name: string;
	statuses: string;
	skippedStatuses: string;
	selectAll: boolean;
	batch: boolean;
	primary: string;
	actions: TaskAction[];
	unreadable?: { stored: unknown };
}

export const ACTIONS_MENU = "menu";

export const OPEN_STATUS = " ";

export function newNumericId(entries: readonly { id: string }[]): string {
	return String(Math.max(0, ...entries.map((entry) => Number(entry.id.match(/^\d+$/)?.[0] ?? 0))) + 1);
}

export function newStatusAction(actions: readonly TaskAction[], label = "", status = "x"): StatusAction {
	return { id: newNumericId(actions), label, kind: "status", status, completionDate: "off" };
}

export function newCopyAction(
	actions: readonly TaskAction[],
	label = "",
	status = ">",
	destinations: Destination[] = [],
	mentionSource = false,
): CopyAction {
	return {
		id: newNumericId(actions),
		label,
		kind: "copy",
		status,
		destinations,
		mentionDestination: true,
		mentionSource,
		prefix: "",
		suffix: "",
	};
}

export function newTaskCommand(commands: readonly TaskCommand[]): TaskCommand {
	const actions: TaskAction[] = [];
	const add = (action: TaskAction) => actions.push(action);
	add(newStatusAction(actions, t("taskActionComplete"), "x"));
	add(newStatusAction(actions, t("taskActionCancel"), "-"));
	add(
		newCopyAction(actions, t("taskActionMigrate"), ">", [
			periodicDestination("day", "next"),
			periodicDestination("week", "this"),
			periodicDestination("week", "next"),
		]),
	);
	add(
		newCopyAction(
			actions,
			t("taskActionSchedule"),
			"<",
			[
				periodicDestination("month", "this"),
				periodicDestination("month", "next"),
				periodicDestination("quarter", "this"),
				periodicDestination("quarter", "next"),
				periodicDestination("year", "this"),
				periodicDestination("year", "next"),
			],
			true,
		),
	);
	return {
		id: newNumericId(commands),
		enabled: true,
		name: t("defaultTaskCommandName"),
		statuses: OPEN_STATUS,
		skippedStatuses: "",
		selectAll: false,
		batch: true,
		primary: actions[0].id,
		actions,
	};
}

export function isRunnableTaskCommand(command: TaskCommand): boolean {
	return command.enabled && command.unreadable === undefined && command.actions.length > 0;
}

export function primaryAction(command: TaskCommand): TaskAction | undefined {
	if (command.primary === ACTIONS_MENU) return undefined;
	return command.actions.find((action) => action.id === command.primary) ?? command.actions[0];
}

export function secondaryActions(command: TaskCommand): TaskAction[] {
	const primary = primaryAction(command);
	return command.actions.filter((action) => action !== primary);
}

export function periodicDestination(period: Period, relation: PeriodRelation): PeriodicDestination {
	return { kind: "periodic", period, relation };
}

export function noteDestination(path = ""): NoteDestination {
	return { kind: "note", path };
}

export function uniqueStatuses(typed: string): string {
	return [...new Set(typed.split("").filter(isStatus))].join("");
}

export function readTaskCommands(stored: unknown): TaskCommand[] {
	if (!Array.isArray(stored)) return [];
	const storedIds = stored.filter(isRecord).map((entry) => ({ id: typeof entry.id === "string" ? entry.id : "" }));
	const commands: TaskCommand[] = [];
	for (const entry of stored) {
		const id =
			isRecord(entry) && typeof entry.id === "string" && /^\d+$/.test(entry.id) && !commands.some((command) => command.id === entry.id)
				? entry.id
				: newNumericId([...storedIds, ...commands]);
		commands.push(readTaskCommand(entry, id));
	}
	return commands;
}

export function storedTaskCommands(commands: readonly TaskCommand[]): unknown[] {
	return commands.map((command) => (command.unreadable ? command.unreadable.stored : withoutUnreadable(command)));
}

function withoutUnreadable(command: TaskCommand): TaskCommand {
	const stored = { ...command };
	delete stored.unreadable;
	return stored;
}

function readTaskCommand(entry: unknown, id: string): TaskCommand {
	const data = isRecord(entry) ? entry : {};
	const command: TaskCommand = {
		id,
		enabled: typeof data.enabled === "boolean" ? data.enabled : false,
		name: typeof data.name === "string" ? data.name : "",
		statuses: typeof data.statuses === "string" ? uniqueStatuses(data.statuses) : OPEN_STATUS,
		skippedStatuses: typeof data.skippedStatuses === "string" ? uniqueStatuses(data.skippedStatuses) : "",
		selectAll: data.selectAll === true,
		batch: typeof data.batch === "boolean" ? data.batch : true,
		primary: typeof data.primary === "string" ? data.primary : "",
		actions: [],
	};
	const actions = readActions(data.actions);
	if (!isRecord(entry) || actions === undefined) return { ...command, enabled: false, unreadable: { stored: entry } };
	const primary = actions.find((action) => action.id === command.primary) ?? actions[0];
	return { ...command, actions, primary: command.primary === ACTIONS_MENU ? ACTIONS_MENU : (primary?.id ?? "") };
}

function readActions(stored: unknown): TaskAction[] | undefined {
	if (stored === undefined) return [];
	if (!Array.isArray(stored)) return undefined;
	const actions: TaskAction[] = [];
	for (const entry of stored) {
		const action = readAction(entry, actions);
		if (!action) return undefined;
		actions.push(action);
	}
	return actions;
}

function readAction(entry: unknown, known: readonly TaskAction[]): TaskAction | undefined {
	if (!isRecord(entry) || !isStatus(entry.status)) return undefined;
	const id = typeof entry.id === "string" && /^\d+$/.test(entry.id) && !known.some((action) => action.id === entry.id) ? entry.id : newNumericId(known);
	const label = typeof entry.label === "string" ? entry.label : "";
	if (entry.kind === "status") {
		const completionDate = COMPLETION_DATES.find((candidate) => candidate === entry.completionDate) ?? "off";
		return { id, label, kind: "status", status: entry.status, completionDate };
	}
	if (entry.kind !== "copy") return undefined;
	return {
		id,
		label,
		kind: "copy",
		status: entry.status,
		destinations: Array.isArray(entry.destinations) ? readDestinations(entry.destinations) : readLegacyPeriodic(entry.periodic),
		mentionDestination: entry.mentionDestination === true,
		mentionSource: entry.mentionSource === true,
		prefix: typeof entry.prefix === "string" ? entry.prefix : "",
		suffix: typeof entry.suffix === "string" ? entry.suffix : "",
	};
}

function readDestinations(stored: readonly unknown[]): Destination[] {
	return stored.map(readDestination).filter((destination) => destination !== undefined);
}

function readDestination(stored: unknown): Destination | undefined {
	if (!isRecord(stored)) return undefined;
	if (stored.kind === "note") return typeof stored.path === "string" ? noteDestination(stored.path) : undefined;
	return stored.kind === "periodic" ? readPeriodicDestination(stored) : undefined;
}

function readPeriodicDestination(stored: Record<string, unknown>): PeriodicDestination | undefined {
	const period = PERIODS.find((candidate) => candidate === stored.period);
	const relation = PERIOD_RELATIONS.find((candidate) => candidate === stored.relation);
	return period && relation ? periodicDestination(period, relation) : undefined;
}

function readLegacyPeriodic(stored: unknown): Destination[] {
	if (!Array.isArray(stored)) return [];
	const chosen = stored.filter(isRecord).map(readPeriodicDestination);
	return PERIODS.flatMap((period) => PERIOD_RELATIONS.map((relation) => periodicDestination(period, relation))).filter((candidate) =>
		chosen.some((destination) => destination?.period === candidate.period && destination.relation === candidate.relation),
	);
}

export function isStatus(value: unknown): value is string {
	return typeof value === "string" && value.length === 1 && !/[\n\r\]]/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function taskCommandName(command: TaskCommand): string {
	return command.name.trim() || t("untitledTaskCommand");
}
