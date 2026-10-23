import { MarkdownView, Notice, Plugin } from "obsidian";
import { createNoteFromEntries } from "./createNote/modal";
import { buildJumpList } from "./lists/jumpList";
import { createObsidianVault } from "./lists/obsidianVault";
import type { VaultNote } from "./lists/vault";
import { JumpModal, SET_PROPERTIES_ICON } from "./modal";
import { setProperties } from "./setProperties/modal";
import { JumpSettings, defaultSettings, mergeSettings, storedSettings } from "./settings";
import { NoteCompassSettingTab } from "./settingsTab";

export default class NoteCompassPlugin extends Plugin {
	settings: JumpSettings = defaultSettings();

	async onload(): Promise<void> {
		this.settings = mergeSettings(await this.loadData());
		this.addSettingTab(new NoteCompassSettingTab(this.app, this));

		this.addCommand({
			id: "jump-to-note",
			name: "Jump to note",
			icon: "compass",
			callback: () => this.openJumpModal(),
		});

		this.addCommand({
			id: "set-properties",
			name: "Set properties",
			icon: SET_PROPERTIES_ICON,
			checkCallback: (checking) => {
				const target = this.currentNote();
				if (!target) return false;
				if (!checking) setProperties(this.app, createObsidianVault(this.app), this.settings, target);
				return true;
			},
		});

		this.addCommand({
			id: "create-note",
			name: "Create note",
			icon: "file-plus",
			callback: () =>
				createNoteFromEntries(this.app, createObsidianVault(this.app), this.settings, this.currentNote()?.path),
		});
	}

	async saveSettings(): Promise<void> {
		await this.saveData(storedSettings(this.settings));
	}

	private openJumpModal(query = ""): void {
		const entries = buildJumpList(
			this.settings.lists,
			createObsidianVault(this.app),
			this.currentNote(),
			this.settings.dateNotes,
		);
		if (!entries.length) {
			new Notice("No notes to jump to.");
			return;
		}
		new JumpModal(this.app, entries, this.settings.showPrefixes, (note, typed) =>
			setProperties(this.app, createObsidianVault(this.app), this.settings, note, () => this.openJumpModal(typed)),
		).openWithQuery(query);
	}

	private currentNote(): VaultNote | undefined {
		const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
		return file ? { path: file.path, basename: file.basename, ctime: file.stat.ctime } : undefined;
	}
}
