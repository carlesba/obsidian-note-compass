import { asList, linkTitle } from "./values.ts";

export interface PickableNote {
	name: string;
	path: string;
	mtime: number;
}

export function isPicked(note: PickableNote, pending: unknown): boolean {
	return asList(pending).some((value) => linksTo(value, note));
}

export function linksTo(value: unknown, note: PickableNote): boolean {
	const link = typeof value === "string" ? value.match(/\[\[([^\]|]+)/) : null;
	const titles = [linkTitle(value), link?.[1]];
	return titles.some((title) => title === note.name || title === note.path.replace(/\.md$/, ""));
}

export function wikiLink(name: string): string {
	return `[[${name}]]`;
}
