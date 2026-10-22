import { App, Notice, PluginSettingTab, debounce } from "obsidian";
import type { SettingDefinitionItem, SettingDefinitionList, SettingDefinitionPage } from "obsidian";
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
import { fitConditionToProperty, newList, propertySuggestions } from "./settings/listForm";
import type { PropertySuggestion } from "./settings/listForm";
import { listPage, listRow, propertyPage, propertyRow } from "./settings/listPage";
import { hasSource, newProperty } from "./settings/setPropertiesForm";

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
	"excludedFolder",
];

const TYPING_PAUSE_MS = 800;

const SORTABLE_LIST_CLASS = "note-launcher-sortable-list";

interface SettingModal {
	openPagePath?: (tabId: string, path: string[]) => unknown;
}

interface AppWithSettingModal {
	setting?: SettingModal;
}

export class NoteLauncherSettingTab extends PluginSettingTab {
	private plugin: NoteLauncherPlugin;
	private readonly refreshAfterTyping = debounce(() => this.update(), TYPING_PAUSE_MS, true);

	constructor(app: App, plugin: NoteLauncherPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const { lists, setProperties } = this.plugin.settings;
		const { properties } = setProperties;
		const vault = createObsidianVault(this.app);
		let suggestions: PropertySuggestion[] | undefined;
		const context = {
			app: this.app,
			propertyTypes: vault.propertyTypes(),
			propertySuggestions: () => (suggestions = suggestions ?? propertySuggestions(vault)),
			write: (key: string, value: unknown) => void this.setControlValue(key, value),
			openPage: (pageId: string) => this.openPage(pageId),
		};
		return [
			sectionHeading("Jump to note", "Pick a note related to the one in focus, from the lists below, in this order."),
			{
				type: "list",
				cls: SORTABLE_LIST_CLASS,
				emptyState: "No lists yet. Add one to show notes in the picker.",
				items: lists.map((list) => listRow(list, context)),
				...this.editableEntries(lists),
				addItem: { name: "Add list", action: () => this.changeLists(() => lists.push(newList(lists))) },
			},
			{ type: "group", items: [this.dateNotesPage(vault)] },
			sectionHeading(
				"Set properties",
				"Edit the focused note's properties from a picker. Each row is a property the picker offers.",
			),
			{
				type: "list",
				cls: SORTABLE_LIST_CLASS,
				emptyState: "No properties yet. Add one to edit it from the picker.",
				items: properties.map((entry) => propertyRow(entry, properties, context)),
				...this.editableEntries(properties),
				addItem: {
					name: "Add property",
					action: () => this.changeLists(() => properties.push(newProperty(properties))),
				},
			},
			{
				type: "group",
				visible: false,
				items: [
					...lists.map((list) => listPage(list, context)),
					...properties.map((entry) => propertyPage(entry, properties, context)),
				],
			},
		];
	}

	private openPage(pageId: string): void {
		const modal = (this.app as unknown as AppWithSettingModal).setting;
		if (typeof modal?.openPagePath !== "function") {
			new Notice("Editing a list needs Obsidian 1.13 or later.");
			return;
		}
		modal.openPagePath(this.plugin.manifest.id, [pageId]);
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
		if (key.endsWith("/property")) this.fitCondition(key);
		await this.plugin.saveSettings();
		if (TYPED_FIELDS.includes(key.split("/").pop() ?? "")) {
			this.refreshAfterTyping();
			return;
		}
		this.refreshDomState();
		this.update();
	}

	private fitCondition(key: string): void {
		const [scope, id] = key.split("/");
		const { lists, setProperties } = this.plugin.settings;
		const propertyTypes = createObsidianVault(this.app).propertyTypes();
		const list = scope === "list" ? lists.find((candidate) => candidate.id === id) : undefined;
		if (list) fitConditionToProperty(list, propertyTypes);
		const entry = scope === "propertySource" ? setProperties.properties.find((candidate) => candidate.id === id) : undefined;
		if (entry && hasSource(entry)) fitConditionToProperty(entry, propertyTypes);
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

function sectionHeading(heading: string, description: string): SettingDefinitionItem {
	return { type: "group", heading, items: [{ name: "", desc: description, searchable: false }] };
}
