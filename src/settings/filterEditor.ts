import { ButtonComponent, DropdownComponent, ExtraButtonComponent, TextComponent, getAllTags } from "obsidian";
import type { App, Setting } from "obsidian";
import { propertyType } from "../lists/conditions";
import type { FilterGroup, FilterRule } from "../lists/filters";
import {
	FILE_DATE_OPTIONS,
	FILTER_MODE_OPTIONS,
	RULE_FIELD_OPTIONS,
	addCondition,
	addGroup,
	canAddGroup,
	changeRuleField,
	inapplicableRule,
	readConditionField,
	removeNode,
	ruleField,
	fitRuleToProperty,
	ruleText,
	writeConditionField,
	writeMode,
	writeRuleText,
} from "./filterForm";
import type { ConditionField, ConditionRule } from "./filterForm";
import { DATE_MODE_OPTIONS, DIRECTION_OPTIONS, fixedDateError, operatorOptions, valueShape } from "./listForm";
import type { PropertySuggestion } from "./listForm";
import { PropertySuggest, TextSuggest, warningDescription } from "./suggest";
import type { TextSuggestion } from "./suggest";

export interface FilterEditing {
	app: App;
	propertyTypes: Record<string, string>;
	propertySuggestions: () => PropertySuggestion[];
	change: (change: () => unknown) => void;
}

type Suggestions = (app: App) => TextSuggestion[];

const TEXT_PLACEHOLDERS: Record<Exclude<FilterRule["kind"], "file">, string> = {
	property: "Property",
	folder: "Folder",
	tag: "Tag",
	linksTo: "Note",
};

const SUGGESTIONS: Partial<Record<FilterRule["kind"], Suggestions>> = {
	folder: (app) =>
		app.vault
			.getAllFolders()
			.map((folder) => ({ value: folder.path }))
			.sort((a, b) => a.value.localeCompare(b.value)),
	tag: (app) => {
		const tags = new Set<string>();
		for (const file of app.vault.getMarkdownFiles()) {
			const cache = app.metadataCache.getFileCache(file);
			for (const tag of cache ? getAllTags(cache) ?? [] : []) tags.add(tag.replace(/^#/, ""));
		}
		return [...tags].sort((a, b) => a.localeCompare(b)).map((value) => ({ value }));
	},
	linksTo: (app) =>
		app.vault
			.getMarkdownFiles()
			.map((file) => ({ value: file.path, label: file.basename, detail: file.path }))
			.sort((a, b) => a.label.localeCompare(b.label)),
};

export function renderFilter(setting: Setting, filter: FilterGroup, editing: FilterEditing): void {
	setting.settingEl.addClass("note-compass-filter-setting");
	renderGroup(setting.settingEl.createDiv({ cls: "note-compass-filter" }), filter, 1, undefined, editing);
}

function renderGroup(
	parentEl: HTMLElement,
	group: FilterGroup,
	depth: number,
	parent: FilterGroup | undefined,
	editing: FilterEditing,
): void {
	const groupEl = parentEl.createDiv({ cls: parent ? ["note-compass-filter-group", "is-nested"] : "note-compass-filter-group" });
	const headerEl = groupEl.createDiv({ cls: "note-compass-filter-row" });
	new DropdownComponent(headerEl)
		.addOptions(FILTER_MODE_OPTIONS)
		.setValue(group.mode)
		.onChange((mode) => editing.change(() => writeMode(group, mode)));
	if (parent) removeButton(headerEl, "Remove group", () => editing.change(() => removeNode(parent, group)));
	const itemsEl = groupEl.createDiv({ cls: "note-compass-filter-items" });
	for (const item of group.items) {
		if (item.kind === "group") renderGroup(itemsEl, item, depth + 1, group, editing);
		else renderRule(itemsEl, item, group, editing);
	}
	const actionsEl = groupEl.createDiv({ cls: "note-compass-filter-actions" });
	addButton(actionsEl, "+ Add condition", () => editing.change(() => addCondition(group)));
	if (canAddGroup(depth)) addButton(actionsEl, "+ Add group", () => editing.change(() => addGroup(group)));
}

function renderRule(parentEl: HTMLElement, rule: FilterRule, group: FilterGroup, editing: FilterEditing): void {
	const ruleEl = parentEl.createDiv({ cls: "note-compass-filter-rule" });
	const rowEl = ruleEl.createDiv({ cls: "note-compass-filter-row" });
	new DropdownComponent(rowEl)
		.addOptions(RULE_FIELD_OPTIONS)
		.setValue(ruleField(rule))
		.onChange((field) => editing.change(() => changeRuleField(group, rule, field)));
	if (rule.kind === "file") {
		new DropdownComponent(rowEl)
			.addOptions(FILE_DATE_OPTIONS)
			.setValue(rule.condition.operator)
			.onChange((operator) => editing.change(() => writeConditionField(rule, "operator", operator)));
		renderConditionValue(rowEl, ruleEl, rule, editing);
	} else {
		renderRuleText(rowEl, rule, editing);
	}
	if (rule.kind === "property") {
		const chosen = rule.property !== "";
		const type = propertyType(editing.propertyTypes, rule.property);
		new DropdownComponent(rowEl)
			.addOptions(operatorOptions(type, rule.condition.operator))
			.setValue(rule.condition.operator)
			.setDisabled(!chosen)
			.onChange((operator) => editing.change(() => writeConditionField(rule, "operator", operator)));
		if (chosen) renderConditionValue(rowEl, ruleEl, rule, editing);
	}
	removeButton(rowEl, "Remove condition", () => editing.change(() => removeNode(group, rule)));
	const inapplicable = inapplicableRule(rule, editing.propertyTypes);
	if (inapplicable) warningDescription(ruleEl.createDiv({ cls: "setting-item-description" }), inapplicable);
}

function renderRuleText(rowEl: HTMLElement, rule: Exclude<FilterRule, { kind: "file" }>, editing: FilterEditing): void {
	const commit = (value: string) =>
		editing.change(() => {
			writeRuleText(rule, value);
			if (rule.kind === "property") fitRuleToProperty(rule, editing.propertyTypes);
		});
	const text = textInput(rowEl, ruleText(rule), TEXT_PLACEHOLDERS[rule.kind], { typing: (value) => writeRuleText(rule, value), commit });
	if (rule.kind === "property") {
		const suggest = new PropertySuggest(editing.app, text.inputEl, editing.propertySuggestions);
		suggest.onSelect((suggestion) => {
			suggest.setValue(suggestion.name);
			suggest.close();
			commit(suggestion.name);
		});
		return;
	}
	const suggestions = SUGGESTIONS[rule.kind];
	if (!suggestions) return;
	let cached: TextSuggestion[] | undefined;
	const suggest = new TextSuggest(editing.app, text.inputEl, () => (cached = cached ?? suggestions(editing.app)));
	suggest.onSelect((suggestion) => {
		suggest.setValue(suggestion.value);
		suggest.close();
		commit(suggestion.value);
	});
}

function renderConditionValue(rowEl: HTMLElement, ruleEl: HTMLElement, rule: ConditionRule, editing: FilterEditing): void {
	const draft = (field: ConditionField, value: unknown) => writeConditionField(rule, field, value);
	const write = (field: ConditionField, value: unknown) => editing.change(() => writeConditionField(rule, field, value));
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
	const shape = valueShape(rule.condition.operator);
	if (shape === "text") {
		textInput(rowEl, readText("text"), "Value", edit("text"));
		return;
	}
	if (shape === "number") {
		numberInput(rowEl, readNumber("number"), numberEdit("number"));
		return;
	}
	if (shape !== "date") return;
	new DropdownComponent(rowEl)
		.addOptions(DATE_MODE_OPTIONS)
		.setValue(readText("dateMode"))
		.onChange((mode) => write("dateMode", mode));
	if (readText("dateMode") === "fixed") {
		const errorEl = ruleEl.createDiv({ cls: "setting-item-description" });
		const valid = (value: string) => {
			const error = value.trim() === "" ? undefined : fixedDateError(value.trim());
			errorEl.toggle(error !== undefined);
			if (error) warningDescription(errorEl, error);
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
		.addOptions(DIRECTION_OPTIONS)
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

function addButton(parentEl: HTMLElement, label: string, onClick: () => void): void {
	const button = new ButtonComponent(parentEl).setButtonText(label).setClass("note-compass-filter-add").onClick(onClick);
	keepFocusOnPress(button.buttonEl);
}

function removeButton(parentEl: HTMLElement, tooltip: string, onClick: () => void): void {
	const button = new ExtraButtonComponent(parentEl).setIcon("x").setTooltip(tooltip).onClick(onClick);
	keepFocusOnPress(button.extraSettingsEl);
}

function keepFocusOnPress(el: HTMLElement): void {
	el.addEventListener("mousedown", (event) => event.preventDefault());
}
