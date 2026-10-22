import { changedPrefix, prefixChip, startDraft } from "./prefixChip.ts";
import type { PrefixDraft } from "./prefixChip.ts";

export interface PrefixField {
	key: string;
	prefix: string;
	label: string;
}

export interface PrefixEditing {
	prefixDrafts: Map<string, PrefixDraft>;
	write: (key: string, value: unknown) => void;
}

const MIN_INPUT_SIZE = 4;

export function renderPrefixedName(nameEl: HTMLElement, field: PrefixField, editing: PrefixEditing): () => void {
	const drafts = editing.prefixDrafts;
	nameEl.empty();
	nameEl.addClass("note-launcher-prefixed-name");
	const labelEl = nameEl.createSpan({ cls: "note-launcher-prefixed-name-text", text: field.label });
	let saved = field.prefix;
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
			cls: chip.placeholder ? ["note-launcher-setting-prefix", "is-placeholder"] : "note-launcher-setting-prefix",
			text: chip.text,
			attr: { role: "button", tabindex: "0", "aria-label": "Edit prefix" },
		});
		chipEl.addEventListener("mousedown", (event) => event.stopPropagation());
		chipEl.addEventListener("click", (event) => {
			event.stopPropagation();
			edit(startDraft(saved));
		});
		chipEl.addEventListener("keydown", (event) => {
			if (event.key !== "Enter" && event.key !== " ") return;
			event.preventDefault();
			event.stopPropagation();
			edit(startDraft(saved));
		});
		place(chipEl);
		if (focus) chipEl.focus();
	};

	const finish = (save: boolean, focusChip: boolean) => {
		const draft = drafts.get(field.key);
		if (tornDown || !draft) return;
		drafts.delete(field.key);
		const changed = save ? changedPrefix(draft) : undefined;
		if (changed !== undefined) {
			saved = changed;
			editing.write(field.key, changed);
		}
		showChip(focusChip);
	};

	const edit = (draft: PrefixDraft) => {
		drafts.set(field.key, draft);
		const editor = createEl("input", {
			cls: "note-launcher-setting-prefix-input",
			type: "text",
			value: draft.text,
			attr: { "aria-label": "Prefix", spellcheck: "false" },
		});
		const fit = () => (editor.size = Math.max(editor.value.length, MIN_INPUT_SIZE));
		fit();
		for (const type of ["mousedown", "click", "pointerdown"]) editor.addEventListener(type, (event) => event.stopPropagation());
		editor.addEventListener("input", () => {
			draft.text = editor.value;
			fit();
		});
		editor.addEventListener("keydown", (event) => event.stopPropagation());
		const win = nameEl.win;
		const onKey = (event: KeyboardEvent) => {
			if (event.target !== editor || event.isComposing) return;
			if (event.key !== "Enter" && event.key !== "Escape") return;
			event.preventDefault();
			finish(event.key === "Enter", true);
		};
		win.addEventListener("keydown", onKey, true);
		stopListening = () => win.removeEventListener("keydown", onKey, true);
		editor.addEventListener("blur", () => win.setTimeout(() => finish(true, false), 0));
		input = editor;
		place(editor);
		editor.focus();
		editor.setSelectionRange(draft.selectionStart, draft.selectionEnd);
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
