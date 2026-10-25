import { ExtraButtonComponent } from "obsidian";
import type { Setting, SettingDefinition, SettingDefinitionItem, SettingDefinitionList, SettingDefinitionPage } from "obsidian";
import { formFields, hasChoices, isDateType, newField } from "../forms/form";
import type { Form, FormField } from "../forms/form";
import { t } from "../i18n";
import { formFieldKey, formKey } from "./controlKeys";
import {
	addChoice,
	dateFormatOptions,
	dateSourceOptions,
	deleteChoice,
	fieldModeOptions,
	fieldRowName,
	fieldSummary,
	fieldTypeOptions,
	fieldValueError,
	fieldWarning,
	formRowName,
	formSummary,
	formWarning,
	moveChoice,
	storeAsOptions,
} from "./formsForm";
import type { FieldSetting } from "./formsForm";
import { editableRow, propertyInput } from "./listPage";
import type { ListPageContext } from "./listPage";
import { warningDescription } from "./suggest";

type IdentifiedPage = SettingDefinitionPage & { id: string };

type FieldGroup = "variables" | "properties";

const NAME_PATTERN_EXAMPLE = "{{date:YYMMDDHHmm}} {{book}}";

export function formPageId(form: Form): string {
	return `form-${form.id}`;
}

export function fieldPageId(field: FormField): string {
	return `field-${field.id}`;
}

export function formRow(form: Form, context: ListPageContext): SettingDefinition {
	return editableRow(
		{
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
		},
		{ ...context, showPrefixes: false },
	);
}

export function formPage(form: Form, context: ListPageContext): SettingDefinitionPage {
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
				fieldList(form, "variables", context),
				fieldList(form, "properties", context),
				{ type: "group", visible: false, items: formFields(form).map((field) => fieldPage(form, field, context)) },
			];
	const page: IdentifiedPage = {
		type: "page",
		id: formPageId(form),
		name: formRowName(form),
		displayValue: form.enabled && !form.unreadable ? "" : t("off"),
		status: formWarning(form) ? "warning" : null,
		items,
	};
	return page;
}

function fieldList(form: Form, group: FieldGroup, context: ListPageContext): SettingDefinitionList {
	const fields = form[group];
	const open = (field: FormField) => context.openPath([formPageId(form), fieldPageId(field)]);
	return {
		type: "list",
		heading: group === "variables" ? t("formVariables") : t("formProperties"),
		cls: "note-compass-sortable-list",
		emptyState: group === "variables" ? t("noVariablesYet") : t("noFormPropertiesYet"),
		items: fields.map((field) => fieldRow(form, field, () => open(field))),
		onReorder: (from, to) => context.change(() => fields.splice(to, 0, ...fields.splice(from, 1))),
		onDelete: (index) => context.change(() => fields.splice(index, 1)),
		addItem: {
			name: group === "variables" ? t("addVariable") : t("addFormProperty"),
			action: () => {
				const field = newField(form);
				context.change(() => fields.push(field));
				open(field);
			},
		},
	};
}

function fieldRow(form: Form, field: FormField, open: () => void): SettingDefinition {
	const warning = fieldWarning(form, field);
	const definition: SettingDefinition & { id: string } = {
		id: `${fieldPageId(field)}-row`,
		name: fieldRowName(field),
		desc: warning ?? fieldSummary(field),
		render: (setting) => {
			setting.settingEl.addClass("note-compass-draggable-row");
			if (warning) warningDescription(setting.descEl, warning);
			setting.addExtraButton((button) => button.setIcon("pencil").setTooltip(t("editField")).onClick(open));
		},
	};
	return definition;
}

function fieldPage(form: Form, field: FormField, context: ListPageContext): SettingDefinitionPage {
	const key = (setting: FieldSetting, index?: number) => formFieldKey(form.id, field.id, setting, index);
	const warning = fieldWarning(form, field);
	const isProperty = form.properties.includes(field);
	const asks = field.mode === "ask";
	const items: SettingDefinitionItem[] = [
		{
			name: t("formFieldNeedsAttention"),
			desc: warning,
			searchable: false,
			visible: warning !== undefined,
			render: (setting) => warningDescription(setting.descEl, warning ?? ""),
		},
		isProperty
			? {
					name: t("property"),
					desc: t("formPropertyKeyDesc"),
					render: propertyInput(context, key("key"), () => field.key, t("formPropertyKeyPlaceholder"), context.propertySuggestions),
				}
			: {
					name: t("formVariableName"),
					desc: t("formVariableNameDesc"),
					control: { type: "text", key: key("key"), placeholder: t("formVariableNamePlaceholder") },
				},
		{ name: t("formMode"), desc: t("formModeDesc"), control: { type: "dropdown", key: key("mode"), options: fieldModeOptions() } },
		{ name: t("type"), desc: t("formTypeDesc"), control: { type: "dropdown", key: key("type"), options: fieldTypeOptions(field.mode) } },
	];
	if (asks) {
		items.push(
			{ name: t("formQuestion"), desc: t("formQuestionDesc"), control: { type: "text", key: key("question"), placeholder: field.key } },
			{ name: t("formOptional"), desc: t("formOptionalDesc"), control: { type: "toggle", key: key("optional") } },
		);
	} else {
		items.push(...staticValueItems(form, field, key, context));
	}
	if (asks && hasChoices(field.type)) {
		items.push(
			{ name: t("formStoreAs"), desc: t("formStoreAsDesc"), control: { type: "dropdown", key: key("storeAs"), options: storeAsOptions() } },
			choiceList(field, key, context),
		);
	}
	if (isDateType(field.type)) {
		items.push(
			{ name: t("format"), desc: t("formDateFormatDesc"), control: { type: "dropdown", key: key("dateFormat"), options: dateFormatOptions() } },
			{
				name: t("formCustomFormat"),
				desc: t("formCustomFormatDesc"),
				visible: () => field.dateFormat === "custom",
				control: { type: "text", key: key("customFormat"), placeholder: "dddd D MMMM YYYY" },
			},
		);
	}
	const page: IdentifiedPage = {
		type: "page",
		id: fieldPageId(field),
		name: fieldRowName(field),
		displayValue: fieldSummary(field),
		status: warning ? "warning" : null,
		items,
	};
	return page;
}

function staticValueItems(
	form: Form,
	field: FormField,
	key: (setting: FieldSetting) => string,
	context: ListPageContext,
): SettingDefinitionItem[] {
	switch (field.type) {
		case "text":
			return [{ name: t("formValue"), desc: t("formStaticValueDesc"), control: { type: "text", key: key("text") } }];
		case "number":
			return [
				{
					name: t("formValue"),
					desc: t("formStaticValueDesc"),
					control: { type: "text", key: key("number"), placeholder: "3", validate: (value) => fieldValueError("number", value) },
				},
			];
		case "checkbox":
			return [{ name: t("formValue"), desc: t("formStaticValueDesc"), control: { type: "toggle", key: key("checked") } }];
		case "list":
			return [{ name: t("formListItems"), desc: t("formListItemsDesc"), render: listItemsInput(field, key("listItems"), context) }];
		default:
			return [
				{
					name: t("formValue"),
					desc: t("formDateSourceDesc"),
					control: { type: "dropdown", key: key("from"), options: dateSourceOptions(form, field) },
				},
			];
	}
}

function choiceList(field: FormField, key: (setting: FieldSetting, index?: number) => string, context: ListPageContext): SettingDefinitionList {
	const choices = field.choices ?? [];
	return {
		type: "list",
		heading: t("formChoices"),
		emptyState: t("noFormChoices"),
		items: choices.map((choice, index) => ({
			name: t("formChoiceNumber", { number: index + 1 }),
			searchable: false,
			render: (setting: Setting) => {
				setting.settingEl.addClass("note-compass-preset-value", "note-compass-form-choice");
				setting.addText((text) =>
					text
						.setPlaceholder(t("formChoiceValuePlaceholder"))
						.setValue(choice.value)
						.onChange((typed) => context.write(key("choiceValue", index), typed)),
				);
				setting.addText((text) =>
					text
						.setPlaceholder(choice.value || t("formChoiceLabelPlaceholder"))
						.setValue(choice.label ?? "")
						.onChange((typed) => context.write(key("choiceLabel", index), typed)),
				);
			},
		})),
		onReorder: (from, to) => context.change(() => moveChoice(field, from, to)),
		onDelete: (index) => context.change(() => deleteChoice(field, index)),
		addItem: { name: t("addFormChoice"), action: () => context.change(() => addChoice(field)) },
	};
}

function listItemsInput(field: FormField, key: string, context: ListPageContext): (setting: Setting) => void {
	return (setting) => {
		setting.settingEl.addClass("note-compass-list-items");
		const items = Array.isArray(field.value) ? [...field.value] : [];
		const boxEl = setting.controlEl.createDiv({ cls: "note-compass-chip-input" });
		const inputEl = createEl("input", {
			type: "text",
			cls: "note-compass-chip-input-text",
			attr: { placeholder: t("formListItemPlaceholder"), "aria-label": t("formListItems") },
		});
		const save = () => context.write(key, [...items]);
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
	};
}
