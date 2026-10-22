import { shownPrefix } from "../render.ts";

export interface PrefixChip {
	text: string;
	placeholder: boolean;
}

export interface PrefixDraft {
	original: string;
	text: string;
	selectionStart: number;
	selectionEnd: number;
}

export const PREFIX_PLACEHOLDER = "prefix";

export function prefixChip(prefix: string): PrefixChip {
	const shown = shownPrefix(prefix);
	return shown === "" ? { text: PREFIX_PLACEHOLDER, placeholder: true } : { text: shown, placeholder: false };
}

export function startDraft(prefix: string): PrefixDraft {
	return { original: prefix, text: prefix, selectionStart: 0, selectionEnd: prefix.length };
}

export function changedPrefix(draft: PrefixDraft): string | undefined {
	return draft.text === draft.original ? undefined : draft.text;
}
