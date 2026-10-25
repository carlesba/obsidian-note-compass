import { test } from "node:test";
import { strict as assert } from "node:assert";
import { duplicateEntry, duplicateName } from "../src/settings/duplicate.ts";

test("a duplicate lands right after its original with a new id and the same settings", () => {
	const entries = [
		{ id: "list-1", prefix: "📁 proj", tags: ["a"] },
		{ id: "list-2", prefix: "📅 due", tags: [] },
	];
	const copy = duplicateEntry(entries, entries[0]!, "list-3");
	assert.deepEqual(entries.map((entry) => entry.id), ["list-1", "list-3", "list-2"]);
	assert.deepEqual(copy, { id: "list-3", prefix: "📁 proj", tags: ["a"] });
});

test("a duplicate shares nothing with its original", () => {
	const entries = [{ id: "1", tags: ["a"] }];
	const copy = duplicateEntry(entries, entries[0]!, "2");
	copy?.tags.push("b");
	assert.deepEqual(entries[0]?.tags, ["a"]);
});

test("a duplicate can be adjusted before it is added", () => {
	const entries = [{ id: "1", name: "Reading log" }];
	duplicateEntry(entries, entries[0]!, "2", (copy) => (copy.name = duplicateName(copy.name)));
	assert.equal(entries[1]?.name, "Reading log copy");
});

test("an entry that is not in the list is not duplicated", () => {
	const entries = [{ id: "1" }];
	assert.equal(duplicateEntry(entries, { id: "9" }, "2"), undefined);
	assert.equal(entries.length, 1);
});

test("an unnamed entry's duplicate stays unnamed", () => {
	assert.equal(duplicateName("  "), "");
});
