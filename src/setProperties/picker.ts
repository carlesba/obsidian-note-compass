import { t } from "../i18n/index.ts";
import type { Frontmatter } from "../lists/vault";
import { matchesInOrder, prefixParts, rowLabel } from "../render.ts";
import type { RowParts } from "../render";
import { isLinkType } from "../settings.ts";
import type { CheckboxMode, EditableProperty, SetPropertiesSettings } from "../settings";
import { isPicked, linksTo, wikiLink } from "./links.ts";
import { multiRowName, multiRowProperties, multiRowSegments, rowHolds, withRowApplied } from "./multiValues.ts";
import type { MultiRow } from "./multiValues";
import { offeredProperties, propertyType } from "./offered.ts";
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
const CANCEL_MARK = "🛑";

export function saveLabel(): string {
	return rowLabel({ mark: SAVE_MARK, content: t("saveAndClose") });
}

export function cancelLabel(): string {
	return rowLabel({ mark: CANCEL_MARK, content: t("cancel") });
}

const SELECTED_MARK = "✓";
const CHANGED_MARK = "•";
const USE_MARK = "✏️";
const UNFILTERED_ROWS_PER_ENTRY = 5;

export function initialPropertyState(settings: SetPropertiesSettings, frontmatter: Frontmatter | undefined): PropertyState {
	const saved = frontmatter ?? {};
	const state = new Map<string, unknown>();
	for (const entry of offeredProperties(settings)) state.set(entry.property, ownValue(saved, entry.property));
	for (const property of multiRowProperties(settings)) state.set(property, ownValue(saved, property));
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
	checkboxMode: CheckboxMode = "picker",
	rows: readonly MultiRow[] = [],
): PickerChoice[] {
	const held = rows.filter((row) => rowHolds(row, state.values));
	const unheld = rows.filter((row) => !rowHolds(row, state.values));
	const choices = [
		choice({ mark: SAVE_MARK, content: t("saveAndClose") }, { action: "save" }),
		choice({ mark: CANCEL_MARK, content: t("cancel") }, { action: "cancel" }),
		...selectedChoices(entries, initial, state, checkboxMode),
		...held.map((row) => heldRowChoice(row, initial, state)),
		...unheld.map((row) => unheldRowChoice(row, state)),
		...entryChoices(entries, state, query, checkboxMode),
	];
	if (!query) return choices;
	const matches = choices.filter((candidate) => !candidate.kept && matchesInOrder(query, candidate.label));
	return [...matches, ...choices.filter((candidate) => candidate.kept)];
}

export function writeProperties(
	frontmatter: Frontmatter,
	initial: PropertyState,
	state: PropertyState,
	keptEmpty: PropertyState = new Map(),
): void {
	state.forEach((value, property) => {
		if (sameValue(value, initial.get(property))) return;
		if (!isUnset(value)) frontmatter[property] = value;
		else if (keptEmpty.has(property)) frontmatter[property] = keptEmpty.get(property);
		else delete frontmatter[property];
	});
}

export function keptEmptyValues(settings: SetPropertiesSettings): PropertyState {
	const kept = new Map<string, unknown>();
	const decided = new Set<string>();
	for (const entry of offeredProperties(settings)) {
		if (decided.has(entry.property)) continue;
		decided.add(entry.property);
		if (entry.keepsEmpty) kept.set(entry.property, propertyType(settings, entry) === "links" ? [] : null);
	}
	return kept;
}

function selectedChoices(
	entries: readonly OfferedEntry[],
	initial: PropertyState,
	state: PickerState,
	checkboxMode: CheckboxMode,
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
				...prefixPart(offered.entry),
				content: property,
				value: formatPendingValue(offered.type, pending),
			};
			choices.push(choice(parts, scalarAction(offered, state, pending, checkboxMode)));
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
				...prefixPart(linkOwner(entries, property, link) ?? offered.entry),
				content: title,
			};
			choices.push(choice(parts, set(withValue(state, property, remaining))));
		}
	}
	return choices;
}

function heldRowChoice(row: MultiRow, initial: PropertyState, state: PickerState): PickerChoice {
	const parts = { mark: selectedMark(!rowHolds(row, initial)), ...multiRowParts(row) };
	return choice(parts, set(state));
}

function unheldRowChoice(row: MultiRow, state: PickerState): PickerChoice {
	return choice(multiRowParts(row), set({ ...state, values: withRowApplied(row, state.values) }));
}

function multiRowParts(row: MultiRow): RowParts {
	const segments = multiRowSegments(row.entry);
	const parts: RowParts = { ...prefixPart(row.entry), content: multiRowName(row.entry) };
	if (segments) parts.contentSegments = segments;
	return parts;
}

function linkOwner(entries: readonly OfferedEntry[], property: string, link: unknown): EditableProperty | undefined {
	return entries.find(
		(offered) => offered.entry.property === property && offered.notes.some((note) => linksTo(link, note)),
	)?.entry;
}

function prefixPart(entry: EditableProperty): Pick<RowParts, "prefix" | "prefixColor"> {
	return prefixParts(entry.prefix, entry.prefixColor);
}

function entryChoices(
	entries: readonly OfferedEntry[],
	state: PickerState,
	query: string,
	checkboxMode: CheckboxMode,
): PickerChoice[] {
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
		if (offered.type === "link" || offered.type === "links") {
			const notes = offered.notes.filter((note) => !isPicked(note, pending) && offer(property, note.path));
			const rows = notes.map((note) =>
				choice(
					{ ...prefixPart(offered.entry), content: note.name },
					set(withLink(state, offered, note.name)),
				),
			);
			choices.push(...capped(offered, rows, query));
			continue;
		}
		if (isUnset(pending) && offer(property, "")) {
			choices.push(choice({ ...prefixPart(offered.entry), content: property }, scalarAction(offered, state, pending, checkboxMode)));
		}
		const mainMenu = offered.entry.mainMenuPresets ?? [];
		if (mainMenu.length > 0) {
			const presets = offered.presets
				.filter((preset) => mainMenu.includes(preset))
				.map((preset) => (offered.type === "number" ? Number(preset) : preset))
				.filter((value) => !sameValue(value, pending) && offer(property, String(value)));
			const rows = presets.map((value) =>
				choice({ ...prefixPart(offered.entry), content: property, value: String(value) }, set(withValue(state, property, value))),
			);
			choices.push(...capped(offered, rows, query));
		}
		if (offered.type === "text") choices.push(...useChoices(offered, state, typedName(offered)));
	}
	return choices;
}

function useChoices(
	offered: OfferedEntry,
	state: PickerState,
	name: string | undefined,
): PickerChoice[] {
	if (name === undefined) return [];
	const { property } = offered.entry;
	const wanted = name.toLowerCase();
	const known = offered.presets.filter((preset) => (offered.entry.mainMenuPresets ?? []).includes(preset));
	if (known.some((value) => value.toLowerCase() === wanted) || sameValue(state.values.get(property), name)) {
		return [];
	}
	const parts = { mark: USE_MARK, ...prefixPart(offered.entry), content: t("useTypedValue", { property, value: name }) };
	return [{ ...choice(parts, set(withValue(state, property, name))), kept: true }];
}

function capped(offered: OfferedEntry, rows: PickerChoice[], query: string): PickerChoice[] {
	if (query || rows.length <= UNFILTERED_ROWS_PER_ENTRY) return rows;
	const { prefix, property } = offered.entry;
	const content = t("moreRows", { count: rows.length - UNFILTERED_ROWS_PER_ENTRY });
	const more = { ...prefixPart(offered.entry), content };
	const expandQuery = prefix.trim() || property;
	return [...rows.slice(0, UNFILTERED_ROWS_PER_ENTRY), choice(more, { action: "expand", query: expandQuery })];
}

function typedNameFor(
	entries: readonly OfferedEntry[],
	query: string,
): (offered: OfferedEntry) => string | undefined {
	const typed = query.trimStart();
	const scope = entries
		.map((offered) => offered.entry.prefix.trim())
		.filter((prefix) => prefix !== "" && typed.startsWith(prefix))
		.sort((a, b) => b.length - a.length)[0];
	const name = (scope === undefined ? typed : typed.slice(scope.length)).trim();
	return (offered) =>
		name !== "" && (scope === undefined || offered.entry.prefix.trim() === scope) ? name : undefined;
}

function scalarAction(offered: OfferedEntry, state: PickerState, pending: unknown, checkboxMode: CheckboxMode): PickerAction {
	const { entry } = offered;
	const mode = offered.type === "checkbox" ? checkboxMode : "picker";
	if (mode === "picker") return { action: "edit", entry };
	if (mode === "toggle") return set(withValue(state, entry.property, pending === true ? undefined : true));
	const next = pending === true ? false : pending === false ? undefined : true;
	return set(withValue(state, entry.property, next));
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
