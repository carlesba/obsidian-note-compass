import { existingSourceNotes } from "../lists/jumpList.ts";
import type { DateNoteSettings } from "../lists/dateNotes.ts";
import type { JumpListVault, VaultNote } from "../lists/vault.ts";
import { wikiLink } from "../setProperties/links.ts";
import type { ListSource } from "../settings.ts";

export interface NoteOption {
	name: string;
	path: string;
	link: string;
}

export function offeredNotes(
	source: ListSource,
	vault: JumpListVault,
	current: VaultNote | undefined,
	dateNotes: DateNoteSettings,
	linkText: (path: string) => string,
): NoteOption[] {
	return existingSourceNotes(source, vault, current, dateNotes)
		.sort((a, b) => vault.mtime(b.path) - vault.mtime(a.path) || a.basename.localeCompare(b.basename))
		.map((file) => ({ name: file.basename, path: file.path, link: wikiLink(linkText(file.path)) }));
}
