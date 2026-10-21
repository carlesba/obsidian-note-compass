import { FIXED_DATE_FORMAT, conditionAppliesTo } from "./conditions.ts";
import type { Condition, DateValue, PropertyType } from "./conditions.ts";
import type { Frontmatter, MomentDate } from "./vault";

export interface PropertyCheck {
	property: string;
	condition: Condition;
	type: PropertyType;
	today: MomentDate;
}

export function matchesCondition(frontmatter: Frontmatter | undefined, check: PropertyCheck): boolean {
	const { condition, type } = check;
	if (!conditionAppliesTo(condition.operator, type)) return false;
	const present = frontmatter !== undefined && check.property in frontmatter;
	const property = present ? frontmatter[check.property] : undefined;
	if (condition.operator === "is not set") return !present || isEmpty(property);
	if (!present) return false;
	switch (condition.operator) {
		case "is true":
			return property === true || property === "true";
		case "is false":
			return property === false;
		case "is set":
			return !isEmpty(property);
		case "is":
			return scalarText(property) === condition.value;
		case "contains":
			return typeof property === "string" && property.includes(condition.value);
		case "has item":
			return containsValue(property, linkText(condition.value));
		case "=":
		case "<":
		case ">":
			return compareNumber(property, condition.operator, condition.value);
		case "on":
		case "before":
		case "after":
			return compareDay(property, condition.operator, targetDay(condition.value, check.today));
	}
}

function isEmpty(property: unknown): boolean {
	if (property === null || property === undefined) return true;
	if (typeof property === "string") return property.trim() === "";
	return Array.isArray(property) && property.length === 0;
}

function compareNumber(property: unknown, operator: "=" | "<" | ">", value: number): boolean {
	const number = typeof property === "number" ? property : typeof property === "string" && property.trim() !== "" ? Number(property) : NaN;
	if (!Number.isFinite(number)) return false;
	if (operator === "=") return number === value;
	return operator === "<" ? number < value : number > value;
}

function compareDay(property: unknown, operator: "on" | "before" | "after", target: string | undefined): boolean {
	const day = typeof property === "string" ? property.match(/^\d{4}-\d{2}-\d{2}/)?.[0] : undefined;
	if (!day || !target) return false;
	if (operator === "on") return day === target;
	return operator === "before" ? day < target : day > target;
}

function targetDay(value: DateValue, today: MomentDate): string | undefined {
	if (value.kind === "relative") return today.clone().add(value.days, "day").format(FIXED_DATE_FORMAT);
	return /^\d{4}-\d{2}-\d{2}$/.test(value.date) ? value.date : undefined;
}

function containsValue(property: unknown, value: string): boolean {
	if (Array.isArray(property)) {
		return property.some((element) => {
			const text = scalarText(element);
			return text !== undefined && linkText(text) === value;
		});
	}
	if (typeof property === "string") return property.includes(value) || linkText(property) === value;
	return false;
}

function linkText(value: string): string {
	const wikiLink = value.trim().match(/^\[\[([^\]|]*)(?:\|[^\]]*)?\]\]$/);
	return wikiLink ? wikiLink[1].trim() : value;
}

function scalarText(value: unknown): string | undefined {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return undefined;
}
