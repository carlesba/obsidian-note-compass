import { test } from "node:test";
import { strict as assert } from "node:assert";
import { TYPE_A_NAME, creatableEntries, createChoices } from "../src/createNote/choices.ts";
import type { CreateChoice } from "../src/createNote/choices.ts";
import { createNote, createdNotice } from "../src/createNote/newNotes.ts";
import type { EditableProperty, EditablePropertyType, ListSource } from "../src/settings.ts";
import { fakeVault } from "./fakeVault.ts";
import type { FakeNote, FakeVaultOptions } from "./fakeVault.ts";

const PERSON = { kind: "linksToNote", note: "types/Person.md" } as const;

function vaultNotes(): FakeNote[] {
	return [
		{ path: "Today.md" },
		{ path: "types/Person.md" },
		{ path: "people/Ann.md", links: ["types/Person.md"] },
		{ path: "templates/Person.md", content: "# Person\n" },
		{ path: "templates/Linked.md", content: "type: [[types/Person]]" },
		{ path: "templates/Core.md", content: "# {{Title}}\n{{date}} {{TIME}} {{date:YYYY}} {{time:HH}} {{title}}" },
	];
}

function entry(property: string, type: EditablePropertyType, extra: Partial<EditableProperty> = {}): EditableProperty {
	return { id: property + type + (extra.prefix ?? ""), enabled: true, prefix: "", property, type, source: PERSON, ...extra };
}

function setup(properties: EditableProperty[], options: FakeVaultOptions = {}, fakes: FakeNote[] = vaultNotes()) {
	const vault = fakeVault(fakes, options);
	const entries = creatableEntries({ properties }, vault);
	return { vault, choicesFor: (query: string) => createChoices(entries, query) };
}

const labels = (choices: readonly CreateChoice[]) => choices.map((choice) => choice.label);

function pick(choices: readonly CreateChoice[], label: string) {
	const found = choices.find((choice) => choice.label === label);
	assert.ok(found, `no row ${label} in ${JSON.stringify(labels(choices))}`);
	assert.equal(found.action.action, "create");
	if (found.action.action !== "create") throw new Error("not a create row");
	return found.action.creation;
}

async function created(source: ListSource, extra: Partial<EditableProperty> = {}, options: FakeVaultOptions = {}, fakes = vaultNotes()) {
	const { vault, choicesFor } = setup([entry("people", "links", { prefix: "👤", source, ...extra })], options, fakes);
	const result = await createNote(vault, "Today.md", pick(choicesFor("Zed"), '➕ 👤 people create "Zed"'));
	return { vault, result, notice: createdNotice("Zed", result) };
}

test("each link entry whose source can hold a new note offers a row asking for a name", () => {
	const { choicesFor } = setup(
		[
			entry("people", "links", { prefix: "👤 peop |" }),
			entry("related", "links", { prefix: "🔅", source: { kind: "modifiedToday" } }),
			entry("related", "link", { prefix: "📁", source: { kind: "inFolder", folder: "areas" } }),
			entry("out", "links", { prefix: "🔗", source: { kind: "linksOut" } }),
			entry("big", "links", { source: { kind: "frontmatter", property: "rating", condition: { operator: ">", value: 3 } } }),
			entry("flag", "links", { source: { kind: "frontmatter", property: "flag", condition: { operator: "is set" } } }),
			entry("missing", "links", { source: { kind: "linksToNote", note: "Nowhere" } }),
			entry("active", "checkbox", { source: { kind: "modifiedToday" } }),
			entry("off", "links", { enabled: false }),
		],
		{ propertyTypes: { flag: "text" } },
	);
	const rows = choicesFor("");
	assert.deepEqual(labels(rows), [
		`👤 peop | people ${TYPE_A_NAME}`,
		`🔅 related ${TYPE_A_NAME}`,
		`📁 related ${TYPE_A_NAME}`,
	]);
	assert.deepEqual(rows[0].parts, { prefix: "👤 peop |", content: "people", value: TYPE_A_NAME });
	assert.deepEqual(rows[0].action, { action: "reopen" });
});

test("a typed name offers every entry a create row unless it starts with an entry's prefix", () => {
	const { choicesFor } = setup([
		entry("people", "links", { prefix: "👤 peop |" }),
		entry("related", "links", { prefix: "🔅 ctx |", source: { kind: "modifiedToday" } }),
	]);
	assert.deepEqual(labels(choicesFor("Zed")), ['➕ 👤 peop | people create "Zed"', '➕ 🔅 ctx | related create "Zed"']);
	assert.deepEqual(choicesFor("Zed")[0].parts, { mark: "➕", prefix: "👤 peop |", content: 'people create "Zed"' });
	assert.deepEqual(labels(choicesFor("peop john")), ['➕ 👤 peop | people create "john"']);
	assert.deepEqual(labels(choicesFor("👤 PEOP | John Doe")), ['➕ 👤 peop | people create "John Doe"']);
	assert.equal(pick(choicesFor("peop john"), '➕ 👤 peop | people create "john"').name, "john");
	assert.deepEqual(labels(choicesFor("people")), ['➕ 👤 peop | people create "people"', '➕ 🔅 ctx | related create "people"']);
	assert.deepEqual(labels(choicesFor("ctx ")), [`🔅 ctx | related ${TYPE_A_NAME}`]);
});

test("a name Obsidian cannot use as a file name shows only a row saying so", () => {
	const { choicesFor } = setup([entry("people", "links", { prefix: "👤" })]);
	for (const name of ["a/b", "what?", ".hidden", "x#y"]) {
		const rows = choicesFor(name);
		assert.deepEqual(labels(rows), [`"${name}" has characters Obsidian cannot use in a file name.`]);
		assert.deepEqual(rows[0].action, { action: "reopen" });
	}
});

test("a created note joins the entry's source", async () => {
	const linked = await created(PERSON);
	assert.equal(linked.vault.content("inbox/Zed.md"), "[[types/Person]]\n");
	assert.equal(linked.notice, 'Created "Zed" in inbox.');
	assert.equal((await created({ kind: "inFolder", folder: "people/" })).vault.content("people/Zed.md"), "");
	assert.equal((await created({ kind: "modifiedToday" })).vault.content("inbox/Zed.md"), "");
	const evergreen = await created({ kind: "frontmatter", property: "evergreen", condition: { operator: "is true" } });
	assert.deepEqual(evergreen.vault.frontmatter("inbox/Zed.md"), { evergreen: true });
	const kind = await created({ kind: "frontmatter", property: "kind", condition: { operator: "is", value: "person" } });
	assert.deepEqual(kind.vault.frontmatter("inbox/Zed.md"), { kind: "person" });
	const tags = await created({ kind: "frontmatter", property: "tags", condition: { operator: "has item", value: "people" } });
	assert.deepEqual(tags.vault.frontmatter("inbox/Zed.md"), { tags: ["people"] });
	const done = await created({ kind: "frontmatter", property: "done", condition: { operator: "is set" } }, {}, {
		propertyTypes: { done: "checkbox" },
	});
	assert.deepEqual(done.vault.frontmatter("inbox/Zed.md"), { done: true });
});

test("a created note goes to the source folder, then the entry's folder, then Obsidian's default", async () => {
	const folderWins = await created({ kind: "inFolder", folder: "people" }, { newNoteFolder: "elsewhere" });
	assert.ok(folderWins.vault.paths().includes("people/Zed.md"));
	const entryFolder = await created({ kind: "modifiedToday" }, { newNoteFolder: " /crm/ " });
	assert.equal(entryFolder.notice, 'Created "Zed" in crm.');
	const sources: (string | undefined)[] = [];
	const root = await created({ kind: "modifiedToday" }, {}, { defaultNoteFolder: (source) => (sources.push(source), "") });
	assert.ok(root.vault.paths().includes("Zed.md"));
	assert.equal(root.notice, 'Created "Zed" in the vault root.');
	assert.deepEqual(sources, ["Today.md"]);
	const { vault, choicesFor } = setup([entry("people", "links", { prefix: "👤" })], { defaultNoteFolder: (source) => source ?? "root" });
	await createNote(vault, undefined, pick(choicesFor("Zed"), '➕ 👤 people create "Zed"'));
	assert.ok(vault.paths().includes("root/Zed.md"));
});

test("an existing note at the path is left untouched", async () => {
	const existing = [...vaultNotes(), { path: "inbox/zed.md", content: "mine" }];
	const { vault, result, notice } = await created(PERSON, {}, {}, existing);
	assert.equal(result.outcome, "exists");
	assert.equal(notice, '"Zed" already exists.');
	assert.equal(vault.content("inbox/zed.md"), "mine");
	assert.equal(vault.paths().length, existing.length);
});

test("without Templater a template is copied with the core Templates placeholders filled in", async () => {
	const templated = await created(PERSON, { newNoteFolder: "people", newNoteTemplate: "templates/Person.md" });
	assert.equal(templated.vault.content("people/Zed.md"), "# Person\n\n[[types/Person]]\n");
	const linking = await created(PERSON, { newNoteTemplate: "templates/Linked" });
	assert.equal(linking.vault.content("inbox/Zed.md"), "type: [[types/Person]]");
	const core = await created({ kind: "modifiedToday" }, { newNoteTemplate: "templates/Core.md" });
	assert.equal(core.vault.content("inbox/Zed.md"), "# Zed\n2024-03-09 15:00 2024 15 Zed");
	const configured = await created(
		{ kind: "modifiedToday" },
		{ newNoteTemplate: "templates/Core.md" },
		{ coreTemplatesOptions: { dateFormat: "DD.MM.YYYY", timeFormat: "h A" } },
	);
	assert.equal(configured.vault.content("inbox/Zed.md"), "# Zed\n09.03.2024 3 PM 2024 15 Zed");
});

test("with Templater enabled a template runs through Templater and the note still joins the source", async () => {
	const templater = { calls: [] };
	const { vault, notice } = await created(
		PERSON,
		{ newNoteFolder: "people", newNoteTemplate: "templates/Person.md" },
		{ templater },
	);
	assert.deepEqual(templater.calls, [{ templatePath: "templates/Person.md", folder: "people", name: "Zed" }]);
	assert.equal(vault.content("people/Zed.md"), "ran # Person\n\n[[types/Person]]\n");
	assert.equal(notice, 'Created "Zed" in people.');
	const tagged = await created(
		{ kind: "frontmatter", property: "tags", condition: { operator: "has item", value: "people" } },
		{ newNoteTemplate: "templates/Core.md" },
		{ templater: { calls: [] } },
	);
	assert.equal(tagged.vault.content("inbox/Zed.md"), `ran ${vaultNotes()[5].content}`);
	assert.deepEqual(tagged.vault.frontmatter("inbox/Zed.md"), { tags: ["people"] });
});

test("Templater is not used without a template and a failed Templater run stops the creation", async () => {
	const unused = { calls: [] };
	assert.equal((await created(PERSON, {}, { templater: unused })).vault.content("inbox/Zed.md"), "[[types/Person]]\n");
	assert.deepEqual(unused.calls, []);
	for (const result of ["undefined", "throws"] as const) {
		const evergreen = { kind: "frontmatter", property: "evergreen", condition: { operator: "is true" } } as const;
		const failed = await created(evergreen, { newNoteTemplate: "templates/Person.md" }, { templater: { result, calls: [] } });
		assert.equal(failed.notice, 'Templater could not create "Zed".');
		assert.equal(failed.vault.paths().includes("inbox/Zed.md"), false);
	}
});
