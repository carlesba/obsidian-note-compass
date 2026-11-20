import { t } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import { CURRENT_NOTE_MARK, matchesInOrder, rowLabel } from "../render.ts";
import type { RowParts } from "../render.ts";
import { newNumericId } from "./taskCommand.ts";
import { parseTaskLine } from "./taskLines.ts";

export const BULLET_SYMBOL = "";

export interface TaskStatus {
	id: string;
	symbol: string;
	name: string;
	inCycle: boolean;
	type: TaskStatusType;
	icon: string;
	color: string;
}

export type TaskStatusType = "todo" | "inProgress" | "done" | "cancelled" | "other";

export const TASK_STATUS_TYPES: readonly TaskStatusType[] = ["todo", "inProgress", "done", "cancelled", "other"];

export interface TaskStatusSettings {
	cycleOnClick: boolean;
	drawIcons: boolean;
	statuses: TaskStatus[];
}

export type TaskStatusField = "symbol" | "name" | "inCycle" | "type" | "icon" | "color";

const THEME_DRAWN_TYPES: readonly TaskStatusType[] = ["todo", "done"];

const COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const SUGGESTED_STATUSES: readonly [string, TranslationKey, boolean, TaskStatusType, string][] = [
	[" ", "taskStatusOpen", true, "todo", ""],
	["/", "taskStatusInProgress", true, "inProgress", ""],
	["x", "taskStatusCompleted", true, "done", ""],
	["-", "taskStatusCancelled", true, "cancelled", ""],
	[">", "taskStatusMigrated", false, "other", "arrow-right"],
	["<", "taskStatusScheduled", false, "other", "calendar"],
];

export function typeForSymbol(symbol: string): TaskStatusType {
	return SUGGESTED_STATUSES.find(([suggested]) => suggested === symbol)?.[3] ?? (symbol === "X" ? "done" : "other");
}

export function isThemeDrawn(status: TaskStatus): boolean {
	return THEME_DRAWN_TYPES.includes(status.type);
}

const LIST_PATTERN = /^((?:[ \t]*>)*[ \t]*)([-*+]|\d+[.)])([ \t]+)/;

export function defaultTaskStatuses(): TaskStatusSettings {
	return {
		cycleOnClick: false,
		drawIcons: false,
		statuses: SUGGESTED_STATUSES.map(([symbol, name, inCycle, type, icon], index) => ({ id: String(index + 1), symbol, name: t(name), inCycle, type, icon, color: "" })),
	};
}

export function readTaskStatuses(stored: unknown): TaskStatusSettings {
	if (!isRecord(stored)) return defaultTaskStatuses();
	const statuses: TaskStatus[] = [];
	if (Array.isArray(stored.statuses)) {
		for (const entry of stored.statuses) {
			const status = readTaskStatus(entry, statuses);
			if (status) statuses.push(status);
		}
	}
	return {
		cycleOnClick: stored.cycleOnClick === true,
		drawIcons: stored.drawIcons === true,
		statuses: Array.isArray(stored.statuses) ? statuses : defaultTaskStatuses().statuses,
	};
}

function readTaskStatus(entry: unknown, known: readonly TaskStatus[]): TaskStatus | undefined {
	if (!isRecord(entry)) return undefined;
	const id = typeof entry.id === "string" && /^\d+$/.test(entry.id) && !known.some((status) => status.id === entry.id) ? entry.id : newNumericId(known);
	const symbol = typeof entry.symbol === "string" ? entry.symbol : BULLET_SYMBOL;
	return {
		id,
		symbol,
		name: typeof entry.name === "string" ? entry.name : "",
		inCycle: entry.inCycle === true,
		type: TASK_STATUS_TYPES.find((type) => type === entry.type) ?? typeForSymbol(symbol),
		icon: typeof entry.icon === "string" ? entry.icon : "",
		color: typeof entry.color === "string" && isColor(entry.color) ? entry.color : "",
	};
}

export function isColor(value: string): boolean {
	return COLOR_PATTERN.test(value);
}

export function isSymbol(value: string): boolean {
	return value === BULLET_SYMBOL || (value.length === 1 && !/[\n\r\]]/.test(value));
}

export function usableStatuses(statuses: readonly TaskStatus[]): TaskStatus[] {
	return statuses.filter((status, index) => isSymbol(status.symbol) && statuses.findIndex((other) => other.symbol === status.symbol) === index);
}

export function cycleSymbols(statuses: readonly TaskStatus[]): string[] {
	return usableStatuses(statuses)
		.filter((status) => status.inCycle)
		.map((status) => status.symbol);
}

export function taskStatusWarning(statuses: readonly TaskStatus[], status: TaskStatus): string | undefined {
	if (!isSymbol(status.symbol)) return t("statusSymbolInvalid");
	return statuses.find((other) => other.symbol === status.symbol) === status ? undefined : t("statusSymbolRepeated");
}

export function taskStatusName(status: TaskStatus): string {
	const name = status.name.trim();
	if (name !== "") return name;
	return status.symbol === BULLET_SYMBOL ? t("statusBullet") : t("untitledStatus");
}

export function taskStatusPreview(status: TaskStatus): string {
	return status.symbol === BULLET_SYMBOL ? "-" : `[${status.symbol}]`;
}

export function taskStatusLabel(status: TaskStatus): string {
	return `${taskStatusName(status)} ${taskStatusPreview(status)}`;
}

export function readTaskStatusField(status: TaskStatus, field: TaskStatusField): unknown {
	return status[field];
}

export function writeTaskStatusField(status: TaskStatus, field: TaskStatusField, value: unknown): boolean {
	if (field === "inCycle") {
		status.inCycle = value === true;
		return true;
	}
	if (field === "type") {
		const type = TASK_STATUS_TYPES.find((candidate) => candidate === value);
		if (type) status.type = type;
		return type !== undefined;
	}
	if (typeof value !== "string") return false;
	if (field === "color") {
		const color = value.trim();
		if (color !== "" && !isColor(color)) return false;
		status.color = color;
		return true;
	}
	status[field] = field === "symbol" ? [...value].slice(-1).join("") : value;
	return true;
}

export function newTaskStatus(statuses: readonly TaskStatus[]): TaskStatus {
	const unused = SUGGESTED_STATUSES.find(([symbol]) => !statuses.some((status) => status.symbol === symbol));
	return {
		id: newNumericId(statuses),
		symbol: unused?.[0] ?? "?",
		name: unused ? t(unused[1]) : "",
		inCycle: false,
		type: unused?.[3] ?? "other",
		icon: unused?.[4] ?? "",
		color: "",
	};
}

export interface LineChange {
	from: number;
	to: number;
	insert: string;
}

export function lineSymbol(text: string): string | undefined {
	const task = parseTaskLine(text, 0);
	if (task) return task.status;
	return LIST_PATTERN.test(text) ? BULLET_SYMBOL : undefined;
}

export function symbolChange(text: string, symbol: string): LineChange | undefined {
	const task = parseTaskLine(text, 0);
	if (task) {
		if (task.status === symbol) return undefined;
		if (symbol !== BULLET_SYMBOL) return { from: task.statusIndex, to: task.statusIndex + 1, insert: symbol };
		const closing = task.statusIndex + 2;
		const to = /[ \t]/.test(text[closing] ?? "") ? closing + 1 : closing;
		return { from: task.statusIndex - 1, to, insert: "" };
	}
	const list = LIST_PATTERN.exec(text);
	if (!list || symbol === BULLET_SYMBOL) return undefined;
	return { from: list[0].length, to: list[0].length, insert: `[${symbol}] ` };
}

export function nextCycleSymbol(cycle: readonly string[], current: string): string | undefined {
	if (cycle.length === 0) return undefined;
	const index = cycle.indexOf(current);
	return index < 0 ? cycle[0] : cycle[(index + 1) % cycle.length];
}

export function cycleChange(cycle: readonly string[], text: string, expectedSymbol?: string): LineChange | undefined {
	const current = lineSymbol(text);
	if (current === undefined || (expectedSymbol !== undefined && current !== expectedSymbol)) return undefined;
	const next = nextCycleSymbol(cycle, current);
	return next === undefined ? undefined : symbolChange(text, next);
}

export function applyLineChange(text: string, change: LineChange): string {
	return text.slice(0, change.from) + change.insert + text.slice(change.to);
}

export function changedContent(content: string, line: number, expected: string, change: (text: string) => LineChange | undefined): string {
	const lines = content.split("\n");
	const text = lines[line];
	if (text === undefined) return content;
	const ending = text.endsWith("\r") ? "\r" : "";
	const bare = text.slice(0, text.length - ending.length);
	const edit = bare === expected ? change(bare) : undefined;
	if (!edit) return content;
	lines[line] = applyLineChange(bare, edit) + ending;
	return lines.join("\n");
}

export interface TaskStatusChoice {
	label: string;
	parts: RowParts;
	status: TaskStatus;
}

export function taskStatusChoices(statuses: readonly TaskStatus[], current: string | undefined, query: string): TaskStatusChoice[] {
	const choices = usableStatuses(statuses).map((status) => {
		const name = taskStatusName(status);
		const parts: RowParts = { content: status.symbol === current ? `${CURRENT_NOTE_MARK} ${name}` : name, value: taskStatusPreview(status) };
		return { label: rowLabel(parts), parts, status };
	});
	return query ? choices.filter((choice) => matchesInOrder(query, choice.label)) : choices;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
