import type { ListSource, NoteList } from "../settings";
import { propertyType } from "./conditions.ts";
import { defaultDateNoteSettings, resolveDateNotes } from "./dateNotes.ts";
import type { DateNoteSettings, ResolvedDateNotes } from "./dateNotes.ts";
import { dateNoteSuffix, parseDateNote } from "./dates.ts";
import { matchesCondition } from "./matchers.ts";
import {
	adjacentDateNotes,
	currentPeriodNotes,
	inboundNotes,
	notesInFolder,
	notesLinkingTo,
	notesModifiedSince,
	outboundNotes,
	sameDayNotes,
} from "./sources.ts";
import type { ListedNote } from "./sources.ts";
import type { JumpListEntry, JumpListVault, MomentDate, VaultNote } from "./vault";

interface PrefixedList {
	prefix: string;
	prefixColor?: string;
	notes: ListedNote[];
	keepsOrder: boolean;
}

interface ListContext {
	vault: JumpListVault;
	current?: VaultNote;
	dateNotes: ResolvedDateNotes;
	propertyTypes: Record<string, string>;
	today: MomentDate;
}

export function buildJumpList(
	noteLists: readonly NoteList[],
	vault: JumpListVault,
	current?: VaultNote,
	dateNoteSettings: DateNoteSettings = defaultDateNoteSettings(),
): JumpListEntry[] {
	const dateNotes = resolveDateNotes(dateNoteSettings, vault);
	const context: ListContext = {
		vault,
		current,
		dateNotes,
		propertyTypes: vault.propertyTypes(),
		today: vault.moment(vault.now()).startOf("day"),
	};
	const lists: PrefixedList[] = noteLists
		.filter((list) => list.enabled)
		.map((list) => ({
			prefix: list.prefix,
			prefixColor: list.prefixColor,
			notes: sourceNotes(list.source, context),
			keepsOrder: list.source.kind === "currentPeriods",
		}));

	const seen = new Set<string>(current ? [current.path] : []);
	const entries: JumpListEntry[] = [];
	for (const list of lists) {
		for (const listed of list.keepsOrder ? list.notes : [...list.notes].sort(byName)) {
			if (seen.has(listed.file.path)) continue;
			seen.add(listed.file.path);
			entries.push(toEntry(vault, dateNotes, list, listed));
		}
	}
	return entries;
}

function sourceNotes(source: ListSource, context: ListContext): ListedNote[] {
	const { vault, current, dateNotes } = context;
	if (source.kind === "frontmatter") {
		const check = { ...source, type: propertyType(context.propertyTypes, source.property), today: context.today };
		return vault
			.notes()
			.filter((note) => matchesCondition(vault.frontmatter(note.path), check))
			.map((file) => ({ file }));
	}
	if (source.kind === "linksToNote") return notesLinkingTo(vault, source.note);
	if (source.kind === "inFolder") return notesInFolder(vault, source.folder);
	if (source.kind === "modifiedToday") return notesModifiedSince(vault, context.today.valueOf());
	if (source.kind === "currentPeriods") return currentPeriodNotes(vault, source.periods, dateNotes, context.today);
	if (!current) return [];
	switch (source.kind) {
		case "adjacentDates":
			return adjacentDateNotes(vault, current, dateNotes);
		case "linksOut":
			return outboundNotes(vault, current);
		case "linksIn":
			return inboundNotes(vault, current);
		case "sameDay":
			return sameDayNotes(vault, current, dateNotes);
	}
}

function toEntry(vault: JumpListVault, dateNotes: ResolvedDateNotes, list: PrefixedList, listed: ListedNote): JumpListEntry {
	const name = listed.file.basename;
	const dateNote = parseDateNote(listed.file, dateNotes, vault.moment);
	const dateSuffix = dateNote ? dateNoteSuffix(dateNote) : undefined;
	const suffix = listed.direction && dateSuffix ? `${listed.direction} - ${dateSuffix}` : listed.direction ?? dateSuffix;
	const entry: JumpListEntry = { file: listed.file, prefix: list.prefix, name };
	if (list.prefixColor !== undefined) entry.prefixColor = list.prefixColor;
	if (suffix) entry.suffix = suffix;
	return entry;
}

function byName(a: ListedNote, b: ListedNote): number {
	if (a.file.basename < b.file.basename) return -1;
	return a.file.basename > b.file.basename ? 1 : 0;
}
