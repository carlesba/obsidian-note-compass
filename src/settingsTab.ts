import { App, Notice, PluginSettingTab, debounce } from "obsidian";
import type {
	SettingDefinitionGroup,
	SettingDefinitionItem,
	SettingDefinitionList,
	SettingDefinitionPage,
} from "obsidian";
import { createObsidianVault } from "./lists/obsidianVault";
import type { JumpListVault } from "./lists/vault";
import type NoteCompassPlugin from "./main";
import { defaultSettings } from "./settings";
import {
	DATE_NOTE_SOURCE_KEY,
	SHOW_PREFIXES_KEY,
	periodKey,
	prefixColorKey,
	readControl,
	writeControl,
} from "./settings/controlKeys";
import {
	DATE_NOTE_SOURCE_OPTIONS,
	PERIOD_NAMES,
	customPeriods,
	dateNoteSourceDescription,
	formatError,
} from "./settings/dateNotesForm";
import { newList, propertySuggestions } from "./settings/listForm";
import type { PropertySuggestion } from "./settings/listForm";
import { listPage, listPageId, listRow, propertyPage, propertyPageId, propertyRow } from "./settings/listPage";
import type { ListPageContext } from "./settings/listPage";
import { changedColor, changedPrefix } from "./settings/prefixChip";
import type { PrefixDraft } from "./settings/prefixChip";
import { ResetSettingsModal } from "./settings/resetModal";
import { newProperty } from "./settings/setPropertiesForm";

const TYPED_FIELDS = [
	"prefix",
	"prefixColor",
	"folder",
	"newNoteFolder",
	"format",
	"note",
	"name",
	"excludedFolders",
	"presetValues",
];

const TYPING_PAUSE_MS = 800;

const SORTABLE_LIST_CLASS = "note-compass-sortable-list";

const DATE_NOTE_FORMATS_PAGE_ID = "date-note-formats";

interface SettingModal {
	openPagePath?: (tabId: string, path: string[]) => unknown;
}

interface AppWithSettingModal {
	setting?: SettingModal;
}

export class NoteCompassSettingTab extends PluginSettingTab {
	private plugin: NoteCompassPlugin;
	private readonly refreshAfterTyping = debounce(() => this.update(), TYPING_PAUSE_MS, true);
	private readonly prefixDrafts = new Map<string, PrefixDraft>();

	constructor(app: App, plugin: NoteCompassPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const { lists, setProperties, showPrefixes } = this.plugin.settings;
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
			prefixDrafts: this.prefixDrafts,
			showPrefixes,
		};
		return [
			{
				type: "group",
				heading: "Display",
				items: [
					{
						name: "Show prefixes",
						desc: "Start each row in the pickers with its list's or property's prefix.",
						control: { type: "toggle", key: SHOW_PREFIXES_KEY },
					},
				],
			},
			{
				type: "list",
				heading: "Jump to note",
				cls: SORTABLE_LIST_CLASS,
				emptyState: "No lists yet. Add one to show notes in the picker.",
				items: lists.map((list) => listRow(list, context)),
				...this.editableEntries(lists),
				addItem: {
					name: "Add list",
					action: () => {
						const list = newList(lists);
						this.changeLists(() => lists.push(list));
						this.openPage(listPageId(list));
					},
				},
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
					action: () => {
						const entry = newProperty(properties);
						this.changeLists(() => properties.push(entry));
						this.openPage(propertyPageId(entry));
					},
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
			{
				type: "group",
				items: [
					{
						name: "Reset all settings",
						desc: "Put every list, property and option back to the defaults.",
						render: (setting) => {
							setting.addButton((button) =>
								button
									.setButtonText("Reset")
									.setDestructive()
									.onClick(() => new ResetSettingsModal(this.app, () => void this.resetSettings()).open()),
							);
						},
					},
				],
			},
		];
	}

	hide(): void {
		for (const [key, draft] of this.prefixDrafts) {
			const prefix = changedPrefix(draft);
			if (prefix !== undefined) void this.setControlValue(key, prefix);
			const color = changedColor(draft);
			if (color !== undefined) void this.setControlValue(prefixColorKey(key), color);
		}
		this.prefixDrafts.clear();
		super.hide();
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
		await this.plugin.saveSettings();
		if (TYPED_FIELDS.includes(key.split("/")[2] ?? "")) {
			this.refreshAfterTyping();
			return;
		}
		this.refreshDomState();
		this.update();
	}

	private async resetSettings(): Promise<void> {
		this.plugin.settings = defaultSettings();
		this.prefixDrafts.clear();
		await this.plugin.saveSettings();
		this.update();
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
