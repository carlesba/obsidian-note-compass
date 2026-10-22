import type { JumpListEntry } from "./lists/vault";

export interface RowParts {
	mark?: string;
	prefix?: string;
	content: string;
	value?: string;
}

const ROW_PARTS = ["mark", "prefix", "content", "value"] as const;

export function rowLabel(parts: RowParts): string {
	return ROW_PARTS.map((part) => parts[part])
		.filter(Boolean)
		.join(" ");
}

export function renderRow(el: HTMLElement, parts: RowParts, reservesMarkColumn = false): void {
	el.addClass("note-launcher-row");
	for (const part of ROW_PARTS) {
		const text = shownText(part, parts[part], reservesMarkColumn);
		if (text !== undefined) el.createSpan({ cls: `note-launcher-row-${part}`, text });
	}
}

function shownText(part: (typeof ROW_PARTS)[number], text: string | undefined, reservesMarkColumn: boolean): string | undefined {
	if (part === "mark") return text ?? (reservesMarkColumn ? "" : undefined);
	if (part !== "prefix" || text === undefined) return text;
	return text.trim() || undefined;
}

export function entryParts(entry: JumpListEntry): RowParts {
	const parts: RowParts = { prefix: entry.prefix, content: entry.name };
	if (entry.suffix) parts.value = `(${entry.suffix})`;
	return parts;
}

export function entryLabel(entry: JumpListEntry): string {
	return rowLabel(entryParts(entry));
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
