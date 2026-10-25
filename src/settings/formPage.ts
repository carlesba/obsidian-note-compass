import { ButtonComponent, DropdownComponent, ExtraButtonComponent, TextComponent, ToggleComponent } from "obsidian";
import type { Setting, SettingDefinition, SettingDefinitionItem, SettingDefinitionList, SettingDefinitionPage, SettingDefinitionRender } from "obsidian";
import { hasChoices, isDateType, newField } from "../forms/form";
import type { Form, FormField } from "../forms/form";
import { t } from "../i18n";
import { formFieldKey, formKey } from "./controlKeys";
import {
	addChoice,
	dateFormatOptions,
	dateSourceOptions,
	deleteChoice,
	fieldModeOptions,
	fieldSummary,
	fieldTypeOptions,
	fieldValueError,
	fieldWarning,
	formRowName,
	formSummary,
	formWarning,
	moveChoice,
	readFieldSetting,
	saveAsOptions,
	storeAsOptions,
} from "./formsForm";
import type { FieldSetting } from "./formsForm";
import { editableRow } from "./listPage";
import type { EditableRow, ListPageContext } from "./listPage";
import { sortableRows } from "./sortable";
import { PropertySuggest, warningDescription } from "./suggest";

export interface FieldEditorState {
	expanded: Map<string, string>;
	focusesKey?: string;
}

export interface FormPageContext extends ListPageContext {
	fieldEditor: FieldEditorState;
	refresh: () => void;
	saveQuietly: (change: () => unknown) => void;
}

type IdentifiedPage = SettingDefinitionPage & { id: string };

type FieldKey = (setting: FieldSetting, index?: number) => string;

interface FieldEditor {
	form: Form;
	field: FormField;
	key: FieldKey;
	context: FormPageContext;
	changed: () => void;
}

type Redraw = (focus?: string) => void;

const NAME_PATTERN_EXAMPLE = "{{date:YYMMDDHHmm}} {{book}}";

const FOCUS_ATTRIBUTE = "data-note-compass-focus";

export function formPageId(form: Form): string {
	return `form-${form.id}`;
}

export function formRow(form: Form, context: FormPageContext): SettingDefinition {
	const row = (): EditableRow => ({
		name: formRowName(form),
		label: formRowName(form),
		warning: formWarning(form),
		desc: formSummary(form),
		broken: form.unreadable !== undefined,
		enabled: form.enabled,
		enabledKey: formKey(form.id, "enabled"),
		enabledTooltip: t("offerFormAsCommand"),
		pageId: formPageId(form),
		editTooltip: t("editForm"),
	});
	const rowContext: ListPageContext = {
		...context,
		showPrefixes: false,
		openPage: (pageId) => {
			context.fieldEditor.expanded.delete(form.id);
			context.openPage(pageId);
		},
	};
	const definition = editableRow(row(), rowContext);
	return {
		...definition,
		render: (setting, group) => {
			const current = row();
			setting.setName(current.label);
			setting.setDesc(current.warning ?? current.desc ?? "");
			return editableRow(current, rowContext).render(setting, group);
		},
	};
}

export function formPage(form: Form, context: FormPageContext): SettingDefinitionPage {
	const key = (setting: Parameters<typeof formKey>[1]) => formKey(form.id, setting);
	const items: SettingDefinitionItem[] = form.unreadable
		? [
				{
					name: t("formUnreadable"),
					desc: t("unreadableFormWarning"),
					searchable: false,
					render: (setting) => warningDescription(setting.descEl, t("unreadableFormWarning")),
				},
			]
		: [
				{ name: t("enabled"), desc: t("formEnabledDesc"), control: { type: "toggle", key: key("enabled") } },
				{ name: t("formName"), desc: t("formNameDesc"), control: { type: "text", key: key("name"), placeholder: t("formNamePlaceholder") } },
				{
					name: t("formNamePattern"),
					desc: t("formNamePatternDesc"),
					control: { type: "text", key: key("namePattern"), placeholder: NAME_PATTERN_EXAMPLE },
				},
				{
					name: t("formContentPattern"),
					desc: t("formContentPatternDesc"),
					control: { type: "textarea", key: key("contentPattern"), rows: 6 },
				},
				{ name: t("folder"), desc: t("newNoteFolderDesc"), control: { type: "folder", key: key("folder") } },
				{ name: t("formOpensNote"), desc: t("formOpensNoteDesc"), control: { type: "toggle", key: key("opensNote") } },
				fieldList(form, context),
			];
	const page: IdentifiedPage = {
		type: "page",
		id: formPageId(form),
		name: formRowName(form),
		displayValue: () => (form.enabled && !form.unreadable ? "" : t("off")),
		status: () => (formWarning(form) ? "warning" : null),
		items,
	};
	return page;
}

function fieldList(form: Form, context: FormPageContext): SettingDefinitionList {
	const fields = form.fields;
	const headers = new Map<string, () => void>();
	const changed = () => {
		for (const showHeader of headers.values()) showHeader();
	};
	return {
		type: "list",
		heading: t("formFields"),
		cls: "note-compass-sortable-list note-compass-field-list",
		emptyState: t("noFormFieldsYet"),
		items: fields.map((field) => fieldRow(form, field, context, headers, changed)),
		onReorder: (from, to) => context.change(() => fields.splice(to, 0, ...fields.splice(from, 1))),
		onDelete: (index) =>
			context.change(() => {
				const [removed] = fields.splice(index, 1);
				if (removed && context.fieldEditor.expanded.get(form.id) === removed.id) context.fieldEditor.expanded.delete(form.id);
			}),
		addItem: {
			name: t("addFormField"),
			action: () => {
				const field = newField(form);
				context.fieldEditor.expanded.set(form.id, field.id);
				context.fieldEditor.focusesKey = field.id;
				context.change(() => fields.push(field));
			},
		},
	};
}

function fieldRow(
	form: Form,
	field: FormField,
	context: FormPageContext,
	headers: Map<string, () => void>,
	changed: () => void,
): SettingDefinition {
	const definition: SettingDefinitionRender & { id: string } = {
		id: `field-${field.id}-row`,
		name: fieldSummary(field),
		desc: fieldWarning(form, field),
		render: (setting) => {
			const { settingEl } = setting;
			const expanded = context.fieldEditor.expanded.get(form.id) === field.id;
			settingEl.addClass("note-compass-draggable-row", "note-compass-field-row");
			settingEl.toggleClass("is-expanded", expanded);
			const showHeader = () => fieldHeader(setting, form, field);
			showHeader();
			headers.set(field.id, showHeader);
			const toggle = () => {
				if (expanded) context.fieldEditor.expanded.delete(form.id);
				else context.fieldEditor.expanded.set(form.id, field.id);
				context.refresh();
			};
			setting.addExtraButton((button) =>
				button
					.setIcon(expanded ? "chevron-down" : "chevron-right")
					.setTooltip(expanded ? t("collapseField") : t("editField"))
					.onClick(toggle),
			);
			const editorEl = expanded ? settingEl.createDiv({ cls: "note-compass-field-editor" }) : undefined;
			if (editorEl) {
				const focusesKey = context.fieldEditor.focusesKey === field.id;
				if (focusesKey) context.fieldEditor.focusesKey = undefined;
				renderFieldEditor(
					editorEl,
					{ form, field, key: (name, index) => formFieldKey(form.id, field.id, name, index), context, changed },
					focusesKey ? "key" : undefined,
				);
			}
			const onClick = (event: MouseEvent) => {
				if (!(event.target instanceof Node)) return;
				if (editorEl?.contains(event.target) || setting.controlEl.contains(event.target)) return;
				toggle();
			};
			const onKeydown = (event: KeyboardEvent) => {
				if (event.target !== settingEl || event.isComposing || (event.key !== "Enter" && event.key !== " ")) return;
				event.preventDefault();
				toggle();
			};
			settingEl.addEventListener("click", onClick);
			settingEl.addEventListener("keydown", onKeydown);
			return () => {
				settingEl.removeEventListener("click", onClick);
				settingEl.removeEventListener("keydown", onKeydown);
				settingEl.removeClass("is-expanded");
				editorEl?.remove();
				if (headers.get(field.id) === showHeader) headers.delete(field.id);
			};
		},
	};
	return definition;
}

function fieldHeader(setting: Setting, form: Form, field: FormField): void {
	setting.setName(fieldSummary(field));
	setting.setDesc("");
	setting.descEl.removeClass("note-compass-warning");
	const warning = fieldWarning(form, field);
	if (warning) warningDescription(setting.descEl, warning);
}

function renderFieldEditor(editorEl: HTMLElement, editor: FieldEditor, focus?: string): void {
	const draw: Redraw = (target) => {
		editorEl.empty();
		fieldEditorRows(editorEl, editor, draw);
		if (target === undefined) return;
		const focusEl = editorEl.querySelector<HTMLElement>(`[${FOCUS_ATTRIBUTE}="${target}"]`);
		window.setTimeout(() => focusEl?.focus(), 0);
	};
	draw(focus);
}

function fieldEditorRows(editorEl: HTMLElement, editor: FieldEditor, draw: Redraw): void {
	const { field } = editor;
	const asks = field.mode === "ask";
	dropdownRow(editorEl, editor, draw, "saveAs", t("formSaveAs"), t("formSaveAsDesc"), saveAsOptions());
	const questionInput = keyRow(editorEl, editor);
	dropdownRow(editorEl, editor, draw, "mode", t("formMode"), t("formModeDesc"), fieldModeOptions());
	dropdownRow(editorEl, editor, draw, "type", t("type"), t("formTypeDesc"), fieldTypeOptions(field.mode));
	if (asks) {
		const question = textRow(editorEl, editor, "question", t("formQuestion"), t("formQuestionDesc"), field.key);
		questionInput.placeholderOf = question;
		toggleRow(editorEl, editor, "optional", t("formOptional"), t("formOptionalDesc"));
	} else {
		staticValueRows(editorEl, editor, draw);
	}
	if (asks && hasChoices(field.type)) {
		dropdownRow(editorEl, editor, draw, "storeAs", t("formStoreAs"), t("formStoreAsDesc"), storeAsOptions());
		choicesSection(editorEl, editor, draw);
	}
	if (isDateType(field.type)) {
		dropdownRow(editorEl, editor, draw, "dateFormat", t("format"), t("formDateFormatDesc"), dateFormatOptions());
		if (field.dateFormat === "custom") textRow(editorEl, editor, "customFormat", t("formCustomFormat"), t("formCustomFormatDesc"), "dddd D MMMM YYYY");
	}
}

interface EditorRow {
	rowEl: HTMLElement;
	descEl: HTMLElement;
	controlEl: HTMLElement;
}

function editorRow(parentEl: HTMLElement, name: string, desc: string, wide = false): EditorRow {
	const rowEl = parentEl.createDiv({ cls: wide ? "note-compass-field-setting mod-wide" : "note-compass-field-setting" });
	const infoEl = rowEl.createDiv({ cls: "note-compass-field-setting-info" });
	infoEl.createDiv({ cls: "setting-item-name", text: name });
	const descEl = infoEl.createDiv({ cls: "setting-item-description", text: desc });
	const controlEl = rowEl.createDiv({ cls: "note-compass-field-setting-control" });
	return { rowEl, descEl, controlEl };
}

function settingText(field: FormField, setting: FieldSetting): string {
	const value = readFieldSetting(field, setting);
	return typeof value === "string" ? value : "";
}

function write(editor: FieldEditor, setting: FieldSetting, value: unknown, index?: number): void {
	editor.context.write(editor.key(setting, index), value);
	editor.changed();
}

function dropdownRow(
	parentEl: HTMLElement,
	editor: FieldEditor,
	draw: Redraw,
	setting: FieldSetting,
	name: string,
	desc: string,
	options: Record<string, string>,
): void {
	const { controlEl } = editorRow(parentEl, name, desc);
	const dropdown = new DropdownComponent(controlEl).addOptions(options);
	dropdown.selectEl.setAttr(FOCUS_ATTRIBUTE, setting);
	dropdown.setValue(settingText(editor.field, setting)).onChange((value) => {
		write(editor, setting, value);
		draw(setting);
	});
}

function textRow(
	parentEl: HTMLElement,
	editor: FieldEditor,
	setting: FieldSetting,
	name: string,
	desc: string,
	placeholder: string,
): TextComponent {
	const { controlEl } = editorRow(parentEl, name, desc);
	const text = new TextComponent(controlEl).setPlaceholder(placeholder);
	text.inputEl.setAttr(FOCUS_ATTRIBUTE, setting);
	text.setValue(settingText(editor.field, setting)).onChange((value) => write(editor, setting, value));
	return text;
}

function toggleRow(parentEl: HTMLElement, editor: FieldEditor, setting: FieldSetting, name: string, desc: string): void {
	const { controlEl } = editorRow(parentEl, name, desc);
	new ToggleComponent(controlEl)
		.setValue(readFieldSetting(editor.field, setting) === true)
		.onChange((value) => write(editor, setting, value));
}

function keyRow(parentEl: HTMLElement, editor: FieldEditor): { placeholderOf?: TextComponent } {
	const { field, context } = editor;
	const isProperty = field.saveAs === "property";
	const desc = isProperty ? t("formPropertyKeyDesc") : t("formVariableNameDesc");
	const { controlEl } = editorRow(parentEl, t("formFieldKey"), desc);
	const text = new TextComponent(controlEl).setPlaceholder(isProperty ? t("formPropertyKeyPlaceholder") : t("formVariableNamePlaceholder"));
	text.inputEl.setAttr(FOCUS_ATTRIBUTE, "key");
	const linked: { placeholderOf?: TextComponent } = {};
	const typed = (value: string) => {
		write(editor, "key", value);
		linked.placeholderOf?.setPlaceholder(field.key);
	};
	text.setValue(field.key).onChange(typed);
	if (isProperty) {
		const suggest = new PropertySuggest(context.app, text.inputEl, context.propertySuggestions);
		suggest.onSelect((suggestion) => {
			suggest.setValue(suggestion.name);
			typed(suggestion.name);
			suggest.close();
		});
	}
	return linked;
}

function staticValueRows(parentEl: HTMLElement, editor: FieldEditor, draw: Redraw): void {
	const { form, field } = editor;
	switch (field.type) {
		case "text":
			textRow(parentEl, editor, "text", t("formValue"), t("formStaticValueDesc"), "");
			return;
		case "number":
			numberRow(parentEl, editor);
			return;
		case "checkbox":
			toggleRow(parentEl, editor, "checked", t("formValue"), t("formStaticValueDesc"));
			return;
		case "list":
			listItemsInput(editorRow(parentEl, t("formListItems"), t("formListItemsDesc"), true).controlEl, editor);
			return;
		default:
			dropdownRow(parentEl, editor, draw, "from", t("formValue"), t("formDateSourceDesc"), dateSourceOptions(form, field));
	}
}

function numberRow(parentEl: HTMLElement, editor: FieldEditor): void {
	const { rowEl, descEl, controlEl } = editorRow(parentEl, t("formValue"), t("formStaticValueDesc"));
	const text = new TextComponent(controlEl).setPlaceholder("3");
	text.inputEl.setAttr(FOCUS_ATTRIBUTE, "number");
	text.setValue(settingText(editor.field, "number")).onChange((value) => {
		const error = fieldValueError("number", value);
		descEl.setText(error ?? t("formStaticValueDesc"));
		rowEl.toggleClass("has-error", error !== undefined);
		if (error === undefined) write(editor, "number", value);
	});
}

function choicesSection(parentEl: HTMLElement, editor: FieldEditor, draw: Redraw): void {
	const { field, context } = editor;
	const choices = field.choices ?? [];
	const sectionEl = parentEl.createDiv({ cls: "note-compass-field-choices" });
	sectionEl.createDiv({ cls: "setting-item-name", text: t("formChoices") });
	const listEl = sectionEl.createDiv({ cls: "note-compass-form-choice-list" });
	if (choices.length === 0) listEl.createDiv({ cls: "setting-item-description", text: t("noFormChoices") });
	choices.forEach((choice, index) => {
		const rowEl = listEl.createDiv({ cls: "note-compass-form-choice" });
		new ExtraButtonComponent(rowEl).setIcon("grip-vertical").setTooltip(t("dragToReorder")).extraSettingsEl.addClass("note-compass-form-choice-handle");
		const inputsEl = rowEl.createDiv({ cls: "note-compass-form-choice-inputs" });
		const value = new TextComponent(inputsEl).setPlaceholder(t("formChoiceValuePlaceholder")).setValue(choice.value);
		const label = new TextComponent(inputsEl).setPlaceholder(choice.value || t("formChoiceLabelPlaceholder")).setValue(choice.label ?? "");
		value.inputEl.setAttrs({ [FOCUS_ATTRIBUTE]: `choiceValue/${index}`, "aria-label": t("formChoiceValuePlaceholder") });
		label.inputEl.setAttr("aria-label", t("formChoiceLabelPlaceholder"));
		value.onChange((typed) => {
			write(editor, "choiceValue", typed, index);
			label.setPlaceholder(choice.value || t("formChoiceLabelPlaceholder"));
		});
		label.onChange((typed) => write(editor, "choiceLabel", typed, index));
		new ExtraButtonComponent(rowEl)
			.setIcon("x")
			.setTooltip(t("formRemoveChoice"))
			.onClick(() => {
				context.saveQuietly(() => deleteChoice(field, index));
				editor.changed();
				draw();
			});
	});
	sortableRows(listEl, ".note-compass-form-choice", ".note-compass-form-choice-handle", (from, to) => {
		context.saveQuietly(() => moveChoice(field, from, to));
		draw();
	});
	new ButtonComponent(sectionEl).setButtonText(t("addFormChoice")).onClick(() => {
		context.saveQuietly(() => addChoice(field));
		editor.changed();
		draw(`choiceValue/${choices.length}`);
	});
}

function listItemsInput(controlEl: HTMLElement, editor: FieldEditor): void {
	const { field } = editor;
	const items = Array.isArray(field.value) ? [...field.value] : [];
	const boxEl = controlEl.createDiv({ cls: "note-compass-chip-input" });
	const inputEl = createEl("input", {
		type: "text",
		cls: "note-compass-chip-input-text",
		attr: { placeholder: t("formListItemPlaceholder"), "aria-label": t("formListItems"), [FOCUS_ATTRIBUTE]: "listItems" },
	});
	const save = () => write(editor, "listItems", [...items]);
	boxEl.appendChild(inputEl);
	const draw = () => {
		for (const chipEl of Array.from(boxEl.querySelectorAll(".note-compass-list-chip"))) chipEl.remove();
		items.forEach((item, index) => {
			const chipEl = createSpan({ cls: "note-compass-row-prefix note-compass-list-chip" });
			chipEl.createSpan({ cls: "note-compass-chip-text", text: item });
			new ExtraButtonComponent(chipEl)
				.setIcon("x")
				.setTooltip(t("formRemoveItem"))
				.onClick(() => {
					items.splice(index, 1);
					draw();
					save();
					inputEl.focus();
				});
			boxEl.insertBefore(chipEl, inputEl);
		});
	};
	const add = (keepsFocus: boolean) => {
		const item = inputEl.value.trim();
		if (item === "") return;
		items.push(item);
		inputEl.value = "";
		draw();
		if (keepsFocus) inputEl.focus();
		save();
	};
	inputEl.addEventListener("keydown", (event) => {
		if (event.isComposing) return;
		if (event.key === "Enter") {
			event.preventDefault();
			event.stopPropagation();
			add(true);
		} else if (event.key === "Backspace" && inputEl.value === "" && items.length > 0) {
			event.stopPropagation();
			items.pop();
			draw();
			save();
		}
	});
	inputEl.addEventListener("blur", () => add(false));
	boxEl.addEventListener("click", (event) => {
		if (event.target === boxEl) inputEl.focus();
	});
	draw();
}
