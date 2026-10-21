import type { CustomList } from "../settings";
import type { Frontmatter } from "./vault";

export function matchesCustomList(frontmatter: Frontmatter | undefined, list: CustomList): boolean {
	if (!frontmatter || !(list.property in frontmatter)) return false;
	const property = frontmatter[list.property];
	switch (list.operator) {
		case "is true":
			return property === true || property === "true";
		case "equals":
			return scalarText(property) === list.value;
		case "contains":
			return containsValue(property, linkText(list.value));
		case "exists":
			return property !== null && property !== undefined;
		default:
			return false;
	}
}

function containsValue(property: unknown, value: string): boolean {
	if (Array.isArray(property)) {
		return property.some((element) => {
			const text = scalarText(element);
			return text !== undefined && linkText(text) === value;
		});
	}
	if (typeof property === "string") return property.includes(value) || linkText(property) === value;
	return false;
}

function linkText(value: string): string {
	const wikiLink = value.trim().match(/^\[\[([^\]|]*)(?:\|[^\]]*)?\]\]$/);
	return wikiLink ? wikiLink[1].trim() : value;
}

function scalarText(value: unknown): string | undefined {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return undefined;
}
