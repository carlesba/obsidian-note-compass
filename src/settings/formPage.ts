import { ExtraButtonComponent, Menu, TextComponent, moment } from "obsidian";
import type { Setting, SettingDefinition, SettingDefinitionItem, SettingDefinitionList, SettingDefinitionPage } from "obsidian";
import { hasChoices, isDateType, newFormId } from "../forms/form";
import { SET_DATE_PLACEHOLDERS, typedTime } from "../forms/dateInput";
import { FIELD_PRESETS, presetField, presetFormat } from "../forms/presets";
import type { FieldPreset } from "../forms/presets";
import { duplicateEntry } from "./duplicate";
import type { DateFieldType, Form, FormField } from "../forms/form";
import { t } from "../i18n";
import { formFieldKey, formKey } from "./controlKeys";
import {
	addChoice,
	dateFormatOptions,
	dateSourceOptions,
	deleteChoice,
	fieldModeOptions,
	fieldBadges,
	fieldRowName,
	fieldSummary,
	fieldTypeOptions,
	fieldValueError,
	fieldWarning,
	formRowName,
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
import { LinkSuggest, PropertySuggest, warningDescription } from "./suggest";
import {
	FOCUS_ATTRIBUTE,
	checkedTextRow,
	dropdownRow,
	editorRow,
	expandableRow,
	focusControl,
	renderEditor,
	textRow,
	toggleRow,
} from "./fieldEditor";
import type { EditorBinding, ExpandingPageContext, Redraw } from "./fieldEditor";

export type FormPageContext = ExpandingPageContext;

type IdentifiedPage = SettingDefinitionPage & { id: string };

type FieldKey = (setting: FieldSetting, index?: number) => string;

interface FieldEditor extends EditorBinding<FieldSetting> {
	form: Form;
	field: FormField;
	key: FieldKey;
	context: FormPageContext;
	changed: () => void;
}

const PRESET_ICONS: Record<FieldPreset, string> = {
	blank: "plus",
	date: "calendar",
	time: "clock",
	timestamp: "calendar-clock",
	isoTimestamp: "globe",
	entryDate: "calendar",
	entryTime: "history",
};

const PRESET_LABELS: Record<FieldPreset, () => string> = {
	blank: () => t("fieldPresetBlank"),
	date: () => t("fieldPresetDate"),
	time: () => t("fieldPresetTime"),
	timestamp: () => t("fieldPresetTimestamp"),
	isoTimestamp: () => t("fieldPresetIsoTimestamp"),
	entryDate: () => t("fieldPresetEntryDate"),
	entryTime: () => t("fieldPresetEntryTime"),
};

function presetTitle(preset: FieldPreset): DocumentFragment {
	const title = createFragment();
	title.createSpan({ text: PRESET_LABELS[preset]() });
	const format = presetFormat(preset);
	if (format !== undefined) {
		const now = moment();
		const example = format === "iso" ? now.toISOString() : now.format(format);
		title.appendText(" ");
		title.createSpan({ cls: "note-compass-menu-example", text: `(${example})` });
	}
	return title;
}

const SET_DATE_PREVIEWS: Record<DateFieldType, string> = {
	date: "ddd D MMM YYYY",
	time: "HH:mm",
	datetime: "ddd D MMM YYYY, HH:mm",
};

const NAME_PATTERN_EXAMPLE = "{{date:YYMMDDHHmm}} {{book}}";

export function formPageId(form: Form): string {
	return `form-${form.id}`;
}

export function formRow(form: Form, context: FormPageContext, duplicate?: () => void): SettingDefinition {
	const row = (): EditableRow => ({
		name: formRowName(form),
		label: formRowName(form),
		warning: formWarning(form),
		broken: form.unreadable !== undefined,
		enabled: form.enabled,
		enabledKey: formKey(form.id, "enabled"),
		enabledTooltip: t("offerFormAsCommand"),
		pageId: formPageId(form),
		editTooltip: t("editForm"),
		duplicate,
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
			setting.setDesc(current.warning ?? "");
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
			action: (buttonEl) => {
				const add = (preset: FieldPreset) => {
					const field = presetField(form, preset);
					context.fieldEditor.expanded.set(form.id, field.id);
					context.fieldEditor.focusesKey = field.id;
					context.change(() => fields.push(field));
				};
				const menu = new Menu();
				for (const preset of FIELD_PRESETS) {
					menu.addItem((item) => item.setTitle(presetTitle(preset)).setIcon(PRESET_ICONS[preset]).onClick(() => add(preset)));
				}
				const rect = buttonEl.getBoundingClientRect();
				menu.showAtPosition({ x: rect.left, y: rect.bottom });
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
	const key: FieldKey = (name, index) => formFieldKey(form.id, field.id, name, index);
	const editor: FieldEditor = {
		form,
		field,
		key,
		context,
		changed,
		read: (setting) => readFieldSetting(field, setting),
		write: (setting, value) => write(editor, setting, value),
	};
	return expandableRow({
		id: `field-${field.id}-row`,
		name: fieldSummary(field),
		desc: fieldWarning(form, field),
		listId: form.id,
		itemId: field.id,
		context,
		headers,
		showHeader: (setting) => fieldHeader(setting, form, field),
		duplicate: () =>
			context.change(() => {
				const copy = duplicateEntry(form.fields, field, newFormId(form.fields));
				if (copy) context.fieldEditor.expanded.set(form.id, copy.id);
			}),
		expandTooltip: t("editField"),
		collapseTooltip: t("collapseField"),
		renderEditor: (editorEl, takesFocus) => renderEditor(editorEl, (parentEl, draw) => fieldEditorRows(parentEl, editor, draw), takesFocus ? "key" : undefined),
	});
}

function fieldHeader(setting: Setting, form: Form, field: FormField): void {
	setting.setName(fieldTitle(field));
	setting.setDesc("");
	setting.descEl.removeClass("note-compass-warning");
	const warning = fieldWarning(form, field);
	if (warning) warningDescription(setting.descEl, warning);
}

function fieldTitle(field: FormField): DocumentFragment {
	const title = createFragment();
	const nameEl = title.createSpan({ cls: "note-compass-field-title" });
	nameEl.createSpan({ cls: "note-compass-field-name", text: fieldRowName(field) });
	for (const badge of fieldBadges(field)) {
		nameEl.createSpan({ cls: `note-compass-field-badge mod-${badge.kind}`, text: badge.text });
	}
	return title;
}

function fieldEditorRows(editorEl: HTMLElement, editor: FieldEditor, draw: Redraw): void {
	const { field } = editor;
	const asks = field.mode === "ask";
	const redraws = (setting: FieldSetting) => () => draw(setting);
	dropdownRow(editorEl, editor, "saveAs", t("formSaveAs"), t("formSaveAsDesc"), saveAsOptions(), redraws("saveAs"));
	const questionInput = keyRow(editorEl, editor);
	dropdownRow(editorEl, editor, "mode", t("formMode"), t("formModeDesc"), fieldModeOptions(), redraws("mode"));
	dropdownRow(editorEl, editor, "type", t("type"), t("formTypeDesc"), fieldTypeOptions(field.mode), redraws("type"));
	if (asks) {
		const question = textRow(editorEl, editor, "question", t("formQuestion"), t("formQuestionDesc"), field.key);
		questionInput.placeholderOf = question.text;
		toggleRow(editorEl, editor, "optional", t("formOptional"), t("formOptionalDesc"));
		if (isDateType(field.type)) toggleRow(editorEl, editor, "entryTime", t("formEntryTime"), t("formEntryTimeDesc"));
	} else {
		staticValueRows(editorEl, editor);
	}
	if (asks && hasChoices(field.type)) {
		dropdownRow(editorEl, editor, "storeAs", t("formStoreAs"), t("formStoreAsDesc"), storeAsOptions());
		choicesSection(editorEl, editor, draw);
	}
	if (isDateType(field.type)) {
		const showsCustomFormat = () => customFormat.rowEl.toggle(field.dateFormat === "custom");
		dropdownRow(editorEl, editor, "dateFormat", t("format"), t("formDateFormatDesc"), dateFormatOptions(), showsCustomFormat);
		const customFormat = textRow(editorEl, editor, "customFormat", t("formCustomFormat"), t("formCustomFormatDesc"), "dddd D MMMM YYYY");
		showsCustomFormat();
	}
}

function write(editor: FieldEditor, setting: FieldSetting, value: unknown, index?: number): void {
	editor.context.write(editor.key(setting, index), value);
	editor.changed();
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

function staticValueRows(parentEl: HTMLElement, editor: FieldEditor): void {
	const { form, field } = editor;
	switch (field.type) {
		case "text":
			linkSuggestions(textRow(parentEl, editor, "text", t("formValue"), t("formStaticValueDesc"), t("formLinkHint")).text.inputEl, editor);
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
		default: {
			if (!isDateType(field.type)) return;
			const type = field.type;
			const showsSetDate = () => setDate.rowEl.toggle(field.at !== undefined);
			dropdownRow(parentEl, editor, "from", t("formValue"), t("formDateSourceDesc"), dateSourceOptions(form, field), showsSetDate);
			const setDate = setDateRow(parentEl, editor, type);
			showsSetDate();
		}
	}
}

function setDateRow(parentEl: HTMLElement, editor: FieldEditor, type: DateFieldType): { rowEl: HTMLElement } {
	const { rowEl, descEl, controlEl } = editorRow(parentEl, t("formSetDate"), "");
	const text = new TextComponent(controlEl).setPlaceholder(SET_DATE_PLACEHOLDERS[type]);
	text.inputEl.setAttr(FOCUS_ATTRIBUTE, "at");
	text.inputEl.setAttr("inputmode", "numeric");
	const preview = (typed: string) => {
		const time = typed.trim() === "" ? undefined : typedTime(type, typed, Date.now(), moment);
		const unreadable = typed.trim() !== "" && time === undefined;
		descEl.setText(
			time !== undefined
				? `✓ ${moment(time).format(SET_DATE_PREVIEWS[type])}`
				: unreadable
					? t("formSetDateUnreadable", { format: SET_DATE_PLACEHOLDERS[type] })
					: t("formSetDateDesc", { format: SET_DATE_PLACEHOLDERS[type] }),
		);
		rowEl.toggleClass("has-error", unreadable);
	};
	text.setValue(editor.field.at ?? "").onChange((typed) => {
		write(editor, "at", typed);
		preview(typed);
	});
	preview(editor.field.at ?? "");
	return { rowEl };
}

function linkSuggestions(inputEl: HTMLInputElement, editor: FieldEditor, picked?: () => void): LinkSuggest {
	return new LinkSuggest(editor.context.app, inputEl, picked);
}

function numberRow(parentEl: HTMLElement, editor: FieldEditor): void {
	checkedTextRow(parentEl, editor, "number", t("formValue"), t("formStaticValueDesc"), "3", (typed) => fieldValueError("number", typed));
}

function choicesSection(parentEl: HTMLElement, editor: FieldEditor, draw: Redraw): void {
	const { field, context } = editor;
	const sectionEl = parentEl.createDiv({ cls: "note-compass-field-choices" });
	const headerEl = sectionEl.createDiv({ cls: "note-compass-field-choices-header" });
	headerEl.createDiv({ cls: "setting-item-name", text: t("formChoices") });
	const addButton = new ExtraButtonComponent(headerEl).setIcon("plus").setTooltip(t("addFormChoice"));
	const listEl = sectionEl.createDiv({ cls: "note-compass-form-choice-list" });
	const emptyEl = listEl.createDiv({ cls: "setting-item-description", text: t("noFormChoices") });
	const choices = () => field.choices ?? [];
	emptyEl.toggle(choices().length === 0);
	choices().forEach((_choice, index) => choiceRow(listEl, editor, index, draw));
	sortableRows(listEl, ".note-compass-form-choice", ".note-compass-form-choice-handle", (from, to) => {
		context.saveQuietly(() => moveChoice(field, from, to));
		draw();
	});
	addButton.onClick(() => {
		context.saveQuietly(() => addChoice(field));
		editor.changed();
		emptyEl.hide();
		const index = choices().length - 1;
		choiceRow(listEl, editor, index, draw);
		focusControl(listEl, `choiceValue/${index}`);
	});
}

function choiceRow(listEl: HTMLElement, editor: FieldEditor, index: number, draw: Redraw): void {
	const { field, context } = editor;
	const choice = field.choices?.[index];
	if (!choice) return;
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
	const suggest = linkSuggestions(inputEl, editor, () => add(true));
	inputEl.addEventListener("keydown", (event) => {
		if (event.isComposing || suggest.isOpen) return;
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
