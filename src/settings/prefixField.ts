import { t, tCount } from "../i18n/index.ts";
import { paintChip } from "../render.ts";
import { ComboboxPopover } from "./combobox.ts";
import type { ComboboxItem } from "./combobox.ts";
import { prefixChip } from "./prefixChip.ts";
import { prefixChoices } from "./prefixLinks.ts";
import type { PrefixChoice, PrefixPages, PrefixRow } from "./prefixLinks.ts";

export interface PrefixField {
	key: string;
	prefix: string;
	prefixColor?: string;
	label: string;
	newPrefix?: () => void;
}

export interface PrefixMenuContext {
	prefixes: PrefixPages;
	prefixChanged: () => void;
}

export const NEW_PREFIX = "new";

const NO_PREFIX = "none";

const CHOICE_PREFIX = "prefix:";

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
		attr: { role: "button", tabindex: "0", "aria-haspopup": "listbox", "aria-expanded": "false" },
	});
	renderChip(chipEl, field.prefix, field.prefixColor);
	nameEl.createSpan({ cls: "note-compass-prefixed-name-text", text: field.label });
	let popover: ComboboxPopover | undefined;
	const close = () => {
		popover?.destroy();
		popover = undefined;
		chipEl.setAttribute("aria-expanded", "false");
	};
	const choose = (item: ComboboxItem) => {
		close();
		if (item.value === NEW_PREFIX) field.newPrefix?.();
		else if (choosePrefix(item, field.key, context.prefixes)) context.prefixChanged();
	};
	const toggle = () => {
		if (popover) {
			close();
			return;
		}
		chipEl.setAttribute("aria-expanded", "true");
		popover = new ComboboxPopover(
			chipEl,
			{ items: () => prefixItems(context.prefixes.rows(), field.key, field.newPrefix !== undefined), searchPlaceholder: t("comboboxSearch") },
			selectedPrefixItem(context.prefixes.rows(), field.key).value,
			"",
			{
				choose,
				dismiss: () => {
					close();
					chipEl.focus();
				},
			},
		);
	};
	chipEl.addEventListener("mousedown", (event) => event.stopPropagation());
	chipEl.addEventListener("click", (event) => {
		event.stopPropagation();
		toggle();
	});
	chipEl.addEventListener("keydown", (event) => {
		if (event.key !== "Enter" && event.key !== " ") return;
		event.preventDefault();
		event.stopPropagation();
		toggle();
	});
	alignChips(nameEl);
}

export function prefixItems(rows: readonly PrefixRow[], key: string, offersNewPrefix: boolean): ComboboxItem[] {
	const actions: ComboboxItem[] = [{ value: NO_PREFIX, label: t("noPrefix"), icon: "eraser" }];
	if (offersNewPrefix) actions.push({ value: NEW_PREFIX, label: t("newPrefix"), icon: "plus" });
	return [...actions, ...prefixChoices(rows, key).map(choiceItem)];
}

export function selectedPrefixItem(rows: readonly PrefixRow[], key: string): ComboboxItem {
	const own = rows.find((row) => row.key === key);
	if (!own || own.prefix.trim() === "") return { value: NO_PREFIX, label: t("noPrefix") };
	return choiceItem({ prefix: own.prefix.trim(), color: own.prefixColor, count: 0, checked: true });
}

export function choosePrefix(item: ComboboxItem, key: string, prefixes: PrefixPages): boolean {
	if (item.value === NO_PREFIX) return prefixes.clearPrefix(key);
	const choice = prefixChoices(prefixes.rows(), key).find((candidate) => choiceValue(candidate) === item.value);
	return choice ? prefixes.assign(key, choice) : false;
}

function choiceValue(choice: Pick<PrefixChoice, "prefix" | "color">): string {
	return `${CHOICE_PREFIX}${choice.prefix}\u0000${choice.color ?? ""}`;
}

function choiceItem(choice: PrefixChoice): ComboboxItem {
	return {
		value: choiceValue(choice),
		label: choice.prefix,
		detail: tCount("prefixRowCountOne", "prefixRowCountOther", choice.count),
		render: (titleEl) => renderChip(titleEl.createSpan({ cls: MENU_CHIP_CLASS }), choice.prefix, choice.color),
	};
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
