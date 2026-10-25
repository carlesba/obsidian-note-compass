import { t } from "../i18n/index.ts";
import type { PrefixChange, PrefixSuggestion } from "./prefixLinks.ts";

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
	linked: string[];
	updatesLinked: boolean;
}

export function prefixChip(prefix: string): PrefixChip {
	const shown = prefix.trim();
	return shown === "" ? { text: t("prefixPlaceholder"), placeholder: true } : { text: shown, placeholder: false };
}

export function startDraft(prefix: string, color?: string, linked: string[] = []): PrefixDraft {
	const draft: PrefixDraft = {
		original: prefix,
		text: prefix,
		selectionStart: 0,
		selectionEnd: prefix.length,
		linked,
		updatesLinked: true,
	};
	return color === undefined ? draft : { ...draft, originalColor: color, color };
}

export function changedPrefix(draft: PrefixDraft): string | undefined {
	return draft.text === draft.original ? undefined : draft.text;
}

export function changedColor(draft: PrefixDraft): string | undefined {
	return draft.color === draft.originalColor ? undefined : draft.color ?? "";
}

export function draftChange(draft: PrefixDraft): PrefixChange | undefined {
	const prefix = changedPrefix(draft);
	const color = changedColor(draft);
	if (prefix === undefined && color === undefined) return undefined;
	return { ...(prefix === undefined ? {} : { prefix }), ...(color === undefined ? {} : { color }) };
}

export function pickSuggestion(draft: PrefixDraft, suggestion: PrefixSuggestion): void {
	draft.text = suggestion.prefix;
	draft.color = suggestion.color;
}

export function movedHighlight(highlighted: number | undefined, count: number, step: 1 | -1): number | undefined {
	if (count === 0) return undefined;
	if (highlighted === undefined) return step === 1 ? 0 : count - 1;
	return (highlighted + step + count) % count;
}
