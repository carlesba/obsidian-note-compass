import { matchesInOrder } from "../render.ts";
import { writePrefixColor } from "../settings.ts";
import type { JumpSettings } from "../settings.ts";
import { listKey, propertyKey } from "./controlKeys.ts";
import { sourceSummary } from "./listForm.ts";
import { propertyLabel } from "./setPropertiesForm.ts";

export interface PrefixRow {
	key: string;
	prefix: string;
	prefixColor?: string;
	label: string;
}

export interface PrefixValue {
	prefix: string;
	color?: string;
}

export interface PrefixChoice extends PrefixValue {
	count: number;
	checked: boolean;
}

export interface PrefixMenu {
	choices: PrefixChoice[];
	clears: boolean;
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
	label: string;
	target: { prefix: string; prefixColor?: string };
}

function prefixTargets(settings: JumpSettings): PrefixTarget[] {
	return [
		...settings.lists.map((list) => ({ key: listKey(list.id, "prefix"), label: sourceSummary(list.source), target: list })),
		...settings.setProperties.properties.map((entry) => ({
			key: propertyKey(entry.id, "prefix"),
			label: propertyLabel(entry),
			target: entry,
		})),
	];
}

export function prefixRows(settings: JumpSettings): PrefixRow[] {
	return prefixTargets(settings).map(({ key, label, target }) => ({
		key,
		prefix: target.prefix,
		prefixColor: target.prefixColor,
		label,
	}));
}

export function samePrefix(a: Pick<PrefixRow, "prefix" | "prefixColor">, b: Pick<PrefixRow, "prefix" | "prefixColor">): boolean {
	return a.prefix.trim() === b.prefix.trim() && a.prefixColor === b.prefixColor;
}

export function linkedPrefixKeys(rows: readonly PrefixRow[], key: string): string[] {
	const own = rows.find((row) => row.key === key);
	if (!own || own.prefix.trim() === "") return [];
	return rows.filter((row) => row.key !== key && samePrefix(row, own)).map((row) => row.key);
}

export function prefixMenu(rows: readonly PrefixRow[], key: string): PrefixMenu {
	const own = rows.find((row) => row.key === key);
	const choices: PrefixChoice[] = [];
	for (const row of rows) {
		const prefix = row.prefix.trim();
		if (prefix === "") continue;
		const known = choices.find((choice) => samePrefix({ prefix: choice.prefix, prefixColor: choice.color }, row));
		if (known) {
			known.count++;
			continue;
		}
		const checked = own !== undefined && samePrefix(own, row);
		choices.push(row.prefixColor === undefined ? { prefix, count: 1, checked } : { prefix, color: row.prefixColor, count: 1, checked });
	}
	choices.sort((a, b) => b.count - a.count || a.prefix.localeCompare(b.prefix));
	return { choices, clears: own !== undefined && own.prefix.trim() !== "" };
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

export function assignPrefix(settings: JumpSettings, key: string, value: PrefixValue): boolean {
	const own = prefixRows(settings).find((row) => row.key === key);
	if (!own || samePrefix(own, { prefix: value.prefix, prefixColor: value.color })) return false;
	return applyPrefixChange(settings, [key], { prefix: value.prefix, color: value.color ?? "" });
}

export function clearPrefix(settings: JumpSettings, key: string): boolean {
	return assignPrefix(settings, key, { prefix: "" });
}

export function linkedRowsText(labels: readonly string[], shown = 3): string {
	const listed = labels.slice(0, shown).join(", ");
	return labels.length > shown ? `${listed}, …` : listed;
}

interface PrefixPage {
	linked: string[];
	onlyThisRow: boolean;
	edited: boolean;
	holds: number;
}

export class PrefixPages {
	private readonly settings: () => JumpSettings;
	private readonly pages = new Map<string, PrefixPage>();
	private focusing: string | undefined;

	constructor(settings: () => JumpSettings) {
		this.settings = settings;
	}

	rows(): PrefixRow[] {
		return prefixRows(this.settings());
	}

	private page(key: string): PrefixPage {
		const known = this.pages.get(key);
		if (known) return known;
		const page: PrefixPage = { linked: linkedPrefixKeys(this.rows(), key), onlyThisRow: false, edited: false, holds: 0 };
		this.pages.set(key, page);
		return page;
	}

	hold(key: string): void {
		this.page(key).holds++;
	}

	release(key: string): void {
		const page = this.pages.get(key);
		if (page) page.holds = Math.max(0, page.holds - 1);
	}

	closeUnheld(key: string): boolean {
		const page = this.pages.get(key);
		if (!page || page.holds > 0) return false;
		this.pages.delete(key);
		return page.edited;
	}

	linkedRows(key: string): PrefixRow[] {
		const rows = this.rows();
		const linked = this.pages.get(key)?.linked ?? linkedPrefixKeys(rows, key);
		return rows.filter((row) => linked.includes(row.key));
	}

	onlyThisRow(key: string): boolean {
		return this.pages.get(key)?.onlyThisRow ?? false;
	}

	setOnlyThisRow(key: string, onlyThisRow: boolean): void {
		this.page(key).onlyThisRow = onlyThisRow;
	}

	edit(key: string, change: PrefixChange): boolean {
		const page = this.page(key);
		const keys = page.onlyThisRow ? [key] : [key, ...page.linked];
		if (!applyPrefixChange(this.settings(), keys, change)) return false;
		page.edited = true;
		return true;
	}

	assign(key: string, value: PrefixValue): boolean {
		return assignPrefix(this.settings(), key, value);
	}

	clearPrefix(key: string): boolean {
		return clearPrefix(this.settings(), key);
	}

	startEditing(key: string): void {
		this.pages.delete(key);
		this.focusing = key;
	}

	takeFocus(key: string): boolean {
		if (this.focusing !== key) return false;
		this.focusing = undefined;
		return true;
	}

	clear(): void {
		this.pages.clear();
		this.focusing = undefined;
	}
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
