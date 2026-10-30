import { isDateCondition, propertyType, readCondition } from "./conditions.ts";
import type { Condition, DateCondition } from "./conditions.ts";
import { matchesCondition, matchesDay } from "./matchers.ts";
import { findNote } from "./sources.ts";
import type { JumpListVault, MomentDate, VaultNote } from "./vault";

export type FilterMode = "all" | "any" | "none";

export const FILTER_MODES: readonly FilterMode[] = ["all", "any", "none"];

export const MAX_FILTER_DEPTH = 3;

export type FileDateField = "created" | "modified";

export const FILE_DATE_FIELDS: readonly FileDateField[] = ["created", "modified"];

export interface FilterGroup {
	kind: "group";
	mode: FilterMode;
	items: FilterNode[];
}

export type PropertyRule = { kind: "property"; property: string; condition: Condition };
export type FolderRule = { kind: "folder"; folder: string; negated?: true };
export type TagRule = { kind: "tag"; tag: string; negated?: true };
export type LinksToRule = { kind: "linksTo"; note: string; negated?: true };

export type NegatableRule = FolderRule | TagRule | LinksToRule;
export type FileDateRule = { kind: "file"; field: FileDateField; condition: DateCondition };

export type FilterRule = PropertyRule | FolderRule | TagRule | LinksToRule | FileDateRule;

export type FilterNode = FilterGroup | FilterRule;

export interface FilterContext {
	vault: JumpListVault;
	propertyTypes: Record<string, string>;
	today: MomentDate;
}

type NotePredicate = (note: VaultNote) => boolean;

const DAY_FORMAT = "YYYY-MM-DD";

export function emptyFilter(): FilterGroup {
	return { kind: "group", mode: "all", items: [] };
}

export function singleRuleFilter(rule: FilterRule): FilterGroup {
	return { kind: "group", mode: "all", items: [rule] };
}

export function filterRules(node: FilterNode): FilterRule[] {
	return node.kind === "group" ? node.items.flatMap(filterRules) : [node];
}

export function noteMatcher(filter: FilterGroup, context: FilterContext): NotePredicate {
	return compile(filter, context) ?? (() => true);
}

export function filterNotes(filter: FilterGroup, context: FilterContext): VaultNote[] {
	const matches = compile(filter, context);
	return matches ? context.vault.notes().filter(matches) : [];
}

function compile(node: FilterNode, context: FilterContext): NotePredicate | undefined {
	if (node.kind !== "group") return compileRule(node, context);
	const predicates = node.items
		.map((item) => compile(item, context))
		.filter((predicate): predicate is NotePredicate => predicate !== undefined);
	if (predicates.length === 0) return undefined;
	if (node.mode === "all") return (note) => predicates.every((matches) => matches(note));
	if (node.mode === "any") return (note) => predicates.some((matches) => matches(note));
	return (note) => !predicates.some((matches) => matches(note));
}

function compileRule(rule: FilterRule, context: FilterContext): NotePredicate {
	const matches = compilePositiveRule(rule, context);
	if (rule.kind === "property" || rule.kind === "file" || rule.negated !== true) return matches;
	return (note) => !matches(note);
}

function compilePositiveRule(rule: FilterRule, context: FilterContext): NotePredicate {
	const { vault, today } = context;
	switch (rule.kind) {
		case "property": {
			const check = { property: rule.property, condition: rule.condition, type: propertyType(context.propertyTypes, rule.property), today };
			return (note) => matchesCondition(vault.frontmatter(note.path), check);
		}
		case "folder": {
			const folder = rule.folder.replace(/^\/+|\/+$/g, "");
			return (note) => folder !== "" && note.path.startsWith(`${folder}/`);
		}
		case "tag": {
			const tag = normalizedTag(rule.tag);
			return (note) => tag !== "" && vault.tags(note.path).some((noteTag) => isTagOrSubtag(normalizedTag(noteTag), tag));
		}
		case "linksTo": {
			const target = findNote(vault.notes(), rule.note);
			const linking = new Set(target ? vault.linksTo(target.path) : []);
			return (note) => linking.has(note.path);
		}
		case "file": {
			const timestamp = rule.field === "created" ? (note: VaultNote) => note.ctime : (note: VaultNote) => vault.mtime(note.path);
			return (note) => matchesDay(vault.moment(timestamp(note)).format(DAY_FORMAT), rule.condition, today);
		}
	}
}

export function normalizedTag(tag: string): string {
	return tag.trim().replace(/^#/, "").toLowerCase();
}

function isTagOrSubtag(noteTag: string, tag: string): boolean {
	return noteTag === tag || noteTag.startsWith(`${tag}/`);
}

export function readFilter(stored: unknown): FilterGroup | undefined {
	return readGroup(stored, 1);
}

function readGroup(stored: unknown, depth: number): FilterGroup | undefined {
	if (!isRecord(stored) || stored.kind !== "group" || depth > MAX_FILTER_DEPTH || !Array.isArray(stored.items)) return undefined;
	const mode = FILTER_MODES.find((candidate) => candidate === stored.mode);
	if (!mode) return undefined;
	const items: FilterNode[] = [];
	for (const item of stored.items) {
		const node = isRecord(item) && item.kind === "group" ? readGroup(item, depth + 1) : readRule(item);
		if (!node) return undefined;
		items.push(node);
	}
	return { kind: "group", mode, items };
}

function readRule(stored: unknown): FilterRule | undefined {
	if (!isRecord(stored)) return undefined;
	switch (stored.kind) {
		case "property": {
			const condition = readCondition(stored.condition);
			return typeof stored.property === "string" && condition ? { kind: "property", property: stored.property, condition } : undefined;
		}
		case "folder":
			return typeof stored.folder === "string" ? withNegation({ kind: "folder", folder: stored.folder }, stored) : undefined;
		case "tag":
			return typeof stored.tag === "string" ? withNegation({ kind: "tag", tag: stored.tag }, stored) : undefined;
		case "linksTo":
			return typeof stored.note === "string" ? withNegation({ kind: "linksTo", note: stored.note }, stored) : undefined;
		case "file": {
			const field = FILE_DATE_FIELDS.find((candidate) => candidate === stored.field);
			const condition = readDateCondition(stored.condition);
			return field && condition ? { kind: "file", field, condition } : undefined;
		}
		default:
			return undefined;
	}
}

function withNegation<T extends NegatableRule>(rule: T, stored: Record<string, unknown>): T | undefined {
	if (stored.negated === undefined || stored.negated === false) return rule;
	return stored.negated === true ? { ...rule, negated: true } : undefined;
}

function readDateCondition(stored: unknown): DateCondition | undefined {
	const condition = readCondition(stored);
	return condition && isDateCondition(condition) ? condition : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
