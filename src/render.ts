import type { JumpListEntry } from "./lists/vault";

export function entryLabel(entry: JumpListEntry): string {
	const suffix = entry.suffix ? ` (${entry.suffix})` : "";
	return `${entry.prefix} | ${entry.name}${suffix}`;
}

export function matchesInOrder(query: string, label: string): boolean {
	const wanted = query.toLowerCase();
	const target = label.toLowerCase();
	let matched = 0;
	for (const character of target) {
		if (matched === wanted.length) break;
		if (character === wanted[matched]) matched++;
	}
	return matched === wanted.length;
}
