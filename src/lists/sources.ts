import type { Period, ResolvedDateNotes } from "./dateNotes.ts";
import { adjacentDatePaths, currentDatePath, isSameLocalDay, parseDateNote } from "./dates.ts";
import type { JumpListVault, MomentDate, VaultNote } from "./vault";

export interface ListedNote {
	file: VaultNote;
	direction?: string;
	missing?: Period;
}

export function adjacentDateNotes(vault: JumpListVault, current: VaultNote, dateNotes: ResolvedDateNotes): ListedNote[] {
	const dateNote = parseDateNote(current, dateNotes, vault.moment);
	if (!dateNote) return [];
	const adjacent = adjacentDatePaths(dateNote);
	const notes = vault.notes();
	const atPath = (path: string) => notes.find((note) => note.path === path);
	const listed: ListedNote[] = [];
	const next = atPath(adjacent.next);
	if (next) listed.push({ file: next, direction: adjacent.nextLabel });
	const previous = atPath(adjacent.previous);
	if (previous) listed.push({ file: previous, direction: adjacent.previousLabel });
	return listed;
}

const CURRENT_PERIOD_LABELS: Record<Period, string> = {
	day: "today",
	week: "this week",
	month: "this month",
	quarter: "this quarter",
	year: "this year",
};

export function currentPeriodNotes(
	vault: JumpListVault,
	periods: readonly Period[],
	dateNotes: ResolvedDateNotes,
	today: MomentDate,
): ListedNote[] {
	const notes = vault.notes();
	const listed: ListedNote[] = [];
	for (const period of periods) {
		const path = currentDatePath(dateNotes, period, today);
		if (path === undefined) continue;
		const file = notes.find((note) => note.path === path);
		if (file) listed.push({ file, direction: CURRENT_PERIOD_LABELS[period] });
		else listed.push({ file: unsavedNote(path), direction: `create ${CURRENT_PERIOD_LABELS[period]}`, missing: period });
	}
	return listed;
}

export function outboundNotes(vault: JumpListVault, current: VaultNote): ListedNote[] {
	return notesAtPaths(vault, vault.linksFrom(current.path));
}

export function inboundNotes(vault: JumpListVault, current: VaultNote): ListedNote[] {
	return notesAtPaths(vault, vault.linksTo(current.path));
}

export function sameDayNotes(vault: JumpListVault, current: VaultNote, dateNotes: ResolvedDateNotes): ListedNote[] {
	const dateNote = parseDateNote(current, dateNotes, vault.moment);
	const reference = dateNote?.period === "day" ? dateNote.date.valueOf() : current.ctime;
	return vault
		.notes()
		.filter((note) => isSameLocalDay(reference, note.ctime))
		.map((file) => ({ file }));
}

export function findNote(notes: readonly VaultNote[], note: string): VaultNote | undefined {
	return (
		notes.find((candidate) => candidate.path === note) ??
		notes.find((candidate) => candidate.path === `${note}.md`) ??
		notes.find((candidate) => candidate.basename === note)
	);
}

export function notesLinkingTo(vault: JumpListVault, note: string): ListedNote[] {
	const target = findNote(vault.notes(), note);
	return target ? notesAtPaths(vault, vault.linksTo(target.path)) : [];
}

export function notesInFolder(vault: JumpListVault, folder: string): ListedNote[] {
	const trimmed = folder.replace(/^\/+|\/+$/g, "");
	if (trimmed === "") return [];
	return vault
		.notes()
		.filter((note) => note.path.startsWith(`${trimmed}/`))
		.map((file) => ({ file }));
}

export function notesModifiedSince(vault: JumpListVault, since: number): ListedNote[] {
	return vault
		.notes()
		.filter((note) => vault.mtime(note.path) >= since)
		.map((file) => ({ file }));
}

function unsavedNote(path: string): VaultNote {
	return { path, basename: path.split("/").pop()?.replace(/\.md$/, "") ?? path, ctime: 0 };
}

function notesAtPaths(vault: JumpListVault, paths: string[]): ListedNote[] {
	const wanted = new Set(paths);
	return vault
		.notes()
		.filter((note) => wanted.has(note.path))
		.map((file) => ({ file }));
}
