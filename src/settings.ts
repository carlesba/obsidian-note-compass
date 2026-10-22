import { readCondition } from "./lists/conditions.ts";
import type { Condition } from "./lists/conditions.ts";
import { DEFAULT_CUSTOM_DATE_NOTES, PERIODS, defaultDateNoteSettings } from "./lists/dateNotes.ts";
import type { DateNoteSettings, PeriodFormat } from "./lists/dateNotes.ts";

export type RelationSourceKind = "adjacentDates" | "linksOut" | "linksIn" | "sameDay";

export const RELATION_SOURCE_KINDS: readonly RelationSourceKind[] = ["adjacentDates", "linksOut", "linksIn", "sameDay"];

export type ListSource =
	| { kind: RelationSourceKind }
	| { kind: "frontmatter"; property: string; condition: Condition }
	| { kind: "linksToNote"; note: string }
	| { kind: "inFolder"; folder: string }
	| { kind: "modifiedToday" };

export interface NoteList {
	id: string;
	enabled: boolean;
	prefix: string;
	source: ListSource;
}

type LinkListMode = "multi" | "single";

const LINK_LIST_MODES: readonly LinkListMode[] = ["multi", "single"];

interface LinkList extends NoteList {
	name: string;
	property: string;
	mode: LinkListMode;
}

interface LegacySetPropertiesSettings {
	flagsPrefix: string;
	flags: string[];
	templatesFolder: string;
	linkLists: LinkList[];
}

export type EditablePropertyType = "checkbox" | "text" | "number" | "date" | "datetime" | "link" | "links";

export const EDITABLE_PROPERTY_TYPES: readonly EditablePropertyType[] = [
	"checkbox",
	"text",
	"number",
	"date",
	"datetime",
	"link",
	"links",
];

export interface EditableProperty {
	id: string;
	enabled: boolean;
	prefix: string;
	property: string;
	type: EditablePropertyType;
	source?: ListSource;
	excludedFolder?: string;
}

export interface SetPropertiesSettings {
	properties: EditableProperty[];
}

export interface JumpSettings {
	lists: NoteList[];
	dateNotes: DateNoteSettings;
	setProperties: SetPropertiesSettings;
}

const DEFAULT_PREFIXES: Record<RelationSourceKind, string> = {
	adjacentDates: "📅 day |",
	linksOut: "🔗 out |",
	linksIn: "🔗 in  |",
	sameDay: "🔅 ctx |",
};

const LEGACY_BUILT_IN_KEYS: Record<RelationSourceKind, string> = {
	adjacentDates: "adjacentDays",
	linksOut: "linksOut",
	linksIn: "linksIn",
	sameDay: "sameDay",
};

const LEGACY_OPERATORS: Record<string, (value: string) => Condition> = {
	"is true": () => ({ operator: "is true" }),
	equals: (value) => ({ operator: "is", value }),
	contains: (value) => ({ operator: "has item", value }),
	exists: () => ({ operator: "is set" }),
};

const DATE_NOTE_SOURCES: readonly DateNoteSettings["from"][] = ["auto", "periodicNotes", "dailyNotes", "custom"];

const DEFAULT_FLAGS_PREFIX = "🎛️ meta |";

const DEFAULT_FLAGS = ["active", "someday", "evergreen", "blocked", "archived"];

const DEFAULT_TEMPLATES_FOLDER = "templates";

function defaultLinkListFields(): Omit<LinkList, "id" | "enabled">[] {
	return [
		{ prefix: "👤 peop |", name: "People", source: { kind: "linksToNote", note: "Person 👤" }, property: "people", mode: "multi" },
		{ prefix: "📍 trak |", name: "Trackers", source: { kind: "linksToNote", note: "Tracker 📍" }, property: "trackers", mode: "multi" },
		{
			prefix: "📚 coll |",
			name: "Collections",
			source: { kind: "linksToNote", note: "Collection 📚" },
			property: "collections",
			mode: "multi",
		},
		{ prefix: "📂 catg |", name: "Category", source: { kind: "inFolder", folder: "categories" }, property: "category", mode: "single" },
		{
			prefix: "🏷️ ever |",
			name: "Evergreen",
			source: { kind: "frontmatter", property: "evergreen", condition: { operator: "is true" } },
			property: "related",
			mode: "multi",
		},
		{
			prefix: "📍 actv |",
			name: "Active",
			source: { kind: "frontmatter", property: "active", condition: { operator: "is true" } },
			property: "related",
			mode: "multi",
		},
		{ prefix: "🏢 comp |", name: "Companies", source: { kind: "linksToNote", note: "Org 🏢" }, property: "related", mode: "multi" },
		{ prefix: "🔅 tday |", name: "Today", source: { kind: "modifiedToday" }, property: "related", mode: "multi" },
	];
}

export function defaultSettings(): JumpSettings {
	return mergeSettings(undefined);
}

export function newListId(lists: readonly { id: string }[]): string {
	const highest = Math.max(0, ...lists.map((list) => Number(list.id.match(/^list-(\d+)$/)?.[1] ?? 0)));
	return `list-${highest + 1}`;
}

export function mergeSettings(stored: unknown): JumpSettings {
	const data = isRecord(stored) ? stored : {};
	return {
		lists: Array.isArray(data.lists) ? readLists(data.lists, () => ({})) : migrateLegacyLists(data),
		dateNotes: readDateNotes(data.dateNotes),
		setProperties: readSetProperties(data.setProperties),
	};
}

function readSetProperties(stored: unknown): SetPropertiesSettings {
	const data = isRecord(stored) ? stored : {};
	if (Array.isArray(data.properties)) return { properties: readProperties(data.properties) };
	return { properties: migrateLegacySetProperties(readLegacySetProperties(data)) };
}

function readLegacySetProperties(data: Record<string, unknown>): LegacySetPropertiesSettings {
	return {
		flagsPrefix: typeof data.flagsPrefix === "string" ? data.flagsPrefix : DEFAULT_FLAGS_PREFIX,
		flags: Array.isArray(data.flags)
			? data.flags.filter((flag): flag is string => typeof flag === "string")
			: [...DEFAULT_FLAGS],
		templatesFolder: typeof data.templatesFolder === "string" ? data.templatesFolder : DEFAULT_TEMPLATES_FOLDER,
		linkLists: Array.isArray(data.linkLists) ? readLists(data.linkLists, readLinkListFields) : defaultLinkLists(),
	};
}

function migrateLegacySetProperties(legacy: LegacySetPropertiesSettings): EditableProperty[] {
	const links: EditableProperty[] = legacy.linkLists.map((list) => ({
		id: list.id,
		enabled: list.enabled,
		prefix: list.prefix,
		property: list.property,
		type: list.mode === "single" ? "link" : "links",
		source: list.source,
		excludedFolder: legacy.templatesFolder,
	}));
	const checkboxes: EditableProperty[] = [];
	for (const flag of legacy.flags) {
		const id = newListId([...links, ...checkboxes]);
		checkboxes.push({ id, enabled: true, prefix: legacy.flagsPrefix, property: flag, type: "checkbox" });
	}
	return [...checkboxes, ...links];
}

export function isLinkType(type: EditablePropertyType): boolean {
	return type === "link" || type === "links";
}

function readProperties(stored: unknown[]): EditableProperty[] {
	const storedIds = stored.filter(isRecord).map((entry) => ({ id: typeof entry.id === "string" ? entry.id : "" }));
	const properties: EditableProperty[] = [];
	for (const entry of stored) {
		if (!isRecord(entry) || typeof entry.property !== "string") continue;
		const type = EDITABLE_PROPERTY_TYPES.find((candidate) => candidate === entry.type);
		if (!type) continue;
		const source = isLinkType(type) ? readSource(entry.source) : undefined;
		if (isLinkType(type) && !source) continue;
		const id =
			typeof entry.id === "string" && entry.id !== "" && !properties.some((property) => property.id === entry.id)
				? entry.id
				: newListId([...storedIds, ...properties]);
		const property: EditableProperty = {
			id,
			enabled: typeof entry.enabled === "boolean" ? entry.enabled : false,
			prefix: typeof entry.prefix === "string" ? entry.prefix : "",
			property: entry.property,
			type,
		};
		if (source) {
			property.source = source;
			property.excludedFolder = typeof entry.excludedFolder === "string" ? entry.excludedFolder : "";
		}
		properties.push(property);
	}
	return properties;
}

function defaultLinkLists(): LinkList[] {
	return defaultLinkListFields().map((list, index) => ({ id: `list-${index + 1}`, enabled: true, ...list }));
}

function readLinkListFields(entry: Record<string, unknown>): Omit<LinkList, keyof NoteList> | undefined {
	if (typeof entry.property !== "string") return undefined;
	return {
		name: typeof entry.name === "string" ? entry.name : "",
		property: entry.property,
		mode: LINK_LIST_MODES.find((mode) => mode === entry.mode) ?? "multi",
	};
}

function readLists<Fields extends object>(
	stored: unknown[],
	readFields: (entry: Record<string, unknown>) => Fields | undefined,
): (NoteList & Fields)[] {
	const storedIds = stored.filter(isRecord).map((entry) => ({ id: typeof entry.id === "string" ? entry.id : "" }));
	const lists: (NoteList & Fields)[] = [];
	for (const entry of stored) {
		if (!isRecord(entry)) continue;
		const source = readSource(entry.source);
		const fields = readFields(entry);
		if (!source || !fields) continue;
		const id =
			typeof entry.id === "string" && entry.id !== "" && !lists.some((list) => list.id === entry.id)
				? entry.id
				: newListId([...storedIds, ...lists]);
		lists.push({
			...fields,
			id,
			enabled: typeof entry.enabled === "boolean" ? entry.enabled : false,
			prefix: typeof entry.prefix === "string" ? entry.prefix : "",
			source,
		});
	}
	return lists;
}

function readSource(stored: unknown): ListSource | undefined {
	if (!isRecord(stored) || typeof stored.kind !== "string") return undefined;
	const kind = RELATION_SOURCE_KINDS.find((relation) => relation === stored.kind);
	if (kind) return { kind };
	if (stored.kind === "modifiedToday") return { kind: "modifiedToday" };
	if (stored.kind === "linksToNote") return typeof stored.note === "string" ? { kind: "linksToNote", note: stored.note } : undefined;
	if (stored.kind === "inFolder") return typeof stored.folder === "string" ? { kind: "inFolder", folder: stored.folder } : undefined;
	if (stored.kind !== "frontmatter" || typeof stored.property !== "string") return undefined;
	const condition = readCondition(stored.condition);
	return condition ? { kind: "frontmatter", property: stored.property, condition } : undefined;
}

function migrateLegacyLists(data: Record<string, unknown>): NoteList[] {
	const builtIns = isRecord(data.builtIns) ? data.builtIns : {};
	const lists: NoteList[] = [];
	const add = (enabled: boolean, prefix: string, source: ListSource) =>
		lists.push({ id: newListId(lists), enabled, prefix, source });

	for (const kind of RELATION_SOURCE_KINDS) {
		const legacy = builtIns[LEGACY_BUILT_IN_KEYS[kind]];
		const list = isRecord(legacy) ? legacy : {};
		add(
			typeof list.enabled === "boolean" ? list.enabled : true,
			typeof list.prefix === "string" ? withLegacySeparator(list.prefix) : DEFAULT_PREFIXES[kind],
			{ kind },
		);
	}

	for (const legacy of Array.isArray(data.customLists) ? data.customLists : []) {
		if (!isRecord(legacy) || typeof legacy.property !== "string" || typeof legacy.operator !== "string") continue;
		if (!Object.prototype.hasOwnProperty.call(LEGACY_OPERATORS, legacy.operator)) continue;
		const toCondition = LEGACY_OPERATORS[legacy.operator];
		const value = typeof legacy.value === "string" ? legacy.value : "";
		const prefix = withLegacySeparator(typeof legacy.prefix === "string" ? legacy.prefix : "");
		add(true, prefix, { kind: "frontmatter", property: legacy.property, condition: toCondition(value) });
	}
	return lists;
}

function withLegacySeparator(prefix: string): string {
	return prefix === "" ? "|" : `${prefix} |`;
}

function readDateNotes(stored: unknown): DateNoteSettings {
	const defaults = defaultDateNoteSettings();
	if (!isRecord(stored)) return defaults;
	const from = DATE_NOTE_SOURCES.find((source) => source === stored.from) ?? defaults.from;
	const custom = isRecord(stored.custom) ? stored.custom : {};
	const formats = { ...defaults.custom };
	for (const period of PERIODS) formats[period] = readPeriodFormat(custom[period], DEFAULT_CUSTOM_DATE_NOTES[period]);
	return { from, custom: formats };
}

function readPeriodFormat(stored: unknown, fallback: PeriodFormat): PeriodFormat {
	const format = isRecord(stored) ? stored : {};
	return {
		enabled: typeof format.enabled === "boolean" ? format.enabled : fallback.enabled,
		folder: typeof format.folder === "string" ? format.folder : fallback.folder,
		format: typeof format.format === "string" ? format.format : fallback.format,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
