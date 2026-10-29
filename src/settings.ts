import { readCondition } from "./lists/conditions.ts";
import type { Condition } from "./lists/conditions.ts";
import { readFilter, singleRuleFilter } from "./lists/filters.ts";
import type { FilterGroup } from "./lists/filters.ts";
import { DEFAULT_CUSTOM_DATE_NOTES, PERIODS, defaultDateNoteSettings } from "./lists/dateNotes.ts";
import type { DateNoteSettings, Period, PeriodFormat } from "./lists/dateNotes.ts";
import { readForms, storedForms } from "./forms/form.ts";
import type { Form } from "./forms/form.ts";
import { readFixedValues } from "./setProperties/fixedValues.ts";
import type { FixedValue } from "./setProperties/fixedValues.ts";
import { readTaskCommands, storedTaskCommands } from "./tasks/taskCommand.ts";
import type { TaskCommand } from "./tasks/taskCommand.ts";

export type RelationSourceKind = "adjacentDates" | "linksOut" | "linksIn" | "sameDay";

export const RELATION_SOURCE_KINDS: readonly RelationSourceKind[] = ["adjacentDates", "linksOut", "linksIn", "sameDay"];

export type ListSource =
	| { kind: RelationSourceKind }
	| { kind: "filter"; filter: FilterGroup }
	| { kind: "linksToNote"; note: string }
	| { kind: "inFolder"; folder: string }
	| { kind: "modifiedToday" }
	| { kind: "currentPeriods"; periods: Period[] }
	| UnreadableSource;

export interface UnreadableSource {
	kind: "unreadable";
	stored: unknown;
}

export interface NoteList {
	id: string;
	enabled: boolean;
	prefix: string;
	prefixColor?: string;
	source: ListSource;
}

type LinkListMode = "multi" | "single";

const LINK_LIST_MODES: readonly LinkListMode[] = ["multi", "single"];

interface LinkList extends NoteList {
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

export type CheckboxMode = "picker" | "toggle" | "cycle";

export const CHECKBOX_MODES: readonly CheckboxMode[] = ["picker", "toggle", "cycle"];

export interface EditableProperty {
	id: string;
	enabled: boolean;
	prefix: string;
	prefixColor?: string;
	property: string;
	type: EditablePropertyType;
	source?: ListSource;
	excludedFolders?: string[];
	presetValues?: string[];
	mainMenuPresets?: string[];
	keepsEmpty?: true;
	mode?: "multiple";
	name?: string;
	fixedValues?: FixedValue[];
}

export function isMultiRow(entry: EditableProperty): boolean {
	return entry.mode === "multiple";
}

export interface SetPropertiesSettings {
	properties: EditableProperty[];
	checkboxMode: CheckboxMode;
}

export interface JumpSettings {
	showPrefixes: boolean;
	lists: NoteList[];
	dateNotes: DateNoteSettings;
	setProperties: SetPropertiesSettings;
	forms: Form[];
	taskCommands: TaskCommand[];
}

const DEFAULT_PREFIXES: Record<RelationSourceKind, string> = {
	adjacentDates: "📅 day",
	linksOut: "🔗 out",
	linksIn: "🔗 in",
	sameDay: "🔅 ctx",
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

const DEFAULT_FLAGS_PREFIX = "🎛️ meta";

const DEFAULT_FLAGS = ["active", "someday", "evergreen", "blocked", "archived"];

const DEFAULT_TEMPLATES_FOLDER = "templates";

function defaultLinkListFields(): Omit<LinkList, "id" | "enabled">[] {
	return [
		{ prefix: "👤 peop", source: { kind: "linksToNote", note: "Person 👤" }, property: "people", mode: "multi" },
		{ prefix: "📍 trak", source: { kind: "linksToNote", note: "Tracker 📍" }, property: "trackers", mode: "multi" },
		{
			prefix: "📚 coll",
			source: { kind: "linksToNote", note: "Collection 📚" },
			property: "collections",
			mode: "multi",
		},
		{ prefix: "📂 catg", source: { kind: "inFolder", folder: "categories" }, property: "category", mode: "single" },
		{
			prefix: "🏷️ ever",
			source: propertyFilter("evergreen", { operator: "is true" }),
			property: "related",
			mode: "multi",
		},
		{
			prefix: "📍 actv",
			source: propertyFilter("active", { operator: "is true" }),
			property: "related",
			mode: "multi",
		},
		{ prefix: "🏢 comp", source: { kind: "linksToNote", note: "Org 🏢" }, property: "related", mode: "multi" },
		{ prefix: "🔅 tday", source: { kind: "modifiedToday" }, property: "related", mode: "multi" },
	];
}

function propertyFilter(property: string, condition: Condition): ListSource {
	return { kind: "filter", filter: singleRuleFilter({ kind: "property", property, condition }) };
}

export function isUnreadable(source: ListSource | undefined): source is UnreadableSource {
	return source?.kind === "unreadable";
}

export function storedSettings(settings: JumpSettings): unknown {
	return {
		...settings,
		lists: settings.lists.map(withStoredSource),
		setProperties: { ...settings.setProperties, properties: settings.setProperties.properties.map(withStoredSource) },
		forms: storedForms(settings.forms),
		taskCommands: storedTaskCommands(settings.taskCommands),
	};
}

function withStoredSource(entry: { source?: ListSource }): object {
	return isUnreadable(entry.source) ? { ...entry, source: entry.source.stored } : entry;
}

export function defaultSettings(): JumpSettings {
	return mergeSettings(undefined);
}

const PREFIX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function writePrefixColor(target: { prefixColor?: string }, value: unknown): void {
	if (typeof value === "string" && PREFIX_COLOR_PATTERN.test(value)) target.prefixColor = value;
	else delete target.prefixColor;
}

export function newListId(lists: readonly { id: string }[]): string {
	const highest = Math.max(0, ...lists.map((list) => Number(list.id.match(/^list-(\d+)$/)?.[1] ?? 0)));
	return `list-${highest + 1}`;
}

export function mergeSettings(stored: unknown): JumpSettings {
	const data = isRecord(stored) ? stored : {};
	return {
		showPrefixes: typeof data.showPrefixes === "boolean" ? data.showPrefixes : true,
		lists: Array.isArray(data.lists) ? readLists(data.lists, () => ({})) : migrateLegacyLists(data),
		dateNotes: readDateNotes(data.dateNotes),
		setProperties: readSetProperties(data.setProperties),
		forms: readForms(data.forms),
		taskCommands: readTaskCommands(data.taskCommands),
	};
}

function readSetProperties(stored: unknown): SetPropertiesSettings {
	const data = isRecord(stored) ? stored : {};
	if (Array.isArray(data.properties)) return { properties: readProperties(data.properties), checkboxMode: readCheckboxMode(data) };
	return { properties: migrateLegacySetProperties(readLegacySetProperties(data)), checkboxMode: "picker" };
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
		prefix: withoutSeparator(list.prefix),
		property: list.property,
		type: list.mode === "single" ? "link" : "links",
		source: list.source,
		excludedFolders: folderList(legacy.templatesFolder),
	}));
	const checkboxes: EditableProperty[] = [];
	for (const flag of legacy.flags) {
		const id = newListId([...links, ...checkboxes]);
		checkboxes.push({ id, enabled: true, prefix: withoutSeparator(legacy.flagsPrefix), property: flag, type: "checkbox" });
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
		const source = isLinkType(type) ? readSourceOrKeep(entry.source) : undefined;
		const id =
			typeof entry.id === "string" && entry.id !== "" && !properties.some((property) => property.id === entry.id)
				? entry.id
				: newListId([...storedIds, ...properties]);
		const property: EditableProperty = {
			id,
			enabled: typeof entry.enabled === "boolean" ? entry.enabled : false,
			prefix: typeof entry.prefix === "string" ? withoutSeparator(entry.prefix) : "",
			property: entry.property,
			type,
		};
		writePrefixColor(property, entry.prefixColor);
		const presetValues = readPresetValues(entry);
		if (presetValues.length > 0) property.presetValues = presetValues;
		const mainMenuPresets = readMainMenuPresets(entry, presetValues);
		if (mainMenuPresets.length > 0) property.mainMenuPresets = mainMenuPresets;
		if (entry.keepsEmpty === true) property.keepsEmpty = true;
		if (entry.mode === "multiple") property.mode = "multiple";
		if (typeof entry.name === "string" && entry.name.trim() !== "") property.name = entry.name;
		const fixedValues = readFixedValues(entry.fixedValues);
		if (fixedValues.length > 0) property.fixedValues = fixedValues;
		if (source) {
			property.source = source;
			property.excludedFolders = readExcludedFolders(entry);
		}
		properties.push(property);
	}
	return properties;
}

function readExcludedFolders(entry: Record<string, unknown>): string[] {
	if (Array.isArray(entry.excludedFolders)) {
		return entry.excludedFolders
			.filter((folder): folder is string => typeof folder === "string")
			.map((folder) => folder.trim())
			.filter((folder) => folder !== "");
	}
	return typeof entry.excludedFolder === "string" ? folderList(entry.excludedFolder) : [];
}

function readPresetValues(entry: Record<string, unknown>): string[] {
	if (!Array.isArray(entry.presetValues)) return [];
	const values = entry.presetValues
		.filter((value): value is string => typeof value === "string")
		.map((value) => value.trim())
		.filter((value) => value !== "");
	return [...new Set(values)];
}

function readCheckboxMode(data: Record<string, unknown>): CheckboxMode {
	const stored = CHECKBOX_MODES.find((mode) => mode === data.checkboxMode);
	if (stored) return stored;
	const properties = Array.isArray(data.properties) ? data.properties.filter(isRecord) : [];
	const perProperty = properties.find((entry) => entry.type === "checkbox" && entry.checkboxMode !== "picker" && CHECKBOX_MODES.some((mode) => mode === entry.checkboxMode));
	return CHECKBOX_MODES.find((mode) => mode === perProperty?.checkboxMode) ?? "picker";
}

function readMainMenuPresets(entry: Record<string, unknown>, presetValues: readonly string[]): string[] {
	if (entry.presetsInMainMenu === true) return [...presetValues];
	if (!Array.isArray(entry.mainMenuPresets)) return [];
	const wanted = new Set(entry.mainMenuPresets.filter((value): value is string => typeof value === "string").map((value) => value.trim()));
	return presetValues.filter((value) => wanted.has(value));
}

export function hasPresetValues(type: EditablePropertyType): boolean {
	return type === "text" || type === "number";
}

function folderList(folder: string): string[] {
	const trimmed = folder.trim();
	return trimmed === "" ? [] : [trimmed];
}

function defaultLinkLists(): LinkList[] {
	return defaultLinkListFields().map((list, index) => ({ id: `list-${index + 1}`, enabled: true, ...list }));
}

function readLinkListFields(entry: Record<string, unknown>): Omit<LinkList, keyof NoteList> | undefined {
	if (typeof entry.property !== "string") return undefined;
	return {
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
		const source = readSourceOrKeep(entry.source);
		const fields = readFields(entry);
		if (!fields) continue;
		const id =
			typeof entry.id === "string" && entry.id !== "" && !lists.some((list) => list.id === entry.id)
				? entry.id
				: newListId([...storedIds, ...lists]);
		const list: NoteList & Fields = {
			...fields,
			id,
			enabled: typeof entry.enabled === "boolean" ? entry.enabled : false,
			prefix: typeof entry.prefix === "string" ? withoutSeparator(entry.prefix) : "",
			source,
		};
		writePrefixColor(list, entry.prefixColor);
		lists.push(list);
	}
	return lists;
}

function readSourceOrKeep(stored: unknown): ListSource {
	return readSource(stored) ?? { kind: "unreadable", stored };
}

function readSource(stored: unknown): ListSource | undefined {
	if (!isRecord(stored) || typeof stored.kind !== "string") return undefined;
	const kind = RELATION_SOURCE_KINDS.find((relation) => relation === stored.kind);
	if (kind) return { kind };
	if (stored.kind === "modifiedToday") return { kind: "modifiedToday" };
	if (stored.kind === "currentPeriods") {
		const periods = Array.isArray(stored.periods) ? stored.periods : [];
		return { kind: "currentPeriods", periods: PERIODS.filter((period) => periods.includes(period)) };
	}
	if (stored.kind === "linksToNote") return typeof stored.note === "string" ? { kind: "linksToNote", note: stored.note } : undefined;
	if (stored.kind === "inFolder") return typeof stored.folder === "string" ? { kind: "inFolder", folder: stored.folder } : undefined;
	if (stored.kind === "filter") {
		const filter = readFilter(stored.filter);
		return filter ? { kind: "filter", filter } : undefined;
	}
	if (stored.kind !== "frontmatter" || typeof stored.property !== "string") return undefined;
	const condition = readCondition(stored.condition);
	return condition ? propertyFilter(stored.property, condition) : undefined;
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
			typeof list.prefix === "string" ? list.prefix.trim() : DEFAULT_PREFIXES[kind],
			{ kind },
		);
	}

	for (const legacy of Array.isArray(data.customLists) ? data.customLists : []) {
		if (!isRecord(legacy) || typeof legacy.property !== "string" || typeof legacy.operator !== "string") continue;
		if (!Object.prototype.hasOwnProperty.call(LEGACY_OPERATORS, legacy.operator)) continue;
		const toCondition = LEGACY_OPERATORS[legacy.operator];
		const value = typeof legacy.value === "string" ? legacy.value : "";
		const prefix = typeof legacy.prefix === "string" ? legacy.prefix.trim() : "";
		add(true, prefix, propertyFilter(legacy.property, toCondition(value)));
	}
	return lists;
}

function withoutSeparator(prefix: string): string {
	return prefix.replace(/\s*\|\s*$/, "").trim();
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
