import { ExtraButtonComponent } from "obsidian";
import { t } from "../i18n/index.ts";
import { paintChip } from "../render.ts";
import { prefixColorKey } from "./controlKeys.ts";
import { changedColor, changedPrefix, prefixChip, startDraft } from "./prefixChip.ts";
import type { PrefixDraft } from "./prefixChip.ts";

export interface PrefixField {
	key: string;
	prefix: string;
	prefixColor?: string;
	label: string;
}

export interface PrefixEditing {
	prefixDrafts: Map<string, PrefixDraft>;
	write: (key: string, value: unknown) => void;
}

const MIN_INPUT_SIZE = 4;

const FOCUS_SETTLE_MS = 50;

const NEUTRAL_COLOR = "#888888";

const CHIP_CLASS = "note-compass-setting-prefix";

const PREFIX_WIDTH_PROPERTY = "--note-compass-prefix-width";

const measuringLists = new WeakSet<HTMLElement>();

export function renderPrefixedName(nameEl: HTMLElement, field: PrefixField, editing: PrefixEditing): () => void {
	const drafts = editing.prefixDrafts;
	nameEl.empty();
	nameEl.addClass("note-compass-prefixed-name");
	const labelEl = nameEl.createSpan({ cls: "note-compass-prefixed-name-text", text: field.label });
	let saved = field.prefix;
	let savedColor = field.prefixColor;
	let shownEl: HTMLElement | undefined;
	let input: HTMLInputElement | undefined;
	let stopListening: (() => void) | undefined;
	let tornDown = false;

	const place = (el: HTMLElement) => {
		shownEl?.remove();
		nameEl.insertBefore(el, labelEl);
		shownEl = el;
	};

	const showChip = (focus: boolean) => {
		input = undefined;
		stopListening?.();
		stopListening = undefined;
		const chip = prefixChip(saved);
		const chipEl = createSpan({
			cls: chip.placeholder ? [CHIP_CLASS, "is-placeholder"] : CHIP_CLASS,
			attr: { role: "button", tabindex: "0", "aria-label": t("editPrefix") },
		});
		chipEl.createSpan({ cls: "note-compass-chip-text", text: chip.text });
		if (!chip.placeholder) paintChip(chipEl, savedColor);
		chipEl.addEventListener("mousedown", (event) => event.stopPropagation());
		chipEl.addEventListener("click", (event) => {
			event.stopPropagation();
			edit(startDraft(saved, savedColor));
		});
		chipEl.addEventListener("keydown", (event) => {
			if (event.key !== "Enter" && event.key !== " ") return;
			event.preventDefault();
			event.stopPropagation();
			edit(startDraft(saved, savedColor));
		});
		place(chipEl);
		alignChips(nameEl);
		if (focus) chipEl.focus();
	};

	const finish = (draft: PrefixDraft, save: boolean, focusChip: boolean) => {
		if (tornDown || drafts.get(field.key) !== draft) return;
		drafts.delete(field.key);
		const prefix = save ? changedPrefix(draft) : undefined;
		const color = save ? changedColor(draft) : undefined;
		if (prefix !== undefined) {
			saved = prefix;
			editing.write(field.key, prefix);
		}
		if (color !== undefined) {
			savedColor = color || undefined;
			editing.write(prefixColorKey(field.key), color);
		}
		showChip(focusChip);
	};

	const edit = (draft: PrefixDraft) => {
		drafts.set(field.key, draft);
		const win = nameEl.win;
		const editorEl = createSpan({ cls: "note-compass-setting-prefix-editor" });
		const textEl = editorEl.createEl("input", {
			cls: "note-compass-setting-prefix-input",
			type: "text",
			value: draft.text,
			attr: { "aria-label": t("prefix"), spellcheck: "false" },
		});
		const colorEl = editorEl.createEl("input", {
			cls: "note-compass-setting-prefix-color",
			type: "color",
			value: draft.color ?? NEUTRAL_COLOR,
			attr: { "aria-label": t("prefixColour") },
		});
		new ExtraButtonComponent(editorEl)
			.setIcon("rotate-ccw")
			.setTooltip(t("removeColour"))
			.onClick(() => {
				draft.color = undefined;
				paintChip(textEl, undefined);
				textEl.focus();
			});
		paintChip(textEl, draft.color);
		let pickingColor = false;

		const fit = () => (textEl.size = Math.max(textEl.value.length, MIN_INPUT_SIZE));
		fit();
		textEl.addEventListener("input", () => {
			draft.text = textEl.value;
			fit();
		});
		const pickColor = () => {
			draft.color = colorEl.value;
			paintChip(textEl, draft.color);
		};
		colorEl.addEventListener("pointerdown", () => (pickingColor = true));
		colorEl.addEventListener("input", pickColor);
		colorEl.addEventListener("change", () => {
			pickColor();
			pickingColor = false;
			textEl.focus();
		});
		editorEl.addEventListener("mousedown", (event) => {
			event.stopPropagation();
			if (event.target !== textEl && event.target !== colorEl) event.preventDefault();
		});
		for (const type of ["click", "pointerdown"]) editorEl.addEventListener(type, (event) => event.stopPropagation());
		editorEl.addEventListener("keydown", (event) => event.stopPropagation());
		editorEl.addEventListener("focusout", (event) => {
			const next = event.relatedTarget;
			if (next instanceof Node && editorEl.contains(next)) return;
			if (next === null && pickingColor) return;
			win.setTimeout(() => {
				if (editorEl.contains(editorEl.doc.activeElement)) return;
				finish(draft, true, false);
			}, FOCUS_SETTLE_MS);
		});

		const onKey = (event: KeyboardEvent) => {
			if (!(event.target instanceof Node) || !editorEl.contains(event.target) || event.isComposing) return;
			const commits = event.key === "Enter" && event.target === textEl;
			if (!commits && event.key !== "Escape") return;
			event.preventDefault();
			finish(draft, commits, true);
		};
		const onPointerOutside = (event: PointerEvent) => {
			if (event.target instanceof Node && editorEl.contains(event.target)) return;
			finish(draft, true, false);
		};
		win.addEventListener("keydown", onKey, true);
		win.addEventListener("pointerdown", onPointerOutside, true);
		stopListening = () => {
			win.removeEventListener("keydown", onKey, true);
			win.removeEventListener("pointerdown", onPointerOutside, true);
		};
		input = textEl;
		place(editorEl);
		textEl.focus();
		textEl.setSelectionRange(draft.selectionStart, draft.selectionEnd);
	};

	const pending = drafts.get(field.key);
	if (pending) edit(pending);
	else showChip(false);

	return () => {
		tornDown = true;
		stopListening?.();
		const draft = drafts.get(field.key);
		if (!input || !draft) return;
		draft.text = input.value;
		draft.selectionStart = input.selectionStart ?? input.value.length;
		draft.selectionEnd = input.selectionEnd ?? input.value.length;
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
