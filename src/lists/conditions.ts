export const PROPERTY_TYPES = ["text", "multitext", "tags", "aliases", "number", "checkbox", "date", "datetime"] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const VALUE_TYPES = ["text", "list", "number", "date", "boolean", "file"] as const;

export type ValueType = (typeof VALUE_TYPES)[number];

export const OPERATORS = [
	"is",
	"is not",
	"is exactly",
	"is not exactly",
	"=",
	"≠",
	"<",
	"≤",
	">",
	"≥",
	"on",
	"not on",
	"before",
	"on or before",
	"after",
	"on or after",
	"starts with",
	"does not start with",
	"ends with",
	"does not end with",
	"is empty",
	"is not empty",
	"contains",
	"does not contain",
	"contains any of",
	"does not contain any of",
	"contains all of",
	"does not contain all of",
	"links to",
	"does not link to",
	"in folder",
	"is not in folder",
	"has tag",
	"does not have tag",
	"has property",
	"does not have property",
] as const;

export type Operator = (typeof OPERATORS)[number];

export const OPERATORS_BY_TYPE: Record<ValueType, readonly Operator[]> = {
	text: [
		"is",
		"is not",
		"starts with",
		"ends with",
		"is empty",
		"contains",
		"contains any of",
		"contains all of",
		"does not start with",
		"does not end with",
		"is not empty",
		"does not contain",
		"does not contain any of",
		"does not contain all of",
	],
	list: [
		"is exactly",
		"is not exactly",
		"is empty",
		"contains",
		"contains any of",
		"contains all of",
		"is not empty",
		"does not contain",
		"does not contain any of",
		"does not contain all of",
	],
	number: ["=", "≠", "<", "≤", ">", "≥", "is empty", "is not empty"],
	date: ["on", "not on", "before", "on or before", "after", "on or after", "is empty", "is not empty"],
	boolean: ["is", "is not"],
	file: ["is", "is not", "links to", "in folder", "has tag", "has property", "does not link to", "is not in folder", "does not have tag", "does not have property"],
};

const PROPERTY_VALUE_TYPES: Record<PropertyType, ValueType> = {
	text: "text",
	multitext: "list",
	tags: "list",
	aliases: "list",
	number: "number",
	checkbox: "boolean",
	date: "date",
	datetime: "date",
};

export type DateValue = { kind: "fixed"; date: string } | { kind: "relative"; days: number };

export type ConditionValue = string | string[] | number | boolean | DateValue;

export interface Condition {
	operator: Operator;
	value?: ConditionValue;
}

export type ValueShape = "none" | "text" | "texts" | "number" | "date" | "boolean" | "note" | "folder" | "tag" | "property";

export const FIXED_DATE_FORMAT = "YYYY-MM-DD";

const NEGATED_OPERATORS: Partial<Record<Operator, Operator>> = {
	"is not": "is",
	"is not exactly": "is exactly",
	"≠": "=",
	"not on": "on",
	"does not start with": "starts with",
	"does not end with": "ends with",
	"is not empty": "is empty",
	"does not contain": "contains",
	"does not contain any of": "contains any of",
	"does not contain all of": "contains all of",
	"does not link to": "links to",
	"is not in folder": "in folder",
	"does not have tag": "has tag",
	"does not have property": "has property",
};

const LEGACY_OPERATORS: Record<string, Condition> = {
	"has item": { operator: "contains" },
	"does not have item": { operator: "does not contain" },
	"is set": { operator: "is not empty" },
	"is not set": { operator: "is empty" },
	"is true": { operator: "is", value: true },
	"is false": { operator: "is", value: false },
};

const LIST_VALUE_OPERATORS: readonly Operator[] = ["contains any of", "does not contain any of", "contains all of", "does not contain all of"];

const FILE_SHAPES: Partial<Record<Operator, ValueShape>> = {
	"in folder": "folder",
	"is not in folder": "folder",
	"has tag": "tag",
	"does not have tag": "tag",
	"has property": "property",
	"does not have property": "property",
};

export function propertyValueType(type: PropertyType): ValueType {
	return PROPERTY_VALUE_TYPES[type];
}

export function valueShape(type: ValueType, operator: Operator): ValueShape | undefined {
	if (!OPERATORS_BY_TYPE[type].includes(operator)) return undefined;
	if (operator === "is empty" || operator === "is not empty") return "none";
	switch (type) {
		case "text":
			return LIST_VALUE_OPERATORS.includes(operator) ? "texts" : "text";
		case "list":
			return LIST_VALUE_OPERATORS.includes(operator) || operator === "is exactly" || operator === "is not exactly" ? "texts" : "text";
		case "number":
			return "number";
		case "date":
			return "date";
		case "boolean":
			return "boolean";
		case "file":
			return FILE_SHAPES[operator] ?? "note";
	}
}

export function conditionFits(condition: Condition, type: ValueType): boolean {
	const shape = valueShape(type, condition.operator);
	return shape !== undefined && valueHasShape(condition.value, shape);
}

function valueHasShape(value: ConditionValue | undefined, shape: ValueShape): boolean {
	switch (shape) {
		case "none":
			return true;
		case "texts":
			return Array.isArray(value);
		case "number":
			return typeof value === "number";
		case "boolean":
			return typeof value === "boolean";
		case "date":
			return isDateValue(value);
		default:
			return typeof value === "string";
	}
}

export function conditionFor(type: ValueType, operator: Operator, previous?: Condition): Condition {
	const shape = valueShape(type, operator);
	if (shape === undefined || shape === "none") return { operator };
	return { operator, value: valueFor(shape, previous?.value) };
}

function valueFor(shape: Exclude<ValueShape, "none">, previous: ConditionValue | undefined): ConditionValue {
	switch (shape) {
		case "texts":
			if (Array.isArray(previous)) return previous;
			return typeof previous === "string" && previous.trim() !== "" ? [previous] : [];
		case "number":
			return typeof previous === "number" ? previous : 0;
		case "boolean":
			return typeof previous === "boolean" ? previous : true;
		case "date":
			return isDateValue(previous) ? previous : { kind: "relative", days: 0 };
		default:
			if (typeof previous === "string") return previous;
			return Array.isArray(previous) ? (previous[0] ?? "") : "";
	}
}

export function defaultCondition(type: ValueType): Condition {
	switch (type) {
		case "number":
			return { operator: "=", value: 0 };
		case "date":
			return { operator: "after", value: { kind: "relative", days: -7 } };
		case "boolean":
			return { operator: "is", value: true };
		case "file":
			return { operator: "links to", value: "" };
		default:
			return { operator: "contains", value: "" };
	}
}

export function fitCondition(condition: Condition, type: ValueType): Condition {
	if (conditionFits(condition, type)) return condition;
	const fallback = defaultCondition(type);
	const operator = OPERATORS_BY_TYPE[type].includes(condition.operator) ? condition.operator : fallback.operator;
	return conditionFor(type, operator, condition.value === undefined ? fallback : condition);
}

export function positiveOperator(operator: Operator): Operator | undefined {
	return NEGATED_OPERATORS[operator];
}

export function propertyType(types: Record<string, string>, property: string): PropertyType {
	const type = types[property.toLowerCase()];
	return isPropertyType(type) ? type : "text";
}

export function readCondition(stored: unknown): Condition | undefined {
	if (!isRecord(stored) || typeof stored.operator !== "string") return undefined;
	const legacy = Object.prototype.hasOwnProperty.call(LEGACY_OPERATORS, stored.operator) ? LEGACY_OPERATORS[stored.operator] : undefined;
	if (legacy) return legacy.value === undefined ? withValue(legacy.operator, stored.value) : { ...legacy };
	const operator = OPERATORS.find((candidate) => candidate === stored.operator);
	return operator ? withValue(operator, stored.value) : undefined;
}

function withValue(operator: Operator, stored: unknown): Condition | undefined {
	if (operator === "is empty" || operator === "is not empty") return { operator };
	if (stored === undefined) return undefined;
	const value = readValue(stored);
	return value === undefined ? undefined : { operator, value };
}

function readValue(stored: unknown): ConditionValue | undefined {
	if (typeof stored === "string" || typeof stored === "boolean") return stored;
	if (typeof stored === "number") return Number.isFinite(stored) ? stored : undefined;
	if (Array.isArray(stored)) return stored.every((item) => typeof item === "string") ? stored : undefined;
	return readDateValue(stored);
}

function readDateValue(stored: unknown): DateValue | undefined {
	if (!isRecord(stored)) return undefined;
	if (stored.kind === "fixed" && typeof stored.date === "string") return { kind: "fixed", date: stored.date };
	if (stored.kind === "relative" && typeof stored.days === "number" && Number.isInteger(stored.days)) {
		return { kind: "relative", days: stored.days };
	}
	return undefined;
}

export function isDateValue(value: unknown): value is DateValue {
	return readDateValue(value) !== undefined;
}

function isPropertyType(value: unknown): value is PropertyType {
	return typeof value === "string" && (PROPERTY_TYPES as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
