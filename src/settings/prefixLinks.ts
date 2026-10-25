import { matchesInOrder } from "../render.ts";
import { writePrefixColor } from "../settings.ts";
import type { JumpSettings } from "../settings.ts";
import { listKey, propertyKey } from "./controlKeys.ts";

export interface PrefixRow {
	key: string;
	prefix: string;
	prefixColor?: string;
}

export interface PrefixSuggestion {
	prefix: string;
	color?: string;
	count: number;
}

export interface PrefixChange {
	prefix?: string;
	color?: string;
}

interface PrefixTarget {
	key: string;
	target: { prefix: string; prefixColor?: string };
}

function prefixTargets(settings: JumpSettings): PrefixTarget[] {
	return [
		...settings.lists.map((list) => ({ key: listKey(list.id, "prefix"), target: list })),
		...settings.setProperties.properties.map((entry) => ({ key: propertyKey(entry.id, "prefix"), target: entry })),
	];
}

export function prefixRows(settings: JumpSettings): PrefixRow[] {
	return prefixTargets(settings).map(({ key, target }) => ({ key, prefix: target.prefix, prefixColor: target.prefixColor }));
}

export function samePrefix(a: Omit<PrefixRow, "key">, b: Omit<PrefixRow, "key">): boolean {
	return a.prefix.trim() === b.prefix.trim() && a.prefixColor === b.prefixColor;
}

export function linkedPrefixKeys(rows: readonly PrefixRow[], key: string): string[] {
	const own = rows.find((row) => row.key === key);
	if (!own || own.prefix.trim() === "") return [];
	return rows.filter((row) => row.key !== key && samePrefix(row, own)).map((row) => row.key);
}

export function prefixSuggestions(rows: readonly PrefixRow[], key: string, query: string): PrefixSuggestion[] {
	const own = rows.find((row) => row.key === key);
	const suggestions: PrefixSuggestion[] = [];
	for (const row of rows) {
		const prefix = row.prefix.trim();
		if (row.key === key || prefix === "" || (own && samePrefix(row, own))) continue;
		const known = suggestions.find((suggestion) => samePrefix({ prefix: suggestion.prefix, prefixColor: suggestion.color }, row));
		if (known) known.count++;
		else suggestions.push(row.prefixColor === undefined ? { prefix, count: 1 } : { prefix, color: row.prefixColor, count: 1 });
	}
	const typed = query.trim();
	return suggestions
		.filter((suggestion) => typed === "" || matchesInOrder(typed, suggestion.prefix))
		.sort((a, b) => b.count - a.count);
}

export function updatedPrefixKeys(key: string, linked: readonly string[], updatesLinked: boolean): string[] {
	return updatesLinked ? [key, ...linked] : [key];
}

export function applyPrefixChange(settings: JumpSettings, keys: readonly string[], change: PrefixChange): boolean {
	const targets = prefixTargets(settings).filter(({ key }) => keys.includes(key));
	for (const { target } of targets) {
		if (change.prefix !== undefined) target.prefix = change.prefix;
		if (change.color !== undefined) writePrefixColor(target, change.color);
	}
	return targets.length > 0;
}

export type PrefixRefresh = "now" | "afterTyping";

interface TypedPrefix {
	key: string;
	linked: string[];
}

export class PrefixEdits {
	private readonly settings: () => JumpSettings;
	private readonly saved: (refresh: PrefixRefresh) => void;
	private readonly updatesLinkedChoices = new Map<string, boolean>();
	private typed: TypedPrefix | undefined;

	constructor(settings: () => JumpSettings, saved: (refresh: PrefixRefresh) => void) {
		this.settings = settings;
		this.saved = saved;
	}

	rows(): PrefixRow[] {
		return prefixRows(this.settings());
	}

	linked(key: string): string[] {
		return this.typed?.key === key ? this.typed.linked : linkedPrefixKeys(this.rows(), key);
	}

	linkedPrefix(key: string): string {
		const linked = this.linked(key);
		return this.rows().find((row) => linked.includes(row.key))?.prefix.trim() ?? "";
	}

	updatesLinked(key: string): boolean {
		return this.updatesLinkedChoices.get(key) ?? true;
	}

	setUpdatesLinked(key: string, updatesLinked: boolean): void {
		this.updatesLinkedChoices.set(key, updatesLinked);
	}

	save(keys: readonly string[], change: PrefixChange): void {
		this.typed = undefined;
		if (applyPrefixChange(this.settings(), keys, change)) this.saved(keys.length > 1 ? "now" : "afterTyping");
	}

	type(key: string, change: PrefixChange, refresh: PrefixRefresh = "afterTyping"): void {
		if (this.typed?.key !== key) this.typed = { key, linked: linkedPrefixKeys(this.rows(), key) };
		const keys = updatedPrefixKeys(key, this.typed.linked, this.updatesLinked(key));
		if (applyPrefixChange(this.settings(), keys, change)) this.saved(refresh);
	}

	clear(): void {
		this.typed = undefined;
		this.updatesLinkedChoices.clear();
	}
}
