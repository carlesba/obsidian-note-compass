import {
	CONDITIONS_BY_TYPE,
	DATE_OPERATORS,
	NUMBER_OPERATORS,
	TEXT_OPERATORS,
	VALUELESS_OPERATORS,
	conditionAppliesTo,
	propertyType,
} from "../lists/conditions.ts";
import type { Condition, DateCondition, DateValue } from "../lists/conditions.ts";
import { FILTER_MODES, MAX_FILTER_DEPTH, filterRules } from "../lists/filters.ts";
import type { FileDateRule, FilterGroup, FilterMode, FilterNode, FilterRule, NegatableRule, PropertyRule } from "../lists/filters.ts";

export type RuleField = "property" | "folder" | "tag" | "linksTo" | "created" | "modified";

export type ConditionField = "operator" | "text" | "number" | "dateMode" | "date" | "days" | "direction";

export type ConditionRule = PropertyRule | FileDateRule;

export const FILTER_MODE_OPTIONS: Record<FilterMode, string> = {
	all: "All the following are true",
	any: "Any of the following are true",
	none: "None of the following are true",
};

export const RULE_FIELD_OPTIONS: Record<RuleField, string> = {
	property: "Property",
	folder: "Folder",
	tag: "Tag",
	linksTo: "Links to note",
	created: "Created",
	modified: "Modified",
};

export const FILE_DATE_OPTIONS: Record<string, string> = Object.fromEntries(DATE_OPERATORS.map((operator) => [operator, operator]));

const MODE_NAMES: Record<FilterMode, string> = { all: "All", any: "Any", none: "None" };

const FILE_DATE_NAMES = { created: "Created", modified: "Modified" };

export function ruleField(rule: FilterRule): RuleField {
	return rule.kind === "file" ? rule.field : rule.kind;
}

export function newRule(field: RuleField): FilterRule {
	switch (field) {
		case "property":
			return { kind: "property", property: "", condition: { operator: "is set" } };
		case "folder":
			return { kind: "folder", folder: "" };
		case "tag":
			return { kind: "tag", tag: "" };
		case "linksTo":
			return { kind: "linksTo", note: "" };
		case "created":
		case "modified":
			return { kind: "file", field, condition: { operator: "after", value: { kind: "relative", days: -7 } } };
	}
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
	const field = (Object.keys(RULE_FIELD_OPTIONS) as RuleField[]).find((candidate) => candidate === chosen);
	const index = group.items.indexOf(rule);
	if (field === undefined || index === -1 || ruleField(rule) === field) return;
	const replacement = newRule(field);
	if (rule.kind === "file" && replacement.kind === "file") replacement.condition = rule.condition;
	group.items[index] = replacement;
}

export function writeMode(group: FilterGroup, mode: string): void {
	const chosen = FILTER_MODES.find((candidate) => candidate === mode);
	if (chosen) group.mode = chosen;
}

export function ruleText(rule: FilterRule): string {
	switch (rule.kind) {
		case "property":
			return rule.property;
		case "folder":
			return rule.folder;
		case "tag":
			return rule.tag;
		case "linksTo":
			return rule.note;
		case "file":
			return "";
	}
}

export function writeRuleText(rule: FilterRule, value: string): void {
	const text = value.trim();
	if (rule.kind === "property") rule.property = text;
	else if (rule.kind === "folder") rule.folder = text;
	else if (rule.kind === "tag") rule.tag = text.replace(/^#/, "");
	else if (rule.kind === "linksTo") rule.note = text;
}

export function writeNegated(rule: NegatableRule, negated: boolean): void {
	if (negated) rule.negated = true;
	else delete rule.negated;
}

export function fitRuleToProperty(rule: PropertyRule, types: Record<string, string>): void {
	if (rule.property === "") return;
	const type = propertyType(types, rule.property);
	if (conditionAppliesTo(rule.condition.operator, type)) return;
	rule.condition = conditionFor(CONDITIONS_BY_TYPE[type][0], rule.condition);
}

export function inapplicableRule(rule: FilterRule, types: Record<string, string>): string | undefined {
	if (rule.kind !== "property") return undefined;
	const type = propertyType(types, rule.property);
	if (conditionAppliesTo(rule.condition.operator, type)) return undefined;
	return `"${rule.condition.operator}" does not apply to a ${type} property, so this condition matches nothing until you change it.`;
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
	if (rules.length === 0) return "No conditions yet";
	const [only] = filter.items;
	if (filter.mode === "all" && filter.items.length === 1 && only.kind !== "group") return describeRule(only);
	return `${MODE_NAMES[filter.mode]} of ${rules.length} ${rules.length === 1 ? "condition" : "conditions"}`;
}

export function describeRule(rule: FilterRule): string {
	switch (rule.kind) {
		case "property":
			if (rule.property.trim() === "") return "Property not chosen";
			return `${rule.property} ${describeCondition(rule.condition)}`;
		case "folder":
			return rule.folder === "" ? "Folder not chosen" : `${rule.negated ? "Not in" : "In"} ${rule.folder}`;
		case "tag": {
			const tag = rule.tag.trim().replace(/^#/, "");
			return tag === "" ? "Tag not chosen" : `${rule.negated ? "Not tagged" : "Tagged"} ${tag}`;
		}
		case "linksTo": {
			const name = rule.note.split("/").pop()?.replace(/\.md$/, "") ?? "";
			return name === "" ? "Note not chosen" : `${rule.negated ? "Does not link to" : "Links to"} ${name}`;
		}
		case "file":
			return `${FILE_DATE_NAMES[rule.field]} ${describeCondition(rule.condition)}`;
	}
}

function describeCondition(condition: Condition): string {
	return "value" in condition ? `${condition.operator} ${describeValue(condition.value)}` : condition.operator;
}

export function describeValue(value: string | number | DateValue): string {
	if (typeof value !== "object") return String(value);
	if (value.kind === "fixed") return value.date;
	if (value.days === 0) return "today";
	const days = Math.abs(value.days) === 1 ? "1 day" : `${Math.abs(value.days)} days`;
	return value.days < 0 ? `${days} ago` : `${days} from now`;
}

export function readConditionField(rule: ConditionRule, field: ConditionField): unknown {
	const { condition } = rule;
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

export function writeConditionField(rule: ConditionRule, field: ConditionField, value: unknown): void {
	if (rule.kind === "file") rule.condition = dateConditionFor(rule.condition, field, value);
	else rule.condition = propertyConditionFor(rule.condition, field, value);
}

function propertyConditionFor(condition: Condition, field: ConditionField, value: unknown): Condition {
	if (field === "operator") return typeof value === "string" ? conditionFor(value, condition) : condition;
	if (field === "text" && typeof value === "string" && includes(TEXT_OPERATORS, condition.operator)) {
		return { operator: condition.operator, value };
	}
	if (field === "number" && typeof value === "number" && Number.isFinite(value) && includes(NUMBER_OPERATORS, condition.operator)) {
		return { operator: condition.operator, value };
	}
	if (includes(DATE_OPERATORS, condition.operator) && "value" in condition && typeof condition.value === "object") {
		return { operator: condition.operator, value: dateFor(condition.value, field, value) };
	}
	return condition;
}

function dateConditionFor(condition: DateCondition, field: ConditionField, value: unknown): DateCondition {
	if (field === "operator") {
		return typeof value === "string" && includes(DATE_OPERATORS, value) ? { operator: value, value: condition.value } : condition;
	}
	return { operator: condition.operator, value: dateFor(condition.value, field, value) };
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

function conditionFor(operator: string, previous: Condition): Condition {
	const kept = "value" in previous ? previous.value : undefined;
	if (includes(TEXT_OPERATORS, operator)) return { operator, value: typeof kept === "string" ? kept : "" };
	if (includes(NUMBER_OPERATORS, operator)) return { operator, value: typeof kept === "number" ? kept : 0 };
	if (includes(DATE_OPERATORS, operator)) {
		return { operator, value: typeof kept === "object" ? kept : { kind: "relative", days: 0 } };
	}
	return includes(VALUELESS_OPERATORS, operator) ? { operator } : previous;
}

function includes<T extends string>(values: readonly T[], value: string): value is T {
	return (values as readonly string[]).includes(value);
}
