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
	today: MomentDate;
	dateNotes: ResolvedDateNotes;
	now?: MomentDate;
	templatesOptions?: unknown;
}

export interface SourcedTask extends TaskLine {
	source: VaultNote;
}

export interface ApplyResult {
	applied: number;
	skipped: number;
}

export function completionSuffix(action: StatusAction, context: ApplyContext, sourcePath: string): string {
	if (action.completionDate === "off") return "";
	const day = context.dateNotes.periods.day;
	const date = (action.completionDate === "timestamp" ? (context.now ?? context.today) : context.today).format(day.format);
	if (action.completionDate === "timestamp") return completionText(`${date} ${coreDatePlaceholder("time", undefined, context.now ?? context.today, context.templatesOptions)}`);
	if (action.completionDate === "text") return completionText(date);
	return completionText(wikiLink(context.vault.linkText(notePath(day.folder, date), sourcePath)));
}

export function statusEdit(task: TaskLine, status: string, suffix: string): LineEdit {
	return { line: task.line, expected: task.text, replacement: withSuffix(withStatus(task, status), suffix) };
}

export async function applyStatusAction(context: ApplyContext, action: StatusAction, tasks: readonly SourcedTask[]): Promise<ApplyResult> {
	let total: ApplyResult = { applied: 0, skipped: 0 };
	for (const [source, sourceTasks] of bySource(tasks)) {
		const suffix = completionSuffix(action, context, source.path);
		total = sum(total, await editSource(context, source, sourceTasks.map((task) => statusEdit(task, action.status, suffix))));
	}
	return total;
}

export async function applyCopyAction(
	context: ApplyContext,
	action: CopyAction,
	tasks: readonly SourcedTask[],
	destination: ResolvedDestination,
): Promise<ApplyResult> {
	let total: ApplyResult = { applied: 0, skipped: 0 };
	let target = destination;
	for (const [source, sourceTasks] of bySource(tasks)) {
		const result = await copyFromSource(context, action, source, sourceTasks, target);
		if (result.applied > 0) target = { path: target.path, label: target.label };
		total = sum(total, result);
	}
	return total;
}

async function copyFromSource(
	context: ApplyContext,
	action: CopyAction,
	source: VaultNote,
	tasks: readonly SourcedTask[],
	destination: ResolvedDestination,
): Promise<ApplyResult> {
	const { vault } = context;
	const lines = contentLines(await vault.readNote(source.path));
	const unchanged = tasks.filter((task) => lines[task.line] === task.text);
	const changed = tasks.length - unchanged.length;
	if (unchanged.length === 0) return { applied: 0, skipped: changed };
	if (destination.missing) await vault.createPeriodNote(destination.path, destination.missing.period, destination.missing.date, context.dateNotes.from);
	const sourceLink = action.mentionSource ? vault.linkText(source.path, destination.path) : undefined;
	await vault.processNote(destination.path, (content) => appendLines(content, unchanged.map((task) => copiedLine(task, sourceLink, action.prefix, action.suffix))));
	const suffix = action.mentionDestination ? destinationMention(vault.linkText(destination.path, source.path)) : "";
	const result = await editSource(context, source, unchanged.map((task) => statusEdit(task, action.status, suffix)));
	return { applied: result.applied, skipped: result.skipped + changed };
}

export interface TaskNote {
	note: VaultNote;
	lineNumbers: readonly number[];
}

export async function remainingTasks(vault: NoteBodyVault, notes: readonly TaskNote[], filter: StatusFilter): Promise<SourcedTask[]> {
	const tasks: SourcedTask[] = [];
	for (const { note, lineNumbers } of notes) {
		if (lineNumbers.length === 0) continue;
		for (const task of noteTasks(await vault.readNote(note.path), lineNumbers, filter)) tasks.push({ ...task, source: note });
	}
	return tasks;
}

function bySource<Task extends SourcedTask>(tasks: readonly Task[]): Map<VaultNote, Task[]> {
	const groups = new Map<string, { source: VaultNote; tasks: Task[] }>();
	for (const task of tasks) {
		const group = groups.get(task.source.path) ?? { source: task.source, tasks: [] };
		group.tasks.push(task);
		groups.set(task.source.path, group);
	}
	return new Map([...groups.values()].map((group) => [group.source, group.tasks]));
}

function sum(a: ApplyResult, b: ApplyResult): ApplyResult {
	return { applied: a.applied + b.applied, skipped: a.skipped + b.skipped };
}

async function editSource(context: ApplyContext, source: VaultNote, edits: readonly LineEdit[]): Promise<ApplyResult> {
	let result: ApplyResult = { applied: 0, skipped: edits.length };
	await context.vault.processNote(source.path, (content) => {
		const edited = applyLineEdits(content, edits);
		result = { applied: edited.applied.length, skipped: edited.skipped.length };
		return edited.content;
	});
	return result;
}

export interface StagedChange {
	source: VaultNote;
	edit: LineEdit;
	copy?: { destination: ResolvedDestination; text: string };
}

export interface TaskBatch {
	remaining: SourcedTask[];
	changes: StagedChange[];
}

export function taskKey(source: VaultNote, line: number): string {
	return `${source.path}\n${line}`;
}

export function stageChanges(batch: TaskBatch, changes: readonly StagedChange[]): TaskBatch {
	const staged = new Set(changes.map((change) => taskKey(change.source, change.edit.line)));
	return { remaining: batch.remaining.filter((task) => !staged.has(taskKey(task.source, task.line))), changes: [...batch.changes, ...changes] };
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

export function prepareChanges(context: ApplyContext, action: StatusAction | CopyAction, tasks: readonly SourcedTask[], destination?: ResolvedDestination): StagedChange[] {
	if (action.kind === "status") {
		return tasks.map((task) => ({ source: task.source, edit: statusEdit(task, action.status, completionSuffix(action, context, task.source.path)) }));
	}
	if (!destination) return [];
	return tasks.map((task) => {
		const suffix = action.mentionDestination ? destinationMention(context.vault.linkText(destination.path, task.source.path)) : "";
		const sourceLink = action.mentionSource ? context.vault.linkText(task.source.path, destination.path) : undefined;
		return { source: task.source, edit: statusEdit(task, action.status, suffix), copy: { destination, text: copiedLine(task, sourceLink, action.prefix, action.suffix) } };
	});
}

export interface FileChanges {
	path: string;
	edits: LineEdit[];
	appends: string[];
	destination?: ResolvedDestination;
}

export function groupChanges(changes: readonly StagedChange[]): FileChanges[] {
	const files = new Map<string, FileChanges>();
	for (const change of changes) {
		const file = files.get(change.source.path) ?? { path: change.source.path, edits: [], appends: [] };
		file.edits.push(change.edit);
		files.set(change.source.path, file);
	}
	addCopies(files, changes);
	return [...files.values()];
}

function groupCopies(changes: readonly StagedChange[]): FileChanges[] {
	return [...addCopies(new Map(), changes).values()];
}

function addCopies(files: Map<string, FileChanges>, changes: readonly StagedChange[]): Map<string, FileChanges> {
	for (const change of changes) {
		if (!change.copy) continue;
		const { destination, text } = change.copy;
		const file = files.get(destination.path) ?? { path: destination.path, edits: [], appends: [], destination };
		file.appends.push(text);
		files.set(destination.path, file);
	}
	return files;
}

export async function applyStagedChanges(context: ApplyContext, changes: readonly StagedChange[]): Promise<ApplyResult> {
	if (changes.length === 0) return { applied: 0, skipped: 0 };
	const accepted = new Set<StagedChange>();
	const written = new Set<StagedChange>();
	const sources = groupChanges(changes).filter((file) => file.edits.length > 0);
	for (const file of sources) {
		const fromHere = changes.filter((change) => change.source.path === file.path);
		await context.vault.processNote(file.path, (content) => {
			const edited = applyLineEdits(content, fromHere.map((change) => change.edit));
			const applied = new Set(edited.applied);
			for (const change of fromHere) if (applied.has(change.edit)) accepted.add(change);
			const copiesHere = changes.filter((change) => accepted.has(change) && !written.has(change) && change.copy?.destination.path === file.path);
			for (const change of copiesHere) written.add(change);
			return appendLines(edited.content, copiesHere.map((change) => change.copy!.text));
		});
	}
	const pending = changes.filter((change) => accepted.has(change) && !written.has(change));
	for (const file of groupCopies(pending)) {
		const missing = file.destination?.missing;
		if (missing) await context.vault.createPeriodNote(file.path, missing.period, missing.date, context.dateNotes.from);
		await context.vault.processNote(file.path, (content) => appendLines(content, file.appends));
	}
	return { applied: accepted.size, skipped: changes.length - accepted.size };
}
