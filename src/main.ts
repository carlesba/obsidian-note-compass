import { Plugin } from "obsidian";
import { JumpListSettings, defaultSettings, mergeSettings } from "./settings";

export default class JumpListPlugin extends Plugin {
	settings: JumpListSettings = defaultSettings();

	async onload(): Promise<void> {
		this.settings = mergeSettings(await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
