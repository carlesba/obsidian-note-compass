import type { JumpListEntry } from "./lists/vault";

export function entryLabel(entry: JumpListEntry): string {
	const suffix = entry.suffix ? ` (${entry.suffix})` : "";
	return [entry.prefix, `${entry.name}${suffix}`].filter(Boolean).join(" ");
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
