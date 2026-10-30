import { DropdownComponent, ExtraButtonComponent, TextComponent, ToggleComponent, setIcon, setTooltip } from "obsidian";
import type { App, Setting, SettingDefinitionRender } from "obsidian";
import { t } from "../i18n";
import { headerClickToggles, toggleExpandedField } from "./formsForm";
import type { PropertySuggestion } from "./listForm";
import type { ListPageContext } from "./listPage";
import { PropertySuggest } from "./suggest";
import { ROW_CONTROL_CLASS } from "./tabOrder";

export interface FieldEditorState {
	expanded: Map<string, string>;
	focusesKey?: string;
}

export interface ExpandingPageContext extends ListPageContext {
	fieldEditor: FieldEditorState;
	refresh: () => void;
	saveQuietly: (change: () => unknown) => void;
}

export interface EditorBinding<Setting extends string> {
	read: (setting: Setting) => unknown;
	write: (setting: Setting, value: unknown) => void;
}

export interface EditorRow {
	rowEl: HTMLElement;
	descEl: HTMLElement;
	controlEl: HTMLElement;
}

export type Redraw = (focus?: string) => void;

export interface ExpandableRow {
	id: string;
	name: string;
	desc?: string;
	cls?: string;
	listId: string;
	itemId: string;
	context: ExpandingPageContext;
	headers: Map<string, () => void>;
	showHeader: (setting: Setting) => void;
	duplicate?: () => void;
	expandTooltip: string;
	collapseTooltip: string;
	renderEditor: (editorEl: HTMLElement, takesFocus: boolean) => void;
}

export const FOCUS_ATTRIBUTE = "data-note-compass-focus";

export function expandableRow(row: ExpandableRow): SettingDefinitionRender & { id: string } {
	const { context, headers, listId, itemId } = row;
	return {
		id: row.id,
		name: row.name,
		desc: row.desc,
		render: (setting) => {
			const { settingEl, controlEl } = setting;
			const expanded = context.fieldEditor.expanded.get(listId) === itemId;
			settingEl.addClass("note-compass-draggable-row", "note-compass-field-row", ROW_CONTROL_CLASS);
			if (row.cls) settingEl.addClass(row.cls);
			settingEl.toggleClass("is-expanded", expanded);
			settingEl.setAttr("aria-expanded", String(expanded));
			const showHeader = () => row.showHeader(setting);
			showHeader();
			headers.set(itemId, showHeader);
			const toggle = () => {
				toggleExpandedField(context.fieldEditor.expanded, listId, itemId);
				context.refresh();
			};
			const { duplicate } = row;
			if (duplicate) new ExtraButtonComponent(controlEl).setIcon("copy").setTooltip(t("duplicateRow")).onClick(duplicate);
			const chevronEl = controlEl.createDiv({ cls: "clickable-icon note-compass-field-chevron" });
			setIcon(chevronEl, expanded ? "chevron-down" : "chevron-right");
			setTooltip(chevronEl, expanded ? row.collapseTooltip : row.expandTooltip);
			const editorEl = expanded ? settingEl.createDiv({ cls: "note-compass-field-editor" }) : undefined;
			if (editorEl) {
				const takesFocus = context.fieldEditor.focusesKey === itemId;
				if (takesFocus) context.fieldEditor.focusesKey = undefined;
				row.renderEditor(editorEl, takesFocus);
			}
			const onClick = (event: MouseEvent) => {
				const path = event.composedPath();
				const click = {
					inEditor: editorEl !== undefined && path.includes(editorEl),
					inControls: path.includes(controlEl),
					onChevron: path.includes(chevronEl),
				};
				if (headerClickToggles(click)) toggle();
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
				if (row.cls) settingEl.removeClass(row.cls);
				settingEl.removeAttribute("aria-expanded");
				editorEl?.remove();
				if (headers.get(itemId) === showHeader) headers.delete(itemId);
			};
		},
	};
}

export function renderEditor(editorEl: HTMLElement, rows: (parentEl: HTMLElement, draw: Redraw) => void, focus?: string): void {
	const draw: Redraw = (target) => {
		const releaseLayout = holdLayout(editorEl);
		const contentEl = createDiv();
		rows(contentEl, draw);
		editorEl.setChildrenInPlace(Array.from(contentEl.childNodes));
		releaseLayout();
		focusControl(editorEl, target);
	};
	rows(editorEl, draw);
	focusControl(editorEl, focus);
}

export function focusControl(editorEl: HTMLElement, target: string | undefined): void {
	if (target === undefined) return;
	const focusEl = editorEl.querySelector<HTMLElement>(`[${FOCUS_ATTRIBUTE}="${target}"]`);
	if (!focusEl) return;
	editorEl.win.setTimeout(() => {
		focusEl.focus({ preventScroll: true });
		focusEl.scrollIntoView({ block: "nearest" });
	}, 0);
}

function scrollerOf(el: HTMLElement): HTMLElement | undefined {
	for (let parentEl = el.parentElement; parentEl; parentEl = parentEl.parentElement) {
		const { overflowY } = el.win.getComputedStyle(parentEl);
		if (overflowY === "auto" || overflowY === "scroll") return parentEl;
	}
	return undefined;
}

function holdLayout(el: HTMLElement): () => void {
	const scrollerEl = scrollerOf(el);
	const scrollTop = scrollerEl?.scrollTop;
	el.setCssStyles({ minHeight: `${el.offsetHeight}px` });
	const restoreScroll = () => {
		if (scrollerEl && scrollTop !== undefined) scrollerEl.scrollTop = scrollTop;
	};
	return () => {
		restoreScroll();
		el.win.requestAnimationFrame(() => {
			el.setCssStyles({ minHeight: "" });
			restoreScroll();
		});
	};
}

export function editorRow(parentEl: HTMLElement, name: string, desc: string, wide = false): EditorRow {
	const rowEl = parentEl.createDiv({ cls: wide ? "note-compass-field-setting mod-wide" : "note-compass-field-setting" });
	const infoEl = rowEl.createDiv({ cls: "note-compass-field-setting-info" });
	infoEl.createDiv({ cls: "setting-item-name", text: name });
	const descEl = infoEl.createDiv({ cls: "setting-item-description", text: desc });
	const controlEl = rowEl.createDiv({ cls: "note-compass-field-setting-control" });
	return { rowEl, descEl, controlEl };
}

function settingText<Setting extends string>(binding: EditorBinding<Setting>, setting: Setting): string {
	const value = binding.read(setting);
	return typeof value === "string" ? value : "";
}

export function dropdownRow<Setting extends string>(
	parentEl: HTMLElement,
	binding: EditorBinding<Setting>,
	setting: Setting,
	name: string,
	desc: string,
	options: Record<string, string>,
	changed?: () => void,
): { rowEl: HTMLElement } {
	const { rowEl, controlEl } = editorRow(parentEl, name, desc);
	const dropdown = new DropdownComponent(controlEl).addOptions(options);
	dropdown.selectEl.setAttr(FOCUS_ATTRIBUTE, setting);
	dropdown.setValue(settingText(binding, setting)).onChange((value) => {
		binding.write(setting, value);
		changed?.();
	});
	return { rowEl };
}

export function textRow<Setting extends string>(
	parentEl: HTMLElement,
	binding: EditorBinding<Setting>,
	setting: Setting,
	name: string,
	desc: string,
	placeholder: string,
): { text: TextComponent; rowEl: HTMLElement } {
	const { rowEl, controlEl } = editorRow(parentEl, name, desc);
	const text = new TextComponent(controlEl).setPlaceholder(placeholder);
	text.inputEl.setAttr(FOCUS_ATTRIBUTE, setting);
	text.setValue(settingText(binding, setting)).onChange((value) => binding.write(setting, value));
	return { text, rowEl };
}

export function checkedTextRow<Setting extends string>(
	parentEl: HTMLElement,
	binding: EditorBinding<Setting>,
	setting: Setting,
	name: string,
	desc: string,
	placeholder: string,
	error: (typed: string) => string | undefined,
): { text: TextComponent; rowEl: HTMLElement } {
	const { rowEl, descEl, controlEl } = editorRow(parentEl, name, desc);
	const text = new TextComponent(controlEl).setPlaceholder(placeholder);
	text.inputEl.setAttr(FOCUS_ATTRIBUTE, setting);
	text.setValue(settingText(binding, setting)).onChange((value) => {
		const problem = error(value);
		descEl.setText(problem ?? desc);
		rowEl.toggleClass("has-error", problem !== undefined);
		if (problem === undefined) binding.write(setting, value);
	});
	return { text, rowEl };
}

export function toggleRow<Setting extends string>(parentEl: HTMLElement, binding: EditorBinding<Setting>, setting: Setting, name: string, desc: string): void {
	const { controlEl } = editorRow(parentEl, name, desc);
	new ToggleComponent(controlEl).setValue(binding.read(setting) === true).onChange((value) => binding.write(setting, value));
}

export function suggestProperties(
	app: App,
	inputEl: HTMLInputElement,
	suggestions: () => PropertySuggestion[],
	picked: (suggestion: PropertySuggestion) => void,
): PropertySuggest {
	const suggest = new PropertySuggest(app, inputEl, suggestions);
	suggest.onSelect((suggestion) => {
		suggest.setValue(suggestion.name);
		picked(suggestion);
		suggest.close();
	});
	inputEl.addEventListener("focus", () => inputEl.dispatchEvent(new Event("input")));
	return suggest;
}
