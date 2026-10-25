import { trimSlashes } from "../createNote/newNotes.ts";
import type { JumpListVault, NewNoteVault, VaultNote } from "../lists/vault.ts";
import type { Form } from "./form.ts";
import type { ResolvedForm } from "./resolve.ts";

export interface FormNote {
	name: string;
	path: string;
	folder: string;
}

export function formNoteFolder(vault: NewNoteVault, form: Form, sourcePath: string | undefined): string {
	return trimSlashes(form.folder.trim() || vault.defaultNoteFolder(sourcePath));
}

export function freeNotePath(notes: readonly VaultNote[], folder: string, name: string): FormNote {
	const taken = new Set(notes.map((note) => note.path.toLowerCase()));
	const pathFor = (candidate: string) => (folder === "" ? `${candidate}.md` : `${folder}/${candidate}.md`);
	let candidate = name;
	for (let copy = 2; taken.has(pathFor(candidate).toLowerCase()); copy++) candidate = `${name} ${copy}`;
	return { name: candidate, path: pathFor(candidate), folder };
}

export async function createFormNote(
	vault: JumpListVault & NewNoteVault,
	form: Form,
	resolved: ResolvedForm,
	sourcePath: string | undefined,
): Promise<FormNote> {
	const note = freeNotePath(vault.notes(), formNoteFolder(vault, form, sourcePath), resolved.name);
	await vault.createNote(note.path, resolved.content);
	if (resolved.frontmatter.length > 0) {
		await vault.updateFrontmatter(note.path, (frontmatter) => {
			for (const [key, value] of resolved.frontmatter) frontmatter[key] = value;
		});
	}
	return note;
}
