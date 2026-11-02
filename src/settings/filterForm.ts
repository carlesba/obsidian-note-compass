import { t, tCount, translatedLabels } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import { operatorLabel, typeLabel } from "../i18n/labels.ts";
import { OPERATORS_BY_TYPE, conditionFits, conditionFor, fitCondition, isDateValue, propertyType, valueShape } from "../lists/conditions.ts";
import type { Condition, ConditionValue, DateValue, Operator, ValueType } from "../lists/conditions.ts";
import { FILE_FIELDS, FILE_FIELD_TYPES, FILTER_MODES, MAX_FILTER_DEPTH, fileRule, filterRules, ruleValueType } from "../lists/filters.ts";
import type { FileField, FilterGroup, FilterMode, FilterNode, FilterRule, PropertyRule } from "../lists/filters.ts";

export type RuleField = "property" | FileField;

export type ConditionField = "operator" | "text" | "texts" | "number" | "boolean" | "dateMode" | "date" | "days" | "direction";

const FILTER_MODE_KEYS: Record<FilterMode, TranslationKey> = { all: "modeAll", any: "modeAny", none: "modeNone" };

const SUMMARY_KEYS: Record<FilterMode, { one: TranslationKey; other: TranslationKey }> = {
	all: { one: "allOfOne", other: "allOfOther" },
	any: { one: "anyOfOne", other: "anyOfOther" },
	none: { one: "noneOfOne", other: "noneOfOther" },
};

export const FILE_FIELD_KEYS: Record<FileField, TranslationKey> = {
	file: "fieldFile",
	name: "fieldFileName",
	basename: "fieldFileBaseName",
	fullname: "fieldFileFullName",
	path: "fieldFilePath",
	folder: "fieldFolder",
	ext: "fieldFileExtension",
	ctime: "fieldCreatedTime",
	mtime: "fieldModifiedTime",
	size: "fieldFileSize",
	links: "fieldFileLinks",
	backlinks: "fieldFileBacklinks",
	embeds: "fieldFileEmbeds",
	tags: "fieldFileTags",
};

export function filterModeOptions(): Record<FilterMode, string> {
	return translatedLabels(FILTER_MODE_KEYS);
}

export function operatorOptions(type: ValueType, current?: Operator): Record<string, string> {
	const options: Record<string, string> = {};
	for (const operator of OPERATORS_BY_TYPE[type]) options[operator] = operatorLabel(operator);
	if (current !== undefined && !(current in options)) options[current] = t("operatorDoesNotApply", { operator: operatorLabel(current) });
	return options;
}

export function ruleField(rule: FilterRule): RuleField {
	return rule.kind === "file" ? rule.field : "property";
}

export function fileFieldLabel(field: FileField): string {
	return t(FILE_FIELD_KEYS[field]);
}

export function newRule(field: RuleField): FilterRule {
	if (field === "property") return { kind: "property", property: "", condition: { operator: "contains", value: "" } };
	return fileRule(field);
}

export function canAddGroup(depth: number): boolean {
	return depth < MAX_FILTER_DEPTH;
}

export function addCondition(group: FilterGroup): void {
	group.items.push(newRule("property"));
}

export function addGroup(group: FilterGroup): void {
	group.items.push({ kind: "group", mode: "all", items: [newRule("property")] });
}

export function removeNode(group: FilterGroup, node: FilterNode): void {
	const index = group.items.indexOf(node);
	if (index !== -1) group.items.splice(index, 1);
}

export function changeRuleField(group: FilterGroup, rule: FilterRule, chosen: string): void {
	const field = chosen === "property" ? "property" : FILE_FIELDS.find((candidate) => candidate === chosen);
	const index = group.items.indexOf(rule);
	if (field === undefined || index === -1 || ruleField(rule) === field) return;
	const replacement = newRule(field);
	if (replacement.kind === "file" && conditionFits(rule.condition, FILE_FIELD_TYPES[replacement.field])) replacement.condition = rule.condition;
	group.items[index] = replacement;
}

export function writeMode(group: FilterGroup, mode: string): void {
	const chosen = FILTER_MODES.find((candidate) => candidate === mode);
	if (chosen) group.mode = chosen;
}

export function writeProperty(rule: PropertyRule, value: string): void {
	rule.property = value.trim();
}

export function fitRuleToProperty(rule: PropertyRule, types: Record<string, string>): void {
	if (rule.property === "") return;
	rule.condition = fitCondition(rule.condition, ruleValueType(rule, types));
}

export function inapplicableRule(rule: FilterRule, types: Record<string, string>): string | undefined {
	if (rule.kind !== "property") return undefined;
	if (conditionFits(rule.condition, ruleValueType(rule, types))) return undefined;
	return t("inapplicableRule", { operator: operatorLabel(rule.condition.operator), type: typeLabel(propertyType(types, rule.property)) });
}

export function inapplicableFilter(filter: FilterGroup, types: Record<string, string>): string | undefined {
	for (const rule of filterRules(filter)) {
		const warning = inapplicableRule(rule, types);
		if (warning) return warning;
	}
	return undefined;
}

export function filterSummary(filter: FilterGroup): string {
	const rules = filterRules(filter);
	if (rules.length === 0) return t("noConditionsYet");
	const [only] = filter.items;
	if (filter.mode === "all" && filter.items.length === 1 && only.kind !== "group") return describeRule(only);
	const { one, other } = SUMMARY_KEYS[filter.mode];
	return tCount(one, other, rules.length);
}

export function describeRule(rule: FilterRule): string {
	if (rule.kind === "file") {
		const names = valueShape(FILE_FIELD_TYPES[rule.field], rule.condition.operator) === "note";
		return `${fileFieldLabel(rule.field)} ${describeCondition(names ? { ...rule.condition, value: noteLabel(rule.condition.value) } : rule.condition)}`;
	}
	if (rule.property.trim() === "") return t("propertyNotChosen");
	return `${rule.property} ${describeCondition(rule.condition)}`;
}

function describeCondition(condition: Condition): string {
	const operator = operatorLabel(condition.operator);
	return condition.value === undefined ? operator : `${operator} ${describeConditionValue(condition.value)}`;
}

function describeConditionValue(value: ConditionValue): string {
	if (typeof value === "boolean") return t(value ? "booleanTrue" : "booleanFalse");
	if (Array.isArray(value)) return value.length === 0 ? "…" : value.join(t("listSeparator"));
	if (typeof value === "string") return value.trim() === "" ? "…" : noteName(value.trim());
	return describeValue(value);
}

function noteLabel(value: ConditionValue | undefined): ConditionValue | undefined {
	return typeof value === "string" ? (value.split("/").pop() ?? value).replace(/\.md$/, "") : value;
}

function noteName(value: string): string {
	const wikiLink = value.match(/^\[\[([^\]|]*)(?:\|[^\]]*)?\]\]$/);
	return wikiLink ? wikiLink[1] : value;
}

export function describeValue(value: number | DateValue): string {
	if (typeof value !== "object") return String(value);
	if (value.kind === "fixed") return value.date;
	if (value.days === 0) return t("relativeToday");
	const count = Math.abs(value.days);
	return value.days < 0 ? tCount("daysAgoOne", "daysAgoOther", count) : tCount("daysFromNowOne", "daysFromNowOther", count);
}

export function readConditionField(rule: FilterRule, field: ConditionField): unknown {
	const { condition } = rule;
	if (field === "operator") return condition.operator;
	const { value } = condition;
	if (field === "text") return typeof value === "string" ? value : undefined;
	if (field === "texts") return Array.isArray(value) ? value.join(", ") : undefined;
	if (field === "number") return typeof value === "number" ? value : undefined;
	if (field === "boolean") return typeof value === "boolean" ? value : undefined;
	if (!isDateValue(value)) return undefined;
	if (field === "dateMode") return value.kind;
	if (field === "date") return value.kind === "fixed" ? value.date : "";
	const days = value.kind === "relative" ? value.days : 0;
	if (field === "days") return Math.abs(days);
	return days < 0 ? "ago" : days > 0 ? "fromNow" : "today";
}

export function writeConditionField(rule: FilterRule, field: ConditionField, value: unknown, types: Record<string, string>): void {
	const type = ruleValueType(rule, types);
	const { condition } = rule;
	if (field === "operator") {
		const operator = OPERATORS_BY_TYPE[type].find((candidate) => candidate === value);
		if (operator) rule.condition = conditionFor(type, operator, condition);
		return;
	}
	const shape = valueShape(type, condition.operator);
	if (field === "text" && typeof value === "string" && shape !== undefined && !["none", "texts", "number", "date", "boolean"].includes(shape)) {
		rule.condition = { operator: condition.operator, value };
	} else if (field === "texts" && typeof value === "string" && shape === "texts") {
		rule.condition = { operator: condition.operator, value: splitValues(value) };
	} else if (field === "number" && typeof value === "number" && Number.isFinite(value) && shape === "number") {
		rule.condition = { operator: condition.operator, value };
	} else if (field === "boolean" && typeof value === "boolean" && shape === "boolean") {
		rule.condition = { operator: condition.operator, value };
	} else if (shape === "date" && isDateValue(condition.value)) {
		rule.condition = { operator: condition.operator, value: dateFor(condition.value, field, value) };
	}
}

function splitValues(text: string): string[] {
	return text
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item !== "");
}

function dateFor(date: DateValue, field: ConditionField, value: unknown): DateValue {
	const days = date.kind === "relative" ? date.days : 0;
	if (field === "dateMode") {
		if (value === date.kind) return date;
		return value === "fixed" ? { kind: "fixed", date: "" } : { kind: "relative", days: 0 };
	}
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

