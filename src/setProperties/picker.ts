import type { Frontmatter } from "../lists/vault";
import { matchesInOrder, rowLabel } from "../render.ts";
import type { RowParts } from "../render";
import { isLinkType } from "../settings.ts";
import type { EditableProperty, SetPropertiesSettings } from "../settings";
import { isPicked, linksTo, wikiLink } from "./links.ts";
import { isCreatableName } from "./newNotes.ts";
import type { NoteCreation } from "./newNotes";
import { offeredProperties } from "./offered.ts";
import type { OfferedEntry } from "./offered";
import { asList, formatPendingValue, isUnset, linkTitle, sameValue } from "./values.ts";

export type PropertyState = ReadonlyMap<string, unknown>;

export interface PickerState {
	values: PropertyState;
	creations: readonly NoteCreation[];
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

export const SAVE_LABEL = "🏁 Save & close";
export const CANCEL_LABEL = "🛑 Cancel";

const SELECTED_MARK = "✓";
const CHANGED_MARK = "•";
const USE_MARK = "✏️";
const CREATE_MARK = "➕";
const UNFILTERED_ROWS_PER_ENTRY = 5;

export function initialPropertyState(settings: SetPropertiesSettings, frontmatter: Frontmatter | undefined): PropertyState {
	const saved = frontmatter ?? {};
	const state = new Map<string, unknown>();
	for (const entry of offeredProperties(settings)) state.set(entry.property, ownValue(saved, entry.property));
	return state;
}

export function pickerState(values: PropertyState): PickerState {
	return { values, creations: [] };
}

export function withValue(state: PickerState, property: string, value: unknown): PickerState {
	return { ...state, values: new Map(state.values).set(property, value) };
}

export function pendingCreations(state: PickerState): NoteCreation[] {
	return state.creations.filter(
		(creation, index) =>
			state.creations.findIndex((other) => other.name === creation.name) === index &&
			asList(state.values.get(creation.entry.property)).some((value) => linkTitle(value) === creation.name),
	);
}

export function pickerChoices(
	entries: readonly OfferedEntry[],
	initial: PropertyState,
	state: PickerState,
	query: string,
): PickerChoice[] {
	const choices = [
		choice({ content: SAVE_LABEL }, { action: "save" }),
		choice({ content: CANCEL_LABEL }, { action: "cancel" }),
		...selectedChoices(entries, initial, state),
		...entryChoices(entries, state, query),
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

function selectedChoices(entries: readonly OfferedEntry[], initial: PropertyState, state: PickerState): PickerChoice[] {
	const choices: PickerChoice[] = [];
	for (const offered of firstPerProperty(entries)) {
		const { property, prefix } = offered.entry;
		const pending = state.values.get(property);
		const saved = initial.get(property);
		if (!isLinkType(offered.type)) {
			if (isUnset(pending)) continue;
			const parts = {
				mark: selectedMark(!sameValue(pending, saved)),
				prefix,
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
				prefix: linkOwner(entries, state, property, link)?.prefix ?? prefix,
				content: title,
			};
			choices.push(choice(parts, set(withValue(state, property, remaining))));
		}
	}
	return choices;
}

function linkOwner(
	entries: readonly OfferedEntry[],
	state: PickerState,
	property: string,
	link: unknown,
): EditableProperty | undefined {
	const listing = entries.find(
		(offered) => offered.entry.property === property && offered.notes.some((note) => linksTo(link, note)),
	);
	if (listing) return listing.entry;
	return state.creations.find((creation) => creation.entry.property === property && creation.name === linkTitle(link))
		?.entry;
}

function entryChoices(entries: readonly OfferedEntry[], state: PickerState, query: string): PickerChoice[] {
	const typedName = typedNameFor(entries, query);
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
		const name = typedName(offered);
		if (offered.type === "link" || offered.type === "links") {
			const notes = offered.notes.filter((note) => !isPicked(note, pending) && offer(property, note.path));
			const rows = notes.map((note) =>
				choice({ prefix: offered.entry.prefix, content: note.name }, set(withLink(state, offered, note.name))),
			);
			choices.push(...capped(offered, rows, query), ...createChoices(offered, state, name));
		} else if (offered.type === "text") {
			const values = offered.values.filter((value) => !sameValue(value, pending) && offer(property, value));
			const rows = values.map((value) =>
				choice({ prefix: offered.entry.prefix, content: property, value }, set(withValue(state, property, value))),
			);
			choices.push(...capped(offered, rows, query), ...useChoices(offered, state, name));
		} else if (isUnset(pending) && offer(property, "")) {
			choices.push(choice({ prefix: offered.entry.prefix, content: property }, { action: "edit", entry: offered.entry }));
		}
	}
	return choices;
}

function createChoices(offered: OfferedEntry, state: PickerState, name: string | undefined): PickerChoice[] {
	if (name === undefined || !offered.newNote || !isCreatableName(name)) return [];
	const wanted = name.toLowerCase();
	const pending = asList(state.values.get(offered.entry.property));
	const known =
		offered.notes.some((note) => note.name.toLowerCase() === wanted) ||
		pending.some((value) => String(linkTitle(value)).toLowerCase() === wanted);
	if (known) return [];
	const creation: NoteCreation = { name, entry: offered.entry, rule: offered.newNote };
	const next = withLink(state, offered, name);
	const parts = { mark: CREATE_MARK, prefix: offered.entry.prefix, content: `create "${name}"` };
	return [{ ...choice(parts, set({ ...next, creations: [...next.creations, creation] })), kept: true }];
}

function useChoices(offered: OfferedEntry, state: PickerState, name: string | undefined): PickerChoice[] {
	if (name === undefined) return [];
	const { property } = offered.entry;
	const wanted = name.toLowerCase();
	if (offered.values.some((value) => value.toLowerCase() === wanted) || sameValue(state.values.get(property), name)) {
		return [];
	}
	const parts = { mark: USE_MARK, prefix: offered.entry.prefix, content: `${property}: use "${name}"` };
	return [{ ...choice(parts, set(withValue(state, property, name))), kept: true }];
}

function capped(offered: OfferedEntry, rows: PickerChoice[], query: string): PickerChoice[] {
	if (query || rows.length <= UNFILTERED_ROWS_PER_ENTRY) return rows;
	const { prefix, property } = offered.entry;
	const more = { prefix, content: `… ${rows.length - UNFILTERED_ROWS_PER_ENTRY} more, type to filter` };
	return [
		...rows.slice(0, UNFILTERED_ROWS_PER_ENTRY),
		choice(more, { action: "expand", query: prefix.trim() || property }),
	];
}

function typedNameFor(entries: readonly OfferedEntry[], query: string): (offered: OfferedEntry) => string | undefined {
	const typed = query.trimStart();
	const scope = entries
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
