import { App, PluginSettingTab, debounce } from "obsidian";
import type { SettingDefinitionItem, SettingDefinitionList, SettingDefinitionPage } from "obsidian";
import { PERIODS } from "./lists/dateNotes";
import { createObsidianVault } from "./lists/obsidianVault";
import type { JumpListVault } from "./lists/vault";
import type NoteLauncherPlugin from "./main";
import {
	DATE_NOTE_SOURCE_KEY,
	FLAGS_PREFIX_KEY,
	TEMPLATES_FOLDER_KEY,
	periodKey,
	readControl,
	writeControl,
} from "./settings/controlKeys";
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
import { flagRow, linkListPage, listPage } from "./settings/listPage";
import { newLinkList } from "./settings/setPropertiesForm";

const TYPED_FIELDS = [
	"prefix",
	"property",
	"text",
	"number",
	"date",
	"days",
	"folder",
	"format",
	"note",
	"name",
	"writesTo",
	"flagsPrefix",
	"templatesFolder",
];

const TYPING_PAUSE_MS = 800;

export class NoteLauncherSettingTab extends PluginSettingTab {
	private plugin: NoteLauncherPlugin;
	private readonly refreshAfterTyping = debounce(() => this.update(), TYPING_PAUSE_MS, true);

	constructor(app: App, plugin: NoteLauncherPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const { lists, setProperties } = this.plugin.settings;
		const { flags, linkLists } = setProperties;
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
				...this.editableEntries(lists),
				addItem: { name: "Add list", action: () => this.changeLists(() => lists.push(newList(lists))) },
			},
			{ type: "group", items: [this.dateNotesPage(vault)] },
			{
				type: "group",
				heading: "Set properties",
				items: [
					{
						name: "Flags prefix",
						desc: "Every flag row in the picker starts with it.",
						control: { type: "text", key: FLAGS_PREFIX_KEY },
					},
				],
			},
			{
				type: "list",
				heading: "Flags",
				emptyState: "No flags yet. Add one to switch a checkbox property from the picker.",
				items: flags.map((flag, index) => flagRow(flag, index, context)),
				...this.editableEntries(flags),
				addItem: { name: "Add flag", action: () => this.changeLists(() => flags.push("")) },
			},
			{
				type: "group",
				items: [
					{
						name: "Templates folder",
						desc: "Notes in this folder are never offered by the link lists.",
						control: { type: "folder", key: TEMPLATES_FOLDER_KEY },
					},
				],
			},
			{
				type: "list",
				heading: "Link lists",
				emptyState: "No link lists yet. Add one to link notes from the picker.",
				items: linkLists.map((list) => linkListPage(list, context)),
				...this.editableEntries(linkLists),
				addItem: { name: "Add link list", action: () => this.changeLists(() => linkLists.push(newLinkList(linkLists))) },
			},
		];
	}

	private editableEntries(entries: unknown[]): Pick<SettingDefinitionList, "onReorder" | "onDelete"> {
		return {
			onReorder: (from, to) => this.changeLists(() => entries.splice(to, 0, ...entries.splice(from, 1))),
			onDelete: (index) => this.changeLists(() => entries.splice(index, 1)),
		};
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
