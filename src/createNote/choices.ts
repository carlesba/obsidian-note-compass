import type { JumpListVault, NewNoteVault } from "../lists/vault";
import { t } from "../i18n/index.ts";
import { matchesInOrder, prefixParts, rowLabel } from "../render.ts";
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

const CREATE_MARK = "➕";

export function creatableEntries(settings: SetPropertiesSettings, vault: JumpListVault): CreatableEntry[] {
	const creatable: CreatableEntry[] = [];
	for (const entry of offeredProperties(settings)) {
		if (entry.createsNotes !== true || !isLinkType(propertyType(settings, entry))) continue;
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
	showPrefixes: boolean,
): EntryChoice[] {
	const choices = entries.map((creatable) => {
		const folder = newNoteFolder(vault, sourcePath, creatable);
		const parts = { ...prefixPart(creatable, showPrefixes), content: creatable.entry.property, value: folder || t("vaultRoot") };
		return { label: rowLabel(parts), parts, creatable };
	});
	return query ? choices.filter((choice) => matchesInOrder(query, choice.label)) : choices;
}

export function namePlaceholder({ entry }: CreatableEntry): string {
	return t("newNoteName", { property: entry.property });
}

export function nameChoices(
	creatable: CreatableEntry,
	vault: JumpListVault & NewNoteVault,
	sourcePath: string | undefined,
	query: string,
	showPrefixes: boolean,
): NameChoice[] {
	const name = query.trim();
	if (name === "") return [reopen({ content: t("typeAName") })];
	if (!isCreatableName(name)) return [reopen({ content: t("nameHasUnsafeCharacters", { name }) })];
	const wanted = name.toLowerCase();
	const existing = vault.notes().find((note) => note.basename.toLowerCase() === wanted);
	if (existing) return [reopen({ content: t("nameExistsAt", { name, path: existing.path }) })];
	const folder = folderName(newNoteFolder(vault, sourcePath, creatable));
	const parts = { mark: CREATE_MARK, ...prefixPart(creatable, showPrefixes), content: t("createNameIn", { name, folder }) };
	return [{ label: rowLabel(parts), parts, action: { action: "create", creation: { ...creatable, name } } }];
}

function prefixPart({ entry }: CreatableEntry, showPrefixes: boolean): Pick<RowParts, "prefix" | "prefixColor"> {
	return showPrefixes ? prefixParts(entry.prefix, entry.prefixColor) : {};
}

function reopen(parts: RowParts): NameChoice {
	return { label: rowLabel(parts), parts, action: { action: "reopen" } };
}
