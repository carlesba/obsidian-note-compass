import { App, PluginSettingTab, Setting } from "obsidian";
import type JumpListPlugin from "./main";
import { BuiltInList, BuiltInLists, CustomList, CustomListOperator, isOperator, newCustomList, operatorTakesValue } from "./settings";

const BUILT_IN_LISTS_HEADING = "Built-in lists";

const BUILT_IN_LIST_NAMES = [
	["adjacentDays", "Adjacent dates"],
	["linksOut", "Outbound links"],
	["linksIn", "Inbound links"],
	["sameDay", "Same day"],
] as const satisfies ReadonlyArray<readonly [keyof BuiltInLists, string]>;

const BUILT_IN_LIST_DESC = "Show this list in the picker, with its rows starting with the prefix.";

const CUSTOM_LISTS_HEADING = "Custom lists";

const CUSTOM_LISTS_DESC =
	"Each custom list shows the notes whose frontmatter property matches, with its rows starting with the prefix.";

const OPERATOR_LABELS = {
	"is true": "Is true",
	equals: "Equals",
	contains: "Contains",
	exists: "Exists",
} satisfies Record<CustomListOperator, string>;

const ADD_CUSTOM_LIST = "Add custom list";

const REMOVE_CUSTOM_LIST = "Remove custom list";

export class JumpListSettingTab extends PluginSettingTab {
	private plugin: JumpListPlugin;

	constructor(app: App, plugin: JumpListPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		const { settings } = this.plugin;
		containerEl.empty();

		new Setting(containerEl).setName(BUILT_IN_LISTS_HEADING).setHeading();
		for (const [key, name] of BUILT_IN_LIST_NAMES) this.addBuiltInList(name, settings.builtIns[key]);

		new Setting(containerEl).setName(CUSTOM_LISTS_HEADING).setDesc(CUSTOM_LISTS_DESC).setHeading();
		settings.customLists.forEach((list, index) => this.addCustomList(list, index));

		new Setting(containerEl).addButton((button) =>
			button
				.setButtonText(ADD_CUSTOM_LIST)
				.setCta()
				.onClick(() => {
					settings.customLists.push(newCustomList());
					this.saveAndRedisplay();
				}),
		);
	}

	private addBuiltInList(name: string, list: BuiltInList): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(BUILT_IN_LIST_DESC)
			.addText((text) =>
				text
					.setPlaceholder("Prefix")
					.setValue(list.prefix)
					.onChange((value) => {
						list.prefix = value;
						void this.plugin.saveSettings();
					}),
			)
			.addToggle((toggle) =>
				toggle.setValue(list.enabled).onChange((value) => {
					list.enabled = value;
					void this.plugin.saveSettings();
				}),
			);
	}

	private addCustomList(list: CustomList, index: number): void {
		const setting = new Setting(this.containerEl)
			.setName(`Custom list ${index + 1}`)
			.addText((text) =>
				text
					.setPlaceholder("Prefix")
					.setValue(list.prefix)
					.onChange((value) => {
						list.prefix = value;
						void this.plugin.saveSettings();
					}),
			)
			.addText((text) =>
				text
					.setPlaceholder("Property")
					.setValue(list.property)
					.onChange((value) => {
						list.property = value;
						void this.plugin.saveSettings();
					}),
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(OPERATOR_LABELS)
					.setValue(list.operator)
					.onChange((value) => {
						if (!isOperator(value)) return;
						list.operator = value;
						this.saveAndRedisplay();
					}),
			);

		if (operatorTakesValue(list.operator)) {
			setting.addText((text) =>
				text
					.setPlaceholder("Value")
					.setValue(list.value)
					.onChange((value) => {
						list.value = value;
						void this.plugin.saveSettings();
					}),
			);
		}

		setting.addExtraButton((button) =>
			button
				.setIcon("trash")
				.setTooltip(REMOVE_CUSTOM_LIST)
				.onClick(() => {
					this.plugin.settings.customLists.splice(index, 1);
					this.saveAndRedisplay();
				}),
		);
	}

	private saveAndRedisplay(): void {
		void this.plugin.saveSettings();
		this.display();
	}
}
