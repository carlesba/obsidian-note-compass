import { coreDatePlaceholder } from "../forms/newNotes.ts";
import type { ResolvedDateNotes } from "../lists/dateNotes.ts";
import { notePath } from "../lists/dates.ts";
import type { MomentDate, NoteBodyVault, VaultNote } from "../lists/vault";
import type { ResolvedDestination } from "./destinations.ts";
import type { CopyAction, StatusAction } from "./taskCommand.ts";
import {
	appendLines,
	applyLineEdits,
	completionText,
	contentLines,
	copiedLine,
	destinationMention,
	noteTasks,
	withStatus,
	withSuffix,
	wikiLink,
} from "./taskLines.ts";
import type { LineEdit, StatusFilter, TaskLine } from "./taskLines.ts";

export interface ApplyContext {
	vault: NoteBodyVault;
	source: VaultNote;
	today: MomentDate;
	dateNotes: ResolvedDateNotes;
	now?: MomentDate;
	templatesOptions?: unknown;
}

export interface ApplyResult {
	applied: number;
	skipped: number;
}

export function completionSuffix(action: StatusAction, context: ApplyContext): string {
	if (action.completionDate === "off") return "";
	const day = context.dateNotes.periods.day;
	const date = (action.completionDate === "timestamp" ? (context.now ?? context.today) : context.today).format(day.format);
	if (action.completionDate === "timestamp") return completionText(`${date} ${coreDatePlaceholder("time", undefined, context.now ?? context.today, context.templatesOptions)}`);
	if (action.completionDate === "text") return completionText(date);
	return completionText(wikiLink(context.vault.linkText(notePath(day.folder, date), context.source.path)));
}

export function statusEdit(task: TaskLine, status: string, suffix: string): LineEdit {
	return { line: task.line, expected: task.text, replacement: withSuffix(withStatus(task, status), suffix) };
}

export async function applyStatusAction(context: ApplyContext, action: StatusAction, tasks: readonly TaskLine[]): Promise<ApplyResult> {
	const suffix = completionSuffix(action, context);
	return editSource(context, tasks.map((task) => statusEdit(task, action.status, suffix)));
}

export async function applyCopyAction(
	context: ApplyContext,
	action: CopyAction,
	tasks: readonly TaskLine[],
	destination: ResolvedDestination,
): Promise<ApplyResult> {
	const { vault, source } = context;
	const lines = contentLines(await vault.readNote(source.path));
	const unchanged = tasks.filter((task) => lines[task.line] === task.text);
	const changed = tasks.length - unchanged.length;
	if (unchanged.length === 0) return { applied: 0, skipped: changed };
	if (destination.missing) await vault.createPeriodNote(destination.path, destination.missing.period, destination.missing.date, context.dateNotes.from);
	const sourceLink = action.mentionSource ? vault.linkText(source.path, destination.path) : undefined;
	await vault.processNote(destination.path, (content) => appendLines(content, unchanged.map((task) => copiedLine(task, sourceLink, action.prefix, action.suffix))));
	const suffix = action.mentionDestination ? destinationMention(vault.linkText(destination.path, source.path)) : "";
	const result = await editSource(context, unchanged.map((task) => statusEdit(task, action.status, suffix)));
	return { applied: result.applied, skipped: result.skipped + changed };
}

export async function remainingTasks(vault: NoteBodyVault, source: VaultNote, lineNumbers: readonly number[], filter: StatusFilter): Promise<TaskLine[]> {
	return noteTasks(await vault.readNote(source.path), lineNumbers, filter);
}

async function editSource(context: ApplyContext, edits: readonly LineEdit[]): Promise<ApplyResult> {
	let result: ApplyResult = { applied: 0, skipped: edits.length };
	await context.vault.processNote(context.source.path, (content) => {
		const edited = applyLineEdits(content, edits);
		result = { applied: edited.applied.length, skipped: edited.skipped.length };
		return edited.content;
	});
	return result;
}

export interface StagedChange {
	edit: LineEdit;
	copy?: { destination: ResolvedDestination; text: string };
}

export interface TaskBatch {
	remaining: TaskLine[];
	changes: StagedChange[];
}

export function stageChanges(batch: TaskBatch, changes: readonly StagedChange[]): TaskBatch {
	const lines = new Set(changes.map((change) => change.edit.line));
	return { remaining: batch.remaining.filter((task) => !lines.has(task.line)), changes: [...batch.changes, ...changes] };
}

export function shouldFinishBatch(batch: TaskBatch, selectedAll = false): boolean {
	return selectedAll || batch.remaining.length === 0;
}

export function finishBatch(batch: TaskBatch): StagedChange[] {
	return [...batch.changes];
}

export function cancelBatch(batch: TaskBatch): TaskBatch {
	return { remaining: [...batch.remaining], changes: [] };
}

export function prepareChanges(context: ApplyContext, action: StatusAction | CopyAction, tasks: readonly TaskLine[], destination?: ResolvedDestination): StagedChange[] {
	if (action.kind === "status") return tasks.map((task) => ({ edit: statusEdit(task, action.status, completionSuffix(action, context)) }));
	if (!destination) return [];
	const suffix = action.mentionDestination ? destinationMention(context.vault.linkText(destination.path, context.source.path)) : "";
	const sourceLink = action.mentionSource ? context.vault.linkText(context.source.path, destination.path) : undefined;
	return tasks.map((task) => ({ edit: statusEdit(task, action.status, suffix), copy: { destination, text: copiedLine(task, sourceLink, action.prefix, action.suffix) } }));
}

export interface FileChanges {
	path: string;
	edits: LineEdit[];
	appends: string[];
	destination?: ResolvedDestination;
}

export function groupChanges(sourcePath: string, changes: readonly StagedChange[]): FileChanges[] {
	if (changes.length === 0) return [];
	const files = new Map<string, FileChanges>();
	files.set(sourcePath, { path: sourcePath, edits: changes.map((change) => change.edit), appends: [] });
	for (const change of changes) {
		if (!change.copy) continue;
		const { destination, text } = change.copy;
		const file = files.get(destination.path) ?? { path: destination.path, edits: [], appends: [], destination };
		file.appends.push(text);
		files.set(destination.path, file);
	}
	return [...files.values()];
}

export async function applyStagedChanges(context: ApplyContext, changes: readonly StagedChange[]): Promise<ApplyResult> {
	if (changes.length === 0) return { applied: 0, skipped: 0 };
	let accepted: StagedChange[] = [];
	await context.vault.processNote(context.source.path, (content) => {
		const edited = applyLineEdits(content, changes.map((change) => change.edit));
		const applied = new Set(edited.applied);
		accepted = changes.filter((change) => applied.has(change.edit));
		const ownCopies = accepted.filter((change) => change.copy?.destination.path === context.source.path).map((change) => change.copy!.text);
		return appendLines(edited.content, ownCopies);
	});
	for (const file of groupChanges(context.source.path, accepted)) {
		if (file.path === context.source.path) continue;
		const missing = file.destination?.missing;
		if (missing) await context.vault.createPeriodNote(file.path, missing.period, missing.date, context.dateNotes.from);
		await context.vault.processNote(file.path, (content) => appendLines(content, file.appends));
	}
	return { applied: accepted.length, skipped: changes.length - accepted.length };
}
