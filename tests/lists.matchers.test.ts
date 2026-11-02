import { test } from "node:test";
import { strict as assert } from "node:assert";
import { OPERATORS_BY_TYPE, PROPERTY_TYPES, conditionFits, propertyType, propertyValueType, readCondition, valueShape } from "../src/lists/conditions.ts";
import type { Condition, PropertyType } from "../src/lists/conditions.ts";
import { matchesCondition } from "../src/lists/matchers.ts";
import type { Frontmatter } from "../src/lists/vault.ts";
import { moment } from "./moment.ts";

const TODAY = moment(new Date(2024, 2, 9, 15, 45).getTime()).startOf("day");

const matches = (frontmatter: Frontmatter | undefined, type: PropertyType, condition: Condition) =>
	matchesCondition(frontmatter, { property: "status", condition, type, today: TODAY });

const SAMPLE_VALUES: Record<string, Condition["value"]> = { none: undefined, text: "x", texts: ["x"], number: 1, date: { kind: "relative", days: 0 }, boolean: true };

test("a note without frontmatter or without the property matches only is empty and the negated conditions", () => {
	for (const type of PROPERTY_TYPES) {
		const valueType = propertyValueType(type);
		for (const operator of OPERATORS_BY_TYPE[valueType]) {
			const value = SAMPLE_VALUES[valueShape(valueType, operator) ?? "none"];
			const condition: Condition = value === undefined ? { operator } : { operator, value };
			const expected = operator === "is empty" || (operator !== "is not empty" && /not|≠/.test(operator));
			assert.equal(matches(undefined, type, condition), expected, `${type} ${operator}`);
			assert.equal(matches({ other: "x" }, type, condition), expected, `${type} ${operator}`);
		}
	}
});

test("each property type offers the operators Bases offers for its value type", () => {
	assert.deepEqual(OPERATORS_BY_TYPE[propertyValueType("text")], [
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
	]);
	for (const type of ["multitext", "tags", "aliases"] as const) assert.equal(propertyValueType(type), "list");
	assert.deepEqual(OPERATORS_BY_TYPE.list.slice(0, 3), ["is exactly", "is not exactly", "is empty"]);
	assert.deepEqual(OPERATORS_BY_TYPE[propertyValueType("number")], ["=", "≠", "<", "≤", ">", "≥", "is empty", "is not empty"]);
	assert.deepEqual(OPERATORS_BY_TYPE[propertyValueType("datetime")], ["on", "not on", "before", "on or before", "after", "on or after", "is empty", "is not empty"]);
	assert.deepEqual(OPERATORS_BY_TYPE[propertyValueType("checkbox")], ["is", "is not"]);
});

test("a condition the property's type does not offer matches nothing", () => {
	assert.equal(matches({ status: "open" }, "checkbox", { operator: "is", value: "open" }), false);
	assert.equal(matches({ status: 3 }, "text", { operator: "=", value: 3 }), false);
	assert.equal(matches({ status: "2024-03-09" }, "number", { operator: "on", value: { kind: "fixed", date: "2024-03-09" } }), false);
	assert.equal(matches({ status: "open" }, "checkbox", { operator: "is not", value: "x" }), false);
	assert.equal(matches({ status: ["a"] }, "multitext", { operator: "starts with", value: "a" }), false);
	assert.equal(conditionFits({ operator: "contains any of", value: "a" }, "text"), false);
	assert.equal(conditionFits({ operator: "contains any of", value: ["a"] }, "text"), true);
});

test("checkbox is true matches true or the string true, and is false an explicit false", () => {
	assert.equal(matches({ status: true }, "checkbox", { operator: "is", value: true }), true);
	assert.equal(matches({ status: "true" }, "checkbox", { operator: "is", value: true }), true);
	assert.equal(matches({ status: false }, "checkbox", { operator: "is", value: true }), false);
	assert.equal(matches({ status: false }, "checkbox", { operator: "is", value: false }), true);
	assert.equal(matches({ status: null }, "checkbox", { operator: "is", value: false }), false);
	assert.equal(matches({}, "checkbox", { operator: "is", value: false }), false);
	assert.equal(matches({}, "checkbox", { operator: "is not", value: true }), true);
});

test("is empty and is not empty split present values from absent or empty ones", () => {
	for (const type of ["text", "multitext"] as const) {
		for (const empty of [null, "", "  ", []]) {
			if (type === "text" && Array.isArray(empty)) continue;
			assert.equal(matches({ status: empty }, type, { operator: "is not empty" }), false, `${type} ${JSON.stringify(empty)}`);
			assert.equal(matches({ status: empty }, type, { operator: "is empty" }), true, `${type} ${JSON.stringify(empty)}`);
		}
		for (const present of [false, "open", 0]) {
			assert.equal(matches({ status: present }, type, { operator: "is not empty" }), true);
			assert.equal(matches({ status: present }, type, { operator: "is empty" }), false);
		}
	}
	assert.equal(matches({ status: ["a"] }, "multitext", { operator: "is not empty" }), true);
	assert.equal(matches({ status: 0 }, "number", { operator: "is not empty" }), true);
	assert.equal(matches({ status: "2024-03-09" }, "date", { operator: "is not empty" }), true);
	assert.equal(matches({ status: null }, "date", { operator: "is empty" }), true);
});

test("text is compares the whole value exactly", () => {
	assert.equal(matches({ status: "open" }, "text", { operator: "is", value: "open" }), true);
	assert.equal(matches({ status: 3 }, "text", { operator: "is", value: "3" }), true);
	assert.equal(matches({ status: true }, "text", { operator: "is", value: "true" }), true);
	assert.equal(matches({ status: "Open" }, "text", { operator: "is", value: "open" }), false);
	assert.equal(matches({ status: "opened" }, "text", { operator: "is", value: "open" }), false);
	assert.equal(matches({ status: null }, "text", { operator: "is", value: "null" }), false);
});

test("text contains ignores case, while starts with and ends with respect it, as in Bases", () => {
	assert.equal(matches({ status: "Open and URGENT" }, "text", { operator: "contains", value: "urgent" }), true);
	assert.equal(matches({ status: "open" }, "text", { operator: "contains", value: "urgent" }), false);
	assert.equal(matches({ status: 42 }, "text", { operator: "contains", value: "4" }), true);
	assert.equal(matches({ status: "Open" }, "text", { operator: "starts with", value: "Op" }), true);
	assert.equal(matches({ status: "Open" }, "text", { operator: "starts with", value: "op" }), false);
	assert.equal(matches({ status: "Open" }, "text", { operator: "ends with", value: "EN" }), false);
	assert.equal(matches({ status: "a, b and c" }, "text", { operator: "contains any of", value: ["x", "B"] }), true);
	assert.equal(matches({ status: "a, b and c" }, "text", { operator: "contains all of", value: ["a", "x"] }), false);
	assert.equal(matches({ status: "a, b and c" }, "text", { operator: "does not contain any of", value: ["x", "y"] }), true);
});

test("list contains matches an element equal to the value for every list type", () => {
	for (const type of ["multitext", "tags", "aliases"] as const) {
		assert.equal(matches({ status: ["open", "urgent"] }, type, { operator: "contains", value: "urgent" }), true);
		assert.equal(matches({ status: [1, 2] }, type, { operator: "contains", value: "2" }), true);
		assert.equal(matches({ status: ["urgently"] }, type, { operator: "contains", value: "urgent" }), false);
		assert.equal(matches({ status: "urgent" }, type, { operator: "contains", value: "urgent" }), true);
	}
});

test("list contains any of, all of and is exactly compare whole elements", () => {
	const list = (condition: Condition) => matches({ status: ["a", "[[B]]", "c"] }, "multitext", condition);
	assert.equal(list({ operator: "contains any of", value: ["x", "B"] }), true);
	assert.equal(list({ operator: "contains any of", value: ["x", "y"] }), false);
	assert.equal(list({ operator: "contains all of", value: ["a", "c"] }), true);
	assert.equal(list({ operator: "contains all of", value: ["a", "x"] }), false);
	assert.equal(list({ operator: "does not contain all of", value: ["a", "x"] }), true);
	assert.equal(list({ operator: "is exactly", value: ["a", "B", "c"] }), true);
	assert.equal(list({ operator: "is exactly", value: ["c", "B", "a"] }), false);
	assert.equal(list({ operator: "is not exactly", value: ["a"] }), true);
});

test("list contains compares wiki-links by their link text", () => {
	const contains = (status: unknown, value: string) => matches({ status }, "multitext", { operator: "contains", value });
	assert.equal(contains(["[[Foo]]"], "Foo"), true);
	assert.equal(contains(["[[Foo|alias]]"], "Foo"), true);
	assert.equal(contains(["[[Foo|alias]]"], "[[Foo]]"), true);
	assert.equal(contains("[[Foo|alias]]", "Foo"), true);
	assert.equal(contains(["[[Foobar]]"], "Foo"), false);
});

test("number conditions compare numbers and numeric strings", () => {
	assert.equal(matches({ status: 3 }, "number", { operator: "=", value: 3 }), true);
	assert.equal(matches({ status: "3" }, "number", { operator: "=", value: 3 }), true);
	assert.equal(matches({ status: 4 }, "number", { operator: "=", value: 3 }), false);
	assert.equal(matches({ status: 2 }, "number", { operator: "<", value: 3 }), true);
	assert.equal(matches({ status: 3 }, "number", { operator: "<", value: 3 }), false);
	assert.equal(matches({ status: 3 }, "number", { operator: "≤", value: 3 }), true);
	assert.equal(matches({ status: 4 }, "number", { operator: ">", value: 3 }), true);
	assert.equal(matches({ status: 3 }, "number", { operator: ">", value: 3 }), false);
	assert.equal(matches({ status: 3 }, "number", { operator: "≥", value: 3 }), true);
	assert.equal(matches({ status: "" }, "number", { operator: "<", value: 3 }), false);
	assert.equal(matches({ status: "many" }, "number", { operator: ">", value: 3 }), false);
});

test("date conditions compare the day against a fixed date", () => {
	const fixed = (date: string) => ({ kind: "fixed" as const, date });
	for (const type of ["date", "datetime"] as const) {
		assert.equal(matches({ status: "2024-03-05" }, type, { operator: "on", value: fixed("2024-03-05") }), true);
		assert.equal(matches({ status: "2024-03-05T23:10" }, type, { operator: "on", value: fixed("2024-03-05") }), true);
		assert.equal(matches({ status: "2024-03-04" }, type, { operator: "before", value: fixed("2024-03-05") }), true);
		assert.equal(matches({ status: "2024-03-05" }, type, { operator: "before", value: fixed("2024-03-05") }), false);
		assert.equal(matches({ status: "2024-03-05" }, type, { operator: "on or before", value: fixed("2024-03-05") }), true);
		assert.equal(matches({ status: "2024-03-06T00:00" }, type, { operator: "after", value: fixed("2024-03-05") }), true);
		assert.equal(matches({ status: "2024-03-05" }, type, { operator: "after", value: fixed("2024-03-05") }), false);
		assert.equal(matches({ status: "2024-03-05" }, type, { operator: "on or after", value: fixed("2024-03-05") }), true);
		assert.equal(matches({ status: "soon" }, type, { operator: "on", value: fixed("2024-03-05") }), false);
		assert.equal(matches({ status: "2024-03-05" }, type, { operator: "on", value: fixed("March 5") }), false);
	}
});

test("relative date conditions count days from local midnight of the clock's day", () => {
	const relative = (days: number) => ({ kind: "relative" as const, days });
	assert.equal(matches({ status: "2024-03-09" }, "date", { operator: "on", value: relative(0) }), true);
	assert.equal(matches({ status: "2024-03-09T08:00" }, "datetime", { operator: "on", value: relative(0) }), true);
	assert.equal(matches({ status: "2024-03-02" }, "date", { operator: "on", value: relative(-7) }), true);
	assert.equal(matches({ status: "2024-03-12" }, "date", { operator: "after", value: relative(2) }), true);
	assert.equal(matches({ status: "2024-03-11" }, "date", { operator: "after", value: relative(2) }), false);
	assert.equal(matches({ status: "2024-03-08" }, "date", { operator: "before", value: relative(0) }), true);
	assert.equal(matches({ status: "2024-04-01" }, "date", { operator: "on", value: relative(23) }), true);
});

test("propertyType looks the name up lowercased and reads unknown types as text", () => {
	const types = { status: "checkbox", due: "date", odd: "canvas" };
	assert.equal(propertyType(types, "Status"), "checkbox");
	assert.equal(propertyType(types, "due"), "date");
	assert.equal(propertyType(types, "odd"), "text");
	assert.equal(propertyType(types, "missing"), "text");
	assert.equal(propertyType({}, "status"), "text");
});

test("readCondition keeps well-formed conditions, renames the earlier operators and rejects the rest", () => {
	assert.deepEqual(readCondition({ operator: "is", value: "open" }), { operator: "is", value: "open" });
	assert.deepEqual(readCondition({ operator: ">", value: 2 }), { operator: ">", value: 2 });
	assert.deepEqual(readCondition({ operator: "contains any of", value: ["a", "b"] }), { operator: "contains any of", value: ["a", "b"] });
	assert.deepEqual(readCondition({ operator: "is empty" }), { operator: "is empty" });
	assert.deepEqual(readCondition({ operator: "on", value: { kind: "relative", days: -3 } }), {
		operator: "on",
		value: { kind: "relative", days: -3 },
	});
	assert.deepEqual(readCondition({ operator: "before", value: { kind: "fixed", date: "2024-03-05" } }), {
		operator: "before",
		value: { kind: "fixed", date: "2024-03-05" },
	});
	assert.deepEqual(readCondition({ operator: "is false", value: "ignored" }), { operator: "is", value: false });
	assert.deepEqual(readCondition({ operator: "is set" }), { operator: "is not empty" });
	assert.deepEqual(readCondition({ operator: "has item", value: "a" }), { operator: "contains", value: "a" });
	assert.equal(readCondition({ operator: "<", value: Infinity }), undefined);
	assert.equal(readCondition({ operator: "contains any of", value: ["a", 1] }), undefined);
	assert.equal(readCondition({ operator: "on", value: { kind: "relative", days: 1.5 } }), undefined);
	assert.equal(readCondition({ operator: "matches", value: "x" }), undefined);
	assert.equal(readCondition("is true"), undefined);
});

test("negated conditions match exactly the notes their positive condition does not", () => {
	const day = (date: string) => ({ kind: "fixed", date }) as const;
	assert.equal(matches({ status: "open" }, "text", { operator: "is not", value: "open" }), false);
	assert.equal(matches({ status: "closed" }, "text", { operator: "is not", value: "open" }), true);
	assert.equal(matches({ status: "reopened" }, "text", { operator: "does not contain", value: "open" }), false);
	assert.equal(matches({ status: "closed" }, "text", { operator: "does not contain", value: "open" }), true);
	assert.equal(matches({ status: "closed" }, "text", { operator: "does not start with", value: "clo" }), false);
	assert.equal(matches({ status: ["[[Ann]]", "Bob"] }, "multitext", { operator: "does not contain", value: "Ann" }), false);
	assert.equal(matches({ status: ["Bob"] }, "multitext", { operator: "does not contain", value: "Ann" }), true);
	assert.equal(matches({ status: 3 }, "number", { operator: "≠", value: 3 }), false);
	assert.equal(matches({ status: 4 }, "number", { operator: "≠", value: 3 }), true);
	assert.equal(matches({ status: "2024-03-09" }, "date", { operator: "not on", value: day("2024-03-09") }), false);
	assert.equal(matches({ status: "2024-03-08" }, "date", { operator: "not on", value: { kind: "relative", days: 0 } }), true);
});
