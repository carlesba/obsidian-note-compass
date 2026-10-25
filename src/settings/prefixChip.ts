import { t } from "../i18n/index.ts";

export interface PrefixChip {
	text: string;
	placeholder: boolean;
}

export interface PrefixDraft {
	original: string;
	text: string;
	originalColor?: string;
	color?: string;
	selectionStart: number;
	selectionEnd: number;
}

export function prefixChip(prefix: string): PrefixChip {
	const shown = prefix.trim();
	return shown === "" ? { text: t("prefixPlaceholder"), placeholder: true } : { text: shown, placeholder: false };
}

export function startDraft(prefix: string, color?: string): PrefixDraft {
	const draft: PrefixDraft = { original: prefix, text: prefix, selectionStart: 0, selectionEnd: prefix.length };
	return color === undefined ? draft : { ...draft, originalColor: color, color };
}

export function changedPrefix(draft: PrefixDraft): string | undefined {
	return draft.text === draft.original ? undefined : draft.text;
}

export function changedColor(draft: PrefixDraft): string | undefined {
	return draft.color === draft.originalColor ? undefined : draft.color ?? "";
}
