export const PROPERTY_TYPES = ["text", "multitext", "tags", "aliases", "number", "checkbox", "date", "datetime"] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const VALUELESS_OPERATORS = ["is true", "is false", "is set", "is not set"] as const;
export const TEXT_OPERATORS = ["is", "is not", "contains", "does not contain", "has item", "does not have item"] as const;
export const NUMBER_OPERATORS = ["=", "≠", "<", ">"] as const;
export const DATE_OPERATORS = ["on", "not on", "before", "after"] as const;

export type ValuelessOperator = (typeof VALUELESS_OPERATORS)[number];
export type TextOperator = (typeof TEXT_OPERATORS)[number];
export type NumberOperator = (typeof NUMBER_OPERATORS)[number];
export type DateOperator = (typeof DATE_OPERATORS)[number];
export type ConditionOperator = ValuelessOperator | TextOperator | NumberOperator | DateOperator;

export type DateValue = { kind: "fixed"; date: string } | { kind: "relative"; days: number };

export type ValuelessCondition = { operator: ValuelessOperator };
export type TextCondition = { operator: TextOperator; value: string };
export type NumberCondition = { operator: NumberOperator; value: number };
export type DateCondition = { operator: DateOperator; value: DateValue };
export type Condition = ValuelessCondition | TextCondition | NumberCondition | DateCondition;

export const CONDITIONS_BY_TYPE: Record<PropertyType, readonly ConditionOperator[]> = {
	checkbox: ["is true", "is false", "is set", "is not set"],
	text: ["is", "is not", "contains", "does not contain", "is set", "is not set"],
	multitext: ["has item", "does not have item", "is set", "is not set"],
	tags: ["has item", "does not have item", "is set", "is not set"],
	aliases: ["has item", "does not have item", "is set", "is not set"],
	number: ["=", "≠", "<", ">", "is set", "is not set"],
	date: ["on", "not on", "before", "after", "is set", "is not set"],
	datetime: ["on", "not on", "before", "after", "is set", "is not set"],
};

export const FIXED_DATE_FORMAT = "YYYY-MM-DD";

export function conditionAppliesTo(operator: ConditionOperator, type: PropertyType): boolean {
	return CONDITIONS_BY_TYPE[type].includes(operator) || ((operator === "has item" || operator === "does not have item") && type === "text");
}

const POSITIVE_OPERATORS: Partial<Record<ConditionOperator, ConditionOperator>> = {
	"is not": "is",
	"does not contain": "contains",
	"does not have item": "has item",
	"≠": "=",
	"not on": "on",
};

export function positiveCondition(condition: Condition): Condition | undefined {
	const operator = POSITIVE_OPERATORS[condition.operator];
	return operator === undefined ? undefined : ({ ...condition, operator } as Condition);
}

export function propertyType(types: Record<string, string>, property: string): PropertyType {
	const type = types[property.toLowerCase()];
	return isPropertyType(type) ? type : "text";
}

export function isDateCondition(condition: Condition): condition is DateCondition {
	return includes(DATE_OPERATORS, condition.operator);
}

export function readCondition(stored: unknown): Condition | undefined {
	if (!isRecord(stored) || typeof stored.operator !== "string") return undefined;
	const { operator, value } = stored;
	if (includes(VALUELESS_OPERATORS, operator)) return { operator };
	if (includes(TEXT_OPERATORS, operator)) return typeof value === "string" ? { operator, value } : undefined;
	if (includes(NUMBER_OPERATORS, operator)) return typeof value === "number" && Number.isFinite(value) ? { operator, value } : undefined;
	if (includes(DATE_OPERATORS, operator)) {
		const date = readDateValue(value);
		return date ? { operator, value: date } : undefined;
	}
	return undefined;
}

function readDateValue(stored: unknown): DateValue | undefined {
	if (!isRecord(stored)) return undefined;
	if (stored.kind === "fixed" && typeof stored.date === "string") return { kind: "fixed", date: stored.date };
	if (stored.kind === "relative" && typeof stored.days === "number" && Number.isInteger(stored.days)) {
		return { kind: "relative", days: stored.days };
	}
	return undefined;
}

function isPropertyType(value: unknown): value is PropertyType {
	return typeof value === "string" && includes(PROPERTY_TYPES, value);
}

function includes<T extends string>(values: readonly T[], value: string): value is T {
	return (values as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
