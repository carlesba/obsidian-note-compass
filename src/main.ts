import { MarkdownView, Notice, Plugin, getLanguage } from "obsidian";
import { createNoteFromEntries } from "./createNote/modal";
import { fillForm, isRunnable, pickForm } from "./forms/modal";
import { formName } from "./forms/questions";
import { DEFAULT_LANGUAGE, setLanguage, t } from "./i18n";
import { buildJumpList } from "./lists/jumpList";
import { createObsidianVault } from "./lists/obsidianVault";
import type { VaultNote } from "./lists/vault";
import { JumpModal, SET_PROPERTIES_ICON } from "./modal";
import { setProperties } from "./setProperties/modal";
import { JumpSettings, defaultSettings, mergeSettings, storedSettings } from "./settings";
import { NoteCompassSettingTab } from "./settingsTab";

export default class NoteCompassPlugin extends Plugin {
	settings: JumpSettings = defaultSettings();
	private formCommandIds: string[] = [];

	async onload(): Promise<void> {
		try {
			setLanguage(getLanguage());
		} catch {
			setLanguage(DEFAULT_LANGUAGE);
		}
		this.settings = mergeSettings(await this.loadData());
		this.addSettingTab(new NoteCompassSettingTab(this.app, this));

		this.addCommand({
			id: "jump-to-note",
			name: t("jumpToNote"),
			icon: "compass",
			callback: () => this.openJumpModal(),
		});

		this.addCommand({
			id: "set-properties",
			name: t("setProperties"),
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
			name: t("createNote"),
			icon: "file-plus",
			callback: () =>
				createNoteFromEntries(this.app, createObsidianVault(this.app), this.settings, this.currentNote()?.path),
		});

		this.addCommand({
			id: "fill-form",
			name: t("fillForm"),
			icon: "clipboard-list",
			callback: () => pickForm(this.app, createObsidianVault(this.app), this.settings.forms, this.currentNote()?.path),
		});

		this.registerFormCommands();
	}

	async saveSettings(): Promise<void> {
		await this.saveData(storedSettings(this.settings));
		this.registerFormCommands();
	}

	private registerFormCommands(): void {
		for (const id of this.formCommandIds) this.removeCommand(id);
		this.formCommandIds = [];
		for (const form of this.settings.forms.filter(isRunnable)) {
			const id = `form-${form.id}`;
			this.addCommand({
				id,
				name: formName(form),
				icon: "clipboard-list",
				callback: () => fillForm(this.app, createObsidianVault(this.app), form, this.currentNote()?.path),
			});
			this.formCommandIds.push(id);
		}
	}

	private openJumpModal(query = ""): void {
		const entries = buildJumpList(
			this.settings.lists,
			createObsidianVault(this.app),
			this.currentNote(),
			this.settings.dateNotes,
		);
		if (!entries.length) {
			new Notice(t("noNotesToJumpTo"));
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
