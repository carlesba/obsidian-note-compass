import { buildJumpList } from "../lists/jumpList.ts";
import type { Frontmatter, JumpListVault, VaultNote } from "../lists/vault";
import type { JumpSettings, LinkListMode, SetPropertiesSettings } from "../settings";
import { legacyView } from "./legacyView";
import { linkTitle } from "./values";

export interface PropertyRow {
	group: number;
	prefix: string;
	name: string;
	property: string;
	mode: "flag" | LinkListMode;
	mtime: number;
}

interface LinkValue {
	title: unknown;
	raw: unknown;
}

interface LinkProperty {
	mode: LinkListMode;
	values: LinkValue[];
}

export interface PropertyState {
	flags: Map<string, boolean>;
	links: Map<string, LinkProperty>;
}

export type PickerChoice = { action: "save" } | { action: "cancel" } | { action: "toggle"; row: PropertyRow };

export interface LabelledChoice {
	label: string;
	choice: PickerChoice;
}

export const SAVE_LABEL = "🏁 Save & close";
export const CANCEL_LABEL = "🛑 Cancel";

const SELECTED_MARK = "✓";
const UNSELECTED_MARK = "\u2003";

export function propertyRows(settings: JumpSettings, vault: JumpListVault, target: VaultNote): PropertyRow[] {
	const { flags, flagsPrefix, templatesFolder, linkLists } = legacyView(settings.setProperties);
	const rows: PropertyRow[] = flags
		.filter((flag, index) => flags.indexOf(flag) === index)
		.map((flag) => ({ group: 0, prefix: flagsPrefix, name: flag, property: flag, mode: "flag", mtime: 0 }));
	const seen = new Set<string>();
	linkLists
		.filter((list) => list.enabled)
		.forEach((list, index) => {
			for (const entry of buildJumpList([list], vault, target, settings.dateNotes)) {
				const path = entry.file.path;
				if (seen.has(path) || isExcluded(vault, path, templatesFolder)) continue;
				seen.add(path);
				rows.push({
					group: index + 1,
					prefix: list.prefix,
					name: entry.file.basename,
					property: list.property,
					mode: list.mode,
					mtime: vault.mtime(path),
				});
			}
		});
	return rows;
}

export function initialPropertyState(settings: SetPropertiesSettings, frontmatter: Frontmatter | undefined): PropertyState {
	const saved = frontmatter ?? {};
	const { flags: flagNames, linkLists } = legacyView(settings);
	const flags = new Map(flagNames.map((flag) => [flag, ownValue(saved, flag) === true]));
	const links = new Map<string, LinkProperty>();
	for (const list of linkLists) {
		if (!list.enabled || links.has(list.property)) continue;
		const values = asList(ownValue(saved, list.property)).map((raw) => ({ title: linkTitle(raw), raw }));
		links.set(list.property, { mode: list.mode, values });
	}
	return { flags, links };
}

export function isSelected(row: PropertyRow, state: PropertyState): boolean {
	if (row.mode === "flag") return state.flags.get(row.property) === true;
	return state.links.get(row.property)?.values.some((value) => value.title === row.name) ?? false;
}

export function toggleRow(state: PropertyState, row: PropertyRow): PropertyState {
	const selected = isSelected(row, state);
	if (row.mode === "flag") return { ...state, flags: new Map(state.flags).set(row.property, !selected) };
	const current = state.links.get(row.property) ?? { mode: row.mode, values: [] };
	const others = current.values.filter((value) => value.title !== row.name);
	const picked = { title: row.name, raw: `[[${row.name}]]` };
	const values = selected ? others : row.mode === "multi" ? [...current.values, picked] : [picked];
	return { ...state, links: new Map(state.links).set(row.property, { ...current, values }) };
}

export function orderedRows(rows: readonly PropertyRow[], state: PropertyState): PropertyRow[] {
	return [...rows].sort(
		(a, b) => Number(isSelected(b, state)) - Number(isSelected(a, state)) || a.group - b.group || b.mtime - a.mtime,
	);
}

export function rowLabel(row: PropertyRow, state: PropertyState): string {
	const mark = isSelected(row, state) ? SELECTED_MARK : UNSELECTED_MARK;
	return [mark, row.prefix, row.name].filter(Boolean).join(" ");
}

export function pickerChoices(rows: readonly PropertyRow[], state: PropertyState): LabelledChoice[] {
	return [
		{ label: SAVE_LABEL, choice: { action: "save" } },
		{ label: CANCEL_LABEL, choice: { action: "cancel" } },
		...orderedRows(rows, state).map((row) => ({ label: rowLabel(row, state), choice: { action: "toggle" as const, row } })),
	];
}

export function writeProperties(frontmatter: Frontmatter, initial: PropertyState, state: PropertyState): void {
	state.flags.forEach((selected, flag) => {
		if (selected === initial.flags.get(flag)) return;
		if (selected) frontmatter[flag] = true;
		else delete frontmatter[flag];
	});
	state.links.forEach((link, property) => {
		const values = link.values.map((value) => value.raw);
		const initialValues = initial.links.get(property)?.values.map((value) => value.raw) ?? [];
		if (values.length === initialValues.length && values.every((value, index) => value === initialValues[index])) return;
		if (!values.length) delete frontmatter[property];
		else frontmatter[property] = link.mode === "single" && values.length === 1 ? values[0] : values;
	});
}

function isExcluded(vault: JumpListVault, path: string, templatesFolder: string): boolean {
	const folder = templatesFolder.replace(/^\/+|\/+$/g, "");
	if (folder !== "" && path.startsWith(`${folder}/`)) return true;
	return vault.frontmatter(path)?.archived === true;
}

function asList(value: unknown): unknown[] {
	if (value === undefined || value === null || value === "") return [];
	return Array.isArray(value) ? value : [value];
}

function ownValue(frontmatter: Frontmatter, key: string): unknown {
	return Object.prototype.hasOwnProperty.call(frontmatter, key) ? frontmatter[key] : undefined;
}
