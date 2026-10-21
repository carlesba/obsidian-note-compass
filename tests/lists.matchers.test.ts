import { test } from "node:test";
import { strict as assert } from "node:assert";
import { matchesCustomList } from "../src/lists/matchers.ts";
import type { CustomList, CustomListOperator } from "../src/settings.ts";

const list = (operator: CustomListOperator, value = ""): CustomList => ({ prefix: "📍 act", property: "status", operator, value });

test("a note without frontmatter or without the property matches no operator", () => {
	for (const operator of ["is true", "equals", "contains", "exists"] as const) {
		assert.equal(matchesCustomList(undefined, list(operator, "x")), false);
		assert.equal(matchesCustomList({ other: "x" }, list(operator, "x")), false);
	}
});

test("is true matches the boolean true or the string true", () => {
	assert.equal(matchesCustomList({ status: true }, list("is true")), true);
	assert.equal(matchesCustomList({ status: "true" }, list("is true")), true);
	assert.equal(matchesCustomList({ status: false }, list("is true")), false);
	assert.equal(matchesCustomList({ status: "yes" }, list("is true")), false);
});

test("equals compares the property as a string", () => {
	assert.equal(matchesCustomList({ status: "open" }, list("equals", "open")), true);
	assert.equal(matchesCustomList({ status: 3 }, list("equals", "3")), true);
	assert.equal(matchesCustomList({ status: true }, list("equals", "true")), true);
	assert.equal(matchesCustomList({ status: "opened" }, list("equals", "open")), false);
	assert.equal(matchesCustomList({ status: null }, list("equals", "null")), false);
});

test("contains matches a list element equal to the value", () => {
	assert.equal(matchesCustomList({ status: ["open", "urgent"] }, list("contains", "urgent")), true);
	assert.equal(matchesCustomList({ status: [1, 2] }, list("contains", "2")), true);
	assert.equal(matchesCustomList({ status: ["urgently"] }, list("contains", "urgent")), false);
});

test("contains matches a string property that contains the value", () => {
	assert.equal(matchesCustomList({ status: "open and urgent" }, list("contains", "urgent")), true);
	assert.equal(matchesCustomList({ status: "open" }, list("contains", "urgent")), false);
	assert.equal(matchesCustomList({ status: 42 }, list("contains", "4")), false);
});

test("contains compares wiki-links by their link text", () => {
	assert.equal(matchesCustomList({ status: ["[[Foo]]"] }, list("contains", "Foo")), true);
	assert.equal(matchesCustomList({ status: ["[[Foo|alias]]"] }, list("contains", "Foo")), true);
	assert.equal(matchesCustomList({ status: ["[[Foo|alias]]"] }, list("contains", "[[Foo]]")), true);
	assert.equal(matchesCustomList({ status: "[[Foo|alias]]" }, list("contains", "Foo")), true);
	assert.equal(matchesCustomList({ status: ["[[Foobar]]"] }, list("contains", "Foo")), false);
});

test("exists matches a present property that is not null", () => {
	assert.equal(matchesCustomList({ status: "" }, list("exists")), true);
	assert.equal(matchesCustomList({ status: false }, list("exists")), true);
	assert.equal(matchesCustomList({ status: null }, list("exists")), false);
});
