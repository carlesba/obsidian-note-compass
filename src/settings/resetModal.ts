import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";

const RESET_TITLE = "Reset all Note Compass settings?";

const RESET_MESSAGE = "Your lists, properties and options go back to the defaults. This can't be undone.";

export class ResetSettingsModal extends Modal {
	private readonly reset: () => void;

	constructor(app: App, reset: () => void) {
		super(app);
		this.reset = reset;
	}

	onOpen(): void {
		this.setTitle(RESET_TITLE);
		this.contentEl.createEl("p", { text: RESET_MESSAGE });
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()))
			.addButton((button) =>
				button
					.setButtonText("Reset")
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
