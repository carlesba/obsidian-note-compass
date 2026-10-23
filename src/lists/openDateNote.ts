import type { App } from "obsidian";
import type { Period } from "./dateNotes";
import { createObsidianVault } from "./obsidianVault";
import type { JumpListEntry, MissingDateNote } from "./vault";

interface CommandRegistry {
	commands?: { executeCommandById(id: string): boolean };
}

const PERIODIC_NOTES_COMMANDS: Record<Period, string> = {
	day: "periodic-notes:open-daily-note",
	week: "periodic-notes:open-weekly-note",
	month: "periodic-notes:open-monthly-note",
	quarter: "periodic-notes:open-quarterly-note",
	year: "periodic-notes:open-yearly-note",
};

const DAILY_NOTES_COMMAND = "daily-notes";

export async function createDateNote(app: App, entry: JumpListEntry, missing: MissingDateNote): Promise<void> {
	const command = ownerCommand(missing);
	if (command && (app as App & CommandRegistry).commands?.executeCommandById(command)) return;
	await createObsidianVault(app).createNote(entry.file.path, "");
	const file = app.vault.getFileByPath(entry.file.path);
	if (file) await app.workspace.getLeaf(false).openFile(file);
}

function ownerCommand({ period, from }: MissingDateNote): string | undefined {
	if (from === "periodicNotes") return PERIODIC_NOTES_COMMANDS[period];
	if (from === "dailyNotes" && period === "day") return DAILY_NOTES_COMMAND;
	return undefined;
}
