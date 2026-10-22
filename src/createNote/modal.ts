import { Notice } from "obsidian";
import type { App } from "obsidian";
import { ChoiceModal } from "../choiceModal";
import type { JumpListVault, NewNoteVault } from "../lists/vault";
import type { JumpSettings } from "../settings";
import { creatableEntries, createChoices } from "./choices";
import type { CreateChoice } from "./choices";
import { createNote, createdNotice } from "./newNotes";
import type { NoteCreation } from "./newNotes";

export function createNoteFromEntries(
	app: App,
	vault: JumpListVault & NewNoteVault,
	settings: JumpSettings,
	sourcePath: string | undefined,
): void {
	const entries = creatableEntries(settings.setProperties, vault);
	if (!entries.length) {
		new Notice("No link property can create notes.");
		return;
	}
	const create = async (creation: NoteCreation) => {
		try {
			new Notice(createdNotice(creation.name, await createNote(vault, sourcePath, creation)));
		} catch {
			new Notice(`Could not create "${creation.name}".`);
		}
	};
	const open = (query: string): void => {
		new ChoiceModal<CreateChoice>(app, "Create note…", (typed) => createChoices(entries, typed), {
			choose: ({ action }, typed) => {
				if (action.action === "create") void create(action.creation);
				else open(typed);
			},
			dismiss: () => undefined,
		}).openWithQuery(query);
	};
	open("");
}
