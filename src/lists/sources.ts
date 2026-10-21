import { adjacentDateNames, dayFromName, isDateNote, isSameLocalDay } from "./dates.ts";
import type { JumpListVault, VaultNote } from "./vault";

export interface ListedNote {
	file: VaultNote;
	direction?: string;
}

export function adjacentDateNotes(vault: JumpListVault, current: VaultNote): ListedNote[] {
	if (!isDateNote(current, vault.frontmatter(current.path))) return [];
	const adjacent = adjacentDateNames(current.basename);
	if (!adjacent) return [];
	const notes = vault.notes();
	const byBasename = (basename: string) => notes.find((note) => note.basename === basename);
	const listed: ListedNote[] = [];
	const next = byBasename(adjacent.next);
	if (next) listed.push({ file: next, direction: adjacent.nextLabel });
	const previous = byBasename(adjacent.previous);
	if (previous) listed.push({ file: previous, direction: adjacent.previousLabel });
	return listed;
}

export function outboundNotes(vault: JumpListVault, current: VaultNote): ListedNote[] {
	return notesAtPaths(vault, vault.linksFrom(current.path));
}

export function inboundNotes(vault: JumpListVault, current: VaultNote): ListedNote[] {
	return notesAtPaths(vault, vault.linksTo(current.path));
}

export function sameDayNotes(vault: JumpListVault, current: VaultNote): ListedNote[] {
	const reference = isDateNote(current, vault.frontmatter(current.path))
		? dayFromName(current.basename) ?? current.ctime
		: current.ctime;
	return vault
		.notes()
		.filter((note) => isSameLocalDay(reference, note.ctime))
		.map((file) => ({ file }));
}

function notesAtPaths(vault: JumpListVault, paths: string[]): ListedNote[] {
	const wanted = new Set(paths);
	return vault
		.notes()
		.filter((note) => wanted.has(note.path))
		.map((file) => ({ file }));
}
