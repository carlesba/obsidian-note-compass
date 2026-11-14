import { adjacentEntriesInOrder, currentPeriodsInOrder, showsMissingNotes } from "../settings.ts";
import type { ListSource, NoteList } from "../settings";
import { defaultDateNoteSettings, resolveDateNotes } from "./dateNotes.ts";
import type { DateNoteSettings, ResolvedDateNotes } from "./dateNotes.ts";
import { dateNoteSuffix, parseDateNote } from "./dates.ts";
import { emptyFilter, filterNotes, noteMatcher } from "./filters.ts";
import type { FilterGroup } from "./filters.ts";
import {
	adjacentDateNotes,
	currentPeriodNotes,
	inboundNotes,
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
	pickerFilter: FilterGroup = emptyFilter(),
	currentNote: "hidden" | "marked" = "hidden",
): JumpListEntry[] {
	const context = listContext(vault, current, dateNoteSettings);
	const { dateNotes } = context;
	const matchesPicker = noteMatcher(pickerFilter, context);
	const lists: PrefixedList[] = noteLists
		.filter((list) => list.source.kind !== "unreadable")
		.map((list) => ({
			prefix: list.prefix,
			prefixColor: list.prefixColor,
			notes: sourceNotes(list.source, context).filter((listed) => matchesPicker(listed.file)),
			keepsOrder: keepsOrder(list.source),
		}));

	const entries: JumpListEntry[] = [];
	for (const list of lists) {
		const seen = new Set<string>(current && currentNote === "hidden" ? [current.path] : []);
		for (const listed of list.keepsOrder ? list.notes : [...list.notes].sort(byName)) {
			if (seen.has(listed.file.path)) continue;
			seen.add(listed.file.path);
			const entry = toEntry(vault, dateNotes, list, listed);
			if (listed.file.path === current?.path) entry.current = true;
			entries.push(entry);
		}
	}
	return entries;
}

export function notesFromLists(noteLists: readonly NoteList[], vault: JumpListVault, current: VaultNote | undefined, dateNoteSettings: DateNoteSettings): VaultNote[] {
	const context = listContext(vault, current, dateNoteSettings);
	const seen = new Set<string>();
	const notes: VaultNote[] = [];
	for (const list of noteLists) {
		if (list.source.kind === "unreadable") continue;
		const listed = sourceNotes(list.source, context).filter((entry) => entry.missing === undefined);
		for (const { file } of keepsOrder(list.source) ? listed : [...listed].sort(byName)) {
			if (seen.has(file.path)) continue;
			seen.add(file.path);
			notes.push(file);
		}
	}
	return notes;
}

const CURRENT_NOTE_SOURCES: ReadonlySet<ListSource["kind"]> = new Set(["currentNote", "adjacentDates", "linksOut", "linksIn", "sameDay"]);

export function readsCurrentNote(source: ListSource): boolean {
	return CURRENT_NOTE_SOURCES.has(source.kind);
}

function keepsOrder(source: ListSource): boolean {
	return source.kind === "currentPeriods" || source.kind === "adjacentDates";
}

export function existingSourceNotes(source: ListSource, vault: JumpListVault, current: VaultNote | undefined, dateNoteSettings: DateNoteSettings): VaultNote[] {
	return sourceNotes(source, listContext(vault, current, dateNoteSettings))
		.filter((listed) => listed.missing === undefined)
		.map((listed) => listed.file);
}

function listContext(vault: JumpListVault, current: VaultNote | undefined, dateNoteSettings: DateNoteSettings): ListContext {
	return {
		vault,
		current,
		dateNotes: resolveDateNotes(dateNoteSettings, vault),
		propertyTypes: vault.propertyTypes(),
		today: vault.moment(vault.now()).startOf("day"),
	};
}

function sourceNotes(source: ListSource, context: ListContext): ListedNote[] {
	const { vault, current, dateNotes } = context;
	if (source.kind === "filter") return filterNotes(source.filter, context).map((file) => ({ file }));
	if (source.kind === "unreadable") return [];
	if (source.kind === "linksToNote") return notesLinkingTo(vault, source.note);
	if (source.kind === "modifiedToday") return notesModifiedSince(vault, context.today.valueOf());
	if (source.kind === "currentPeriods") return currentPeriodNotes(vault, currentPeriodsInOrder(source), dateNotes, context.today, showsMissingNotes(source));
	if (!current) return [];
	switch (source.kind) {
		case "currentNote":
			return [{ file: current }];
		case "adjacentDates":
			return adjacentDateNotes(vault, current, dateNotes, adjacentEntriesInOrder(source), showsMissingNotes(source));
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
	if (listed.missing) {
		entry.missing = { period: listed.missing, from: dateNotes.from };
		if (listed.missingDate) entry.missing.date = listed.missingDate;
	}
	return entry;
}

function byName(a: ListedNote, b: ListedNote): number {
	if (a.file.basename < b.file.basename) return -1;
	return a.file.basename > b.file.basename ? 1 : 0;
}
