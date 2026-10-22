import type { Frontmatter } from "../lists/vault";
import { matchesInOrder, prefixParts, rowLabel } from "../render.ts";
import type { RowParts } from "../render";
import { isLinkType } from "../settings.ts";
import type { EditableProperty, SetPropertiesSettings } from "../settings";
import { isPicked, linksTo, wikiLink } from "./links.ts";
import { offeredProperties } from "./offered.ts";
import type { OfferedEntry } from "./offered";
import { asList, formatPendingValue, isUnset, linkTitle, sameValue } from "./values.ts";

export type PropertyState = ReadonlyMap<string, unknown>;

export interface PickerState {
	values: PropertyState;
}

export type PickerAction =
	| { action: "save" }
	| { action: "cancel" }
	| { action: "set"; state: PickerState }
	| { action: "edit"; entry: EditableProperty }
	| { action: "expand"; query: string };

export interface PickerChoice {
	label: string;
	parts: RowParts;
	action: PickerAction;
	kept: boolean;
}

const SAVE_MARK = "🏁";
const SAVE_TEXT = "Save & close";
const CANCEL_MARK = "🛑";
const CANCEL_TEXT = "Cancel";

export const SAVE_LABEL = rowLabel({ mark: SAVE_MARK, content: SAVE_TEXT });
export const CANCEL_LABEL = rowLabel({ mark: CANCEL_MARK, content: CANCEL_TEXT });

const SELECTED_MARK = "✓";
const CHANGED_MARK = "•";
const USE_MARK = "✏️";
const UNFILTERED_ROWS_PER_ENTRY = 5;

export function initialPropertyState(settings: SetPropertiesSettings, frontmatter: Frontmatter | undefined): PropertyState {
	const saved = frontmatter ?? {};
	const state = new Map<string, unknown>();
	for (const entry of offeredProperties(settings)) state.set(entry.property, ownValue(saved, entry.property));
	return state;
}

export function pickerState(values: PropertyState): PickerState {
	return { values };
}

export function withValue(state: PickerState, property: string, value: unknown): PickerState {
	return { ...state, values: new Map(state.values).set(property, value) };
}

export function pickerChoices(
	entries: readonly OfferedEntry[],
	initial: PropertyState,
	state: PickerState,
	query: string,
	showPrefixes: boolean,
): PickerChoice[] {
	const choices = [
		choice({ mark: SAVE_MARK, content: SAVE_TEXT }, { action: "save" }),
		choice({ mark: CANCEL_MARK, content: CANCEL_TEXT }, { action: "cancel" }),
		...selectedChoices(entries, initial, state, showPrefixes),
		...entryChoices(entries, state, query, showPrefixes),
	];
	if (!query) return choices;
	const matches = choices.filter((candidate) => !candidate.kept && matchesInOrder(query, candidate.label));
	return [...matches, ...choices.filter((candidate) => candidate.kept)];
}

export function writeProperties(frontmatter: Frontmatter, initial: PropertyState, state: PropertyState): void {
	state.forEach((value, property) => {
		if (sameValue(value, initial.get(property))) return;
		if (isUnset(value)) delete frontmatter[property];
		else frontmatter[property] = value;
	});
}

function selectedChoices(
	entries: readonly OfferedEntry[],
	initial: PropertyState,
	state: PickerState,
	showPrefixes: boolean,
): PickerChoice[] {
	const choices: PickerChoice[] = [];
	for (const offered of firstPerProperty(entries)) {
		const { property } = offered.entry;
		const pending = state.values.get(property);
		const saved = initial.get(property);
		if (!isLinkType(offered.type)) {
			if (isUnset(pending)) continue;
			const parts = {
				mark: selectedMark(!sameValue(pending, saved)),
				...prefixPart(offered.entry, showPrefixes),
				content: property,
				value: formatPendingValue(offered.type, pending),
			};
			const action: PickerAction =
				offered.type === "text" ? set(withValue(state, property, undefined)) : { action: "edit", entry: offered.entry };
			choices.push(choice(parts, action));
			continue;
		}
		const links = asList(pending);
		const titles = new Set<string>();
		for (const link of links) {
			const title = String(linkTitle(link));
			if (titles.has(title)) continue;
			titles.add(title);
			const remaining = offered.type === "links" ? links.filter((other) => !sameValue(other, link)) : undefined;
			const parts = {
				mark: selectedMark(!asList(saved).some((other) => sameValue(other, link))),
				...linkSourceParts(linkOwner(entries, property, link) ?? offered.entry, showPrefixes),
				content: title,
			};
			choices.push(choice(parts, set(withValue(state, property, remaining))));
		}
	}
	return choices;
}

function linkOwner(entries: readonly OfferedEntry[], property: string, link: unknown): EditableProperty | undefined {
	return entries.find(
		(offered) => offered.entry.property === property && offered.notes.some((note) => linksTo(link, note)),
	)?.entry;
}

function linkSourceParts(owner: EditableProperty, showPrefixes: boolean): Pick<RowParts, "prefix" | "prefixColor" | "value"> {
	return showPrefixes ? prefixPart(owner, true) : { value: owner.property };
}

function prefixPart(entry: EditableProperty, showPrefixes: boolean): Pick<RowParts, "prefix" | "prefixColor"> {
	return showPrefixes ? prefixParts(entry.prefix, entry.prefixColor) : {};
}

function entryChoices(
	entries: readonly OfferedEntry[],
	state: PickerState,
	query: string,
	showPrefixes: boolean,
): PickerChoice[] {
	const typedName = typedNameFor(entries, query, showPrefixes);
	const offeredValues = new Set<string>();
	const offer = (property: string, value: string) => {
		const key = `${property}\u0000${value}`;
		const fresh = !offeredValues.has(key);
		offeredValues.add(key);
		return fresh;
	};
	const choices: PickerChoice[] = [];
	for (const offered of entries) {
		const { property } = offered.entry;
		const pending = state.values.get(property);
		if (offered.type === "link" || offered.type === "links") {
			const notes = offered.notes.filter((note) => !isPicked(note, pending) && offer(property, note.path));
			const rows = notes.map((note) =>
				choice(
					{ ...linkSourceParts(offered.entry, showPrefixes), content: note.name },
					set(withLink(state, offered, note.name)),
				),
			);
			choices.push(...capped(offered, rows, query, showPrefixes));
		} else if (offered.type === "text") {
			const values = offered.values.filter((value) => !sameValue(value, pending) && offer(property, value));
			const rows = values.map((value) =>
				choice(
					{ ...prefixPart(offered.entry, showPrefixes), content: property, value },
					set(withValue(state, property, value)),
				),
			);
			choices.push(
				...capped(offered, rows, query, showPrefixes),
				...useChoices(offered, state, typedName(offered), showPrefixes),
			);
		} else if (isUnset(pending) && offer(property, "")) {
			choices.push(
				choice({ ...prefixPart(offered.entry, showPrefixes), content: property }, { action: "edit", entry: offered.entry }),
			);
		}
	}
	return choices;
}

function useChoices(
	offered: OfferedEntry,
	state: PickerState,
	name: string | undefined,
	showPrefixes: boolean,
): PickerChoice[] {
	if (name === undefined) return [];
	const { property } = offered.entry;
	const wanted = name.toLowerCase();
	if (offered.values.some((value) => value.toLowerCase() === wanted) || sameValue(state.values.get(property), name)) {
		return [];
	}
	const parts = { mark: USE_MARK, ...prefixPart(offered.entry, showPrefixes), content: `${property}: use "${name}"` };
	return [{ ...choice(parts, set(withValue(state, property, name))), kept: true }];
}

function capped(offered: OfferedEntry, rows: PickerChoice[], query: string, showPrefixes: boolean): PickerChoice[] {
	if (query || rows.length <= UNFILTERED_ROWS_PER_ENTRY) return rows;
	const { prefix, property } = offered.entry;
	const content = `… ${rows.length - UNFILTERED_ROWS_PER_ENTRY} more, type to filter`;
	const more = showPrefixes ? { ...prefixPart(offered.entry, showPrefixes), content } : { content, value: property };
	const expandQuery = (showPrefixes && prefix.trim()) || property;
	return [...rows.slice(0, UNFILTERED_ROWS_PER_ENTRY), choice(more, { action: "expand", query: expandQuery })];
}

function typedNameFor(
	entries: readonly OfferedEntry[],
	query: string,
	showPrefixes: boolean,
): (offered: OfferedEntry) => string | undefined {
	const typed = query.trimStart();
	const scope = (showPrefixes ? entries : [])
		.map((offered) => offered.entry.prefix.trim())
		.filter((prefix) => prefix !== "" && typed.startsWith(prefix))
		.sort((a, b) => b.length - a.length)[0];
	const name = (scope === undefined ? typed : typed.slice(scope.length)).trim();
	return (offered) =>
		name !== "" && (scope === undefined || offered.entry.prefix.trim() === scope) ? name : undefined;
}

function withLink(state: PickerState, offered: OfferedEntry, name: string): PickerState {
	const { property } = offered.entry;
	const link = wikiLink(name);
	return withValue(state, property, offered.type === "links" ? [...asList(state.values.get(property)), link] : link);
}

function firstPerProperty(entries: readonly OfferedEntry[]): OfferedEntry[] {
	return entries.filter(
		(offered, index) => entries.findIndex((other) => other.entry.property === offered.entry.property) === index,
	);
}

function selectedMark(changed: boolean): string {
	return changed ? `${SELECTED_MARK} ${CHANGED_MARK}` : SELECTED_MARK;
}

function set(state: PickerState): PickerAction {
	return { action: "set", state };
}

function choice(parts: RowParts, action: PickerAction): PickerChoice {
	return { label: rowLabel(parts), parts, action, kept: false };
}

function ownValue(frontmatter: Frontmatter, key: string): unknown {
	return Object.prototype.hasOwnProperty.call(frontmatter, key) ? frontmatter[key] : undefined;
}
