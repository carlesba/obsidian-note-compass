import { FIXED_DATE_FORMAT, conditionFits, positiveOperator, propertyValueType } from "./conditions.ts";
import type { Condition, DateValue, PropertyType } from "./conditions.ts";
import type { Frontmatter, MomentDate } from "./vault";

export type Subject =
	| { type: "text"; value: string | undefined }
	| { type: "list"; items: string[] | undefined; normalize: (text: string) => string }
	| { type: "number"; value: number | undefined }
	| { type: "date"; day: string | undefined }
	| { type: "boolean"; value: boolean | undefined };

export interface PropertyCheck {
	property: string;
	condition: Condition;
	type: PropertyType;
	today: MomentDate;
}

export function matchesCondition(frontmatter: Frontmatter | undefined, check: PropertyCheck): boolean {
	const present = frontmatter !== undefined && check.property in frontmatter;
	const property = present ? frontmatter[check.property] : undefined;
	return matchesSubject(propertySubject(property, check.type), check.condition, check.today);
}

export function matchesSubject(subject: Subject, condition: Condition, today: MomentDate): boolean {
	if (!conditionFits(condition, subject.type)) return false;
	const positive = positiveOperator(condition.operator);
	if (positive) return !matchesSubject(subject, { ...condition, operator: positive }, today);
	if (condition.operator === "is empty") return isEmptySubject(subject);
	const { value } = condition;
	switch (subject.type) {
		case "text":
			return subject.value !== undefined && matchesText(subject.value, condition.operator, value);
		case "list":
			return subject.items !== undefined && matchesList(subject.items, subject.normalize, condition.operator, value);
		case "number":
			return subject.value !== undefined && typeof value === "number" && compareNumber(subject.value, condition.operator, value);
		case "date":
			return subject.day !== undefined && isDate(value) && compareDay(subject.day, condition.operator, targetDay(value, today));
		case "boolean":
			return subject.value !== undefined && subject.value === value;
	}
}

export function matchesDay(day: string, condition: Condition, today: MomentDate): boolean {
	return matchesSubject({ type: "date", day }, condition, today);
}

function propertySubject(property: unknown, type: PropertyType): Subject {
	const valueType = propertyValueType(type);
	if (valueType === "text" && Array.isArray(property)) return { type: "list", items: listItems(property), normalize: linkText };
	switch (valueType) {
		case "list":
			return { type: "list", items: listItems(property), normalize: linkText };
		case "number":
			return { type: "number", value: numberValue(property) };
		case "date":
			return { type: "date", day: typeof property === "string" ? property.match(/^\d{4}-\d{2}-\d{2}/)?.[0] : undefined };
		case "boolean":
			return { type: "boolean", value: property === true || property === "true" ? true : property === false || property === "false" ? false : undefined };
		default:
			return { type: "text", value: scalarText(property) };
	}
}

function isEmptySubject(subject: Subject): boolean {
	switch (subject.type) {
		case "text":
			return subject.value === undefined || subject.value.trim() === "";
		case "list":
			return subject.items === undefined || subject.items.length === 0;
		case "date":
			return subject.day === undefined;
		default:
			return subject.value === undefined;
	}
}

function matchesText(text: string, operator: Condition["operator"], value: Condition["value"]): boolean {
	if (Array.isArray(value)) {
		const wanted = value.map((item) => item.trim().toLowerCase()).filter((item) => item !== "");
		const lower = text.toLowerCase();
		if (wanted.length === 0) return false;
		return operator === "contains all of" ? wanted.every((item) => lower.includes(item)) : wanted.some((item) => lower.includes(item));
	}
	if (typeof value !== "string") return false;
	if (operator === "is") return text === value;
	if (value === "") return false;
	if (operator === "starts with") return text.startsWith(value);
	if (operator === "ends with") return text.endsWith(value);
	return text.toLowerCase().includes(value.toLowerCase());
}

function matchesList(items: string[], normalize: (text: string) => string, operator: Condition["operator"], value: Condition["value"]): boolean {
	const normalized = items.map(normalize);
	if (typeof value === "string") {
		const wanted = normalize(value.trim());
		return wanted !== "" && normalized.includes(wanted);
	}
	if (!Array.isArray(value)) return false;
	const wanted = value.map((item) => normalize(item.trim())).filter((item) => item !== "");
	if (operator === "is exactly") return wanted.length === normalized.length && wanted.every((item, index) => normalized[index] === item);
	if (wanted.length === 0) return false;
	return operator === "contains all of" ? wanted.every((item) => normalized.includes(item)) : wanted.some((item) => normalized.includes(item));
}

function listItems(property: unknown): string[] | undefined {
	if (property === null || property === undefined) return undefined;
	if (Array.isArray(property)) return property.map(scalarText).filter((item): item is string => item !== undefined);
	const text = scalarText(property);
	if (text === undefined) return undefined;
	return text.trim() === "" ? [] : [text];
}

function numberValue(property: unknown): number | undefined {
	const number = typeof property === "number" ? property : typeof property === "string" && property.trim() !== "" ? Number(property) : NaN;
	return Number.isFinite(number) ? number : undefined;
}

function compareNumber(number: number, operator: Condition["operator"], value: number): boolean {
	switch (operator) {
		case "=":
			return number === value;
		case "<":
			return number < value;
		case "≤":
			return number <= value;
		case ">":
			return number > value;
		case "≥":
			return number >= value;
		default:
			return false;
	}
}

function compareDay(day: string, operator: Condition["operator"], target: string | undefined): boolean {
	if (!target) return false;
	switch (operator) {
		case "on":
			return day === target;
		case "before":
			return day < target;
		case "on or before":
			return day <= target;
		case "after":
			return day > target;
		case "on or after":
			return day >= target;
		default:
			return false;
	}
}

function isDate(value: Condition["value"]): value is DateValue {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function targetDay(value: DateValue, today: MomentDate): string | undefined {
	if (value.kind === "relative") return today.clone().add(value.days, "day").format(FIXED_DATE_FORMAT);
	return /^\d{4}-\d{2}-\d{2}$/.test(value.date) ? value.date : undefined;
}

export function linkText(value: string): string {
	const wikiLink = value.trim().match(/^\[\[([^\]|]*)(?:\|[^\]]*)?\]\]$/);
	return wikiLink ? wikiLink[1].trim() : value;
}

function scalarText(value: unknown): string | undefined {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return undefined;
}
