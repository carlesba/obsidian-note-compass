import { App, PluginSettingTab, debounce } from "obsidian";
import type { SettingDefinitionItem, SettingDefinitionPage } from "obsidian";
import { PERIODS } from "./lists/dateNotes";
import { createObsidianVault } from "./lists/obsidianVault";
import type { JumpListVault } from "./lists/vault";
import type NoteLauncherPlugin from "./main";
import { DATE_NOTE_SOURCE_KEY, periodKey, readControl, writeControl } from "./settings/controlKeys";
import {
	DATE_NOTE_SOURCE_OPTIONS,
	PERIOD_NAMES,
	formatError,
	readsCustomFormats,
	resolvedPeriodRows,
	resolvedSourceName,
} from "./settings/dateNotesForm";
import { newList, propertySuggestions } from "./settings/listForm";
import type { PropertySuggestion } from "./settings/listForm";
import { listPage } from "./settings/listPage";

const TYPED_FIELDS = ["prefix", "property", "text", "number", "date", "days", "folder", "format", "note"];

const TYPING_PAUSE_MS = 800;

export class NoteLauncherSettingTab extends PluginSettingTab {
	private plugin: NoteLauncherPlugin;
	private readonly refreshAfterTyping = debounce(() => this.update(), TYPING_PAUSE_MS, true);

	constructor(app: App, plugin: NoteLauncherPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const { lists } = this.plugin.settings;
		const vault = createObsidianVault(this.app);
		let suggestions: PropertySuggestion[] | undefined;
		const context = {
			app: this.app,
			propertyTypes: vault.propertyTypes(),
			propertySuggestions: () => (suggestions = suggestions ?? propertySuggestions(vault)),
			write: (key: string, value: unknown) => void this.setControlValue(key, value),
		};
		return [
			{
				type: "list",
				heading: "Jump to note",
				emptyState: "No lists yet. Add one to show notes in the picker.",
				items: lists.map((list) => listPage(list, context)),
				onReorder: (from, to) => this.changeLists(() => lists.splice(to, 0, ...lists.splice(from, 1))),
				onDelete: (index) => this.changeLists(() => lists.splice(index, 1)),
				addItem: { name: "Add list", action: () => this.changeLists(() => lists.push(newList(lists))) },
			},
			{ type: "group", items: [this.dateNotesPage(vault)] },
		];
	}

	getControlValue(key: string): unknown {
		return readControl(this.plugin.settings, key);
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (!writeControl(this.plugin.settings, key, value)) return;
		await this.plugin.saveSettings();
		if (TYPED_FIELDS.includes(key.split("/").pop() ?? "")) {
			this.refreshAfterTyping();
			return;
		}
		this.refreshDomState();
		this.update();
	}

	private changeLists(change: () => unknown): void {
		change();
		void this.plugin.saveSettings();
		this.update();
	}

	private dateNotesPage(vault: JumpListVault): SettingDefinitionPage {
		const { dateNotes } = this.plugin.settings;
		const custom = () => readsCustomFormats(dateNotes);
		return {
			type: "page",
			name: "Date notes",
			desc: "Where the adjacent dates and same day lists find day, week, month, quarter and year notes.",
			displayValue: () => resolvedSourceName(dateNotes, vault),
			items: [
				{
					name: "Read from",
					desc: "Automatic uses Periodic Notes when it is enabled, then the core Daily notes plugin, then Custom.",
					control: { type: "dropdown", key: DATE_NOTE_SOURCE_KEY, options: DATE_NOTE_SOURCE_OPTIONS },
				},
				{
					type: "group",
					heading: "Formats",
					visible: () => !custom(),
					items: resolvedPeriodRows(dateNotes, vault).map((row) => ({ name: row.name, desc: row.desc })),
				},
				...PERIODS.map((period) => ({
					type: "group" as const,
					heading: PERIOD_NAMES[period],
					visible: custom,
					items: [
						{ name: "Enabled", control: { type: "toggle" as const, key: periodKey(period, "enabled") } },
						{
							name: "Folder",
							control: { type: "folder" as const, key: periodKey(period, "folder"), includeRoot: true },
						},
						{
							name: "Format",
							desc: "A Moment format the note's name must match exactly.",
							control: { type: "text" as const, key: periodKey(period, "format"), validate: formatError },
						},
					],
				})),
			],
		};
	}
}
