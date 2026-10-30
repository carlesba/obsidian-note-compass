import { ExtraButtonComponent, DropdownComponent, TextComponent, moment } from "obsidian";
import type { App, Setting, SettingDefinition, SettingDefinitionItem, SettingDefinitionList, SettingDefinitionPage, SettingDefinitionRender } from "obsidian";
import { fieldSource, hasSources, isBlock, isDateType, newBlock, newCustomField, newFormId, takesValue, templateField } from "../forms/form";
import type { FormClock } from "../forms/resolve";
import { SET_DATE_PLACEHOLDERS, typedTime } from "../forms/dateInput";
import { presetField } from "../forms/presets";
import type { BlockCondition, CustomField, DateFieldType, Form, FormBlock, FormField } from "../forms/form";
import { t } from "../i18n";
import { customFieldKey, formBlockKey, formFieldKey, formKey } from "./controlKeys";
import { CUSTOM_FIELDS_LIST_ID, customFieldLabel, customFieldWarning, fieldPickerEntries, templateForm } from "./customFieldsForm";
import type { FieldPickerEntry } from "./customFieldsForm";
import { duplicateEntry, duplicateName } from "./duplicate";
import { FieldPickerModal } from "./fieldPicker";
import {
	addChoice,
	addCondition,
	blockSummary,
	blockWarning,
	conditionField,
	conditionKeyOptions,
	conditionOperatorOptions,
	conditionValueOptions,
	dateFormatOptions,
	dateSourceOptions,
	deleteChoice,
	deleteCondition,
	deleteFieldRow,
	duplicateBlock,
	duplicateField,
	fieldModeOptions,
	fieldBadges,
	fieldRowName,
	fieldRows,
	fieldSourceOptions,
	fieldSummary,
	fieldTypeOptions,
	fieldValueError,
	fieldWarning,
	formRowName,
	formWarning,
	moveChoice,
	moveFieldRow,
	notesSourceOptions,
	readFieldSetting,
	saveAsOptions,
} from "./formsForm";
import type { BlockSetting, FieldSetting } from "./formsForm";
import { editableRow } from "./listPage";
import type { EditableRow, ListPageContext } from "./listPage";
import { sortableRows } from "./sortable";
import { ROW_CONTROL_CLASS } from "./tabOrder";
import { knownPlaceholderKeys, placeholderEntries, placeholderPreview } from "./placeholderMenu";
import { pillInput, renderPillText } from "./pillInput";
import type { PillInput, PillInputOptions } from "./pillInput";
import { NoteSuggest, PropertySuggest, TextSuggest, warningDescription } from "./suggest";
import type { TextSuggestion } from "./suggest";
import { renderFilter } from "./filterEditor";
import { filterRules } from "../lists/filters";
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

export interface FormPageContext extends ExpandingPageContext {
	formClock: () => FormClock;
	customFields: () => CustomField[];
}

type PatternSetting = "namePattern" | "contentPattern";

type IdentifiedPage = SettingDefinitionPage & { id: string };

type FieldKey = (setting: FieldSetting, index?: number) => string;

interface FieldEditor extends EditorBinding<FieldSetting> {
	form: Form;
	field: FormField;
	key: FieldKey;
	context: FormPageContext;
	changed: () => void;
}

interface BlockEditor {
	form: Form;
	block: FormBlock;
	context: FormPageContext;
	changed: () => void;
}

const BLOCK_HEAD_CLASS = "note-compass-block-head";

const BLOCK_MEMBER_CLASS = "note-compass-block-member";

const BLOCK_FOOT_CLASS = "note-compass-block-foot";

const BLOCK_FOOT_ADD_CLASS = "note-compass-block-foot-add";

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
				patternRow(form, context, "namePattern", t("formNamePattern"), t("formNamePatternDesc"), NAME_PATTERN_EXAMPLE),
				patternRow(form, context, "contentPattern", t("formContentPattern"), t("formContentPatternDesc"), ""),
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

function patternRow(form: Form, context: FormPageContext, setting: PatternSetting, name: string, desc: string, placeholder: string): SettingDefinitionRender {
	const multiline = setting === "contentPattern";
	return {
		name,
		desc,
		render: ({ settingEl, controlEl }) => {
			settingEl.addClass("note-compass-pill-setting");
			if (multiline) settingEl.addClass("mod-multiline");
			const input = placeholderInput(controlEl, form, context, multiline, {
				multiline,
				placeholder,
				ariaLabel: name,
				changed: (text) => context.write(formKey(form.id, setting), text),
			});
			input.setValue(form[setting]);
			return () => {
				input.el.remove();
				settingEl.removeClass("note-compass-pill-setting", "mod-multiline");
			};
		},
	};
}

function placeholderInput(
	parentEl: HTMLElement,
	form: Form,
	context: FormPageContext,
	inContent: boolean,
	options: Omit<PillInputOptions, "app" | "entries" | "knownKeys">,
): PillInput {
	return pillInput(parentEl, {
		app: context.app,
		entries: () => {
			const clock = context.formClock();
			return placeholderEntries(form, { inContent, preview: (key) => placeholderPreview(key, clock) });
		},
		knownKeys: () => knownPlaceholderKeys(form, inContent),
		...options,
	});
}

function fieldList(form: Form, context: FormPageContext): SettingDefinitionList {
	const headers = new Map<string, () => void>();
	const changed = () => {
		for (const showHeader of headers.values()) showHeader();
	};
	const rows = fieldRows(form);
	return {
		type: "list",
		heading: t("formFields"),
		cls: "note-compass-sortable-list note-compass-field-list",
		emptyState: t("noFormFieldsYet"),
		items: rows.map((row) => {
			if (row.kind === "head") return blockHeadRow(form, row.block, context, headers, changed);
			if (row.kind === "foot") return blockFootRow(form, row.block, context);
			return fieldRow(form, row.field, row.block, context, headers, changed);
		}),
		onReorder: (from, to) => context.change(() => moveFieldRow(form, from, to)),
		onDelete: (index) =>
			context.change(() => {
				const removed = deleteFieldRow(form, index);
				if (removed !== undefined && context.fieldEditor.expanded.get(form.id) === removed) context.fieldEditor.expanded.delete(form.id);
			}),
		addItem: {
			name: t("addFormField"),
			action: () => openFieldPicker(form, context, (item) => form.fields.push(item), true),
		},
	};
}

function openFieldPicker(form: Form, context: FormPageContext, insert: (item: FormField | FormBlock) => void, offersBlock: boolean): void {
	const entries = fieldPickerEntries(context.customFields(), { offersBlock });
	new FieldPickerModal(context.app, entries, (entry) => {
		const item = pickedItem(form, entry);
		context.fieldEditor.expanded.set(form.id, item.id);
		context.fieldEditor.focusesKey = item.id;
		context.change(() => insert(item));
	}).open();
}

function pickedItem(form: Form, entry: FieldPickerEntry): FormField | FormBlock {
	if (entry.kind === "template") return templateField(form, entry.template);
	if (entry.kind === "preset") return presetField(form, entry.preset);
	return newBlock(form);
}

export function customFieldsList(customFields: CustomField[], context: FormPageContext): SettingDefinitionList {
	const headers = new Map<string, () => void>();
	const changed = () => {
		for (const showHeader of headers.values()) showHeader();
	};
	return {
		type: "list",
		heading: t("customFields"),
		cls: "note-compass-sortable-list note-compass-field-list",
		emptyState: t("noCustomFieldsYet"),
		items: customFields.map((template) => customFieldRow(customFields, template, context, headers, changed)),
		onReorder: (from, to) => context.change(() => customFields.splice(to, 0, ...customFields.splice(from, 1))),
		onDelete: (index) =>
			context.change(() => {
				const [removed] = customFields.splice(index, 1);
				if (removed && context.fieldEditor.expanded.get(CUSTOM_FIELDS_LIST_ID) === removed.id) context.fieldEditor.expanded.delete(CUSTOM_FIELDS_LIST_ID);
			}),
		addItem: {
			name: t("addCustomField"),
			action: () => {
				const template = newCustomField(customFields);
				context.fieldEditor.expanded.set(CUSTOM_FIELDS_LIST_ID, template.id);
				context.fieldEditor.focusesKey = template.id;
				context.change(() => customFields.push(template));
			},
		},
	};
}

function customFieldRow(
	customFields: CustomField[],
	template: CustomField,
	context: FormPageContext,
	headers: Map<string, () => void>,
	changed: () => void,
): SettingDefinition {
	const form = templateForm(template);
	const editor: FieldEditor = {
		form,
		field: template,
		key: (setting, index) => customFieldKey(template.id, setting, index),
		context,
		changed,
		read: (setting) => readFieldSetting(template, setting),
		write: (setting, value) => write(editor, setting, value),
	};
	return expandableRow({
		id: `custom-field-${template.id}-row`,
		name: customFieldLabel(template),
		desc: customFieldWarning(template),
		listId: CUSTOM_FIELDS_LIST_ID,
		itemId: template.id,
		context,
		headers,
		showHeader: (setting) => customFieldHeader(setting, template),
		duplicate: template.unreadable
			? undefined
			: () =>
					context.change(() => {
						const copy = duplicateEntry(customFields, template, newFormId(customFields), (minted) => (minted.name = duplicateName(template.name)));
						if (copy) context.fieldEditor.expanded.set(CUSTOM_FIELDS_LIST_ID, copy.id);
					}),
		expandTooltip: t("editCustomField"),
		collapseTooltip: t("collapseCustomField"),
		renderEditor: (editorEl, takesFocus) => {
			if (template.unreadable) {
				warningDescription(editorEl.createDiv({ cls: "setting-item-description" }), t("unreadableCustomFieldWarning"));
				return;
			}
			renderEditor(
				editorEl,
				(parentEl, draw) => {
					customFieldNameRow(parentEl, template, editor);
					fieldEditorRows(parentEl, editor, draw);
				},
				takesFocus ? "name" : undefined,
			);
		},
	});
}

function customFieldNameRow(parentEl: HTMLElement, template: CustomField, editor: FieldEditor): void {
	const { controlEl } = editorRow(parentEl, t("customFieldName"), t("customFieldNameDesc"));
	const text = new TextComponent(controlEl).setPlaceholder(template.key || t("customFieldNamePlaceholder"));
	text.inputEl.setAttr(FOCUS_ATTRIBUTE, "name");
	text.setValue(template.name).onChange((value) => {
		editor.context.write(customFieldKey(template.id, "name"), value);
		editor.changed();
	});
}

function customFieldHeader(setting: Setting, template: CustomField): void {
	const title = createFragment();
	const nameEl = title.createSpan({ cls: "note-compass-field-title" });
	nameEl.createSpan({ cls: "note-compass-field-name", text: customFieldLabel(template) });
	if (template.name.trim() !== "" && template.key.trim() !== "") nameEl.createSpan({ cls: "note-compass-fixed-value", text: template.key });
	if (!template.unreadable) {
		for (const badge of fieldBadges(template)) nameEl.createSpan({ cls: `note-compass-field-badge mod-${badge.kind}`, text: badge.text });
	}
	setting.setName(title);
	setting.setDesc("");
	setting.descEl.removeClass("note-compass-warning");
	const warning = customFieldWarning(template);
	if (warning) warningDescription(setting.descEl, warning);
}

function fieldRow(
	form: Form,
	field: FormField,
	block: FormBlock | undefined,
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
		cls: block ? BLOCK_MEMBER_CLASS : undefined,
		listId: form.id,
		itemId: field.id,
		context,
		headers,
		showHeader: (setting) => fieldHeader(setting, form, field),
		duplicate: () =>
			context.change(() => {
				const copy = duplicateField(form, field);
				if (copy) context.fieldEditor.expanded.set(form.id, copy.id);
			}),
		expandTooltip: t("editField"),
		collapseTooltip: t("collapseField"),
		renderEditor: (editorEl, takesFocus) => renderEditor(editorEl, (parentEl, draw) => fieldEditorRows(parentEl, editor, draw), takesFocus ? "key" : undefined),
	});
}

function blockHeadRow(
	form: Form,
	block: FormBlock,
	context: FormPageContext,
	headers: Map<string, () => void>,
	changed: () => void,
): SettingDefinition {
	const editor: BlockEditor = { form, block, context, changed };
	return expandableRow({
		id: `block-${block.id}-head`,
		name: `${t("formBlockWhen")} ${blockSummary(form, block)}`,
		desc: blockWarning(form, block),
		cls: BLOCK_HEAD_CLASS,
		listId: form.id,
		itemId: block.id,
		context,
		headers,
		showHeader: (setting) => blockHeader(setting, form, block),
		duplicate: () =>
			context.change(() => {
				const copy = duplicateBlock(form, block);
				if (copy) context.fieldEditor.expanded.set(form.id, copy.id);
			}),
		expandTooltip: t("editBlock"),
		collapseTooltip: t("collapseBlock"),
		renderEditor: (editorEl, takesFocus) =>
			renderEditor(editorEl, (parentEl, draw) => blockEditorRows(parentEl, editor, draw), takesFocus ? conditionFocus("key", 0) : undefined),
	});
}

function blockFootRow(form: Form, block: FormBlock, context: FormPageContext): SettingDefinition {
	const row: SettingDefinitionRender & { id: string } = {
		id: `block-${block.id}-foot`,
		name: t("formBlockEnd"),
		searchable: false,
		render: (setting) => {
			const { settingEl, controlEl } = setting;
			settingEl.addClass(BLOCK_FOOT_CLASS, ROW_CONTROL_CLASS);
			const add = new ExtraButtonComponent(controlEl).setIcon("plus").setTooltip(t("addFieldToBlock"));
			add.extraSettingsEl.addClass(BLOCK_FOOT_ADD_CLASS);
			add.onClick(() =>
				openFieldPicker(
					form,
					context,
					(item) => {
						if (!isBlock(item)) block.fields.push(item);
					},
					false,
				),
			);
			return () => settingEl.removeClass(BLOCK_FOOT_CLASS);
		},
	};
	return row;
}

function blockHeader(setting: Setting, form: Form, block: FormBlock): void {
	const title = createFragment();
	const nameEl = title.createSpan({ cls: "note-compass-field-title" });
	nameEl.createSpan({ cls: "note-compass-field-badge mod-block", text: t("formBlockWhen") });
	nameEl.createSpan({ cls: "note-compass-field-name", text: blockSummary(form, block) });
	setting.setName(title);
	setting.setDesc("");
	setting.descEl.removeClass("note-compass-warning");
	const warning = blockWarning(form, block);
	if (warning) warningDescription(setting.descEl, warning);
}

function conditionFocus(setting: BlockSetting, index: number): string {
	return `condition${setting}/${index}`;
}

function blockEditorRows(editorEl: HTMLElement, editor: BlockEditor, draw: Redraw): void {
	const { block, context } = editor;
	const sectionEl = editorEl.createDiv({ cls: "note-compass-field-choices" });
	const headerEl = sectionEl.createDiv({ cls: "note-compass-field-choices-header" });
	const infoEl = headerEl.createDiv({ cls: "note-compass-field-setting-info" });
	infoEl.createDiv({ cls: "setting-item-name", text: t("formBlockConditions") });
	infoEl.createDiv({ cls: "setting-item-description", text: t("formBlockConditionsDesc") });
	const addButton = new ExtraButtonComponent(headerEl).setIcon("plus").setTooltip(t("addFormCondition"));
	const listEl = sectionEl.createDiv({ cls: "note-compass-form-choice-list" });
	const emptyEl = listEl.createDiv({ cls: "setting-item-description", text: t("formBlockNoConditions") });
	emptyEl.toggle(block.conditions.length === 0);
	block.conditions.forEach((condition, index) => conditionRow(listEl, editor, condition, index, draw));
	addButton.onClick(() => {
		context.saveQuietly(() => addCondition(block));
		editor.changed();
		draw(conditionFocus("key", block.conditions.length - 1));
	});
}

function conditionRow(listEl: HTMLElement, editor: BlockEditor, condition: BlockCondition, index: number, draw: Redraw): void {
	const { form, block, context } = editor;
	const rowEl = listEl.createDiv({ cls: "note-compass-form-choice note-compass-block-condition" });
	const inputsEl = rowEl.createDiv({ cls: "note-compass-form-choice-inputs" });
	const writeCondition = (setting: BlockSetting, value: string) => {
		context.write(formBlockKey(form.id, block.id, setting, index), value);
		editor.changed();
	};
	const key = new DropdownComponent(inputsEl).addOptions(conditionKeyOptions(form, block, condition)).setValue(condition.key);
	key.selectEl.setAttrs({ [FOCUS_ATTRIBUTE]: conditionFocus("key", index), "aria-label": t("formBlockField") });
	key.onChange((value) => {
		writeCondition("key", value);
		draw(conditionFocus("operator", index));
	});
	const operator = new DropdownComponent(inputsEl).addOptions(conditionOperatorOptions(form, block, condition)).setValue(condition.operator);
	operator.selectEl.setAttrs({ [FOCUS_ATTRIBUTE]: conditionFocus("operator", index), "aria-label": t("formBlockOperator") });
	operator.onChange((value) => {
		writeCondition("operator", value);
		draw(conditionFocus("operator", index));
	});
	if (takesValue(condition.operator)) conditionValueControl(inputsEl, editor, condition, index, writeCondition);
	new ExtraButtonComponent(rowEl)
		.setIcon("x")
		.setTooltip(t("formRemoveCondition"))
		.onClick(() => {
			context.saveQuietly(() => deleteCondition(block, index));
			editor.changed();
			draw();
		});
}

function conditionValueControl(
	parentEl: HTMLElement,
	editor: BlockEditor,
	condition: BlockCondition,
	index: number,
	writeCondition: (setting: BlockSetting, value: string) => void,
): void {
	const { form, block } = editor;
	const focus = { [FOCUS_ATTRIBUTE]: conditionFocus("value", index), "aria-label": t("formValue") };
	const choices = conditionValueOptions(form, block, condition);
	if (choices) {
		const dropdown = new DropdownComponent(parentEl).addOptions(choices).setValue(condition.value ?? "");
		dropdown.selectEl.setAttrs(focus);
		dropdown.onChange((value) => writeCondition("value", value));
		return;
	}
	const type = conditionField(form, block, condition.key)?.type;
	const text = new TextComponent(parentEl).setPlaceholder(type && isDateType(type) ? SET_DATE_PLACEHOLDERS[type] : t("formValue")).setValue(condition.value ?? "");
	text.inputEl.setAttrs(focus);
	if (type === "number" || (type && isDateType(type))) text.inputEl.setAttr("inputmode", type === "number" ? "decimal" : "numeric");
	text.onChange((value) => writeCondition("value", value));
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
	const questionInput = keyRow(editorEl, editor);
	dropdownRow(editorEl, editor, "saveAs", t("formSaveAs"), t("formSaveAsDesc"), saveAsOptions(), redraws("saveAs"));
	dropdownRow(editorEl, editor, "mode", t("formMode"), t("formModeDesc"), fieldModeOptions(), redraws("mode"));
	if (asks) questionInput.placeholderOf = textRow(editorEl, editor, "question", t("formQuestion"), t("formQuestionDesc"), field.key).text;
	dropdownRow(editorEl, editor, "type", t("formFieldType"), t("formTypeDesc"), fieldTypeOptions(), redraws("type"));
	if (asks && hasSources(field.type)) {
		dropdownRow(editorEl, editor, "source", t("formSource"), t("formSourceDesc"), fieldSourceOptions(field.type), redraws("source"));
		const source = fieldSource(field);
		if (source === "options") choicesSection(editorEl, editor, draw);
		if (source === "notes") notesSourceRows(editorEl, editor, draw);
	}
	if (asks) {
		toggleRow(editorEl, editor, "optional", t("formOptional"), t("formOptionalDesc"));
		if (isDateType(field.type)) toggleRow(editorEl, editor, "entryTime", t("formEntryTime"), t("formEntryTimeDesc"));
	} else {
		staticValueRows(editorEl, editor);
	}
	if (isDateType(field.type)) {
		const showsCustomFormat = () => customFormat.rowEl.toggle(field.dateFormat === "custom");
		dropdownRow(editorEl, editor, "dateFormat", t("format"), t("formDateFormatDesc"), dateFormatOptions(), showsCustomFormat);
		const customFormat = textRow(editorEl, editor, "customFormat", t("formCustomFormat"), t("formCustomFormatDesc"), "dddd D MMMM YYYY");
		showsCustomFormat();
	}
}

function notesSourceRows(parentEl: HTMLElement, editor: FieldEditor, draw: Redraw): void {
	const { field, context } = editor;
	const source = field.notesFrom;
	if (!source) return;
	dropdownRow(parentEl, editor, "notesSource", t("formNotesFrom"), t("formNotesFromDesc"), notesSourceOptions(field), () => draw("notesSource"));
	if (source.kind === "linksToNote") {
		const { text } = textRow(parentEl, editor, "notesNote", t("note"), t("noteDesc"), t("notePlaceholder"));
		new NoteSuggest(context.app, text.inputEl, (file) => file.path);
	} else if (source.kind === "inFolder") {
		const { text } = textRow(parentEl, editor, "notesFolder", t("folder"), t("folderDesc"), "");
		const suggest = new TextSuggest(context.app, text.inputEl, () => folderSuggestions(context.app));
		suggest.onSelect((suggestion) => {
			suggest.setValue(suggestion.value);
			suggest.close();
			write(editor, "notesFolder", suggestion.value);
		});
	} else if (source.kind === "filter") {
		const { filter } = source;
		const { rowEl } = editorRow(parentEl, t("filter"), filterRules(filter).length === 0 ? t("filterEmptyDesc") : t("filterDesc"), true);
		renderFilter(rowEl, filter, {
			...context,
			change: (mutate) => {
				context.saveQuietly(mutate);
				editor.changed();
			},
		});
	}
}

function folderSuggestions(app: App): TextSuggestion[] {
	return app.vault
		.getAllFolders()
		.map((folder) => ({ value: folder.path }))
		.sort((a, b) => a.value.localeCompare(b.value));
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
			staticTextRow(parentEl, editor);
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

function staticTextRow(parentEl: HTMLElement, editor: FieldEditor): void {
	const { form, field, context } = editor;
	const { controlEl } = editorRow(parentEl, t("formValue"), t("formStaticTextDesc"));
	const input = placeholderInput(controlEl, form, context, false, {
		multiline: false,
		placeholder: t("formLinkHint"),
		ariaLabel: t("formValue"),
		changed: (text) => write(editor, "text", text),
	});
	input.el.setAttr(FOCUS_ATTRIBUTE, "text");
	input.setValue(typeof field.value === "string" ? field.value : "");
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
	const { form, field, context } = editor;
	const choice = field.choices?.[index];
	if (!choice) return;
	const rowEl = listEl.createDiv({ cls: "note-compass-form-choice" });
	new ExtraButtonComponent(rowEl).setIcon("grip-vertical").setTooltip(t("dragToReorder")).extraSettingsEl.addClass("note-compass-form-choice-handle");
	const inputsEl = rowEl.createDiv({ cls: "note-compass-form-choice-inputs" });
	const value = placeholderInput(inputsEl, form, context, false, {
		multiline: false,
		placeholder: t("formChoiceValuePlaceholder"),
		ariaLabel: t("formChoiceValuePlaceholder"),
		changed: (typed) => {
			write(editor, "choiceValue", typed, index);
			label.setPlaceholder(choice.value || t("formChoiceLabelPlaceholder"));
		},
	});
	value.el.setAttr(FOCUS_ATTRIBUTE, `choiceValue/${index}`);
	value.setValue(choice.value);
	const label = new TextComponent(inputsEl).setPlaceholder(choice.value || t("formChoiceLabelPlaceholder")).setValue(choice.label ?? "");
	label.inputEl.setAttr("aria-label", t("formChoiceLabelPlaceholder"));
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
	const { form, field, context } = editor;
	const items = Array.isArray(field.value) ? [...field.value] : [];
	const boxEl = controlEl.createDiv({ cls: "note-compass-chip-input" });
	const known = () => knownPlaceholderKeys(form, false);
	const save = () => write(editor, "listItems", [...items]);
	const draw = () => {
		for (const chipEl of Array.from(boxEl.querySelectorAll(".note-compass-list-chip"))) chipEl.remove();
		items.forEach((item, index) => {
			const chipEl = createSpan({ cls: "note-compass-row-prefix note-compass-list-chip" });
			renderPillText(chipEl.createSpan({ cls: "note-compass-chip-text" }), item, known());
			new ExtraButtonComponent(chipEl)
				.setIcon("x")
				.setTooltip(t("formRemoveItem"))
				.onClick(() => {
					items.splice(index, 1);
					draw();
					save();
					input.el.focus();
				});
			boxEl.insertBefore(chipEl, input.el);
		});
	};
	const add = (keepsFocus: boolean) => {
		const item = input.value().trim();
		if (item === "") return;
		items.push(item);
		input.setValue("");
		draw();
		if (keepsFocus) input.el.focus();
		save();
	};
	const input = placeholderInput(boxEl, form, context, false, {
		multiline: false,
		placeholder: t("formListItemPlaceholder"),
		ariaLabel: t("formListItems"),
		changed: () => undefined,
		linkPicked: () => add(true),
	});
	input.el.addClass("note-compass-chip-input-text");
	input.el.setAttr(FOCUS_ATTRIBUTE, "listItems");
	input.el.addEventListener("keydown", (event) => {
		if (event.isComposing || input.suggest.isOpen) return;
		if (event.key === "Enter") {
			event.preventDefault();
			event.stopPropagation();
			add(true);
		} else if (event.key === "Backspace" && input.value() === "" && items.length > 0) {
			event.stopPropagation();
			items.pop();
			draw();
			save();
		}
	});
	input.el.addEventListener("blur", () => add(false));
	boxEl.addEventListener("click", (event) => {
		if (event.target === boxEl) input.el.focus();
	});
	draw();
}
