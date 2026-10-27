import { TextComponent } from "obsidian";
import type { Setting, SettingDefinitionList } from "obsidian";
import { t } from "../i18n";
import type { EditableProperty } from "../settings";
import { newFixedValueId } from "../setProperties/fixedValues";
import type { FixedValue } from "../setProperties/fixedValues";
import { fixedValueKey } from "./controlKeys";
import { duplicateEntry } from "./duplicate";
import { FOCUS_ATTRIBUTE, checkedTextRow, dropdownRow, editorRow, expandableRow, renderEditor, suggestProperties, textRow, toggleRow } from "./fieldEditor";
import type { EditorBinding, ExpandingPageContext, Redraw } from "./fieldEditor";
import {
	FIXED_VALUE_PLACEHOLDERS,
	addFixedValue,
	dateChoiceOptions,
	deleteFixedValue,
	fixedValueError,
	fixedValueTitle,
	fixedValueTypeOptions,
	moveFixedValue,
	readFixedValueSetting,
} from "./fixedValuesForm";
import type { FixedValueSetting } from "./fixedValuesForm";
import { propertyTypePreset } from "./setPropertiesForm";
import { NoteSuggest } from "./suggest";

interface FixedValueEditor extends EditorBinding<FixedValueSetting> {
	fixed: FixedValue;
	context: ExpandingPageContext;
}

export function fixedValuesList(entry: EditableProperty, context: ExpandingPageContext): SettingDefinitionList {
	const values = entry.fixedValues ?? [];
	const { expanded } = context.fieldEditor;
	const headers = new Map<string, () => void>();
	const changed = () => {
		for (const showHeader of headers.values()) showHeader();
	};
	return {
		type: "list",
		heading: t("fixedValues"),
		cls: "note-compass-sortable-list note-compass-field-list",
		emptyState: t("noFixedValues"),
		items: values.map((fixed) => fixedValueRow(entry, fixed, context, headers, changed)),
		onReorder: (from, to) => context.change(() => moveFixedValue(entry, from, to)),
		onDelete: (index) =>
			context.change(() => {
				const removed = deleteFixedValue(entry, index);
				if (removed && expanded.get(entry.id) === removed.id) expanded.delete(entry.id);
			}),
		addItem: {
			name: t("addFixedValue"),
			action: () =>
				context.change(() => {
					const fixed = addFixedValue(entry);
					expanded.set(entry.id, fixed.id);
					context.fieldEditor.focusesKey = fixed.id;
				}),
		},
	};
}

function fixedValueRow(
	entry: EditableProperty,
	fixed: FixedValue,
	context: ExpandingPageContext,
	headers: Map<string, () => void>,
	changed: () => void,
) {
	const editor: FixedValueEditor = {
		fixed,
		context,
		read: (setting) => readFixedValueSetting(fixed, setting),
		write: (setting, value) => {
			context.write(fixedValueKey(entry.id, fixed.id, setting), value);
			changed();
		},
	};
	const title = fixedValueTitle(fixed);
	return expandableRow({
		id: `fixed-value-${entry.id}-${fixed.id}-row`,
		name: `${title.property} ${title.value}`,
		listId: entry.id,
		itemId: fixed.id,
		context,
		headers,
		showHeader: (setting) => fixedValueHeader(setting, fixed),
		duplicate: () =>
			context.change(() => {
				const values = entry.fixedValues ?? [];
				const copy = duplicateEntry(values, fixed, newFixedValueId(values));
				if (copy) context.fieldEditor.expanded.set(entry.id, copy.id);
			}),
		expandTooltip: t("editFixedValue"),
		collapseTooltip: t("collapseFixedValue"),
		renderEditor: (editorEl, takesFocus) => renderEditor(editorEl, (parentEl, draw) => fixedValueRows(parentEl, editor, draw), takesFocus ? "property" : undefined),
	});
}

function fixedValueHeader(setting: Setting, fixed: FixedValue): void {
	const { property, value } = fixedValueTitle(fixed);
	const title = createFragment();
	const nameEl = title.createSpan({ cls: "note-compass-field-title" });
	nameEl.createSpan({ cls: "note-compass-field-name", text: property });
	nameEl.createSpan({ cls: "note-compass-fixed-value", text: value });
	setting.setName(title);
	setting.setDesc("");
}

function fixedValueRows(parentEl: HTMLElement, editor: FixedValueEditor, draw: Redraw): void {
	const { fixed } = editor;
	propertyRow(parentEl, editor, draw);
	dropdownRow(parentEl, editor, "type", t("type"), t("fixedTypeDesc"), fixedValueTypeOptions(), () => draw("type"));
	switch (fixed.type) {
		case "clear":
			return;
		case "checkbox":
			toggleRow(parentEl, editor, "value", t("formValue"), t("fixedCheckboxDesc"));
			return;
		case "text":
			textRow(parentEl, editor, "value", t("formValue"), t("fixedTextDesc"), t("presetTextPlaceholder"));
			return;
		case "number":
			checkedTextRow(parentEl, editor, "value", t("formValue"), t("fixedNumberDesc"), "3", (typed) => fixedValueError("number", typed));
			return;
		case "date":
		case "datetime": {
			const type = fixed.type;
			const showsFixedDate = () => fixedDate.rowEl.toggle(fixed.relative === undefined);
			dropdownRow(parentEl, editor, "relative", t("formValue"), t("fixedDateDesc"), dateChoiceOptions(type), showsFixedDate);
			const fixedDate = checkedTextRow(parentEl, editor, "value", t("formSetDate"), t("fixedDateValueDesc", { format: FIXED_VALUE_PLACEHOLDERS[type] }), FIXED_VALUE_PLACEHOLDERS[type], (typed) =>
				fixedValueError(type, typed),
			);
			showsFixedDate();
			return;
		}
		default:
			noteRow(parentEl, editor);
	}
}

function propertyRow(parentEl: HTMLElement, editor: FixedValueEditor, draw: Redraw): void {
	const { fixed, context } = editor;
	const { controlEl } = editorRow(parentEl, t("property"), t("fixedPropertyDesc"));
	const text = new TextComponent(controlEl).setPlaceholder(t("propertyPlaceholder")).setValue(fixed.property);
	text.inputEl.setAttr(FOCUS_ATTRIBUTE, "property");
	text.onChange((typed) => {
		if (typed.trim() !== fixed.property) editor.write("property", typed);
	});
	suggestProperties(context.app, text.inputEl, context.propertySuggestions, (suggestion) => {
		editor.write("property", suggestion.name);
		editor.write("type", propertyTypePreset(suggestion.type));
		draw("type");
	});
}

function noteRow(parentEl: HTMLElement, editor: FixedValueEditor): void {
	const { controlEl } = editorRow(parentEl, t("note"), editor.fixed.type === "links" ? t("fixedLinksDesc") : t("fixedLinkDesc"));
	const text = new TextComponent(controlEl).setPlaceholder(t("notePlaceholder")).setValue(String(editor.read("value")));
	text.inputEl.setAttr(FOCUS_ATTRIBUTE, "value");
	text.onChange((typed) => editor.write("value", typed));
	new NoteSuggest(editor.context.app, text.inputEl);
}
