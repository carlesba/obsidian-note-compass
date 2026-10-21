import { App, PluginSettingTab, Setting } from "obsidian";
import type { DateValue } from "./lists/conditions";
import type JumpListPlugin from "./main";
import type { ListSource, NoteList, RelationSourceKind } from "./settings";

const LISTS_HEADING = "Jump to note";

const LIST_DESC = "Show this list in the picker, with its rows starting with the prefix.";

const RELATION_SOURCE_NAMES: Record<RelationSourceKind, string> = {
	adjacentDates: "Adjacent dates",
	linksOut: "Outbound links",
	linksIn: "Inbound links",
	sameDay: "Same day",
};

export class JumpListSettingTab extends PluginSettingTab {
	private plugin: JumpListPlugin;

	constructor(app: App, plugin: JumpListPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName(LISTS_HEADING).setHeading();
		for (const list of this.plugin.settings.lists) this.addList(list);
	}

	private addList(list: NoteList): void {
		new Setting(this.containerEl)
			.setName(sourceName(list.source))
			.setDesc(LIST_DESC)
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
}

function sourceName(source: ListSource): string {
	if (source.kind !== "frontmatter") return RELATION_SOURCE_NAMES[source.kind];
	const { property, condition } = source;
	const value = "value" in condition ? ` ${describeValue(condition.value)}` : "";
	return `Property ${property} ${condition.operator}${value}`;
}

function describeValue(value: string | number | DateValue): string {
	if (typeof value !== "object") return String(value);
	if (value.kind === "fixed") return value.date;
	return value.days === 0 ? "today" : `today ${value.days > 0 ? "+" : "-"} ${Math.abs(value.days)} days`;
}
