import { App, Notice, PluginSettingTab, debounce } from "obsidian";
import type {
	SettingDefinitionGroup,
	SettingDefinitionItem,
	SettingDefinitionList,
	SettingDefinitionPage,
} from "obsidian";
import { createObsidianVault } from "./lists/obsidianVault";
import type { JumpListVault } from "./lists/vault";
import type NoteLauncherPlugin from "./main";
import { DATE_NOTE_SOURCE_KEY, periodKey, readControl, writeControl } from "./settings/controlKeys";
import {
	DATE_NOTE_SOURCE_OPTIONS,
	PERIOD_NAMES,
	customPeriods,
	dateNoteSourceDescription,
	formatError,
} from "./settings/dateNotesForm";
import { fitConditionToProperty, newList, propertySuggestions } from "./settings/listForm";
import type { PropertySuggestion } from "./settings/listForm";
import { listPage, listRow, propertyPage, propertyRow } from "./settings/listPage";
import type { ListPageContext } from "./settings/listPage";
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
	"excludedFolders",
];

const TYPING_PAUSE_MS = 800;

const SORTABLE_LIST_CLASS = "note-launcher-sortable-list";

const DATE_NOTE_FORMATS_PAGE_ID = "date-note-formats";

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
		const context: ListPageContext = {
			app: this.app,
			propertyTypes: vault.propertyTypes(),
			propertySuggestions: () => (suggestions = suggestions ?? propertySuggestions(vault)),
			write: (key: string, value: unknown) => void this.setControlValue(key, value),
			openPage: (pageId: string) => this.openPage(pageId),
			change: (change: () => unknown) => this.changeLists(change),
		};
		return [
			{
				type: "list",
				heading: "Jump to note",
				cls: SORTABLE_LIST_CLASS,
				emptyState: "No lists yet. Add one to show notes in the picker.",
				items: lists.map((list) => listRow(list, context)),
				...this.editableEntries(lists),
				addItem: { name: "Add list", action: () => this.changeLists(() => lists.push(newList(lists))) },
			},
			this.dateNotesSection(vault, context),
			{
				type: "list",
				heading: "Set properties",
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
					this.dateNoteFormatsPage(vault),
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
		if (TYPED_FIELDS.includes(key.split("/")[2] ?? "")) {
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

	private dateNotesSection(vault: JumpListVault, context: ListPageContext): SettingDefinitionGroup {
		const { dateNotes } = this.plugin.settings;
		return {
			type: "group",
			heading: "Date notes",
			items: [
				{
					name: "Read from",
					desc: dateNoteSourceDescription(dateNotes, vault),
					render: (setting) => {
						setting.addDropdown((dropdown) =>
							dropdown
								.addOptions(DATE_NOTE_SOURCE_OPTIONS)
								.setValue(dateNotes.from)
								.onChange((from) => context.write(DATE_NOTE_SOURCE_KEY, from)),
						);
						if (customPeriods(dateNotes, vault).length === 0) return;
						setting.addExtraButton((button) =>
							button
								.setIcon("pencil")
								.setTooltip("Edit formats")
								.onClick(() => context.openPage(DATE_NOTE_FORMATS_PAGE_ID)),
						);
					},
				},
			],
		};
	}

	private dateNoteFormatsPage(vault: JumpListVault): SettingDefinitionPage {
		const page: SettingDefinitionPage & { id: string } = {
			type: "page",
			id: DATE_NOTE_FORMATS_PAGE_ID,
			name: "Date note formats",
			items: customPeriods(this.plugin.settings.dateNotes, vault).map((period) => ({
				type: "group" as const,
				heading: PERIOD_NAMES[period],
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
		};
		return page;
	}
}
