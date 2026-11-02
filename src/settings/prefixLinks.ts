import { allLists, writePrefixColor } from "../settings.ts";
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
		...allLists(settings).map((list) => ({ key: listKey(list.id, "prefix"), label: sourceSummary(list.source), target: list })),
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

export function prefixChoices(rows: readonly PrefixRow[], key: string): PrefixChoice[] {
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
	return choices;
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

export type PrefixDraftKind = "shared" | "new";

export interface PrefixDraft extends PrefixValue {
	kind: PrefixDraftKind;
}

export class PrefixPages {
	private readonly settings: () => JumpSettings;
	private readonly drafts = new Map<string, PrefixDraft>();
	private readonly holds = new Map<string, number>();
	private focusing: string | undefined;

	constructor(settings: () => JumpSettings) {
		this.settings = settings;
	}

	rows(): PrefixRow[] {
		return prefixRows(this.settings());
	}

	linkedRows(key: string): PrefixRow[] {
		const rows = this.rows();
		const linked = linkedPrefixKeys(rows, key);
		return rows.filter((row) => linked.includes(row.key));
	}

	draft(key: string): PrefixDraft | undefined {
		return this.drafts.get(key);
	}

	startEditing(key: string): void {
		const own = this.rows().find((row) => row.key === key);
		if (!own) return;
		this.drafts.set(key, own.prefixColor === undefined ? { kind: "shared", prefix: own.prefix } : { kind: "shared", prefix: own.prefix, color: own.prefixColor });
		this.focusing = key;
	}

	startNew(key: string): void {
		this.drafts.set(key, { kind: "new", prefix: "" });
		this.focusing = key;
	}

	editDraft(key: string, change: PrefixChange): void {
		const draft = this.drafts.get(key);
		if (!draft) return;
		if (change.prefix !== undefined) draft.prefix = change.prefix;
		if (change.color === "") delete draft.color;
		else if (change.color !== undefined) draft.color = change.color;
	}

	save(key: string): boolean {
		const draft = this.drafts.get(key);
		if (!draft) return false;
		this.drafts.delete(key);
		const prefix = draft.prefix.trim();
		const settings = this.settings();
		if (prefix === "") return clearPrefix(settings, key);
		if (draft.kind === "new") return assignPrefix(settings, key, { prefix, color: draft.color });
		return applyPrefixChange(settings, [key, ...linkedPrefixKeys(this.rows(), key)], { prefix, color: draft.color ?? "" });
	}

	assign(key: string, value: PrefixValue): boolean {
		this.drafts.delete(key);
		return assignPrefix(this.settings(), key, value);
	}

	clearPrefix(key: string): boolean {
		this.drafts.delete(key);
		return clearPrefix(this.settings(), key);
	}

	hold(key: string): void {
		this.holds.set(key, (this.holds.get(key) ?? 0) + 1);
	}

	release(key: string): void {
		this.holds.set(key, Math.max(0, (this.holds.get(key) ?? 0) - 1));
	}

	discardUnheld(key: string): void {
		if ((this.holds.get(key) ?? 0) > 0) return;
		this.holds.delete(key);
		this.drafts.delete(key);
	}

	takeFocus(key: string): boolean {
		if (this.focusing !== key) return false;
		this.focusing = undefined;
		return true;
	}

	clear(): void {
		this.drafts.clear();
		this.holds.clear();
		this.focusing = undefined;
	}
}
