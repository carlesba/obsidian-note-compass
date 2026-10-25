import { ExtraButtonComponent } from "obsidian";
import { t, tCount } from "../i18n/index.ts";
import { paintChip } from "../render.ts";
import { draftChange, movedHighlight, pickSuggestion, prefixChip, startDraft } from "./prefixChip.ts";
import type { PrefixDraft } from "./prefixChip.ts";
import { prefixSuggestions, updatedPrefixKeys } from "./prefixLinks.ts";
import type { PrefixEdits, PrefixSuggestion } from "./prefixLinks.ts";

export interface PrefixField {
	key: string;
	prefix: string;
	prefixColor?: string;
	label: string;
}

export interface PrefixEditing {
	prefixDrafts: Map<string, PrefixDraft>;
	prefixes: PrefixEdits;
}

const MIN_INPUT_SIZE = 4;

const FOCUS_SETTLE_MS = 50;

const NEUTRAL_COLOR = "#888888";

const CHIP_CLASS = "note-compass-setting-prefix";

const SUGGESTION_CHIP_CLASS = "note-compass-prefix-suggestion-chip";

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
	let panelEl: HTMLElement | undefined;
	let input: HTMLInputElement | undefined;
	let stopListening: (() => void) | undefined;
	let tornDown = false;

	const place = (el: HTMLElement, panel?: HTMLElement) => {
		shownEl?.remove();
		panelEl?.remove();
		nameEl.insertBefore(el, labelEl);
		shownEl = el;
		panelEl = panel;
		if (panel) nameEl.appendChild(panel);
		nameEl.toggleClass("is-editing-prefix", panel !== undefined);
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
		const startEditing = () => edit(startDraft(saved, savedColor, editing.prefixes.linked(field.key)));
		chipEl.addEventListener("mousedown", (event) => event.stopPropagation());
		chipEl.addEventListener("click", (event) => {
			event.stopPropagation();
			startEditing();
		});
		chipEl.addEventListener("keydown", (event) => {
			if (event.key !== "Enter" && event.key !== " ") return;
			event.preventDefault();
			event.stopPropagation();
			startEditing();
		});
		place(chipEl);
		alignChips(nameEl);
		if (focus) chipEl.focus();
	};

	const finish = (draft: PrefixDraft, save: boolean, focusChip: boolean) => {
		if (tornDown || drafts.get(field.key) !== draft) return;
		drafts.delete(field.key);
		const change = save ? draftChange(draft) : undefined;
		if (change) {
			if (change.prefix !== undefined) saved = change.prefix;
			if (change.color !== undefined) savedColor = change.color || undefined;
		}
		showChip(focusChip);
		if (change) editing.prefixes.save(updatedPrefixKeys(field.key, draft.linked, draft.updatesLinked), change);
	};

	const edit = (draft: PrefixDraft) => {
		drafts.set(field.key, draft);
		const win = nameEl.win;
		const rows = editing.prefixes.rows();
		const editorEl = createSpan({ cls: "note-compass-setting-prefix-editor" });
		const textEl = editorEl.createEl("input", {
			cls: "note-compass-setting-prefix-input",
			type: "text",
			value: draft.text,
			attr: { "aria-label": t("prefix"), spellcheck: "false", autocomplete: "off" },
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

		const panel = createDiv({ cls: "note-compass-setting-prefix-panel" });
		const suggestionsEl = panel.createDiv({
			cls: "note-compass-prefix-suggestions",
			attr: { role: "listbox", "aria-label": t("prefixesInUse") },
		});
		let suggestions: PrefixSuggestion[] = [];
		let highlighted: number | undefined;
		let suggesting = true;

		const highlight = (index: number | undefined) => {
			highlighted = index;
			Array.from(suggestionsEl.children).forEach((itemEl, position) => {
				itemEl.toggleClass("is-selected", position === index);
				itemEl.setAttribute("aria-selected", String(position === index));
				if (position === index) itemEl.scrollIntoView({ block: "nearest" });
			});
		};

		const fit = () => (textEl.size = Math.max(textEl.value.length, MIN_INPUT_SIZE));

		const pick = (suggestion: PrefixSuggestion) => {
			pickSuggestion(draft, suggestion);
			textEl.value = draft.text;
			colorEl.value = draft.color ?? NEUTRAL_COLOR;
			paintChip(textEl, draft.color);
			fit();
			suggesting = false;
			showSuggestions();
			textEl.focus();
			textEl.setSelectionRange(draft.text.length, draft.text.length);
		};

		const showSuggestions = () => {
			const query = draft.text === draft.original ? "" : draft.text;
			suggestions = suggesting ? prefixSuggestions(rows, field.key, query) : [];
			highlighted = undefined;
			suggestionsEl.empty();
			suggestionsEl.toggleClass("is-hidden", suggestions.length === 0);
			for (const suggestion of suggestions) {
				const itemEl = suggestionsEl.createDiv({
					cls: "note-compass-prefix-suggestion",
					attr: { role: "option", "aria-selected": "false" },
				});
				const chipEl = itemEl.createSpan({ cls: SUGGESTION_CHIP_CLASS });
				chipEl.createSpan({ cls: "note-compass-chip-text", text: suggestion.prefix });
				paintChip(chipEl, suggestion.color);
				itemEl.createSpan({
					cls: "note-compass-prefix-suggestion-count",
					text: tCount("prefixRowCountOne", "prefixRowCountOther", suggestion.count),
				});
				itemEl.addEventListener("click", () => pick(suggestion));
				itemEl.addEventListener("mousemove", () => {
					const index = suggestions.indexOf(suggestion);
					if (index !== highlighted) highlight(index);
				});
			}
		};

		if (draft.linked.length > 0) {
			const linkedEl = panel.createEl("label", { cls: "note-compass-prefix-linked" });
			const checkboxEl = linkedEl.createEl("input", { type: "checkbox" });
			checkboxEl.checked = draft.updatesLinked;
			linkedEl.createSpan({
				text: tCount("linkedPrefixRowsOne", "linkedPrefixRowsOther", draft.linked.length, {
					prefix: draft.original.trim(),
				}),
			});
			checkboxEl.addEventListener("change", () => (draft.updatesLinked = checkboxEl.checked));
		}

		fit();
		showSuggestions();
		textEl.addEventListener("input", () => {
			draft.text = textEl.value;
			suggesting = true;
			fit();
			showSuggestions();
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
		const within = (target: EventTarget | null) => target instanceof Node && (editorEl.contains(target) || panel.contains(target));
		for (const el of [editorEl, panel]) {
			el.addEventListener("mousedown", (event) => {
				event.stopPropagation();
				if (event.target !== textEl && event.target !== colorEl) event.preventDefault();
			});
			for (const type of ["click", "pointerdown"]) el.addEventListener(type, (event) => event.stopPropagation());
			el.addEventListener("keydown", (event) => event.stopPropagation());
			el.addEventListener("focusout", (event) => {
				const next = event.relatedTarget;
				if (within(next)) return;
				if (next === null && pickingColor) return;
				win.setTimeout(() => {
					if (within(editorEl.doc.activeElement)) return;
					finish(draft, true, false);
				}, FOCUS_SETTLE_MS);
			});
		}

		const onKey = (event: KeyboardEvent) => {
			if (!within(event.target) || event.isComposing) return;
			const onText = event.target === textEl;
			if (onText && event.key === "ArrowDown" && !suggesting) {
				suggesting = true;
				showSuggestions();
			}
			if (onText && (event.key === "ArrowDown" || event.key === "ArrowUp") && suggestions.length > 0) {
				event.preventDefault();
				highlight(movedHighlight(highlighted, suggestions.length, event.key === "ArrowDown" ? 1 : -1));
				return;
			}
			const chosen = highlighted === undefined ? undefined : suggestions[highlighted];
			if (onText && event.key === "Enter" && chosen) {
				event.preventDefault();
				pick(chosen);
				return;
			}
			if (event.key === "Escape" && suggestions.length > 0) {
				event.preventDefault();
				suggesting = false;
				showSuggestions();
				return;
			}
			const commits = event.key === "Enter" && onText;
			if (!commits && event.key !== "Escape") return;
			event.preventDefault();
			finish(draft, commits, true);
		};
		const onPointerOutside = (event: PointerEvent) => {
			if (within(event.target)) return;
			finish(draft, true, false);
		};
		win.addEventListener("keydown", onKey, true);
		win.addEventListener("pointerdown", onPointerOutside, true);
		stopListening = () => {
			win.removeEventListener("keydown", onKey, true);
			win.removeEventListener("pointerdown", onPointerOutside, true);
		};
		input = textEl;
		place(editorEl, panel);
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
