import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";
import { t } from "../i18n";

export class ResetSettingsModal extends Modal {
	private readonly reset: () => void;

	constructor(app: App, reset: () => void) {
		super(app);
		this.reset = reset;
	}

	onOpen(): void {
		this.setTitle(t("resetTitle"));
		this.contentEl.createEl("p", { text: t("resetMessage") });
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText(t("cancel")).onClick(() => this.close()))
			.addButton((button) =>
				button
					.setButtonText(t("reset"))
					.setDestructive()
					.onClick(() => {
						this.close();
						this.reset();
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
