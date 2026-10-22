import { test } from "node:test";
import { strict as assert } from "node:assert";
import { entryLabel, entryParts, matchesInOrder, rowLabel } from "../src/render.ts";
import type { JumpListEntry } from "../src/lists/vault.ts";

const file = { path: "notes/Project.md", basename: "Project", ctime: 0 };

test("labels an entry with its prefix and name", () => {
	const entry: JumpListEntry = { file, prefix: "🔗 out |", name: "Project" };
	assert.equal(entryLabel(entry), "🔗 out | Project");
});

test("keeps the prefix verbatim, inner spaces included", () => {
	const entry: JumpListEntry = { file, prefix: "🔗 in  |", name: "Project" };
	assert.equal(entryLabel(entry), "🔗 in  | Project");
});

test("labels an entry with an empty prefix by its name alone", () => {
	const entry: JumpListEntry = { file, prefix: "", name: "Project" };
	assert.equal(entryLabel(entry), "Project");
});

test("appends the suffix in parentheses", () => {
	const entry: JumpListEntry = { file, prefix: "📅 day |", name: "2024-03-05", suffix: "previous - Tue" };
	assert.equal(entryLabel(entry), "📅 day | 2024-03-05 (previous - Tue)");
});

test("an empty query matches every label", () => {
	assert.equal(matchesInOrder("", "🔗 out | Project"), true);
});

test("matches query characters that appear in order", () => {
	assert.equal(matchesInOrder("prj", "🔗 out | Project"), true);
	assert.equal(matchesInOrder("out pro", "🔗 out | Project"), true);
});

test("ignores case on both sides", () => {
	assert.equal(matchesInOrder("PROJ", "🔗 out | project"), true);
	assert.equal(matchesInOrder("proj", "🔗 out | PROJECT"), true);
});

test("rejects characters out of order or missing", () => {
	assert.equal(matchesInOrder("jp", "🔗 out | Project"), false);
	assert.equal(matchesInOrder("projects", "🔗 out | Project"), false);
});

test("matches emoji in the prefix", () => {
	assert.equal(matchesInOrder("📅2024", "📅 day | 2024-03-05"), true);
});

test("splits an entry into prefix, name and suffix parts", () => {
	const entry: JumpListEntry = { file, prefix: "📅 day |", name: "2024-03-05", suffix: "previous - Tue" };
	assert.deepEqual(entryParts(entry), { prefix: "📅 day |", content: "2024-03-05", value: "(previous - Tue)" });
	assert.deepEqual(entryParts({ file, prefix: "", name: "Project" }), { prefix: "", content: "Project" });
});

test("a row's label joins its non-empty parts with spaces", () => {
	assert.equal(rowLabel({ mark: "✓ •", prefix: "👤 peop |", content: "Ann", value: "x" }), "✓ • 👤 peop | Ann x");
	assert.equal(rowLabel({ mark: "", prefix: "", content: "Ann" }), "Ann");
});
