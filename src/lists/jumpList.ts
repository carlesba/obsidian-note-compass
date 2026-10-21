import type { JumpListSettings } from "../settings";
import { defaultDateNoteSettings, resolveDateNotes } from "./dateNotes.ts";
import type { DateNoteSettings, ResolvedDateNotes } from "./dateNotes.ts";
import { dateNoteSuffix, parseDateNote } from "./dates.ts";
import { matchesCustomList } from "./matchers.ts";
import { adjacentDateNotes, inboundNotes, outboundNotes, sameDayNotes } from "./sources.ts";
import type { ListedNote } from "./sources.ts";
import type { JumpListEntry, JumpListVault, VaultNote } from "./vault";

interface PrefixedList {
	prefix: string;
	notes: ListedNote[];
}

export function buildJumpList(
	settings: JumpListSettings,
	vault: JumpListVault,
	current?: VaultNote,
	dateNoteSettings: DateNoteSettings = defaultDateNoteSettings(),
): JumpListEntry[] {
	const dateNotes = resolveDateNotes(dateNoteSettings, vault);
	const lists: PrefixedList[] = [];
	if (current) {
		const { adjacentDays, linksOut, linksIn, sameDay } = settings.builtIns;
		if (adjacentDays.enabled) lists.push({ prefix: adjacentDays.prefix, notes: adjacentDateNotes(vault, current, dateNotes) });
		if (linksOut.enabled) lists.push({ prefix: linksOut.prefix, notes: outboundNotes(vault, current) });
		if (linksIn.enabled) lists.push({ prefix: linksIn.prefix, notes: inboundNotes(vault, current) });
		if (sameDay.enabled) lists.push({ prefix: sameDay.prefix, notes: sameDayNotes(vault, current, dateNotes) });
	}
	for (const list of settings.customLists) {
		const notes = vault
			.notes()
			.filter((note) => matchesCustomList(vault.frontmatter(note.path), list))
			.map((file) => ({ file }));
		lists.push({ prefix: list.prefix, notes });
	}

	const seen = new Set<string>(current ? [current.path] : []);
	const entries: JumpListEntry[] = [];
	for (const list of lists) {
		for (const listed of [...list.notes].sort(byName)) {
			if (seen.has(listed.file.path)) continue;
			seen.add(listed.file.path);
			entries.push(toEntry(vault, dateNotes, list.prefix, listed));
		}
	}
	return entries;
}

function toEntry(vault: JumpListVault, dateNotes: ResolvedDateNotes, prefix: string, listed: ListedNote): JumpListEntry {
	const name = listed.file.basename;
	const dateNote = parseDateNote(listed.file, dateNotes, vault.moment);
	const dateSuffix = dateNote ? dateNoteSuffix(dateNote) : undefined;
	const suffix = listed.direction && dateSuffix ? `${listed.direction} - ${dateSuffix}` : listed.direction ?? dateSuffix;
	return suffix ? { file: listed.file, prefix, name, suffix } : { file: listed.file, prefix, name };
}

function byName(a: ListedNote, b: ListedNote): number {
	if (a.file.basename < b.file.basename) return -1;
	return a.file.basename > b.file.basename ? 1 : 0;
}
