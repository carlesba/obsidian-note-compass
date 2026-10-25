import { Notice } from "obsidian";
import type { App } from "obsidian";
import { ChoiceModal } from "../choiceModal";
import { t } from "../i18n";
import type { JumpListVault, NewNoteVault } from "../lists/vault";
import type { JumpSettings } from "../settings";
import { creatableEntries, entryChoices, nameChoices, namePlaceholder } from "./choices";
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
		new Notice(t("noCreatableProperty"));
		return;
	}
	const create = async (creation: NoteCreation) => {
		try {
			const created = await createNote(vault, sourcePath, creation);
			new Notice(createdNotice(creation.name, created));
			if (created.outcome !== "created") return;
			const file = app.vault.getFileByPath(created.path);
			if (file) await app.workspace.getLeaf(false).openFile(file);
		} catch {
			new Notice(t("couldNotCreate", { name: creation.name }));
		}
	};
	const openEntries = (query: string): void => {
		new ChoiceModal<EntryChoice>(app, t("createNoteFor"), (typed) => entryChoices(entries, vault, sourcePath, typed, settings.showPrefixes), {
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
