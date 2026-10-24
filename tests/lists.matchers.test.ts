import { test } from "node:test";
import { strict as assert } from "node:assert";
import { CONDITIONS_BY_TYPE, conditionAppliesTo, propertyType, readCondition } from "../src/lists/conditions.ts";
import type { Condition, PropertyType } from "../src/lists/conditions.ts";
import { matchesCondition } from "../src/lists/matchers.ts";
import type { Frontmatter } from "../src/lists/vault.ts";
import { moment } from "./moment.ts";

const TODAY = moment(new Date(2024, 2, 9, 15, 45).getTime()).startOf("day");

const matches = (frontmatter: Frontmatter | undefined, type: PropertyType, condition: Condition) =>
	matchesCondition(frontmatter, { property: "status", condition, type, today: TODAY });

test("a note without frontmatter or without the property matches only is not set and the negated conditions", () => {
	for (const [type, operators] of Object.entries(CONDITIONS_BY_TYPE) as [PropertyType, Condition["operator"][]][]) {
		for (const operator of operators) {
			const condition = { operator, value: "x" } as Condition;
			const expected = ["is not set", "is not", "does not contain", "does not have item", "≠", "not on"].includes(operator);
			assert.equal(matches(undefined, type, condition), expected, `${type} ${operator}`);
			assert.equal(matches({ other: "x" }, type, condition), expected, `${type} ${operator}`);
		}
	}
});

test("a condition the property's type does not offer matches nothing", () => {
	assert.equal(matches({ status: true }, "text", { operator: "is true" }), false);
	assert.equal(matches({ status: "open" }, "checkbox", { operator: "is", value: "open" }), false);
	assert.equal(matches({ status: 3 }, "text", { operator: "=", value: 3 }), false);
	assert.equal(matches({ status: "2024-03-09" }, "number", { operator: "on", value: { kind: "fixed", date: "2024-03-09" } }), false);
	assert.equal(conditionAppliesTo("has item", "text"), true);
	assert.equal(conditionAppliesTo("≠", "text"), false);
	assert.equal(matches({ status: "open" }, "checkbox", { operator: "is not", value: "x" }), false);
});

test("checkbox is true matches true or the string true, and is false only an explicit false", () => {
	assert.equal(matches({ status: true }, "checkbox", { operator: "is true" }), true);
	assert.equal(matches({ status: "true" }, "checkbox", { operator: "is true" }), true);
	assert.equal(matches({ status: false }, "checkbox", { operator: "is true" }), false);
	assert.equal(matches({ status: false }, "checkbox", { operator: "is false" }), true);
	assert.equal(matches({ status: "false" }, "checkbox", { operator: "is false" }), false);
	assert.equal(matches({ status: null }, "checkbox", { operator: "is false" }), false);
	assert.equal(matches({}, "checkbox", { operator: "is false" }), false);
});

test("is set and is not set split present values from absent or empty ones", () => {
	for (const type of ["checkbox", "text", "multitext"] as const) {
		for (const empty of [null, "", "  ", []]) {
			assert.equal(matches({ status: empty }, type, { operator: "is set" }), false);
			assert.equal(matches({ status: empty }, type, { operator: "is not set" }), true);
		}
		for (const present of [false, "open", ["a"]]) {
			assert.equal(matches({ status: present }, type, { operator: "is set" }), true);
			assert.equal(matches({ status: present }, type, { operator: "is not set" }), false);
		}
	}
	assert.equal(matches({ status: 0 }, "number", { operator: "is set" }), true);
	assert.equal(matches({ status: "2024-03-09" }, "date", { operator: "is set" }), true);
});

test("text is compares the property as a string", () => {
	assert.equal(matches({ status: "open" }, "text", { operator: "is", value: "open" }), true);
	assert.equal(matches({ status: 3 }, "text", { operator: "is", value: "3" }), true);
	assert.equal(matches({ status: true }, "text", { operator: "is", value: "true" }), true);
	assert.equal(matches({ status: "opened" }, "text", { operator: "is", value: "open" }), false);
	assert.equal(matches({ status: null }, "text", { operator: "is", value: "null" }), false);
});

test("text contains matches a substring", () => {
	assert.equal(matches({ status: "open and urgent" }, "text", { operator: "contains", value: "urgent" }), true);
	assert.equal(matches({ status: "open" }, "text", { operator: "contains", value: "urgent" }), false);
	assert.equal(matches({ status: 42 }, "text", { operator: "contains", value: "4" }), false);
});

test("has item matches a list element equal to the value for every list type", () => {
	for (const type of ["multitext", "tags", "aliases"] as const) {
		assert.equal(matches({ status: ["open", "urgent"] }, type, { operator: "has item", value: "urgent" }), true);
		assert.equal(matches({ status: [1, 2] }, type, { operator: "has item", value: "2" }), true);
		assert.equal(matches({ status: ["urgently"] }, type, { operator: "has item", value: "urgent" }), false);
	}
});

test("has item on a text value keeps matching a substring", () => {
	assert.equal(matches({ status: "open and urgent" }, "text", { operator: "has item", value: "urgent" }), true);
	assert.equal(matches({ status: "open" }, "multitext", { operator: "has item", value: "urgent" }), false);
	assert.equal(matches({ status: 42 }, "text", { operator: "has item", value: "4" }), false);
});

test("has item compares wiki-links by their link text", () => {
	const hasItem = (status: unknown, value: string) => matches({ status }, "multitext", { operator: "has item", value });
	assert.equal(hasItem(["[[Foo]]"], "Foo"), true);
	assert.equal(hasItem(["[[Foo|alias]]"], "Foo"), true);
	assert.equal(hasItem(["[[Foo|alias]]"], "[[Foo]]"), true);
	assert.equal(hasItem("[[Foo|alias]]", "Foo"), true);
	assert.equal(hasItem(["[[Foobar]]"], "Foo"), false);
});

test("number conditions compare numbers and numeric strings", () => {
	assert.equal(matches({ status: 3 }, "number", { operator: "=", value: 3 }), true);
	assert.equal(matches({ status: "3" }, "number", { operator: "=", value: 3 }), true);
	assert.equal(matches({ status: 4 }, "number", { operator: "=", value: 3 }), false);
	assert.equal(matches({ status: 2 }, "number", { operator: "<", value: 3 }), true);
	assert.equal(matches({ status: 3 }, "number", { operator: "<", value: 3 }), false);
	assert.equal(matches({ status: 4 }, "number", { operator: ">", value: 3 }), true);
	assert.equal(matches({ status: 3 }, "number", { operator: ">", value: 3 }), false);
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
		assert.equal(matches({ status: "2024-03-06T00:00" }, type, { operator: "after", value: fixed("2024-03-05") }), true);
		assert.equal(matches({ status: "2024-03-05" }, type, { operator: "after", value: fixed("2024-03-05") }), false);
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

test("readCondition keeps well-formed conditions and rejects the rest", () => {
	assert.deepEqual(readCondition({ operator: "is false", value: "ignored" }), { operator: "is false" });
	assert.deepEqual(readCondition({ operator: "is", value: "open" }), { operator: "is", value: "open" });
	assert.deepEqual(readCondition({ operator: ">", value: 2 }), { operator: ">", value: 2 });
	assert.deepEqual(readCondition({ operator: "on", value: { kind: "relative", days: -3 } }), {
		operator: "on",
		value: { kind: "relative", days: -3 },
	});
	assert.deepEqual(readCondition({ operator: "before", value: { kind: "fixed", date: "2024-03-05" } }), {
		operator: "before",
		value: { kind: "fixed", date: "2024-03-05" },
	});
	assert.equal(readCondition({ operator: "is", value: 3 }), undefined);
	assert.equal(readCondition({ operator: "<", value: "3" }), undefined);
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
	assert.equal(matches({ status: ["[[Ann]]", "Bob"] }, "multitext", { operator: "does not have item", value: "Ann" }), false);
	assert.equal(matches({ status: ["Bob"] }, "multitext", { operator: "does not have item", value: "Ann" }), true);
	assert.equal(matches({ status: 3 }, "number", { operator: "≠", value: 3 }), false);
	assert.equal(matches({ status: 4 }, "number", { operator: "≠", value: 3 }), true);
	assert.equal(matches({ status: "2024-03-09" }, "date", { operator: "not on", value: day("2024-03-09") }), false);
	assert.equal(matches({ status: "2024-03-08" }, "date", { operator: "not on", value: { kind: "relative", days: 0 } }), true);
});

test("is not set applies to numbers and dates", () => {
	assert.equal(matches({ status: 3 }, "number", { operator: "is not set" }), false);
	assert.equal(matches({ status: null }, "date", { operator: "is not set" }), true);
});
