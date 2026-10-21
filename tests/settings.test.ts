import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
	OPERATORS,
	defaultSettings,
	isOperator,
	mergeSettings,
	newCustomList,
	operatorTakesValue,
} from "../src/settings.ts";

test("defaultSettings enables every built-in list with its prefix and has no custom lists", () => {
	assert.deepEqual(defaultSettings(), {
		builtIns: {
			linksIn: { enabled: true, prefix: "🔗 in " },
			linksOut: { enabled: true, prefix: "🔗 out" },
			sameDay: { enabled: true, prefix: "🔅 ctx" },
			adjacentDays: { enabled: true, prefix: "📅 day" },
		},
		customLists: [],
	});
});

test("mergeSettings falls back to the defaults when nothing is stored", () => {
	assert.deepEqual(mergeSettings(undefined), defaultSettings());
	assert.deepEqual(mergeSettings(null), defaultSettings());
	assert.deepEqual(mergeSettings("nonsense"), defaultSettings());
});

test("mergeSettings ignores keys it does not know", () => {
	assert.deepEqual(mergeSettings({ theme: "dark", builtIns: { recent: { enabled: false } } }), defaultSettings());
});

test("mergeSettings fills a partial built-in list from the defaults", () => {
	const merged = mergeSettings({ builtIns: { linksIn: { enabled: false }, sameDay: { prefix: "☀️" } } });
	assert.deepEqual(merged.builtIns.linksIn, { enabled: false, prefix: "🔗 in " });
	assert.deepEqual(merged.builtIns.sameDay, { enabled: true, prefix: "☀️" });
	assert.deepEqual(merged.builtIns.linksOut, defaultSettings().builtIns.linksOut);
});

test("mergeSettings replaces built-in values of the wrong type with the defaults", () => {
	const merged = mergeSettings({ builtIns: { adjacentDays: { enabled: "yes", prefix: 7 } } });
	assert.deepEqual(merged.builtIns.adjacentDays, defaultSettings().builtIns.adjacentDays);
});

test("mergeSettings takes the custom lists as saved", () => {
	const customLists = [
		{ prefix: "📚", property: "type", operator: "equals", value: "book" },
		{ prefix: "⭐", property: "starred", operator: "is true", value: "" },
	];
	assert.deepEqual(mergeSettings({ customLists }).customLists, customLists);
});

test("mergeSettings starts with no custom lists when the saved ones are not a list", () => {
	assert.deepEqual(mergeSettings({ customLists: { prefix: "📚" } }).customLists, []);
});

test("mergeSettings returns fresh defaults that callers can change without affecting later merges", () => {
	mergeSettings(undefined).customLists.push({ prefix: "x", property: "p", operator: "exists", value: "" });
	assert.deepEqual(mergeSettings(undefined).customLists, []);
});

test("operatorTakesValue is true only for the operators that compare against a value", () => {
	assert.deepEqual(
		OPERATORS.filter((operator) => operatorTakesValue(operator)),
		["equals", "contains"],
	);
});

test("isOperator accepts every listed operator and nothing else", () => {
	for (const operator of OPERATORS) assert.equal(isOperator(operator), true);
	assert.equal(isOperator("matches"), false);
	assert.equal(isOperator(""), false);
});

test("newCustomList returns an empty list that needs no value and is fresh each time", () => {
	const list = newCustomList();
	assert.deepEqual(list, { prefix: "", property: "", operator: "is true", value: "" });
	assert.equal(operatorTakesValue(list.operator), false);
	assert.notEqual(newCustomList(), list);
});
