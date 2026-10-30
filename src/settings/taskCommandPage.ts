import { DropdownComponent, ExtraButtonComponent, Menu, Notice, Platform, TextComponent } from "obsidian";
import type { Setting, SettingDefinition, SettingDefinitionItem, SettingDefinitionList, SettingDefinitionPage } from "obsidian";
import { t } from "../i18n";
import type { TranslationKey } from "../i18n";
import { createObsidianVault } from "../lists/obsidianVault";
import { actionName, taskKeyLabel } from "../tasks/picker";
import { TASK_KEYS, keysRunning, taskCommandName } from "../tasks/taskCommand";
import type { TaskAction, TaskCommand } from "../tasks/taskCommand";
import { taskActionKey, taskCommandKey } from "./controlKeys";
import { duplicateEntry } from "./duplicate";
import { FOCUS_ATTRIBUTE, dropdownRow, editorRow, expandableRow, renderEditor, textRow, toggleRow } from "./fieldEditor";
import type { EditorBinding, ExpandingPageContext, Redraw } from "./fieldEditor";
import { editableRow } from "./listPage";
import type { EditableRow, ListPageContext } from "./listPage";
import { sortableRows } from "./sortable";
import { NoteSuggest, warningDescription } from "./suggest";
import {
	NOTE_DESTINATION_OPTION,
	addKeyBinding,
	addStatus,
	availableStatuses,
	deleteKeyBinding,
	keyBindingActionOptions,
	keyBindingKeyOptions,
	keyBindingWarning,
	removeStatus,
	statusLabel,
	addTaskAction,
	addTaskDestination,
	completionDateOptions,
	deleteTaskAction,
	destinationNoteWarning,
	destinationOption,
	destinationOptions,
	duplicatedActionId,
	moveTaskAction,
	moveTaskDestination,
	readTaskActionSetting,
	removeTaskDestination,
	taskActionKindLabel,
	taskActionKindOptions,
	taskActionWarning,
	taskCommandWarning,
} from "./taskCommandsForm";
import type { TaskActionSetting, TaskCommandSetting } from "./taskCommandsForm";

type IdentifiedPage = SettingDefinitionPage & { id: string };

interface ActionEditor extends EditorBinding<TaskActionSetting> {
	command: TaskCommand;
	action: TaskAction;
	context: ExpandingPageContext;
	changed: () => void;
}

export function taskCommandPageId(command: TaskCommand): string {
	return `task-command-${command.id}`;
}

function expandedListId(command: TaskCommand): string {
	return `task-command-${command.id}`;
}

export function taskCommandRow(command: TaskCommand, context: ExpandingPageContext, duplicate?: () => void): SettingDefinition {
	const row = (): EditableRow => ({
		name: taskCommandName(command),
		label: taskCommandName(command),
		warning: taskCommandWarning(command),
		broken: command.unreadable !== undefined,
		enabled: command.enabled,
		enabledKey: taskCommandKey(command.id, "enabled"),
		enabledTooltip: t("offerTaskCommand"),
		pageId: taskCommandPageId(command),
		editTooltip: t("editTaskCommand"),
		duplicate,
	});
	const rowContext: ListPageContext = {
		...context,
		showPrefixes: false,
		openPage: (pageId) => {
			context.fieldEditor.expanded.delete(expandedListId(command));
			context.openPage(pageId);
		},
	};
	const definition = editableRow(row(), rowContext);
	return {
		...definition,
		render: (setting, group) => {
			const current = row();
			setting.setName(current.label);
			setting.setDesc(current.warning ?? "");
			return editableRow(current, rowContext).render(setting, group);
		},
	};
}

export function taskCommandPage(command: TaskCommand, context: ExpandingPageContext): SettingDefinitionPage {
	const key = (setting: TaskCommandSetting) => taskCommandKey(command.id, setting);
	const headers = new Map<string, () => void>();
	const items: SettingDefinitionItem[] = command.unreadable
		? [
				{
					name: t("taskCommandUnreadable"),
					desc: t("unreadableTaskCommandWarning"),
					searchable: false,
					render: (setting) => warningDescription(setting.descEl, t("unreadableTaskCommandWarning")),
				},
			]
		: [
				{
					type: "group",
					heading: t("taskCommandSection"),
					items: [
						{ name: t("enabled"), desc: t("taskCommandEnabledDesc"), control: { type: "toggle", key: key("enabled") } },
						{
							name: t("taskCommandName"),
							desc: t("taskCommandNameDesc"),
							control: { type: "text", key: key("name"), placeholder: t("defaultTaskCommandName") },
						},
					],
				},
				statusList(command, context, "statuses", t("taskStatuses"), t("taskStatusesDesc"), "taskAllStatuses"),
				statusList(command, context, "skippedStatuses", t("taskSkippedStatuses"), t("taskSkippedStatusesDesc"), "noSkippedTasks"),
				{
					type: "group",
					heading: t("taskOptionsSection"),
					items: [
						{ name: t("taskSelectAll"), desc: t("taskSelectAllDesc"), control: { type: "toggle", key: key("selectAll") } },
						{
							name: t("taskBatchMode"),
							desc: t("taskBatchModeDesc"),
							render: (setting) => {
								setting.addToggle((toggle) =>
									toggle.setValue(command.batch).onChange((batch) => {
										context.write(key("batch"), batch);
										for (const showHeader of headers.values()) showHeader();
									}),
								);
							},
						},
					],
				},
				actionList(command, context, headers),
				keymapList(command, context, headers),
			];
	const page: IdentifiedPage = {
		type: "page",
		id: taskCommandPageId(command),
		name: taskCommandName(command),
		displayValue: () => (command.enabled && !command.unreadable ? "" : t("off")),
		status: () => (taskCommandWarning(command) ? "warning" : null),
		items,
	};
	return page;
}

type StatusField = "statuses" | "skippedStatuses";

function statusList(
	command: TaskCommand,
	context: ExpandingPageContext,
	field: StatusField,
	heading: string,
	desc: string,
	placeholder: TranslationKey,
): SettingDefinitionList {
	let pills: StatusPills | undefined;
	return {
		type: "list",
		heading,
		items: [
			{
				name: heading,
				desc,
				searchable: false,
				render: (setting) => {
					pills = statusPills(setting, command, context, field, placeholder);
				},
			},
		],
		addItem: {
			name: t("taskAddStatus"),
			action: (el) => {
				const menu = new Menu();
				for (const [status, label] of availableStatuses(command[field])) {
					menu.addItem((item) => item.setTitle(label).onClick(() => pills?.update(addStatus(command[field], status))));
				}
				menu.addItem((item) => item.setTitle(t("taskCustomStatus")).onClick(() => pills?.customInput()));
				const { left, bottom } = el.getBoundingClientRect();
				menu.showAtPosition({ x: left, y: bottom });
			},
		},
	};
}

interface StatusPills {
	update: (value: string) => void;
	customInput: () => void;
}

function statusPills(
	setting: Setting,
	command: TaskCommand,
	context: ExpandingPageContext,
	field: StatusField,
	placeholder: TranslationKey,
): StatusPills {
	setting.settingEl.addClass("note-compass-status-setting");
	setting.nameEl.empty();
	const container = setting.nameEl.createDiv({ cls: "note-compass-status-pills" });
	const update = (value: string) => {
		context.write(taskCommandKey(command.id, field), value);
		draw();
	};
	const customInput = () => {
		const input = new TextComponent(container).setPlaceholder(t("taskCustomStatus"));
		input.inputEl.addClass("note-compass-status-input");
		input.inputEl.setAttribute("aria-label", t("taskCustomStatus"));
		input.inputEl.addEventListener("keydown", (event) => {
			if (event.key === "Escape") input.inputEl.remove();
			if (event.key !== "Enter") return;
			event.preventDefault();
			const value = addStatus(command[field], input.getValue());
			if (value !== command[field]) update(value);
			else {
				input.inputEl.setAttribute("aria-invalid", "true");
				input.inputEl.setAttribute("title", t("taskInvalidStatus"));
			}
		});
		input.inputEl.focus();
	};
	const draw = () => {
		container.empty();
		if (command[field] === "") container.createSpan({ cls: "note-compass-status-empty", text: t(placeholder) });
		for (const status of command[field]) {
			const pill = container.createSpan({ cls: "note-compass-field-badge note-compass-status-pill" });
			pill.createSpan({ text: statusLabel(status) });
			const remove = new ExtraButtonComponent(pill)
				.setIcon("x")
				.setTooltip(t("taskRemoveStatus", { status: statusLabel(status) }))
				.onClick(() => update(removeStatus(command[field], status)));
			remove.extraSettingsEl.addClass("note-compass-status-remove");
		}
	};
	draw();
	return { update, customInput };
}

function keymapList(command: TaskCommand, context: ExpandingPageContext, headers: Map<string, () => void>): SettingDefinitionList {
	return {
		type: "list",
		heading: t("taskKeymap"),
		cls: "note-compass-keymap-list",
		emptyState: t("noTaskKeyBindings"),
		items: command.keymap.map((binding, index) => ({
			name: taskKeyLabel(binding.key, Platform.isMacOS),
			searchable: false,
			render: (setting: Setting) => keyBindingInputs(setting, command, index, context, headers),
		})),
		onDelete: (index) => context.change(() => deleteKeyBinding(command, index)),
		addItem: {
			name: t("addTaskKeyBinding"),
			action: () => {
				if (command.keymap.length >= TASK_KEYS.length) {
					new Notice(t("allTaskKeysBound"));
					return;
				}
				context.change(() => addKeyBinding(command));
			},
		},
	};
}

function keyBindingInputs(setting: Setting, command: TaskCommand, index: number, context: ExpandingPageContext, headers: Map<string, () => void>): () => void {
	const headerId = `key-binding-${index}`;
	setting.setName("");
	setting.settingEl.addClass("note-compass-key-binding");
	const keyDropdown = new DropdownComponent(setting.controlEl);
	keyDropdown.selectEl.setAttribute("aria-label", t("taskKeyBindingKey"));
	const actionDropdown = new DropdownComponent(setting.controlEl);
	actionDropdown.selectEl.setAttribute("aria-label", t("taskKeyBindingAction"));
	const fill = () => {
		const binding = command.keymap[index];
		if (!binding) return;
		keyDropdown.selectEl.empty();
		for (const [key, label] of keyBindingKeyOptions(command, index, Platform.isMacOS)) keyDropdown.addOption(key, label);
		keyDropdown.setValue(binding.key);
		actionDropdown.selectEl.empty();
		for (const [id, label] of keyBindingActionOptions(command, index)) actionDropdown.addOption(id, label);
		actionDropdown.setValue(binding.action);
		setting.setDesc("");
		setting.descEl.removeClass("note-compass-warning");
		const warning = keyBindingWarning(command, index);
		if (warning) warningDescription(setting.descEl, warning);
	};
	const changed = () => {
		for (const showHeader of headers.values()) showHeader();
	};
	keyDropdown.onChange((key) => {
		context.write(taskCommandKey(command.id, "bindingKey", index), key);
		changed();
	});
	actionDropdown.onChange((action) => {
		context.write(taskCommandKey(command.id, "bindingAction", index), action);
		changed();
	});
	fill();
	headers.set(headerId, fill);
	return () => {
		if (headers.get(headerId) === fill) headers.delete(headerId);
	};
}

function actionList(command: TaskCommand, context: ExpandingPageContext, headers: Map<string, () => void>): SettingDefinitionList {
	const listId = expandedListId(command);
	const changed = () => {
		for (const showHeader of headers.values()) showHeader();
	};
	const { expanded } = context.fieldEditor;
	return {
		type: "list",
		heading: t("taskActions"),
		cls: "note-compass-sortable-list note-compass-field-list",
		emptyState: t("noTaskActionsYet"),
		items: command.actions.map((action) => actionRow(command, action, context, headers, changed)),
		onReorder: (from, to) => context.change(() => moveTaskAction(command, from, to)),
		onDelete: (index) =>
			context.change(() => {
				const removed = deleteTaskAction(command, index);
				if (removed && expanded.get(listId) === removed.id) expanded.delete(listId);
			}),
		addItem: {
			name: t("addTaskAction"),
			action: () =>
				context.change(() => {
					const action = addTaskAction(command);
					expanded.set(listId, action.id);
					context.fieldEditor.focusesKey = action.id;
				}),
		},
	};
}

function actionRow(
	command: TaskCommand,
	action: TaskAction,
	context: ExpandingPageContext,
	headers: Map<string, () => void>,
	changed: () => void,
): SettingDefinition {
	const listId = expandedListId(command);
	const editor: ActionEditor = {
		command,
		action,
		context,
		changed,
		read: (setting) => readTaskActionSetting(command, action, setting),
		write: (setting, value) => {
			context.write(taskActionKey(command.id, action.id, setting), value);
			changed();
		},
	};
	return expandableRow({
		id: `task-action-${command.id}-${action.id}-row`,
		name: actionName(action),
		desc: taskActionWarning(action),
		listId,
		itemId: action.id,
		context,
		headers,
		showHeader: (setting) => actionHeader(setting, command, action),
		duplicate: () =>
			context.change(() => {
				const copy = duplicateEntry(command.actions, action, duplicatedActionId(command));
				if (copy) context.fieldEditor.expanded.set(listId, copy.id);
			}),
		expandTooltip: t("editTaskAction"),
		collapseTooltip: t("collapseTaskAction"),
		renderEditor: (editorEl, takesFocus) => renderEditor(editorEl, (parentEl, draw) => actionEditorRows(parentEl, editor, draw), takesFocus ? "label" : undefined),
	});
}

function actionHeader(setting: Setting, command: TaskCommand, action: TaskAction): void {
	const title = createFragment();
	const nameEl = title.createSpan({ cls: "note-compass-field-title" });
	nameEl.createSpan({ cls: "note-compass-field-name", text: actionName(action) });
	for (const key of keysRunning(command, action)) nameEl.createSpan({ cls: "note-compass-field-badge mod-property", text: taskKeyLabel(key, Platform.isMacOS) });
	nameEl.createSpan({ cls: "note-compass-field-badge mod-mode", text: taskActionKindLabel(action.kind) });
	nameEl.createSpan({ cls: "note-compass-field-badge mod-type", text: `[${action.status}]` });
	setting.setName(title);
	setting.setDesc("");
	setting.descEl.removeClass("note-compass-warning");
	const warning = taskActionWarning(action);
	if (warning) warningDescription(setting.descEl, warning);
}

function actionEditorRows(parentEl: HTMLElement, editor: ActionEditor, draw: Redraw): void {
	const { action } = editor;
	textRow(parentEl, editor, "label", t("taskActionLabel"), t("taskActionLabelDesc"), t("taskActionLabelPlaceholder"));
	dropdownRow(parentEl, editor, "kind", t("taskActionKind"), t("taskActionKindDesc"), taskActionKindOptions(), () => draw("kind"));
	statusRow(parentEl, editor);
	if (action.kind === "status") {
		dropdownRow(parentEl, editor, "completionDate", t("completionDate"), t("completionDateDesc"), completionDateOptions());
		return;
	}
	const { controlEl } = editorRow(parentEl, t("taskDestinations"), t("taskDestinationsDesc"));
	new ExtraButtonComponent(controlEl).setIcon("arrow-right").setTooltip(t("taskDestinations")).onClick(() => editor.context.openPage(taskDestinationsPageId(editor.command, action)));
	textRow(parentEl, editor, "prefix", t("taskCopyPrefix"), t("taskCopyAffixesDesc"), "");
	textRow(parentEl, editor, "suffix", t("taskCopySuffix"), t("taskCopyAffixesDesc"), "");
	toggleRow(parentEl, editor, "mentionDestination", t("mentionDestination"), t("mentionDestinationDesc"));
	toggleRow(parentEl, editor, "mentionSource", t("mentionSource"), t("mentionSourceDesc"));
}

function statusRow(parentEl: HTMLElement, editor: ActionEditor): void {
	const desc = editor.action.kind === "copy" ? t("taskActionCopyStatusDesc") : t("taskActionStatusDesc");
	const { rowEl, descEl, controlEl } = editorRow(parentEl, t("taskActionStatus"), desc);
	const text = new TextComponent(controlEl).setValue(editor.action.status);
	text.inputEl.maxLength = 1;
	text.inputEl.addClass("note-compass-status-input");
	text.inputEl.setAttr(FOCUS_ATTRIBUTE, "status");
	text.onChange((typed) => {
		const empty = typed === "";
		descEl.setText(empty ? t("taskActionStatusRequired") : desc);
		rowEl.toggleClass("has-error", empty);
		if (!empty) editor.write("status", typed);
	});
}

function destinationsSection(parentEl: HTMLElement, editor: ActionEditor, draw: Redraw): void {
	const { action, context } = editor;
	if (action.kind !== "copy") return;
	const sectionEl = parentEl.createDiv({ cls: "note-compass-field-choices" });
	const headerEl = sectionEl.createDiv({ cls: "note-compass-field-choices-header" });
	const infoEl = headerEl.createDiv();
	infoEl.createDiv({ cls: "setting-item-name", text: t("taskDestinations") });
	infoEl.createDiv({ cls: "setting-item-description", text: t("taskDestinationsDesc") });
	const addButton = new ExtraButtonComponent(headerEl).setIcon("plus").setTooltip(t("addTaskDestination"));
	const listEl = sectionEl.createDiv({ cls: "note-compass-form-choice-list" });
	const emptyEl = listEl.createDiv({ cls: "setting-item-description", text: t("taskActionNeedsDestination") });
	emptyEl.toggle(action.destinations.length === 0);
	action.destinations.forEach((_destination, index) => destinationRow(listEl, editor, index, draw));
	sortableRows(listEl, ".note-compass-destination", ".note-compass-form-choice-handle", (from, to) => {
		context.saveQuietly(() => moveTaskDestination(action, from, to));
		editor.changed();
		draw();
	});
	addButton.onClick(() => {
		context.saveQuietly(() => addTaskDestination(action));
		editor.changed();
		draw(`destination/${action.destinations.length - 1}`);
	});
}

function destinationRow(listEl: HTMLElement, editor: ActionEditor, index: number, draw: Redraw): void {
	const { action, command, context } = editor;
	if (action.kind !== "copy") return;
	const destination = action.destinations[index];
	if (!destination) return;
	const key = (setting: TaskActionSetting) => taskActionKey(command.id, action.id, setting, String(index));
	const entryEl = listEl.createDiv({ cls: "note-compass-destination" });
	const rowEl = entryEl.createDiv({ cls: "note-compass-form-choice" });
	new ExtraButtonComponent(rowEl).setIcon("grip-vertical").setTooltip(t("dragToReorder")).extraSettingsEl.addClass("note-compass-form-choice-handle");
	const inputsEl = rowEl.createDiv({ cls: "note-compass-form-choice-inputs" });
	const option = destinationOption(destination);
	const dropdown = new DropdownComponent(inputsEl).addOptions(destinationOptions()).setValue(option);
	dropdown.selectEl.setAttrs({ [FOCUS_ATTRIBUTE]: `destination/${index}`, "aria-label": t("taskDestinations") });
	dropdown.onChange((chosen) => {
		context.write(key("destination"), chosen);
		editor.changed();
		if ((option === NOTE_DESTINATION_OPTION) !== (chosen === NOTE_DESTINATION_OPTION)) draw();
	});
	const warningEl = entryEl.createDiv({ cls: "setting-item-description" });
	if (destination.kind === "note") {
		const notes = createObsidianVault(context.app).notes();
		const showWarning = (path: string) => {
			const warning = destinationNoteWarning(path, notes);
			warningEl.toggle(warning !== undefined);
			if (warning) warningDescription(warningEl, warning);
		};
		const { path } = destination;
		const text = new TextComponent(inputsEl).setPlaceholder(t("taskDestinationNotePlaceholder")).setValue(path);
		text.inputEl.setAttrs({ [FOCUS_ATTRIBUTE]: `destinationNote/${index}`, "aria-label": t("destinationSpecificNote") });
		text.onChange((typed) => {
			context.write(key("destinationNote"), typed);
			showWarning(typed);
		});
		new NoteSuggest(context.app, text.inputEl, (file) => file.path);
		showWarning(path);
	} else warningEl.hide();
	new ExtraButtonComponent(rowEl)
		.setIcon("x")
		.setTooltip(t("removeTaskDestination"))
		.onClick(() => {
			context.saveQuietly(() => removeTaskDestination(action, index));
			editor.changed();
			draw();
		});
}

function taskDestinationsPageId(command: TaskCommand, action: TaskAction): string {
	return `task-destinations-${command.id}-${action.id}`;
}

export function taskDestinationsPages(command: TaskCommand, context: ExpandingPageContext): SettingDefinitionPage[] {
	return command.actions.filter((action) => action.kind === "copy").map((action): IdentifiedPage => ({
		type: "page",
		id: taskDestinationsPageId(command, action),
		name: `${actionName(action)} · ${t("taskDestinations")}`,
		items: [
			{
				name: taskCommandName(command),
				render: (setting) => {
					setting.addExtraButton((button) => button.setIcon("arrow-left").setTooltip(taskCommandName(command)).onClick(() => context.openPage(taskCommandPageId(command))));
				},
			},
			{
				name: t("taskDestinations"),
				render: (setting) => {
					const editor: ActionEditor = {
						command, action, context, changed: () => undefined,
						read: (key) => readTaskActionSetting(command, action, key),
						write: (key, value) => context.write(taskActionKey(command.id, action.id, key), value),
					};
					setting.infoEl.empty();
					setting.controlEl.remove();
					renderEditor(setting.infoEl, (parentEl, draw) => destinationsSection(parentEl, editor, draw));
				},
			},
		],
	}));
}
