import { buildJumpList } from "../lists/jumpList.ts";
import type { JumpListVault, PropertyValueCount, VaultNote } from "../lists/vault";
import { matchesInOrder } from "../render.ts";
import { isLinkType } from "../settings.ts";
import type { EditableProperty, EditablePropertyType, JumpSettings } from "../settings";
import { asList, isUnset, linkTitle, parseDate, parseDateTime, parseNumber, sameValue } from "./values.ts";

export interface PickableNote {
	name: string;
	path: string;
	mtime: number;
}

export interface ValuePicker {
	type: EditablePropertyType;
	notes: PickableNote[];
	counts: PropertyValueCount[];
	now: number;
}

export interface ValueChoice {
	label: string;
	value: unknown;
	reopens: boolean;
	typed: boolean;
}

export const CLEAR_LABEL = "🗑️ Clear";
export const DONE_LABEL = "↩ Done";

const SELECTED_MARK = "✓";
const UNSELECTED_MARK = "\u2003";

export function valuePicker(
	settings: JumpSettings,
	vault: JumpListVault,
	target: VaultNote,
	entry: EditableProperty,
	type: EditablePropertyType,
): ValuePicker {
	return {
		type,
		notes: isLinkType(type) ? pickableNotes(settings, vault, target, entry) : [],
		counts: type === "text" || type === "number" ? vault.propertyValueCounts(entry.property) : [],
		now: vault.now(),
	};
}

export function valueChoices(picker: ValuePicker, pending: unknown, query: string): ValueChoice[] {
	const choices = typeChoices(picker, pending, query);
	if (!query) return choices;
	return choices.filter((choice) => choice.typed || matchesInOrder(query, choice.label));
}

function typeChoices(picker: ValuePicker, pending: unknown, query: string): ValueChoice[] {
	const clear = choice(CLEAR_LABEL, undefined, isUnset(pending));
	const offer = (label: string, value: unknown) => choice(label, value, sameValue(value, pending));
	switch (picker.type) {
		case "checkbox":
			return [offer("true", true), offer("false", false), clear];
		case "text":
			return [...useChoice(query.trim() || undefined, pending), ...vaultValues(picker, "string", pending), clear];
		case "number":
			return [...useChoice(parseNumber(query), pending), ...vaultValues(picker, "number", pending), clear];
		case "date":
			return [
				...useChoice(parseDate(query), pending),
				...datePresets(picker.now).map(([name, date]) => offer(`${name} (${date})`, date)),
				clear,
			];
		case "datetime": {
			const now = `${localDate(picker.now)}T${localTime(picker.now)}`;
			return [...useChoice(parseDateTime(query), pending), offer(`Now (${now})`, now), clear];
		}
		case "link":
			return [
				...orderedNotes(picker.notes, pending).map((note) =>
					isPicked(note, pending) ? choice(note.name, undefined, true) : choice(note.name, wikiLink(note), false),
				),
				clear,
			];
		case "links":
			return [
				{ label: DONE_LABEL, value: pending, reopens: false, typed: false },
				...orderedNotes(picker.notes, pending).map((note) => ({
					...choice(note.name, toggled(note, pending), isPicked(note, pending)),
					reopens: true,
				})),
				clear,
			];
	}
}

function choice(label: string, value: unknown, selected: boolean): ValueChoice {
	return { label: `${selected ? SELECTED_MARK : UNSELECTED_MARK} ${label}`, value, reopens: false, typed: false };
}

function useChoice(value: string | number | undefined, pending: unknown): ValueChoice[] {
	if (value === undefined) return [];
	return [{ ...choice(`✏️ Use "${value}"`, value, sameValue(value, pending)), typed: true }];
}

function vaultValues(picker: ValuePicker, kind: "string" | "number", pending: unknown): ValueChoice[] {
	return picker.counts
		.filter((count) => typeof count.value === kind)
		.sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)))
		.map((count) => choice(`${count.value} (${count.count})`, count.value, sameValue(count.value, pending)));
}

function datePresets(now: number): [string, string][] {
	const weekday = new Date(now).getDay();
	const untilMonday = (8 - weekday) % 7 || 7;
	return [
		["Today", localDate(now)],
		["Tomorrow", localDate(now, 1)],
		["Next Monday", localDate(now, untilMonday)],
		["In a week", localDate(now, 7)],
	];
}

function localDate(time: number, days = 0): string {
	const date = new Date(time);
	date.setDate(date.getDate() + days);
	return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
}

function localTime(time: number): string {
	const date = new Date(time);
	return `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

function twoDigits(value: number): string {
	return String(value).padStart(2, "0");
}

function orderedNotes(notes: readonly PickableNote[], pending: unknown): PickableNote[] {
	return [...notes].sort((a, b) => Number(isPicked(b, pending)) - Number(isPicked(a, pending)) || b.mtime - a.mtime);
}

function isPicked(note: PickableNote, pending: unknown): boolean {
	return asList(pending).some((value) => linksTo(value, note));
}

function linksTo(value: unknown, note: PickableNote): boolean {
	const link = typeof value === "string" ? value.match(/\[\[([^\]|]+)/) : null;
	const titles = [linkTitle(value), link?.[1]];
	return titles.some((title) => title === note.name || title === note.path.replace(/\.md$/, ""));
}

function toggled(note: PickableNote, pending: unknown): unknown[] {
	const values = asList(pending);
	if (isPicked(note, pending)) return values.filter((value) => !linksTo(value, note));
	return [...values, wikiLink(note)];
}

function wikiLink(note: PickableNote): string {
	return `[[${note.name}]]`;
}

function pickableNotes(
	settings: JumpSettings,
	vault: JumpListVault,
	target: VaultNote,
	entry: EditableProperty,
): PickableNote[] {
	if (!entry.source) return [];
	const list = { id: entry.id, enabled: true, prefix: "", source: entry.source };
	const excludedFolder = (entry.excludedFolder ?? "").replace(/^\/+|\/+$/g, "");
	return buildJumpList([list], vault, target, settings.dateNotes)
		.map((listed) => listed.file)
		.filter(
			(file) =>
				file.path !== target.path &&
				!(excludedFolder !== "" && file.path.startsWith(`${excludedFolder}/`)) &&
				vault.frontmatter(file.path)?.archived !== true,
		)
		.map((file) => ({ name: file.basename, path: file.path, mtime: vault.mtime(file.path) }))
		.sort((a, b) => b.mtime - a.mtime);
}
