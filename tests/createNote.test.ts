import { test } from "node:test";
import { strict as assert } from "node:assert";
import { ENTRY_PLACEHOLDER, TYPE_A_NAME, creatableEntries, entryChoices, nameChoices, namePlaceholder } from "../src/createNote/choices.ts";
import type { NameChoice } from "../src/createNote/choices.ts";
import { createNote, createdNotice, noteCreationBlocker } from "../src/createNote/newNotes.ts";
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
	return { id: property + type + (extra.prefix ?? ""), enabled: true, prefix: "", property, type, source: PERSON, createsNotes: true, ...extra };
}

function setup(properties: EditableProperty[], options: FakeVaultOptions = {}, fakes: FakeNote[] = vaultNotes(), sourcePath = "Today.md") {
	const vault = fakeVault(fakes, options);
	const entries = creatableEntries({ properties }, vault);
	const entryRows = (query = "") => entryChoices(entries, vault, sourcePath, query);
	const nameRows = (index: number, query: string) => nameChoices(entryRows()[index].creatable, vault, sourcePath, query);
	return { vault, entries, entryRows, nameRows };
}

const labels = (choices: readonly { label: string }[]) => choices.map((choice) => choice.label);

function creation(rows: readonly NameChoice[]) {
	assert.equal(rows.length, 1);
	const [row] = rows;
	if (row.action.action !== "create") throw new Error(`not a create row: ${row.label}`);
	return row.action.creation;
}

async function created(source: ListSource, extra: Partial<EditableProperty> = {}, options: FakeVaultOptions = {}, fakes = vaultNotes()) {
	const { vault, nameRows } = setup([entry("people", "links", { prefix: "👤", source, ...extra })], options, fakes);
	const result = await createNote(vault, "Today.md", creation(nameRows(0, "Zed")));
	return { vault, result, notice: createdNotice("Zed", result) };
}

test("the first step lists each link entry whose source can hold a new note with where it goes", () => {
	const { entryRows } = setup(
		[
			entry("people", "links", { prefix: "👤 peop |" }),
			entry("related", "links", { prefix: "🔅", source: { kind: "modifiedToday" }, newNoteFolder: "/crm/" }),
			entry("related", "link", { prefix: "📁", source: { kind: "inFolder", folder: "areas" } }),
			entry("out", "links", { prefix: "🔗", source: { kind: "linksOut" } }),
			entry("big", "links", { source: { kind: "frontmatter", property: "rating", condition: { operator: ">", value: 3 } } }),
			entry("flag", "links", { source: { kind: "frontmatter", property: "flag", condition: { operator: "is set" } } }),
			entry("missing", "links", { source: { kind: "linksToNote", note: "Nowhere" } }),
			entry("active", "checkbox", { source: { kind: "modifiedToday" } }),
			entry("off", "links", { enabled: false }),
		],
		{ propertyTypes: { flag: "text" }, defaultNoteFolder: () => "" },
	);
	const rows = entryRows();
	assert.deepEqual(labels(rows), ["👤 peop | people vault root", "🔅 related crm", "📁 related areas"]);
	assert.deepEqual(rows[0].parts, { prefix: "👤 peop |", content: "people", value: "vault root" });
	assert.deepEqual(labels(entryRows("rel")), ["🔅 related crm", "📁 related areas"]);
	assert.deepEqual(labels(entryRows("peop people")), ["👤 peop | people vault root"]);
	assert.deepEqual(labels(entryRows("zzz")), []);
	assert.equal(ENTRY_PLACEHOLDER, "Create a note for…");
});

test("the first step lists only the entries that allow creating notes", () => {
	const { entries } = setup([
		entry("people", "links", { prefix: "a", createsNotes: false }),
		entry("people", "links", { prefix: "b", createsNotes: undefined }),
		entry("people", "links", { prefix: "c" }),
	]);
	assert.deepEqual(entries.map((creatable) => creatable.entry.prefix), ["c"]);
	assert.deepEqual(setup([entry("people", "links", { createsNotes: false })]).entries, []);
});

test("a source that cannot create notes says why", () => {
	const types = { rating: "number", flag: "text", done: "checkbox" };
	const blocker = (source: ListSource) => noteCreationBlocker(source, types);
	assert.equal(blocker(PERSON), undefined);
	assert.equal(blocker({ kind: "modifiedToday" }), undefined);
	assert.equal(blocker({ kind: "inFolder", folder: "people" }), undefined);
	assert.equal(blocker({ kind: "frontmatter", property: "done", condition: { operator: "is set" } }), undefined);
	for (const kind of ["adjacentDates", "linksOut", "linksIn", "sameDay"] as const) {
		assert.equal(blocker({ kind }), "it lists notes by how they relate to the note in focus");
	}
	assert.equal(blocker({ kind: "inFolder", folder: " / " }), "choose a folder first");
	assert.equal(blocker({ kind: "linksToNote", note: "" }), "choose a note first");
	assert.equal(blocker({ kind: "frontmatter", property: "", condition: { operator: "is true" } }), "choose a property first");
	assert.equal(
		blocker({ kind: "frontmatter", property: "rating", condition: { operator: ">", value: 3 } }),
		'">" gives no value to write into a new note',
	);
	assert.equal(
		blocker({ kind: "frontmatter", property: "flag", condition: { operator: "is set" } }),
		'"is set" gives no value to write into a new note',
	);
});

test("the second step asks for a name and only offers creating a valid, unused one", () => {
	const fakes = [...vaultNotes(), { path: "archive/old/Bea.md" }];
	const { entries, nameRows } = setup([entry("people", "links", { prefix: "👤 peop |" })], {}, fakes);
	assert.equal(namePlaceholder(entries[0]), "Name of the new people note…");
	for (const typed of ["", "   "]) {
		assert.deepEqual(labels(nameRows(0, typed)), [TYPE_A_NAME]);
		assert.deepEqual(nameRows(0, typed)[0].action, { action: "reopen" });
	}
	assert.equal(TYPE_A_NAME, "Type a name");
	for (const name of ["a/b", "what?", ".hidden", "x#y"]) {
		const rows = nameRows(0, name);
		assert.deepEqual(labels(rows), [`"${name}" has characters Obsidian cannot use in a file name.`]);
		assert.deepEqual(rows[0].action, { action: "reopen" });
	}
	for (const [typed, path] of [["Bea", "archive/old/Bea.md"], ["ann", "people/Ann.md"], [" TODAY ", "Today.md"]]) {
		const rows = nameRows(0, typed);
		assert.deepEqual(labels(rows), [`"${typed.trim()}" already exists at ${path}.`]);
		assert.deepEqual(rows[0].action, { action: "reopen" });
	}
	const valid = nameRows(0, " John Doe ");
	assert.deepEqual(labels(valid), ['➕ 👤 peop | Create "John Doe" in inbox']);
	assert.deepEqual(valid[0].parts, { mark: "➕", prefix: "👤 peop |", content: 'Create "John Doe" in inbox' });
	assert.equal(creation(valid).name, "John Doe");
});

test("the second step names the folder the note goes to", () => {
	const { nameRows } = setup(
		[
			entry("people", "links", { prefix: "👤", source: { kind: "inFolder", folder: "people/" } }),
			entry("related", "links", { prefix: "🔅", source: { kind: "modifiedToday" } }),
		],
		{ defaultNoteFolder: () => "" },
	);
	assert.deepEqual(labels(nameRows(0, "Zed")), ['➕ 👤 Create "Zed" in people']);
	assert.deepEqual(labels(nameRows(1, "Zed")), ['➕ 🔅 Create "Zed" in the vault root']);
});

test("choosing a valid name creates the note with its source's membership", async () => {
	const { vault, nameRows } = setup([entry("people", "links", { prefix: "👤", newNoteTemplate: "templates/Person.md" })]);
	const result = await createNote(vault, "Today.md", creation(nameRows(0, "Zed")));
	assert.equal(createdNotice("Zed", result), 'Created "Zed" in inbox.');
	assert.equal(vault.content("inbox/Zed.md"), "# Person\n\n[[types/Person]]\n");
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
	assert.deepEqual([...new Set(sources)], ["Today.md"]);
	const { vault, entries } = setup([entry("people", "links", { prefix: "👤" })], { defaultNoteFolder: (source) => source ?? "root" });
	await createNote(vault, undefined, creation(nameChoices(entries[0], vault, undefined, "Zed")));
	assert.ok(vault.paths().includes("root/Zed.md"));
});

test("an existing note at the path is left untouched", async () => {
	const existing = [...vaultNotes(), { path: "inbox/zed.md", content: "mine" }];
	const { vault, entries } = setup([entry("people", "links", { prefix: "👤" })], {}, existing);
	const result = await createNote(vault, "Today.md", { ...entries[0], name: "Zed" });
	const notice = createdNotice("Zed", result);
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
