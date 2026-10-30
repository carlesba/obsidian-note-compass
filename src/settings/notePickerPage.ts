import type { SettingDefinition, SettingDefinitionItem, SettingDefinitionList, SettingDefinitionPage } from "obsidian";
import { t } from "../i18n";
import { newListId, notePickerName } from "../settings";
import type { NotePicker } from "../settings";
import { notePickerKey } from "./controlKeys";
import { duplicateEntry } from "./duplicate";
import { newList } from "./listForm";
import { editableRow, listPage, listPageId, listRow } from "./listPage";
import type { ListPageContext } from "./listPage";
import { warningDescription } from "./suggest";

type IdentifiedPage = SettingDefinitionPage & { id: string };

export interface NotePickerPageContext extends ListPageContext {
	allListIds: () => { id: string }[];
}

export function notePickerPageId(picker: NotePicker): string {
	return `note-picker-${picker.id}`;
}

export function notePickerWarning(picker: NotePicker): string | undefined {
	if (picker.unreadable) return t("unreadableNotePickerWarning");
	return picker.lists.length === 0 ? t("notePickerNeedsList") : undefined;
}

export function notePickerRow(picker: NotePicker, context: ListPageContext, duplicate?: () => void): SettingDefinition {
	return editableRow(
		{
			name: notePickerName(picker),
			label: notePickerName(picker),
			warning: notePickerWarning(picker),
			broken: picker.unreadable !== undefined,
			enabled: picker.enabled,
			enabledKey: notePickerKey(picker.id, "enabled"),
			enabledTooltip: t("offerNotePicker"),
			pageId: notePickerPageId(picker),
			editTooltip: t("editNotePicker"),
			duplicate,
		},
		{ ...context, showPrefixes: false },
	);
}

export function notePickerPage(picker: NotePicker, context: NotePickerPageContext): SettingDefinitionPage {
	const items: SettingDefinitionItem[] = picker.unreadable
		? [
				{
					name: t("notePickerUnreadable"),
					desc: t("unreadableNotePickerWarning"),
					searchable: false,
					render: (setting) => warningDescription(setting.descEl, t("unreadableNotePickerWarning")),
				},
			]
		: [
				{
					type: "group",
					heading: t("notePickerSection"),
					items: [
						{ name: t("enabled"), desc: t("notePickerEnabledDesc"), control: { type: "toggle", key: notePickerKey(picker.id, "enabled") } },
						{
							name: t("notePickerName"),
							desc: t("notePickerNameDesc"),
							control: { type: "text", key: notePickerKey(picker.id, "name"), placeholder: t("defaultNotePickerName") },
						},
					],
				},
				notePickerLists(picker, context),
				{ type: "group", visible: false, items: picker.lists.map((list) => listPage(list, context)) },
			];
	const page: IdentifiedPage = {
		type: "page",
		id: notePickerPageId(picker),
		name: notePickerName(picker),
		displayValue: () => (picker.enabled && !picker.unreadable ? "" : t("off")),
		status: () => (notePickerWarning(picker) ? "warning" : null),
		items,
	};
	return page;
}

function notePickerLists(picker: NotePicker, context: NotePickerPageContext): SettingDefinitionList {
	const { lists } = picker;
	return {
		type: "list",
		heading: t("notePickerLists"),
		cls: "note-compass-sortable-list",
		emptyState: t("noListsYet"),
		items: lists.map((list) => listRow(list, context, () => context.change(() => duplicateEntry(lists, list, newListId(context.allListIds()))))),
		onReorder: (from, to) => context.change(() => lists.splice(to, 0, ...lists.splice(from, 1))),
		onDelete: (index) => context.change(() => lists.splice(index, 1)),
		addItem: {
			name: t("addList"),
			action: () => {
				const list = newList(context.allListIds());
				context.change(() => lists.push(list));
				context.openPage(listPageId(list));
			},
		},
	};
}
