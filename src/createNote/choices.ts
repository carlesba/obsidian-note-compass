import type { JumpListVault, NewNoteVault } from "../lists/vault";
import { matchesInOrder, rowLabel } from "../render.ts";
import type { RowParts } from "../render";
import { offeredProperties, propertyType } from "../setProperties/offered.ts";
import { isLinkType } from "../settings.ts";
import type { SetPropertiesSettings } from "../settings";
import { folderName, isCreatableName, newNoteFolder, newNoteRule } from "./newNotes.ts";
import type { NoteCreation } from "./newNotes";

export type CreatableEntry = Omit<NoteCreation, "name">;

export interface EntryChoice {
	label: string;
	parts: RowParts;
	creatable: CreatableEntry;
}

export type NameAction = { action: "create"; creation: NoteCreation } | { action: "reopen" };

export interface NameChoice {
	label: string;
	parts: RowParts;
	action: NameAction;
}

export const ENTRY_PLACEHOLDER = "Create a note for…";
export const TYPE_A_NAME = "Type a name";

const CREATE_MARK = "➕";

export function creatableEntries(settings: SetPropertiesSettings, vault: JumpListVault): CreatableEntry[] {
	const creatable: CreatableEntry[] = [];
	for (const entry of offeredProperties(settings)) {
		if (!isLinkType(propertyType(settings, entry))) continue;
		const rule = newNoteRule(entry.source, vault);
		if (rule) creatable.push({ entry, rule });
	}
	return creatable;
}

export function entryChoices(
	entries: readonly CreatableEntry[],
	vault: NewNoteVault,
	sourcePath: string | undefined,
	query: string,
): EntryChoice[] {
	const choices = entries.map((creatable) => {
		const folder = newNoteFolder(vault, sourcePath, creatable);
		const parts = { prefix: creatable.entry.prefix, content: creatable.entry.property, value: folder || "vault root" };
		return { label: rowLabel(parts), parts, creatable };
	});
	return query ? choices.filter((choice) => matchesInOrder(query, choice.label)) : choices;
}

export function namePlaceholder({ entry }: CreatableEntry): string {
	return `Name of the new ${entry.property} note…`;
}

export function nameChoices(
	creatable: CreatableEntry,
	vault: JumpListVault & NewNoteVault,
	sourcePath: string | undefined,
	query: string,
): NameChoice[] {
	const name = query.trim();
	if (name === "") return [reopen({ content: TYPE_A_NAME })];
	if (!isCreatableName(name)) return [reopen({ content: `"${name}" has characters Obsidian cannot use in a file name.` })];
	const wanted = name.toLowerCase();
	const existing = vault.notes().find((note) => note.basename.toLowerCase() === wanted);
	if (existing) return [reopen({ content: `"${name}" already exists at ${existing.path}.` })];
	const folder = folderName(newNoteFolder(vault, sourcePath, creatable));
	const parts = { mark: CREATE_MARK, prefix: creatable.entry.prefix, content: `Create "${name}" in ${folder}` };
	return [{ label: rowLabel(parts), parts, action: { action: "create", creation: { ...creatable, name } } }];
}

function reopen(parts: RowParts): NameChoice {
	return { label: rowLabel(parts), parts, action: { action: "reopen" } };
}
