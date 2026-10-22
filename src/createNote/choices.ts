import type { JumpListVault } from "../lists/vault";
import { rowLabel } from "../render.ts";
import type { RowParts } from "../render";
import { offeredProperties, propertyType } from "../setProperties/offered.ts";
import { isLinkType } from "../settings.ts";
import type { SetPropertiesSettings } from "../settings";
import { isCreatableName, newNoteRule } from "./newNotes.ts";
import type { NoteCreation } from "./newNotes";

export type CreatableEntry = Omit<NoteCreation, "name">;

export type CreateAction = { action: "create"; creation: NoteCreation } | { action: "reopen" };

export interface CreateChoice {
	label: string;
	parts: RowParts;
	action: CreateAction;
}

export const TYPE_A_NAME = "type a name";

const CREATE_MARK = "➕";
const WORD_CHARACTER = /[\p{L}\p{N}]/u;
const SPACE = /\s/;

export function creatableEntries(settings: SetPropertiesSettings, vault: JumpListVault): CreatableEntry[] {
	const creatable: CreatableEntry[] = [];
	for (const entry of offeredProperties(settings)) {
		if (!isLinkType(propertyType(settings, entry))) continue;
		const rule = newNoteRule(entry.source, vault);
		if (rule) creatable.push({ entry, rule });
	}
	return creatable;
}

export function createChoices(entries: readonly CreatableEntry[], query: string): CreateChoice[] {
	const { scope, name } = scopedQuery(entries, query);
	if (name === "") {
		return scope.map(({ entry }) =>
			choice({ prefix: entry.prefix, content: entry.property, value: TYPE_A_NAME }, { action: "reopen" }),
		);
	}
	if (!isCreatableName(name)) {
		return [choice({ content: `"${name}" has characters Obsidian cannot use in a file name.` }, { action: "reopen" })];
	}
	return scope.map(({ entry, rule }) =>
		choice(
			{ mark: CREATE_MARK, prefix: entry.prefix, content: `${entry.property} create "${name}"` },
			{ action: "create", creation: { name, entry, rule } },
		),
	);
}

function scopedQuery(
	entries: readonly CreatableEntry[],
	query: string,
): { scope: readonly CreatableEntry[]; name: string } {
	let best: { key: string; rest: string } | undefined;
	for (const { entry } of entries) {
		const key = prefixKey(entry.prefix);
		if (key === "" || (best && best.key.length >= key.length)) continue;
		const rest = afterPrefix(query, key, entry.prefix);
		if (rest !== undefined) best = { key, rest };
	}
	if (!best) return { scope: entries, name: query.trim() };
	const { key, rest } = best;
	return { scope: entries.filter(({ entry }) => prefixKey(entry.prefix) === key), name: rest.trim() };
}

function prefixKey(prefix: string): string {
	return Array.from(prefix)
		.filter((character) => WORD_CHARACTER.test(character))
		.join("")
		.toLowerCase();
}

function afterPrefix(query: string, key: string, prefix: string): string | undefined {
	const wanted = Array.from(key);
	const typed = Array.from(query);
	let index = 0;
	let matched = 0;
	while (matched < wanted.length) {
		if (index >= typed.length) return undefined;
		const character = typed[index++];
		if (!WORD_CHARACTER.test(character)) continue;
		if (character.toLowerCase() !== wanted[matched++]) return undefined;
	}
	if (index < typed.length && WORD_CHARACTER.test(typed[index])) return undefined;
	const separators = new Set(Array.from(prefix));
	while (index < typed.length && !WORD_CHARACTER.test(typed[index]) && (separators.has(typed[index]) || SPACE.test(typed[index]))) {
		index++;
	}
	return typed.slice(index).join("");
}

function choice(parts: RowParts, action: CreateAction): CreateChoice {
	return { label: rowLabel(parts), parts, action };
}
