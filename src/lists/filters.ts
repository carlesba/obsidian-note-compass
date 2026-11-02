import { conditionFits, defaultCondition, positiveOperator, propertyType, propertyValueType, readCondition } from "./conditions.ts";
import type { Condition, ValueType } from "./conditions.ts";
import { linkText, matchesCondition, matchesSubject } from "./matchers.ts";
import type { Subject } from "./matchers.ts";
import { findNote } from "./sources.ts";
import type { JumpListVault, MomentDate, VaultNote } from "./vault";

export type FilterMode = "all" | "any" | "none";

export const FILTER_MODES: readonly FilterMode[] = ["all", "any", "none"];

export const MAX_FILTER_DEPTH = 3;

export const FILE_FIELDS = [
	"file",
	"name",
	"basename",
	"fullname",
	"path",
	"folder",
	"ext",
	"ctime",
	"mtime",
	"size",
	"links",
	"backlinks",
	"embeds",
	"tags",
] as const;

export type FileField = (typeof FILE_FIELDS)[number];

export const FILE_FIELD_TYPES: Record<FileField, ValueType> = {
	file: "file",
	name: "text",
	basename: "text",
	fullname: "text",
	path: "text",
	folder: "text",
	ext: "text",
	ctime: "date",
	mtime: "date",
	size: "number",
	links: "list",
	backlinks: "list",
	embeds: "list",
	tags: "list",
};

export interface FilterGroup {
	kind: "group";
	mode: FilterMode;
	items: FilterNode[];
}

export type PropertyRule = { kind: "property"; property: string; condition: Condition };
export type FileRule = { kind: "file"; field: FileField; condition: Condition };

export type FilterRule = PropertyRule | FileRule;

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

export function fileRule(field: FileField, condition: Condition = defaultCondition(FILE_FIELD_TYPES[field])): FileRule {
	return { kind: "file", field, condition };
}

export function ruleValueType(rule: FilterRule, propertyTypes: Record<string, string>): ValueType {
	return rule.kind === "file" ? FILE_FIELD_TYPES[rule.field] : propertyValueType(propertyType(propertyTypes, rule.property));
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
	const { vault, today } = context;
	if (rule.kind === "property") {
		const check = { property: rule.property, condition: rule.condition, type: propertyType(context.propertyTypes, rule.property), today };
		return (note) => matchesCondition(vault.frontmatter(note.path), check);
	}
	const type = FILE_FIELD_TYPES[rule.field];
	if (!conditionFits(rule.condition, type)) return () => false;
	const { field } = rule;
	if (field === "file") return compileFileCondition(rule.condition, context);
	const subject = fileSubject(field, context);
	return (note) => matchesSubject(subject(note), rule.condition, today);
}

function compileFileCondition(condition: Condition, context: FilterContext): NotePredicate {
	const positive = positiveOperator(condition.operator);
	if (positive) {
		const matches = compileFileCondition({ ...condition, operator: positive }, context);
		return (note) => !matches(note);
	}
	const { vault } = context;
	const value = typeof condition.value === "string" ? condition.value.trim() : "";
	if (value === "") return () => false;
	switch (condition.operator) {
		case "is": {
			const target = findNote(vault.notes(), value);
			return (note) => target !== undefined && note.path === target.path;
		}
		case "links to": {
			const target = findNote(vault.notes(), value);
			const linking = new Set(target ? vault.linksTo(target.path) : []);
			return (note) => linking.has(note.path);
		}
		case "in folder": {
			const folder = value.replace(/^\/+|\/+$/g, "");
			return (note) => folder === "" || note.path.startsWith(`${folder}/`);
		}
		case "has tag": {
			const tag = normalizedTag(value);
			return (note) => vault.tags(note.path).some((noteTag) => isTagOrSubtag(normalizedTag(noteTag), tag));
		}
		case "has property":
			return (note) => {
				const frontmatter = vault.frontmatter(note.path);
				return frontmatter !== undefined && Object.prototype.hasOwnProperty.call(frontmatter, value);
			};
		default:
			return () => false;
	}
}

function fileSubject(field: Exclude<FileField, "file">, context: FilterContext): (note: VaultNote) => Subject {
	const { vault } = context;
	switch (field) {
		case "name":
		case "basename":
			return (note) => ({ type: "text", value: note.basename });
		case "fullname":
			return (note) => ({ type: "text", value: note.path.split("/").pop() ?? note.path });
		case "path":
			return (note) => ({ type: "text", value: note.path });
		case "folder":
			return (note) => ({ type: "text", value: folderOf(note.path) });
		case "ext":
			return (note) => ({ type: "text", value: extensionOf(note.path) });
		case "ctime":
			return (note) => ({ type: "date", day: vault.moment(note.ctime).format(DAY_FORMAT) });
		case "mtime":
			return (note) => ({ type: "date", day: vault.moment(vault.mtime(note.path)).format(DAY_FORMAT) });
		case "size":
			return (note) => ({ type: "number", value: vault.size(note.path) });
		case "tags":
			return (note) => ({ type: "list", items: [...new Set(vault.tags(note.path).map(normalizedTag))], normalize: normalizedTag });
		case "links": {
			const normalize = notePathResolver(vault);
			return (note) => ({ type: "list", items: vault.linksFrom(note.path), normalize });
		}
		case "embeds": {
			const normalize = notePathResolver(vault);
			return (note) => ({ type: "list", items: vault.embeds(note.path), normalize });
		}
		case "backlinks": {
			const normalize = notePathResolver(vault);
			let backlinks: Map<string, string[]> | undefined;
			return (note) => {
				backlinks = backlinks ?? backlinkIndex(vault);
				return { type: "list", items: backlinks.get(note.path) ?? [], normalize };
			};
		}
	}
}

function notePathResolver(vault: JumpListVault): (text: string) => string {
	const notes = vault.notes();
	const resolved = new Map<string, string>();
	return (text) => {
		const known = resolved.get(text);
		if (known !== undefined) return known;
		const path = findNote(notes, linkText(text))?.path ?? text;
		resolved.set(text, path);
		return path;
	};
}

function backlinkIndex(vault: JumpListVault): Map<string, string[]> {
	const index = new Map<string, string[]>();
	for (const source of vault.notes()) {
		for (const target of vault.linksFrom(source.path)) {
			const sources = index.get(target);
			if (sources) sources.push(source.path);
			else index.set(target, [source.path]);
		}
	}
	return index;
}

function folderOf(path: string): string {
	const slash = path.lastIndexOf("/");
	return slash === -1 ? "/" : path.slice(0, slash);
}

function extensionOf(path: string): string {
	const name = path.split("/").pop() ?? path;
	const dot = name.lastIndexOf(".");
	return dot <= 0 ? "" : name.slice(dot + 1);
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

const LEGACY_DATE_FIELDS: Record<string, FileField> = { created: "ctime", modified: "mtime" };

const LEGACY_NEGATABLE_RULES: Record<string, { key: string; operator: Condition["operator"]; negated: Condition["operator"] }> = {
	folder: { key: "folder", operator: "in folder", negated: "is not in folder" },
	tag: { key: "tag", operator: "has tag", negated: "does not have tag" },
	linksTo: { key: "note", operator: "links to", negated: "does not link to" },
};

function readRule(stored: unknown): FilterRule | undefined {
	if (!isRecord(stored) || typeof stored.kind !== "string") return undefined;
	if (stored.kind === "property") {
		const condition = readCondition(stored.condition);
		return typeof stored.property === "string" && condition ? { kind: "property", property: stored.property, condition } : undefined;
	}
	if (stored.kind === "file") {
		const field = typeof stored.field === "string" ? (LEGACY_DATE_FIELDS[stored.field] ?? FILE_FIELDS.find((candidate) => candidate === stored.field)) : undefined;
		const condition = readCondition(stored.condition);
		return field && condition && conditionFits(condition, FILE_FIELD_TYPES[field]) ? fileRule(field, condition) : undefined;
	}
	if (stored.kind === "name" || stored.kind === "path") return readLegacyNameRule(stored.kind, stored);
	const legacy = Object.prototype.hasOwnProperty.call(LEGACY_NEGATABLE_RULES, stored.kind) ? LEGACY_NEGATABLE_RULES[stored.kind] : undefined;
	if (!legacy) return undefined;
	const value = stored[legacy.key];
	if (typeof value !== "string" || (stored.negated !== undefined && typeof stored.negated !== "boolean")) return undefined;
	return fileRule("file", { operator: stored.negated === true ? legacy.negated : legacy.operator, value });
}

function readLegacyNameRule(field: "name" | "path", stored: Record<string, unknown>): FileRule | undefined {
	const condition = readCondition({ operator: stored.operator, value: stored.value });
	if (!condition || !conditionFits(condition, "text")) return undefined;
	if (field === "path" && typeof condition.value === "string" && condition.value.trim() !== "" && (condition.operator === "ends with" || condition.operator === "does not end with")) {
		return fileRule(field, { ...condition, value: `${condition.value}.md` });
	}
	return fileRule(field, condition);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
