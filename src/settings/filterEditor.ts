import { DropdownComponent, TextComponent, getAllTags, setIcon } from "obsidian";
import type { App } from "obsidian";
import { t } from "../i18n";
import { typeLabel } from "../i18n/labels";
import { valueShape } from "../lists/conditions";
import type { ValueShape } from "../lists/conditions";
import { FILE_FIELDS, ruleValueType } from "../lists/filters";
import type { FileField, FilterGroup, FilterNode, FilterRule, PropertyRule } from "../lists/filters";
import {
	addCondition,
	addGroup,
	canAddGroup,
	changeRuleField,
	fileFieldLabel,
	filterModeOptions,
	fitRuleToProperty,
	inapplicableRule,
	operatorOptions,
	readConditionField,
	removeNode,
	writeConditionField,
	writeMode,
	writeProperty,
} from "./filterForm";
import type { ConditionField } from "./filterForm";
import { dateModeOptions, directionOptions, fixedDateError } from "./listForm";
import type { PropertySuggestion } from "./listForm";
import { TextSuggest } from "./suggest";
import type { TextSuggestion } from "./suggest";

export interface FilterEditing {
	app: App;
	propertyTypes: Record<string, string>;
	propertySuggestions: () => PropertySuggestion[];
	change: (change: () => unknown) => void;
}

type Suggestions = (editing: FilterEditing) => TextSuggestion[];

const folderSuggestions: Suggestions = ({ app }) =>
	app.vault
		.getAllFolders()
		.map((folder) => ({ value: folder.path }))
		.sort((a, b) => a.value.localeCompare(b.value));

const tagSuggestions: Suggestions = ({ app }) => {
	const tags = new Set<string>();
	for (const file of app.vault.getMarkdownFiles()) {
		const cache = app.metadataCache.getFileCache(file);
		for (const tag of cache ? getAllTags(cache) ?? [] : []) tags.add(tag.replace(/^#/, ""));
	}
	return [...tags].sort((a, b) => a.localeCompare(b)).map((value) => ({ value }));
};

const noteSuggestions: Suggestions = ({ app }) =>
	app.vault
		.getMarkdownFiles()
		.map((file) => ({ value: file.path, label: file.basename, detail: file.path }))
		.sort((a, b) => a.label.localeCompare(b.label));

const pathSuggestions: Suggestions = ({ app }) =>
	app.vault
		.getAllFolders()
		.map((folder) => ({ value: `${folder.path}/` }))
		.sort((a, b) => a.value.localeCompare(b.value));

const propertyNameSuggestions: Suggestions = (editing) =>
	editing.propertySuggestions().map((suggestion) => ({ value: suggestion.name, detail: typeLabel(suggestion.type) }));

const SHAPE_SUGGESTIONS: Partial<Record<ValueShape, Suggestions>> = {
	note: noteSuggestions,
	folder: folderSuggestions,
	tag: tagSuggestions,
	property: propertyNameSuggestions,
};

const FIELD_SUGGESTIONS: Partial<Record<FileField, Suggestions>> = {
	folder: folderSuggestions,
	path: pathSuggestions,
	links: noteSuggestions,
	backlinks: noteSuggestions,
	embeds: noteSuggestions,
	tags: tagSuggestions,
};

const SHAPE_PLACEHOLDERS: Partial<Record<ValueShape, Parameters<typeof t>[0]>> = {
	note: "note",
	folder: "folder",
	tag: "tag",
	property: "property",
	texts: "valuesPlaceholder",
};

const EDITOR_CLASS = "note-compass-filter";

const FILE_FIELD_PREFIX = "file:";

const PROPERTY_PREFIX = "property:";

export function renderFilter(settingEl: HTMLElement, filter: FilterGroup, editing: FilterEditing): () => void {
	settingEl.addClass("note-compass-filter-setting");
	settingEl.querySelectorAll(`:scope > .${EDITOR_CLASS}`).forEach((el) => el.remove());
	const editorEl = settingEl.createDiv({ cls: ["bases-query-container", EDITOR_CLASS] });
	const redraw = () => {
		editorEl.empty();
		renderGroup(editorEl, filter, { depth: 1, editing: { ...editing, change } });
	};
	const change = (mutate: () => unknown) => {
		editing.change(mutate);
		if (editorEl.isConnected) redraw();
	};
	redraw();
	return () => editorEl.remove();
}

interface GroupPlace {
	depth: number;
	parent?: GroupPlace & { group: FilterGroup };
	editing: FilterEditing;
}

function renderGroup(parentEl: HTMLElement, group: FilterGroup, place: GroupPlace): void {
	const { editing } = place;
	const groupEl = parentEl.createDiv({ cls: "filter-group" });
	const headerEl = groupEl.createDiv({ cls: "filter-group-header" });
	const modeEl = headerEl.createEl("select", { cls: ["conjunction", "dropdown"] });
	for (const [mode, label] of Object.entries(filterModeOptions())) {
		modeEl.createEl("option", { text: label, attr: { value: mode } }).selected = mode === group.mode;
	}
	modeEl.addEventListener("change", () => editing.change(() => writeMode(group, modeEl.value)));
	const headerActionsEl = headerEl.createDiv({ cls: "filter-group-header-actions" });
	const { parent } = place;
	if (parent) iconButton(headerActionsEl, "trash-2", t("removeFilterGroup"), () => editing.change(() => removeFrom(parent, group)));
	const statementsEl = groupEl.createDiv({ cls: "filter-group-statements" });
	const here = { ...place, group };
	group.items.forEach((item, index) => {
		const rowEl = statementsEl.createDiv({ cls: "filter-row" });
		rowEl.createSpan({ cls: "conjunction", text: t(index === 0 ? "where" : group.mode === "all" ? "and" : "or") });
		if (item.kind === "group") {
			rowEl.addClass("mod-group");
			renderGroup(rowEl, item, { depth: place.depth + 1, parent: here, editing });
		} else {
			renderRule(rowEl, item, here);
		}
	});
	const actionsEl = groupEl.createDiv({ cls: "filter-group-actions" });
	textIconButton(actionsEl, "plus", t("addFilter"), () => editing.change(() => addCondition(group)));
	if (canAddGroup(place.depth)) textIconButton(actionsEl, "plus", t("addFilterGroup"), () => editing.change(() => addGroup(group)));
}

function removeFrom(place: GroupPlace & { group: FilterGroup }, node: FilterNode): void {
	removeNode(place.group, node);
	if (place.group.items.length === 0 && place.parent) removeFrom(place.parent, place.group);
}

function renderRule(parentEl: HTMLElement, rule: FilterRule, place: GroupPlace & { group: FilterGroup }): void {
	const { editing, group } = place;
	const statementEl = parentEl.createDiv({ cls: "filter-statement" });
	const expressionEl = statementEl.createDiv({ cls: ["filter-expression", "metadata-property"] });
	renderLeftSide(expressionEl, rule, group, editing);
	const rightEl = createRightSide(expressionEl, statementEl, rule, editing);
	const actionsEl = expressionEl.createDiv({ cls: "filter-row-actions" });
	iconButton(actionsEl, "trash-2", t("removeFilter"), () => editing.change(() => removeFrom(place, rule)));
	const inapplicable = inapplicableRule(rule, editing.propertyTypes);
	if (inapplicable) statementEl.createDiv({ cls: "filter-row-error", text: inapplicable });
	if (rightEl.childElementCount === 0) rightEl.addClass("is-empty");
}

function renderLeftSide(expressionEl: HTMLElement, rule: FilterRule, group: FilterGroup, editing: FilterEditing): void {
	const shown = leftLabel(rule);
	const commit = (value: string) =>
		editing.change(() => {
			const typed = value.trim();
			if (typed === shown) return;
			const field = fieldNamed(typed);
			if (field) {
				changeRuleField(group, rule, field);
				return;
			}
			const target: PropertyRule | undefined = rule.kind === "property" ? rule : replaceWithProperty(group, rule);
			if (!target) return;
			writeProperty(target, typed);
			fitRuleToProperty(target, editing.propertyTypes);
		});
	const text = new TextComponent(expressionEl).setPlaceholder(t("property")).setValue(shown);
	text.inputEl.addClass("filter-property-select");
	text.inputEl.addEventListener("change", () => commit(text.getValue()));
	const suggest = new TextSuggest(editing.app, text.inputEl, () => leftSuggestions(editing));
	suggest.onSelect((suggestion) => {
		suggest.close();
		if (suggestion.value.startsWith(FILE_FIELD_PREFIX)) {
			const field = suggestion.value.slice(FILE_FIELD_PREFIX.length);
			editing.change(() => changeRuleField(group, rule, field));
			return;
		}
		commit(suggestion.value.slice(PROPERTY_PREFIX.length));
	});
}

function leftLabel(rule: FilterRule): string {
	return rule.kind === "property" ? rule.property : fileFieldLabel(rule.field);
}

function fieldNamed(typed: string): FileField | undefined {
	const wanted = typed.toLowerCase();
	return FILE_FIELDS.find((field) => fileFieldLabel(field).toLowerCase() === wanted);
}

function replaceWithProperty(group: FilterGroup, rule: FilterRule): PropertyRule | undefined {
	const index = group.items.indexOf(rule);
	changeRuleField(group, rule, "property");
	const replacement = group.items[index];
	return replacement?.kind === "property" ? replacement : undefined;
}

function leftSuggestions(editing: FilterEditing): TextSuggestion[] {
	const fields = FILE_FIELDS.map((field) => ({
		value: FILE_FIELD_PREFIX + field,
		label: fileFieldLabel(field),
		detail: t("fileField"),
	}));
	const properties = editing.propertySuggestions().map((suggestion) => ({
		value: PROPERTY_PREFIX + suggestion.name,
		label: suggestion.name,
		detail: typeLabel(suggestion.type),
	}));
	return [...fields, ...properties];
}

function createRightSide(expressionEl: HTMLElement, statementEl: HTMLElement, rule: FilterRule, editing: FilterEditing): HTMLElement {
	const unchosen = rule.kind === "property" && rule.property === "";
	const type = ruleValueType(rule, editing.propertyTypes);
	const { operator } = rule.condition;
	const dropdown = new DropdownComponent(expressionEl)
		.addOptions(operatorOptions(type, operator))
		.setValue(operator)
		.setDisabled(unchosen)
		.onChange((chosen) => editing.change(() => writeConditionField(rule, "operator", chosen, editing.propertyTypes)));
	dropdown.selectEl.addClass("filter-operator");
	const rightEl = expressionEl.createDiv({ cls: ["filter-rhs-container", "metadata-property-value"] });
	const shape = valueShape(type, operator);
	if (!unchosen && shape !== undefined) renderConditionValue(rightEl, statementEl, rule, shape, editing);
	return rightEl;
}

function valueSuggestions(rule: FilterRule, shape: ValueShape): Suggestions | undefined {
	if (shape !== "text") return SHAPE_SUGGESTIONS[shape];
	return rule.kind === "file" ? FIELD_SUGGESTIONS[rule.field] : undefined;
}

function renderConditionValue(rowEl: HTMLElement, statementEl: HTMLElement, rule: FilterRule, shape: ValueShape, editing: FilterEditing): void {
	const draft = (field: ConditionField, value: unknown) => writeConditionField(rule, field, value, editing.propertyTypes);
	const write = (field: ConditionField, value: unknown) => editing.change(() => writeConditionField(rule, field, value, editing.propertyTypes));
	const edit = (field: ConditionField): TextEdit => ({ typing: (value) => draft(field, value), commit: (value) => write(field, value) });
	const numberEdit = (field: ConditionField): TextEdit => ({
		typing: (value) => {
			if (isNumber(value)) draft(field, Number(value));
		},
		commit: (value) => {
			if (isNumber(value)) write(field, Number(value));
		},
	});
	const read = (field: ConditionField) => readConditionField(rule, field);
	const readText = (field: ConditionField) => {
		const value = read(field);
		return typeof value === "string" ? value : "";
	};
	const readNumber = (field: ConditionField) => {
		const value = read(field);
		return typeof value === "number" ? value : 0;
	};
	if (shape === "none") return;
	if (shape === "number") {
		numberInput(rowEl, readNumber("number"), numberEdit("number"));
		return;
	}
	if (shape === "boolean") {
		const checkboxEl = rowEl.createEl("input", { type: "checkbox", cls: "metadata-input-checkbox" });
		checkboxEl.checked = read("boolean") === true;
		checkboxEl.addEventListener("change", () => write("boolean", checkboxEl.checked));
		return;
	}
	if (shape === "texts") {
		textInput(rowEl, readText("texts"), t("valuesPlaceholder"), edit("texts"));
		return;
	}
	if (shape !== "date") {
		const placeholder = SHAPE_PLACEHOLDERS[shape];
		const text = textInput(rowEl, readText("text"), t(placeholder ?? "value"), edit("text"));
		const suggestions = valueSuggestions(rule, shape);
		if (!suggestions) return;
		let cached: TextSuggestion[] | undefined;
		const suggest = new TextSuggest(editing.app, text.inputEl, () => (cached = cached ?? suggestions(editing)));
		suggest.onSelect((suggestion) => {
			suggest.setValue(suggestion.value);
			suggest.close();
			write("text", suggestion.value);
		});
		return;
	}
	new DropdownComponent(rowEl)
		.addOptions(dateModeOptions())
		.setValue(readText("dateMode"))
		.onChange((mode) => write("dateMode", mode));
	if (readText("dateMode") === "fixed") {
		const errorEl = statementEl.createDiv({ cls: "filter-row-error" });
		const valid = (value: string) => {
			const error = value.trim() === "" ? undefined : fixedDateError(value.trim());
			errorEl.toggle(error !== undefined);
			errorEl.setText(error ?? "");
			return value.trim() !== "" && error === undefined;
		};
		const date = readText("date");
		valid(date);
		textInput(rowEl, date, "YYYY-MM-DD", {
			typing: (value) => {
				if (valid(value)) draft("date", value);
			},
			commit: (value) => {
				if (valid(value)) write("date", value);
			},
		});
		return;
	}
	new DropdownComponent(rowEl)
		.addOptions(directionOptions())
		.setValue(readText("direction"))
		.onChange((direction) => write("direction", direction));
	if (readText("direction") !== "today") numberInput(rowEl, readNumber("days"), numberEdit("days"), 1);
}

interface TextEdit {
	typing: (value: string) => void;
	commit: (value: string) => void;
}

function isNumber(value: string): boolean {
	return value.trim() !== "" && Number.isFinite(Number(value));
}

function textInput(parentEl: HTMLElement, value: string, placeholder: string, edit: TextEdit): TextComponent {
	const text = new TextComponent(parentEl).setPlaceholder(placeholder).setValue(value);
	text.inputEl.addEventListener("input", () => edit.typing(text.getValue()));
	text.inputEl.addEventListener("change", () => edit.commit(text.getValue()));
	return text;
}

function numberInput(parentEl: HTMLElement, value: number, edit: TextEdit, min?: number): void {
	const text = textInput(parentEl, String(value), "", edit);
	text.inputEl.type = "number";
	text.inputEl.addClass("note-compass-filter-number");
	if (min === undefined) return;
	text.inputEl.min = String(min);
	text.inputEl.step = "1";
}

function textIconButton(parentEl: HTMLElement, icon: string, label: string, onClick: () => void): void {
	const buttonEl = parentEl.createDiv({ cls: ["text-icon-button", "tappable"], attr: { tabindex: "0", role: "button" } });
	setIcon(buttonEl.createSpan({ cls: "text-button-icon" }), icon);
	buttonEl.createSpan({ cls: "text-button-label", text: label });
	pressable(buttonEl, onClick);
}

function iconButton(parentEl: HTMLElement, icon: string, label: string, onClick: () => void): void {
	const buttonEl = parentEl.createEl("button", { cls: "clickable-icon", attr: { "aria-label": label } });
	setIcon(buttonEl, icon);
	pressable(buttonEl, onClick);
}

function pressable(el: HTMLElement, onClick: () => void): void {
	el.addEventListener("mousedown", (event) => event.preventDefault());
	el.addEventListener("click", (event) => {
		event.preventDefault();
		onClick();
	});
	el.addEventListener("keydown", (event) => {
		if (el.tagName === "BUTTON" || (event.key !== "Enter" && event.key !== " ")) return;
		event.preventDefault();
		onClick();
	});
}
