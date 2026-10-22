import {
	CONDITIONS_BY_TYPE,
	DATE_OPERATORS,
	NUMBER_OPERATORS,
	TEXT_OPERATORS,
	VALUELESS_OPERATORS,
	conditionAppliesTo,
	propertyType,
} from "../lists/conditions.ts";
import type { Condition, ConditionOperator, DateValue, PropertyType } from "../lists/conditions.ts";
import type { JumpListVault } from "../lists/vault.ts";
import { RELATION_SOURCE_KINDS, newListId, writePrefixColor } from "../settings.ts";
import type { ListSource, NoteList } from "../settings.ts";

export type SourceChoice = ListSource["kind"];

export const SOURCE_OPTIONS: Record<SourceChoice, string> = {
	adjacentDates: "Adjacent dates",
	linksOut: "Outbound links",
	linksIn: "Inbound links",
	sameDay: "Same day",
	frontmatter: "Property",
	linksToNote: "Links to note",
	inFolder: "In folder",
	modifiedToday: "Modified today",
};

export const DATE_MODE_OPTIONS = { fixed: "Fixed date", relative: "Relative to today" };

export const DIRECTION_OPTIONS = { ago: "Days ago", today: "Today", fromNow: "Days from now" };

export type ListField =
	| "enabled"
	| "prefix"
	| "prefixColor"
	| "source"
	| "property"
	| "operator"
	| "text"
	| "number"
	| "dateMode"
	| "date"
	| "days"
	| "direction"
	| "note"
	| "folder";

export type ValueShape = "none" | "text" | "number" | "date";

export interface PropertySuggestion {
	name: string;
	type: PropertyType;
}

type PropertySource = Extract<ListSource, { kind: "frontmatter" }>;

const FIXED_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function newList(lists: readonly NoteList[]): NoteList {
	return { id: newListId(lists), enabled: false, prefix: "", source: propertySource() };
}

export function listName(list: NoteList): string {
	return `${list.prefix} ${sourceSummary(list.source)}`.trim();
}

export function sourceSummary(source: ListSource): string {
	if (source.kind === "linksToNote") {
		const name = source.note.split("/").pop()?.replace(/\.md$/, "") ?? "";
		return name === "" ? "Note not chosen" : `Links to ${name}`;
	}
	if (source.kind === "inFolder") return source.folder === "" ? "Folder not chosen" : `In ${source.folder}`;
	if (source.kind !== "frontmatter") return SOURCE_OPTIONS[source.kind];
	if (source.property.trim() === "") return "Property not chosen";
	const { condition } = source;
	return "value" in condition
		? `${source.property} ${condition.operator} ${describeValue(condition.value)}`
		: `${source.property} ${condition.operator}`;
}

export function fitConditionToProperty(list: NoteList, types: Record<string, string>): void {
	if (list.source.kind !== "frontmatter" || list.source.property === "") return;
	const type = propertyType(types, list.source.property);
	if (conditionAppliesTo(list.source.condition.operator, type)) return;
	list.source.condition = conditionFor(CONDITIONS_BY_TYPE[type][0], list.source.condition);
}

export function hasProperty(list: NoteList): boolean {
	return list.source.kind === "frontmatter" && list.source.property !== "";
}

export function listDisplayValue(list: NoteList): string {
	return list.enabled ? "" : "off";
}

export function inapplicableCondition(source: ListSource, types: Record<string, string>): string | undefined {
	if (source.kind !== "frontmatter") return undefined;
	const type = propertyType(types, source.property);
	if (conditionAppliesTo(source.condition.operator, type)) return undefined;
	return `"${source.condition.operator}" does not apply to a ${type} property, so this list matches nothing until you change the condition.`;
}

export function operatorOptions(type: PropertyType, current?: ConditionOperator): Record<string, string> {
	const options: Record<string, string> = {};
	for (const operator of CONDITIONS_BY_TYPE[type]) options[operator] = operator;
	if (current !== undefined && !(current in options)) {
		options[current] = conditionAppliesTo(current, type) ? current : `${current} (does not apply)`;
	}
	return options;
}

export function valueShape(operator: ConditionOperator): ValueShape {
	if (includes(TEXT_OPERATORS, operator)) return "text";
	if (includes(NUMBER_OPERATORS, operator)) return "number";
	if (includes(DATE_OPERATORS, operator)) return "date";
	return "none";
}

export function propertySuggestions(vault: Pick<JumpListVault, "notes" | "frontmatter" | "propertyTypes">): PropertySuggestion[] {
	const types = vault.propertyTypes();
	const names = new Map<string, string>();
	for (const note of vault.notes()) {
		for (const name of Object.keys(vault.frontmatter(note.path) ?? {})) {
			if (!names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
		}
	}
	for (const name of Object.keys(types)) if (!names.has(name)) names.set(name, name);
	return Array.from(names.values())
		.sort((a, b) => a.localeCompare(b))
		.map((name) => ({ name, type: propertyType(types, name) }));
}

export function matchingSuggestions(suggestions: readonly PropertySuggestion[], query: string): PropertySuggestion[] {
	const typed = query.trim().toLowerCase();
	return suggestions.filter((suggestion) => suggestion.name.toLowerCase().includes(typed));
}

export function readListField(list: NoteList, field: ListField): unknown {
	if (field === "enabled") return list.enabled;
	if (field === "prefix") return list.prefix;
	if (field === "prefixColor") return list.prefixColor ?? "";
	if (field === "source") return list.source.kind;
	const { source } = list;
	if (source.kind === "linksToNote") return field === "note" ? source.note : undefined;
	if (source.kind === "inFolder") return field === "folder" ? source.folder : undefined;
	if (source.kind !== "frontmatter") return undefined;
	const { condition } = source;
	if (field === "property") return source.property;
	if (field === "operator") return condition.operator;
	if (!("value" in condition)) return undefined;
	const { value } = condition;
	if (field === "text") return typeof value === "string" ? value : undefined;
	if (field === "number") return typeof value === "number" ? value : undefined;
	if (typeof value !== "object") return undefined;
	if (field === "dateMode") return value.kind;
	if (field === "date") return value.kind === "fixed" ? value.date : "";
	const days = value.kind === "relative" ? value.days : 0;
	if (field === "days") return Math.abs(days);
	return days < 0 ? "ago" : days > 0 ? "fromNow" : "today";
}

export function writeListField(list: NoteList, field: ListField, value: unknown): void {
	if (field === "enabled") list.enabled = value === true;
	else if (field === "prefix") list.prefix = typeof value === "string" ? value : "";
	else if (field === "prefixColor") writePrefixColor(list, value);
	else if (field === "source") list.source = sourceFor(value, list.source);
	else if (field === "note" && list.source.kind === "linksToNote") list.source.note = typeof value === "string" ? value.trim() : "";
	else if (field === "folder" && list.source.kind === "inFolder") list.source.folder = typeof value === "string" ? value.trim() : "";
	else if (list.source.kind === "frontmatter") writeConditionField(list.source, field, value);
}

export function fixedDateError(value: string): string | undefined {
	if (FIXED_DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value))) return undefined;
	return "Write the date as YYYY-MM-DD.";
}

function writeConditionField(source: PropertySource, field: ListField, value: unknown): void {
	const { condition } = source;
	if (field === "property") source.property = typeof value === "string" ? value.trim() : "";
	else if (field === "operator" && typeof value === "string") source.condition = conditionFor(value, condition);
	else if (field === "text" && typeof value === "string" && includes(TEXT_OPERATORS, condition.operator)) {
		source.condition = { operator: condition.operator, value };
	} else if (field === "number" && typeof value === "number" && Number.isFinite(value) && includes(NUMBER_OPERATORS, condition.operator)) {
		source.condition = { operator: condition.operator, value };
	} else if (includes(DATE_OPERATORS, condition.operator) && "value" in condition && typeof condition.value === "object") {
		source.condition = { operator: condition.operator, value: dateFor(condition.value, field, value) };
	}
}

function dateFor(date: DateValue, field: ListField, value: unknown): DateValue {
	const days = date.kind === "relative" ? date.days : 0;
	if (field === "dateMode") return value === "fixed" ? { kind: "fixed", date: "" } : { kind: "relative", days: 0 };
	if (field === "date" && typeof value === "string" && date.kind === "fixed") return { kind: "fixed", date: value.trim() };
	if (field === "days" && typeof value === "number" && Number.isInteger(value) && value >= 1 && date.kind === "relative") {
		return { kind: "relative", days: days < 0 ? -value : value };
	}
	if (field === "direction" && date.kind === "relative") {
		const count = Math.max(1, Math.abs(days));
		return { kind: "relative", days: value === "ago" ? -count : value === "fromNow" ? count : 0 };
	}
	return date;
}

function sourceFor(kind: unknown, current: ListSource): ListSource {
	if (kind === current.kind) return current;
	if (kind === "frontmatter") return propertySource();
	if (kind === "linksToNote") return { kind, note: "" };
	if (kind === "inFolder") return { kind, folder: "" };
	if (kind === "modifiedToday") return { kind };
	const relation = RELATION_SOURCE_KINDS.find((choice) => choice === kind);
	return relation ? { kind: relation } : current;
}

function conditionFor(operator: string, previous: Condition): Condition {
	const kept = "value" in previous ? previous.value : undefined;
	if (includes(TEXT_OPERATORS, operator)) return { operator, value: typeof kept === "string" ? kept : "" };
	if (includes(NUMBER_OPERATORS, operator)) return { operator, value: typeof kept === "number" ? kept : 0 };
	if (includes(DATE_OPERATORS, operator)) {
		return { operator, value: typeof kept === "object" ? kept : { kind: "relative", days: 0 } };
	}
	return includes(VALUELESS_OPERATORS, operator) ? { operator } : previous;
}

function propertySource(): PropertySource {
	return { kind: "frontmatter", property: "", condition: { operator: "is set" } };
}

function describeValue(value: string | number | DateValue): string {
	if (typeof value !== "object") return String(value);
	if (value.kind === "fixed") return value.date;
	if (value.days === 0) return "today";
	const days = Math.abs(value.days) === 1 ? "1 day" : `${Math.abs(value.days)} days`;
	return value.days < 0 ? `${days} ago` : `${days} from now`;
}

function includes<T extends string>(values: readonly T[], value: string): value is T {
	return (values as readonly string[]).includes(value);
}
