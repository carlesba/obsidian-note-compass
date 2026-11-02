import { App, Notice, PluginSettingTab, debounce } from "obsidian";
import type {
	SettingDefinitionGroup,
	SettingDefinitionItem,
	SettingDefinitionList,
	SettingDefinitionPage,
	SettingDefinitionRender,
} from "obsidian";
import { t } from "./i18n";
import { createObsidianVault } from "./lists/obsidianVault";
import type { JumpListVault } from "./lists/vault";
import type NoteCompassPlugin from "./main";
import { mentionPicker } from "./mentions/settings";
import { allLists, defaultSettings, duplicateNotePicker, newListId, newNotePicker, notePickerName } from "./settings";
import {
	CHECKBOX_MODE_KEY,
	DATE_NOTE_SOURCE_KEY,
	MENTION_ENABLED_KEY,
	MENTION_PICKER_KEY,
	MENTION_TRIGGER_KEY,
	periodKey,
	readControl,
	writeControl,
} from "./settings/controlKeys";
import {
	customPeriods,
	dateNoteSourceDescription,
	dateNoteSourceOptions,
	formatError,
	periodName,
} from "./settings/dateNotesForm";
import { newForm, newFormId } from "./forms/form";
import { formClock } from "./forms/modal";
import { duplicateEntry, duplicateName } from "./settings/duplicate";
import { customFieldsList, formPage, formPageId, formRow } from "./settings/formPage";
import type { FormPageContext } from "./settings/formPage";
import type { FieldEditorState } from "./settings/fieldEditor";
import { propertySuggestions } from "./settings/listForm";
import type { PropertySuggestion } from "./settings/listForm";
import { propertyPage, propertyPageId, propertyRow } from "./settings/listPage";
import { notePickerPage, notePickerPageId, notePickerRow } from "./settings/notePickerPage";
import type { ListPageContext } from "./settings/listPage";
import { PrefixPages } from "./settings/prefixLinks";
import { ResetSettingsModal } from "./settings/resetModal";
import { checkboxModeOptions, newProperty } from "./settings/setPropertiesForm";
import { warningDescription } from "./settings/suggest";
import { tabPastRows } from "./settings/tabOrder";
import { taskCommandPage, taskCommandPageId, taskCommandRow, taskDestinationsPages } from "./settings/taskCommandPage";
import { newNumericId, newTaskCommand } from "./tasks/taskCommand";

const TYPED_FIELDS = [
	"prefix",
	"prefixColor",
	"folder",
	"format",
	"note",
	"name",
	"excludedFolders",
	"presetValues",
	"rowName",
];

const QUIETLY_SAVED_SCOPES = ["form", "formField", "formBlock", "customField", "fixedValue", "taskCommand", "taskAction"];

const TYPING_PAUSE_MS = 800;

const SORTABLE_LIST_CLASS = "note-compass-sortable-list";

const DATE_NOTE_FORMATS_PAGE_ID = "date-note-formats";

const NAVIGATION_PAGE_ID = "jump-to-note";

const PROPERTIES_PAGE_ID = "properties";

const FORMS_PAGE_ID = "forms";

const TASKS_PAGE_ID = "tasks";

function sectionPage(id: string, name: string, desc: string, items: SettingDefinitionItem[]): SettingDefinitionPage {
	const page: SettingDefinitionPage & { id: string } = { type: "page", id, name, desc, items };
	return page;
}

function hiddenPages(pages: SettingDefinitionPage[]): SettingDefinitionGroup {
	return { type: "group", visible: false, items: pages };
}

function pageIdOf(page: SettingDefinitionPage): string {
	const { id } = page as SettingDefinitionPage & { id?: string };
	return id ?? page.name;
}

export function pagePath(items: readonly SettingDefinitionItem[], pageId: string): string[] | undefined {
	for (const item of items) {
		if (!("type" in item)) continue;
		if (item.type === "page") {
			if (pageIdOf(item) === pageId) return [pageId];
			const inner = item.items ? pagePath(item.items, pageId) : undefined;
			if (inner) return [pageIdOf(item), ...inner];
			continue;
		}
		const inGroup = item.items ? pagePath(item.items, pageId) : undefined;
		if (inGroup) return inGroup;
	}
	return undefined;
}

export function pageAt(items: readonly SettingDefinitionItem[], path: readonly string[]): SettingDefinitionPage | undefined {
	const [pageId, ...rest] = path;
	if (pageId === undefined) return undefined;
	for (const item of items) {
		if (!("type" in item)) continue;
		if (item.type === "page") {
			if (pageIdOf(item) !== pageId) continue;
			if (rest.length === 0) return item;
			return item.items ? pageAt(item.items, rest) : undefined;
		}
		const inGroup = item.items ? pageAt(item.items, path) : undefined;
		if (inGroup) return inGroup;
	}
	return undefined;
}

interface OpenSettingPage {
	pagePath?: unknown;
	title?: string;
}

interface SettingModal {
	openPagePath?: (tabId: string, path: string[]) => unknown;
	pageStack?: { page?: OpenSettingPage }[];
	updatePageTitle?: () => void;
	activeTab?: unknown;
	tabContentContainer?: unknown;
	focusSidebar?: () => void;
}

interface AppWithSettingModal {
	setting?: SettingModal;
}

export class NoteCompassSettingTab extends PluginSettingTab {
	private plugin: NoteCompassPlugin;
	private readonly refreshAfterTyping = debounce(() => this.update(), TYPING_PAUSE_MS, true);
	private readonly fieldEditor: FieldEditorState = { expanded: new Map() };
	private definitionsAreStale = false;
	private readonly prefixes = new PrefixPages(() => this.plugin.settings);

	constructor(app: App, plugin: NoteCompassPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.listenForTab();
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		this.definitionsAreStale = false;
		const { customFields, forms, notePickers, setProperties, taskCommands } = this.plugin.settings;
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
			prefixes: this.prefixes,
			prefixChanged: () => void this.savePrefixes(),
			showPrefixes: true,
		};
		const formContext: FormPageContext = {
			...context,
			fieldEditor: this.fieldEditor,
			formClock: () => formClock(vault, this.plugin.settings.dateNotes),
			customFields: () => this.plugin.settings.customFields,
			refresh: () => this.update(),
			saveQuietly: (change: () => unknown) => {
				change();
				this.definitionsAreStale = true;
				void this.plugin.saveSettings();
			},
		};
		const pickerContext = { ...context, allListIds: () => allLists(this.plugin.settings) };
		const notePickersList: SettingDefinitionList = {
			type: "list",
			cls: SORTABLE_LIST_CLASS,
			emptyState: t("noNotePickersYet"),
			items: notePickers.map((picker) =>
				notePickerRow(picker, context, () => this.changeLists(() => duplicateNotePicker(notePickers, picker, duplicateName(picker.name)))),
			),
			...this.editableEntries(notePickers),
			addItem: {
				name: t("addNotePicker"),
				action: () => {
					const picker = newNotePicker(notePickers);
					this.changeLists(() => notePickers.push(picker));
					this.openPage(notePickerPageId(picker));
				},
			},
		};
		const propertiesList: SettingDefinitionList = {
			type: "list",
			cls: SORTABLE_LIST_CLASS,
			emptyState: t("noPropertiesYet"),
			items: properties.map((entry) =>
				propertyRow(entry, properties, context, () => this.changeLists(() => duplicateEntry(properties, entry, newListId(properties)))),
			),
			...this.editableEntries(properties),
			addItem: {
				name: t("addProperty"),
				action: () => {
					const entry = newProperty(properties);
					this.changeLists(() => properties.push(entry));
					this.openPage(propertyPageId(entry));
				},
			},
		};
		const formsList: SettingDefinitionList = {
			type: "list",
			heading: t("forms"),
			cls: SORTABLE_LIST_CLASS,
			emptyState: t("noFormsListed"),
			items: forms.map((form) =>
				formRow(form, formContext, () =>
					this.changeLists(() => duplicateEntry(forms, form, newFormId(forms), (copy) => (copy.name = duplicateName(form.name)))),
				),
			),
			...this.editableEntries(forms),
			addItem: {
				name: t("addForm"),
				action: () => {
					const form = newForm(forms);
					this.changeLists(() => forms.push(form));
					this.openPage(formPageId(form));
				},
			},
		};
		const taskCommandsList: SettingDefinitionList = {
			type: "list",
			cls: SORTABLE_LIST_CLASS,
			emptyState: t("noTaskCommandsYet"),
			items: taskCommands.map((command) =>
				taskCommandRow(command, formContext, () =>
					this.changeLists(() =>
						duplicateEntry(taskCommands, command, newNumericId(taskCommands), (copy) => (copy.name = duplicateName(command.name))),
					),
				),
			),
			...this.editableEntries(taskCommands),
			addItem: {
				name: t("addTaskCommand"),
				action: () => {
					const command = newTaskCommand(taskCommands);
					this.changeLists(() => taskCommands.push(command));
					this.openPage(taskCommandPageId(command));
				},
			},
		};
		return [
			{
				type: "group",
				items: [
					{
						name: t("settingsIntro"),
						desc: t("settingsIntroDesc"),
						searchable: false,
						render: (setting) => setting.settingEl.addClass("note-compass-settings-intro"),
					},
				],
			},
			{
				type: "group",
				items: [
					sectionPage(NAVIGATION_PAGE_ID, t("navigationSection"), t("navigationSectionDesc"), [
						notePickersList,
						this.mentionGroup(),
						hiddenPages(notePickers.map((picker) => notePickerPage(picker, pickerContext))),
					]),
					sectionPage(PROPERTIES_PAGE_ID, t("propertiesSection"), t("propertiesSectionDesc"), [
						propertiesList,
						{
							type: "group",
							items: [
								{
									name: t("checkboxBehaviour"),
									desc: t("checkboxBehaviourDesc"),
									control: { type: "dropdown", key: CHECKBOX_MODE_KEY, options: checkboxModeOptions() },
								},
							],
						},
						hiddenPages(properties.map((entry) => propertyPage(entry, properties, formContext))),
					]),
					sectionPage(FORMS_PAGE_ID, t("forms"), t("formsSectionDesc"), [
						formsList,
						customFieldsList(customFields, formContext),
						hiddenPages(forms.map((form) => formPage(form, formContext))),
					]),
					sectionPage(TASKS_PAGE_ID, t("tasksSection"), t("tasksSectionDesc"), [
						taskCommandsList,
						hiddenPages(taskCommands.flatMap((command) => [taskCommandPage(command, formContext), ...taskDestinationsPages(command, formContext)])),
					]),
				],
			},
			{ type: "group", heading: t("integrations"), items: [this.dateNotesSource(vault, context)] },
			hiddenPages([this.dateNoteFormatsPage(vault)]),
			{
				type: "group",
				items: [
					{
						name: t("resetAllSettings"),
						desc: t("resetAllSettingsDesc"),
						render: (setting) => {
							setting.addButton((button) =>
								button
									.setButtonText(t("reset"))
									.setDestructive()
									.onClick(() => new ResetSettingsModal(this.app, () => void this.resetSettings()).open()),
							);
						},
					},
				],
			},
		];
	}

	private mentionGroup(): SettingDefinitionGroup {
		const { mention, notePickers } = this.plugin.settings;
		const pickerWarning = !mention.trigger ? t("mentionTriggerEmpty") : mentionPicker(mention, notePickers) ? undefined : t("mentionPickerOff");
		const pickerOptions = Object.fromEntries(
			notePickers.filter((picker) => !picker.unreadable).map((picker) => [picker.id, notePickerName(picker)]),
		);
		const isOn = () => this.plugin.settings.mention.enabled;
		return {
			type: "group",
			heading: t("mentionSection"),
			items: [
				{ name: t("enabled"), desc: t("mentionEnabledDesc"), control: { type: "toggle", key: MENTION_ENABLED_KEY } },
				{
					name: t("mentionTrigger"),
					desc: t("mentionTriggerDesc"),
					visible: isOn,
					control: { type: "text", key: MENTION_TRIGGER_KEY, placeholder: "@" },
				},
				{
					name: t("mentionPicker"),
					desc: pickerWarning ? createFragment((fragment) => warningDescription(fragment.createDiv(), pickerWarning)) : t("mentionPickerDesc"),
					visible: isOn,
					control: { type: "dropdown", key: MENTION_PICKER_KEY, options: pickerOptions },
				},
			],
		};
	}

	hide(): void {
		this.fieldEditor.expanded.clear();
		this.prefixes.clear();
		super.hide();
	}

	private settingModal(): SettingModal | undefined {
		return (this.app as unknown as AppWithSettingModal).setting;
	}

	private listenForTab(): void {
		const modal = this.settingModal();
		const containerEl = modal?.tabContentContainer;
		if (!modal || !isHTMLElement(containerEl)) return;
		const leaveBefore = () => {
			if (typeof modal.focusSidebar !== "function") return false;
			modal.focusSidebar();
			return true;
		};
		this.plugin.registerDomEvent(
			containerEl,
			"keydown",
			(event) => {
				if (modal.activeTab === this) tabPastRows(event, containerEl, leaveBefore);
			},
			{ capture: true },
		);
	}

	private openPage(pageId: string): void {
		const modal = this.settingModal();
		if (typeof modal?.openPagePath !== "function") {
			new Notice(t("needsNewerObsidian"));
			return;
		}
		if (this.definitionsAreStale) this.update();
		modal.openPagePath(this.plugin.manifest.id, pagePath(this.settingItems, pageId) ?? [pageId]);
	}

	private refreshPageTitle(): void {
		const modal = this.settingModal();
		if (modal?.activeTab !== this || typeof modal.updatePageTitle !== "function") return;
		const page = modal.pageStack?.at(-1)?.page;
		const path = page?.pagePath;
		if (!page || !Array.isArray(path) || !path.every((part) => typeof part === "string")) return;
		const definition = pageAt(this.settingItems, path);
		if (!definition || page.title === definition.name) return;
		page.title = definition.name;
		modal.updatePageTitle();
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
		this.refreshPageTitle();
		const [scope = "", , field = ""] = key.split("/");
		if (QUIETLY_SAVED_SCOPES.includes(scope)) this.definitionsAreStale = true;
		await this.plugin.saveSettings();
		if (QUIETLY_SAVED_SCOPES.includes(scope)) {
			this.refreshDomState();
			return;
		}
		if (TYPED_FIELDS.includes(field) || key === MENTION_TRIGGER_KEY) {
			this.refreshAfterTyping();
			return;
		}
		this.refreshDomState();
		this.update();
	}

	private async savePrefixes(): Promise<void> {
		await this.plugin.saveSettings();
		this.refreshDomState();
		this.update();
	}

	private async resetSettings(): Promise<void> {
		this.plugin.settings = defaultSettings();
		this.prefixes.clear();
		await this.plugin.saveSettings();
		this.update();
	}

	private changeLists(change: () => unknown): void {
		change();
		void this.plugin.saveSettings();
		this.update();
	}

	private dateNotesSource(vault: JumpListVault, context: ListPageContext): SettingDefinitionRender {
		const { dateNotes } = this.plugin.settings;
		return {
			name: t("dateNotesSource"),
			desc: dateNoteSourceDescription(dateNotes, vault),
			render: (setting) => {
				setting.addDropdown((dropdown) =>
					dropdown
						.addOptions(dateNoteSourceOptions())
						.setValue(dateNotes.from)
						.onChange((from) => context.write(DATE_NOTE_SOURCE_KEY, from)),
				);
				if (customPeriods(dateNotes, vault).length === 0) return;
				setting.addExtraButton((button) =>
					button
						.setIcon("pencil")
						.setTooltip(t("editFormats"))
						.onClick(() => context.openPage(DATE_NOTE_FORMATS_PAGE_ID)),
				);
			},
		};
	}

	private dateNoteFormatsPage(vault: JumpListVault): SettingDefinitionPage {
		const page: SettingDefinitionPage & { id: string } = {
			type: "page",
			id: DATE_NOTE_FORMATS_PAGE_ID,
			name: t("dateNoteFormats"),
			items: customPeriods(this.plugin.settings.dateNotes, vault).map((period) => ({
				type: "group" as const,
				heading: periodName(period),
				items: [
					{ name: t("enabled"), control: { type: "toggle" as const, key: periodKey(period, "enabled") } },
					{
						name: t("folder"),
						control: { type: "folder" as const, key: periodKey(period, "folder"), includeRoot: true },
					},
					{
						name: t("format"),
						desc: t("formatDesc"),
						control: { type: "text" as const, key: periodKey(period, "format"), validate: formatError },
					},
				],
			})),
		};
		return page;
	}
}

function isHTMLElement(value: unknown): value is HTMLElement {
	if (typeof value !== "object" || value === null) return false;
	const node: { instanceOf?: Node["instanceOf"] } = value;
	return typeof node.instanceOf === "function" && node.instanceOf(HTMLElement);
}
