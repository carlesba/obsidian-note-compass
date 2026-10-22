import type { JumpListEntry } from "./lists/vault";

export interface RowParts {
	mark?: string;
	prefix?: string;
	prefixColor?: string;
	content: string;
	value?: string;
}

const LABEL_PARTS = ["mark", "prefix", "content", "value"] as const;

export const RESULTS_CLASS = "note-launcher-results";

export const MARK_COLUMN_CLASS = "has-mark-column";

export const CHIP_COLOR_PROPERTY = "--note-launcher-chip-color";

export function rowLabel(parts: RowParts): string {
	return LABEL_PARTS.map((part) => parts[part])
		.filter(Boolean)
		.join(" ");
}

export function prefixParts(prefix: string, prefixColor: string | undefined): Pick<RowParts, "prefix" | "prefixColor"> {
	return prefixColor === undefined ? { prefix } : { prefix, prefixColor };
}

export function paintChip(chipEl: HTMLElement, color: string | undefined): void {
	chipEl.toggleClass("has-color", color !== undefined);
	chipEl.setCssProps({ [CHIP_COLOR_PROPERTY]: color ?? "" });
}

export function renderRow(el: HTMLElement, parts: RowParts, reservesMarkColumn = false): void {
	const prefix = parts.prefix?.trim() || undefined;
	el.addClass("note-launcher-row", prefix === undefined ? "no-prefix" : "has-prefix");
	const mark = parts.mark ?? (reservesMarkColumn ? "" : undefined);
	if (mark !== undefined) el.createSpan({ cls: "note-launcher-row-mark", text: mark });
	if (prefix !== undefined) {
		const chipEl = el.createSpan({ cls: "note-launcher-row-prefix" });
		chipEl.createSpan({ cls: "note-launcher-chip-text", text: prefix });
		paintChip(chipEl, parts.prefixColor);
	}
	const bodyEl = el.createSpan({ cls: "note-launcher-row-body" });
	bodyEl.createSpan({ cls: "note-launcher-row-content", text: parts.content });
	if (parts.value !== undefined) bodyEl.createSpan({ cls: "note-launcher-row-value", text: parts.value });
}

export function entryParts(entry: JumpListEntry, showPrefixes: boolean): RowParts {
	const parts: RowParts = showPrefixes
		? { ...prefixParts(entry.prefix, entry.prefixColor), content: entry.name }
		: { content: entry.name };
	if (entry.suffix) parts.value = `(${entry.suffix})`;
	return parts;
}

export function entryLabel(entry: JumpListEntry, showPrefixes: boolean): string {
	return rowLabel(entryParts(entry, showPrefixes));
}

export function matchesInOrder(query: string, label: string): boolean {
	const wanted = query.toLowerCase();
	const target = label.toLowerCase();
	let matched = 0;
	for (let index = 0; index < target.length && matched < wanted.length; index++) {
		if (target[index] === wanted[matched]) matched++;
	}
	return matched === wanted.length;
}
