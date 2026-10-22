import { Notice } from "obsidian";
import type { App } from "obsidian";
import { ChoiceModal } from "../choiceModal";
import type { JumpListVault, NewNoteVault } from "../lists/vault";
import type { JumpSettings } from "../settings";
import { ENTRY_PLACEHOLDER, creatableEntries, entryChoices, nameChoices, namePlaceholder } from "./choices";
import type { CreatableEntry, EntryChoice, NameChoice } from "./choices";
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
	const openEntries = (query: string): void => {
		new ChoiceModal<EntryChoice>(app, ENTRY_PLACEHOLDER, (typed) => entryChoices(entries, vault, sourcePath, typed, settings.showPrefixes), {
			choose: ({ creatable }, typed) => openName(creatable, "", typed),
			dismiss: () => undefined,
		}).openWithQuery(query);
	};
	const openName = (creatable: CreatableEntry, query: string, entryQuery: string): void => {
		new ChoiceModal<NameChoice>(app, namePlaceholder(creatable), (typed) => nameChoices(creatable, vault, sourcePath, typed, settings.showPrefixes), {
			choose: ({ action }, typed) => {
				if (action.action === "create") void create(action.creation);
				else openName(creatable, typed, entryQuery);
			},
			dismiss: () => openEntries(entryQuery),
		}).openWithQuery(query);
	};
	openEntries("");
}
