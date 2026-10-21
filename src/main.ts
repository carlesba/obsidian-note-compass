import { MarkdownView, Notice, Plugin } from "obsidian";
import { buildJumpList } from "./lists/jumpList";
import { createObsidianVault } from "./lists/obsidianVault";
import type { VaultNote } from "./lists/vault";
import { JumpModal } from "./modal";
import { JumpSettings, defaultSettings, mergeSettings } from "./settings";
import { JumpListSettingTab } from "./settingsTab";

export default class NoteLauncherPlugin extends Plugin {
	settings: JumpSettings = defaultSettings();

	async onload(): Promise<void> {
		this.settings = mergeSettings(await this.loadData());
		this.addSettingTab(new JumpListSettingTab(this.app, this));

		this.addCommand({
			id: "jump-to-note",
			name: "Jump to note",
			callback: () => this.openJumpModal(),
		});
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private openJumpModal(): void {
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
		new JumpModal(this.app, entries).open();
	}

	private currentNote(): VaultNote | undefined {
		const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
		return file ? { path: file.path, basename: file.basename, ctime: file.stat.ctime } : undefined;
	}
}
