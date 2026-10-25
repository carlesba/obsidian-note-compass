import { Menu } from "obsidian";
import { t, tCount } from "../i18n/index.ts";
import { paintChip } from "../render.ts";
import { prefixChip } from "./prefixChip.ts";
import { prefixMenu } from "./prefixLinks.ts";
import type { PrefixChoice, PrefixPages } from "./prefixLinks.ts";

export interface PrefixField {
	key: string;
	prefix: string;
	prefixColor?: string;
	label: string;
	editPrefix?: () => void;
}

export interface PrefixMenuContext {
	prefixes: PrefixPages;
	prefixChanged: () => void;
}

const CHIP_CLASS = "note-compass-setting-prefix";

const MENU_CHIP_CLASS = "note-compass-menu-prefix";

const PREFIX_WIDTH_PROPERTY = "--note-compass-prefix-width";

const measuringLists = new WeakSet<HTMLElement>();

export function renderChip(chipEl: HTMLElement, prefix: string, color: string | undefined): void {
	const chip = prefixChip(prefix);
	chipEl.empty();
	chipEl.toggleClass("is-placeholder", chip.placeholder);
	chipEl.createSpan({ cls: "note-compass-chip-text", text: chip.text });
	paintChip(chipEl, chip.placeholder ? undefined : color);
}

export function renderPrefixedName(nameEl: HTMLElement, field: PrefixField, context: PrefixMenuContext): void {
	nameEl.empty();
	nameEl.addClass("note-compass-prefixed-name");
	const chipEl = nameEl.createSpan({
		cls: CHIP_CLASS,
		attr: { role: "button", tabindex: "0", "aria-haspopup": "menu" },
	});
	renderChip(chipEl, field.prefix, field.prefixColor);
	nameEl.createSpan({ cls: "note-compass-prefixed-name-text", text: field.label });
	chipEl.addEventListener("mousedown", (event) => event.stopPropagation());
	chipEl.addEventListener("click", (event) => {
		event.stopPropagation();
		prefixMenuFor(field, context).showAtMouseEvent(event);
	});
	chipEl.addEventListener("keydown", (event) => {
		if (event.key !== "Enter" && event.key !== " ") return;
		event.preventDefault();
		event.stopPropagation();
		const rect = chipEl.getBoundingClientRect();
		prefixMenuFor(field, context).showAtPosition({ x: rect.left, y: rect.bottom, width: rect.width }, chipEl.doc);
	});
	alignChips(nameEl);
}

function prefixMenuFor(field: PrefixField, context: PrefixMenuContext): Menu {
	const { prefixes } = context;
	const { choices, clears } = prefixMenu(prefixes.rows(), field.key);
	const changed = (applied: boolean) => {
		if (applied) context.prefixChanged();
	};
	const menu = new Menu();
	for (const choice of choices) {
		menu.addItem((item) =>
			item
				.setTitle(choiceTitle(choice))
				.setChecked(choice.checked)
				.onClick(() => changed(prefixes.assign(field.key, choice))),
		);
	}
	if (choices.length > 0) menu.addSeparator();
	const { editPrefix } = field;
	if (editPrefix) menu.addItem((item) => item.setTitle(t("editPrefix")).setIcon("pencil").onClick(editPrefix));
	if (clears) {
		menu.addItem((item) =>
			item
				.setTitle(t("noPrefix"))
				.setIcon("eraser")
				.onClick(() => changed(prefixes.clearPrefix(field.key))),
		);
	}
	return menu;
}

function choiceTitle(choice: PrefixChoice): DocumentFragment {
	return createFragment((fragment) => {
		const chipEl = fragment.createSpan({ cls: MENU_CHIP_CLASS });
		renderChip(chipEl, choice.prefix, choice.color);
		fragment.createSpan({
			cls: "note-compass-menu-prefix-count",
			text: `· ${tCount("prefixRowCountOne", "prefixRowCountOther", choice.count)}`,
		});
	});
}

function alignChips(nameEl: HTMLElement): void {
	const win = nameEl.win;
	win.requestAnimationFrame(() => {
		const listEl = nameEl.closest<HTMLElement>(".setting-items");
		if (!listEl || measuringLists.has(listEl)) return;
		measuringLists.add(listEl);
		win.setTimeout(() => measuringLists.delete(listEl), 0);
		listEl.setCssProps({ [PREFIX_WIDTH_PROPERTY]: "" });
		const widths = Array.from(listEl.querySelectorAll<HTMLElement>(`.${CHIP_CLASS}`), (chipEl) => chipEl.getBoundingClientRect().width);
		const widest = Math.ceil(Math.max(0, ...widths));
		if (widest > 0) listEl.setCssProps({ [PREFIX_WIDTH_PROPERTY]: `${widest}px` });
	});
}
