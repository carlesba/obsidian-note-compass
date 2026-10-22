import { test } from "node:test";
import { strict as assert } from "node:assert";
import { entryLabel, entryParts, matchesInOrder, renderRow, rowLabel } from "../src/render.ts";
import type { RowParts } from "../src/render.ts";
import type { JumpListEntry } from "../src/lists/vault.ts";

const file = { path: "notes/Project.md", basename: "Project", ctime: 0 };

test("labels an entry with its prefix and name", () => {
	const entry: JumpListEntry = { file, prefix: "🔗 out", name: "Project" };
	assert.equal(entryLabel(entry, true), "🔗 out Project");
});

test("keeps the prefix verbatim, inner spaces included", () => {
	const entry: JumpListEntry = { file, prefix: "🔗  in", name: "Project" };
	assert.equal(entryLabel(entry, true), "🔗  in Project");
});

test("labels an entry with an empty prefix by its name alone", () => {
	const entry: JumpListEntry = { file, prefix: "", name: "Project" };
	assert.equal(entryLabel(entry, true), "Project");
});

test("appends the suffix in parentheses", () => {
	const entry: JumpListEntry = { file, prefix: "📅 day", name: "2024-03-05", suffix: "previous - Tue" };
	assert.equal(entryLabel(entry, true), "📅 day 2024-03-05 (previous - Tue)");
});

test("with prefixes hidden an entry is labelled and split without its prefix", () => {
	const entry: JumpListEntry = { file, prefix: "📅 day", name: "2024-03-05", suffix: "previous - Tue" };
	assert.equal(entryLabel(entry, false), "2024-03-05 (previous - Tue)");
	assert.deepEqual(entryParts(entry, false), { content: "2024-03-05", value: "(previous - Tue)" });
	assert.equal(matchesInOrder("day", entryLabel(entry, false)), false);
});

test("an empty query matches every label", () => {
	assert.equal(matchesInOrder("", "🔗 out Project"), true);
});

test("matches query characters that appear in order", () => {
	assert.equal(matchesInOrder("prj", "🔗 out Project"), true);
	assert.equal(matchesInOrder("out pro", "🔗 out Project"), true);
});

test("ignores case on both sides", () => {
	assert.equal(matchesInOrder("PROJ", "🔗 out project"), true);
	assert.equal(matchesInOrder("proj", "🔗 out PROJECT"), true);
});

test("rejects characters out of order or missing", () => {
	assert.equal(matchesInOrder("jp", "🔗 out Project"), false);
	assert.equal(matchesInOrder("projects", "🔗 out Project"), false);
});

test("matches emoji in the prefix", () => {
	assert.equal(matchesInOrder("📅2024", "📅 day 2024-03-05"), true);
});

test("splits an entry into prefix, name and suffix parts", () => {
	const entry: JumpListEntry = { file, prefix: "📅 day", name: "2024-03-05", suffix: "previous - Tue" };
	assert.deepEqual(entryParts(entry, true), { prefix: "📅 day", content: "2024-03-05", value: "(previous - Tue)" });
	assert.deepEqual(entryParts({ file, prefix: "", name: "Project" }, true), { prefix: "", content: "Project" });
});

test("a row's label joins its non-empty parts with spaces", () => {
	assert.equal(rowLabel({ mark: "✓ •", prefix: "👤 peop", content: "Ann", value: "x" }), "✓ • 👤 peop Ann x");
	assert.equal(rowLabel({ mark: "", prefix: "", content: "Ann" }), "Ann");
});

interface FakeElement {
	cls: string[];
	text?: string;
	props: Record<string, string>;
	children: FakeElement[];
}

function drawRow(parts: RowParts, reservesMarkColumn = false): FakeElement {
	const fake = (cls: string[] = [], text?: string): FakeElement => ({ cls, text, props: {}, children: [] });
	const wrap = (node: FakeElement): unknown => ({
		addClass: (...classes: string[]) => node.cls.push(...classes),
		toggleClass: (cls: string, on: boolean) => {
			node.cls = node.cls.filter((existing) => existing !== cls);
			if (on) node.cls.push(cls);
		},
		setCssProps: (props: Record<string, string>) => Object.assign(node.props, props),
		createSpan: (span: { cls: string; text?: string }) => {
			const child = fake([span.cls], span.text);
			node.children.push(child);
			return wrap(child);
		},
	});
	const row = fake();
	renderRow(wrap(row) as HTMLElement, parts, reservesMarkColumn);
	return row;
}

const texts = (node: FakeElement): string[] => [
	...(node.text !== undefined ? [`${node.cls[0]}: ${node.text}`] : []),
	...node.children.flatMap(texts),
];

test("a row draws its prefix part trimmed and leaves it out when blank", () => {
	const prefixed = drawRow({ prefix: " 🔗 out ", content: "Project", value: "x" });
	assert.deepEqual(prefixed.cls, ["note-compass-row", "has-prefix"]);
	assert.deepEqual(texts(prefixed), ["note-compass-chip-text: 🔗 out", "note-compass-row-content: Project", "note-compass-row-value: x"]);
	assert.deepEqual(prefixed.children.map((child) => child.cls[0]), ["note-compass-row-prefix", "note-compass-row-body"]);
	const blank = drawRow({ prefix: "  ", content: "Project" });
	assert.deepEqual(blank.cls, ["note-compass-row", "no-prefix"]);
	assert.deepEqual(texts(blank), ["note-compass-row-content: Project"]);
});

test("a row reserves an empty mark only when its picker has a mark column", () => {
	assert.deepEqual(texts(drawRow({ content: "Save" }, true)), ["note-compass-row-mark: ", "note-compass-row-content: Save"]);
	assert.deepEqual(texts(drawRow({ content: "Save" })), ["note-compass-row-content: Save"]);
});

test("a coloured prefix tints its chip through a CSS variable and a plain one does not", () => {
	const [colored] = drawRow({ prefix: "🔗", prefixColor: "#e0a030", content: "Project" }).children;
	assert.ok(colored.cls.includes("has-color"));
	assert.equal(colored.props["--note-compass-chip-color"], "#e0a030");
	const [plain] = drawRow({ prefix: "🔗", content: "Project" }).children;
	assert.ok(!plain.cls.includes("has-color"));
	assert.equal(plain.props["--note-compass-chip-color"] ?? "", "");
});

test("an entry's prefix colour joins its parts but never its label, and hides with the prefix", () => {
	const entry: JumpListEntry = { file, prefix: "🔗 out", prefixColor: "#e0a030", name: "Project" };
	assert.deepEqual(entryParts(entry, true), { prefix: "🔗 out", prefixColor: "#e0a030", content: "Project" });
	assert.equal(entryLabel(entry, true), "🔗 out Project");
	assert.deepEqual(entryParts(entry, false), { content: "Project" });
	assert.equal(rowLabel({ prefix: "🔗", prefixColor: "#fff", content: "Ann" }), "🔗 Ann");
});
