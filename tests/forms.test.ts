import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createFormNote, freeNotePath } from "../src/forms/create.ts";
import { readForms, formFields } from "../src/forms/form.ts";
import type { Form, FormField } from "../src/forms/form.ts";
import { answered, resolveForm, skippedAnswer, unansweredQuestions } from "../src/forms/resolve.ts";
import type { Answer, FormClock } from "../src/forms/resolve.ts";
import { defaultSettings, mergeSettings, storedSettings } from "../src/settings.ts";
import { offeredNotes } from "../src/forms/notes.ts";
import { HOURS_AGO, NOW, fakeVault } from "./fakeVault.ts";
import { moment } from "./moment.ts";

const clock: FormClock = { now: NOW, moment, coreTemplatesOptions: undefined };

function form(extra: Partial<Form> = {}): Form {
	return {
		id: "1",
		enabled: true,
		name: "Reading log",
		namePattern: "",
		contentPattern: "",
		folder: "",
		opensNote: true,
		fields: [],
		...extra,
	};
}

function field(id: string, key: string, extra: Partial<FormField> = {}): FormField {
	return { id, key, saveAs: "property", mode: "ask", type: "text", ...extra };
}

function variable(id: string, key: string, extra: Partial<FormField> = {}): FormField {
	return field(id, key, { saveAs: "variable", ...extra });
}

function answers(entries: Record<string, Answer>): Map<string, Answer> {
	return new Map(Object.entries(entries));
}

const readingLog = (): Form =>
	form({
		namePattern: "{{date:YYMMDDHHmm}}   {{book}}",
		contentPattern: "# {{title}}\nBy {{author}} on {{started:dddd}}, rated {{rating}}.\n{{unknown}} stays",
		fields: [
			variable("1", "book", { source: "typed" }),
			field("2", "author", { source: "typed" }),
			field("3", "started", { type: "datetime", dateFormat: "YYYY-MM-DDTHH:mm" }),
			field("4", "day", { mode: "static", type: "date", dateFormat: "YYYY-MM-DD", from: "started" }),
			field("5", "rating", { type: "number", source: "options", choices: [{ value: "4", label: "4 · Great" }, { value: "2" }] }),
			field("6", "categories", { mode: "static", type: "list", value: ["[[Books]]", "[[Reading]]"] }),
		],
	});

test("forms default to none, and reset gives no forms", () => {
	assert.deepEqual(defaultSettings().forms, []);
	assert.deepEqual(mergeSettings({ forms: "nope" }).forms, []);
});

test("saved forms round-trip through storedSettings and mergeSettings", () => {
	const settings = defaultSettings();
	settings.forms = [readingLog()];
	const stored = JSON.parse(JSON.stringify(storedSettings(settings)));
	assert.deepEqual(mergeSettings(stored).forms, settings.forms);
});

test("an unreadable saved form is kept as it was, switched off and flagged", () => {
	const broken = { id: "2", enabled: true, name: "Future", fields: [{ key: "x", mode: "guess", type: "text" }] };
	const [readable, unreadable, notAnObject] = readForms([{ id: "1", enabled: true, name: "Ok" }, broken, "text"]);
	assert.equal(readable.unreadable, undefined);
	assert.equal(readable.opensNote, true);
	assert.equal(unreadable.enabled, false);
	assert.deepEqual(unreadable.unreadable, { stored: broken });
	assert.deepEqual(notAnObject.unreadable, { stored: "text" });
	const settings = defaultSettings();
	settings.forms = [readable, unreadable];
	const stored = storedSettings(settings) as { forms: unknown[] };
	assert.deepEqual(stored.forms[1], broken);
});

test("readForms mints missing or repeated ids and fills date formats per type", () => {
	const forms = readForms([
		{ id: "1", fields: [{ key: "when", mode: "ask", type: "time" }, { id: "1", key: "day", mode: "static", type: "date" }] },
		{ id: "1" },
	]);
	assert.deepEqual(forms.map((saved) => saved.id), ["1", "2"]);
	assert.deepEqual(formFields(forms[0]).map((saved) => [saved.id, saved.saveAs, saved.dateFormat]), [["1", "property", "HH:mm"], ["2", "property", "YYYY-MM-DD"]]);
	assert.deepEqual(forms[1].fields, []);
});

test("forms saved with separate variables and properties read as one fields list, variables first", () => {
	const [converted, broken] = readForms([
		{
			id: "1",
			enabled: true,
			variables: [{ id: "1", key: "book", mode: "ask", type: "text" }],
			properties: [{ id: "2", key: "author", mode: "ask", type: "text" }, { id: "3", key: "kind", mode: "static", type: "text", value: "book" }],
		},
		{ id: "2", enabled: true, variables: "book" },
	]);
	assert.deepEqual(converted.fields, [variable("1", "book", { source: "typed" }), field("2", "author", { source: "typed" }), field("3", "kind", { mode: "static", value: "book" })]);
	assert.deepEqual(broken.unreadable, { stored: { id: "2", enabled: true, variables: "book" } });
	const settings = defaultSettings();
	settings.forms = [converted];
	const stored = storedSettings(settings) as { forms: Record<string, unknown>[] };
	assert.deepEqual(Object.keys(stored.forms[0]).filter((key) => key === "fields" || key === "variables" || key === "properties"), ["fields"]);
});

test("the name and content fill creation dates, answers, field formats and leave unknown placeholders", () => {
	const started = new Date(2024, 2, 4, 9, 30).getTime();
	const resolved = resolveForm(
		readingLog(),
		answers({ "1": answered("Dune"), "2": answered("Frank Herbert"), "3": answered(started), "5": answered("4") }),
		clock,
	);
	assert.equal(resolved.name, "2403091500 Dune");
	assert.equal(resolved.content, "# 2403091500 Dune\nBy Frank Herbert on Monday, rated 4.\n{{unknown}} stays");
	assert.deepEqual(resolved.frontmatter, [
		["author", "Frank Herbert"],
		["started", "2024-03-04T09:30"],
		["day", "2024-03-04"],
		["rating", 4],
		["categories", ["[[Books]]", "[[Reading]]"]],
	]);
});

test("a field taken from a skipped field is skipped too, and skipped fields are not written", () => {
	const shape = readingLog();
	formFields(shape)[2].optional = true;
	const resolved = resolveForm(
		shape,
		answers({ "1": answered("Dune"), "2": answered("Frank Herbert"), "3": skippedAnswer(), "5": answered("2") }),
		clock,
	);
	assert.deepEqual(resolved.frontmatter.map(([key]) => key), ["author", "rating", "categories"]);
	assert.equal(resolved.content.includes("on ,"), true);
});

test("a date field at creation uses the creation time and can be written as ISO 8601", () => {
	const shape = form({
		namePattern: "Entry {{stamp}}",
		fields: [field("1", "stamp", { mode: "static", type: "datetime", dateFormat: "iso" }), field("2", "at", { mode: "static", type: "time", dateFormat: "custom", customFormat: "H[h]" })],
	});
	const resolved = resolveForm(shape, new Map(), clock);
	assert.deepEqual(resolved.frontmatter, [
		["stamp", moment(NOW).toISOString()],
		["at", "15h"],
	]);
});

test("a list from fixed options writes the chosen values as a list, label only shown", () => {
	const shape = form({
		namePattern: "{{topics}}",
		fields: [field("1", "topics", { type: "list", source: "options", choices: [{ value: "a", label: "Alpha" }, { value: "b" }] })],
	});
	const resolved = resolveForm(shape, answers({ "1": answered(["a", "b"]) }), clock);
	assert.deepEqual(resolved.frontmatter, [["topics", ["a", "b"]]]);
	assert.equal(resolved.name, "a, b");
});

test("variables fill placeholders but are never written, and a skipped variable is empty", () => {
	const shape = form({
		namePattern: "{{place}} meeting {{topic}}",
		fields: [variable("1", "place", { optional: true }), variable("2", "topic")],
	});
	const resolved = resolveForm(shape, answers({ "1": skippedAnswer(), "2": answered("Roadmap") }), clock);
	assert.equal(resolved.name, "meeting Roadmap");
	assert.deepEqual(resolved.frontmatter, []);
});

test("static numbers and checkboxes are written with their types", () => {
	const shape = form({
		fields: [field("1", "pages", { mode: "static", type: "number", value: 320 }), field("2", "read", { mode: "static", type: "checkbox" })],
	});
	assert.deepEqual(resolveForm(shape, new Map(), clock).frontmatter, [
		["pages", 320],
		["read", false],
	]);
});

test("every required question must be answered before creating, optional ones may be left out", () => {
	const shape = readingLog();
	formFields(shape)[2].optional = true;
	const missing = unansweredQuestions(shape, answers({ "1": answered("Dune"), "2": answered("") }), clock);
	assert.deepEqual(missing.map((question) => question.key), ["author", "rating"]);
});

test("a name already taken gets a number, compared case-insensitively", () => {
	const notes = fakeVault([{ path: "log/Dune.md" }, { path: "log/dune 2.md" }]).notes();
	assert.deepEqual(freeNotePath(notes, "log", "Dune"), { name: "Dune 3", path: "log/Dune 3.md", folder: "log" });
	assert.deepEqual(freeNotePath(notes, "", "Dune"), { name: "Dune", path: "Dune.md", folder: "" });
});

test("creating writes the content and then the properties in order, in the form's folder or the default one", async () => {
	const vault = fakeVault([{ path: "reading/Dune.md" }]);
	const shape = form({ folder: "reading", namePattern: "{{book}}", contentPattern: "Notes on {{book}}", fields: [variable("1", "book"), field("2", "author")] });
	const resolved = resolveForm(shape, answers({ "1": answered("Dune"), "2": answered("Frank Herbert") }), clock);
	const note = await createFormNote(vault, shape, resolved, undefined);
	assert.deepEqual(note, { name: "Dune 2", path: "reading/Dune 2.md", folder: "reading" });
	assert.equal(vault.content("reading/Dune 2.md"), "Notes on Dune");
	assert.deepEqual(vault.frontmatter("reading/Dune 2.md"), { author: "Frank Herbert" });

	const elsewhere = await createFormNote(vault, { ...shape, folder: "" }, resolved, "Today.md");
	assert.equal(elsewhere.path, "inbox/Dune.md");
});

test("a fixed date set to a typed date writes that date, typed with or without dashes", () => {
	const shape = form({
		fields: [
			field("1", "due", { mode: "static", type: "datetime", at: "202810300900" }),
			field("2", "day", { mode: "static", type: "date", at: "2028-10-30" }),
			field("3", "start", { mode: "static", type: "time", at: "0930" }),
			field("4", "bad", { mode: "static", type: "date", at: "2028" }),
		],
	});
	const resolved = resolveForm(shape, new Map(), clock);
	assert.deepEqual(resolved.frontmatter, [
		["due", "2028-10-30T09:00"],
		["day", "2028-10-30"],
		["start", "09:30"],
	]);
});

test("an answered entry time moves every creation time of the form to it", () => {
	const entry = moment("2028-10-30T09:00", "YYYY-MM-DDTHH:mm", true).valueOf();
	const shape = form({
		namePattern: "{{date:YYMMDDHHmm}} entry",
		fields: [
			field("1", "stamp", { mode: "static", type: "datetime" }),
			variable("2", "entry-time", { type: "datetime", entryTime: true }),
		],
	});
	const resolved = resolveForm(shape, answers({ "2": answered(entry) }), clock);
	assert.equal(resolved.name, "2810300900 entry");
	assert.deepEqual(resolved.frontmatter, [["stamp", "2028-10-30T09:00"]]);
	const untouched = resolveForm(shape, new Map(), clock);
	assert.equal(untouched.name, `${moment(NOW).format("YYMMDDHHmm")} entry`);
});


test("saved entryTime markers and date types round-trip without migration", () => {
	for (const type of ["date", "time", "datetime"] as const) {
		const shape = form({ fields: [variable("1", "when", { type, entryTime: true, dateFormat: "custom", customFormat: "YYYY/MM/DD HH:mm" })] });
		const settings = mergeSettings({ forms: [shape] });
		const reloaded = mergeSettings(JSON.parse(JSON.stringify(storedSettings(settings))));
		assert.deepEqual(reloaded.forms[0].fields, shape.fields);
	}
});

test("saved select and multiselect fields read as a data type with fixed options, and are saved in the new shape only", () => {
	const saved = {
		id: "1",
		enabled: true,
		fields: [
			{ id: "1", key: "rating", mode: "ask", type: "select", storeAs: "number", choices: [{ value: "4", label: "4 · Great" }] },
			{ id: "2", key: "kind", mode: "ask", type: "select", storeAs: "text", choices: [{ value: "book" }] },
			{ id: "3", key: "genre", mode: "ask", type: "select", choices: [{ value: "sci-fi", label: "Sci-fi" }, { label: "no value" }] },
			{ id: "4", key: "topics", mode: "ask", type: "multiselect", storeAs: "text", choices: [{ value: "a" }] },
			{ id: "5", key: "author", mode: "ask", type: "text" },
			{ id: "6", key: "pages", mode: "ask", type: "number", optional: true },
			{ id: "7", key: "read", mode: "ask", type: "checkbox" },
			{ id: "8", key: "day", mode: "ask", type: "date" },
		],
	};
	const [read] = readForms([saved]);
	assert.equal(read.unreadable, undefined);
	assert.deepEqual(read.fields, [
		field("1", "rating", { type: "number", source: "options", choices: [{ value: "4", label: "4 · Great" }] }),
		field("2", "kind", { type: "text", source: "options", choices: [{ value: "book" }] }),
		field("3", "genre", { type: "text", source: "options", choices: [{ value: "sci-fi", label: "Sci-fi" }] }),
		field("4", "topics", { type: "list", source: "options", choices: [{ value: "a" }] }),
		field("5", "author", { source: "typed" }),
		field("6", "pages", { type: "number", source: "typed", optional: true }),
		field("7", "read", { type: "checkbox" }),
		field("8", "day", { type: "date", dateFormat: "YYYY-MM-DD" }),
	]);
	const settings = defaultSettings();
	settings.forms = [read];
	const stored = JSON.parse(JSON.stringify(storedSettings(settings))) as { forms: { fields: Record<string, unknown>[] }[] };
	assert.deepEqual(stored.forms[0].fields.map((saved) => saved.type), ["number", "text", "text", "list", "text", "number", "checkbox", "date"]);
	assert.deepEqual(stored.forms[0].fields.map((saved) => saved.source), ["options", "options", "options", "options", "typed", "typed", undefined, undefined]);
	assert.equal(stored.forms[0].fields.some((saved) => "storeAs" in saved), false);
	assert.deepEqual(mergeSettings(stored).forms, settings.forms);
});

test("a saved source that does not fit its data type reads as typed input, and an unreadable notes source makes the form unreadable", () => {
	const [read] = readForms([
		{
			id: "1",
			fields: [
				{ id: "1", key: "pages", mode: "ask", type: "number", source: "notes", notesFrom: { kind: "modifiedToday" } },
				{ id: "2", key: "read", mode: "ask", type: "checkbox", source: "options", choices: [{ value: "x" }] },
				{ id: "3", key: "book", mode: "ask", type: "text", source: "notes", notesFrom: { kind: "inFolder", folder: "books" } },
				{ id: "4", key: "people", mode: "ask", type: "list", source: "notes", notesFrom: { kind: "filter", filter: { kind: "group", mode: "all", items: [] } } },
				{ id: "5", key: "kind", mode: "static", type: "text", source: "options", value: "book" },
			],
		},
	]);
	assert.deepEqual(read.fields, [
		field("1", "pages", { type: "number", source: "typed" }),
		field("2", "read", { type: "checkbox" }),
		field("3", "book", { source: "notes", notesFrom: { kind: "inFolder", folder: "books" } }),
		field("4", "people", { type: "list", source: "notes", notesFrom: { kind: "filter", filter: { kind: "group", mode: "all", items: [] } } }),
		field("5", "kind", { mode: "static", value: "book" }),
	]);
	const broken = { id: "2", enabled: true, fields: [{ id: "1", key: "book", mode: "ask", type: "text", source: "notes", notesFrom: { kind: "someday" } }] };
	const [unreadable] = readForms([broken]);
	assert.equal(unreadable.enabled, false);
	assert.deepEqual(unreadable.unreadable, { stored: broken });
	const settings = defaultSettings();
	settings.forms = [read, unreadable];
	const reloaded = mergeSettings(JSON.parse(JSON.stringify(storedSettings(settings))));
	assert.deepEqual(reloaded.forms, settings.forms);
});

test("each data type and source combination writes its own shape: numbers from options, links from notes, lists as items", () => {
	const shape = form({
		namePattern: "{{book}} by {{author}}",
		contentPattern: "[[{{book}}]] with {{people}}",
		fields: [
			field("1", "book", { source: "notes", notesFrom: { kind: "inFolder", folder: "books" } }),
			field("2", "author", { source: "options", choices: [{ value: "Herbert", label: "Frank Herbert" }] }),
			field("3", "rating", { type: "number", source: "options", choices: [{ value: "4", label: "4 · Great" }, { value: "n/a" }] }),
			field("4", "pages", { type: "number", source: "typed" }),
			field("5", "topics", { type: "list", source: "options", choices: [{ value: "a", label: "Alpha" }, { value: "b" }] }),
			field("6", "people", { type: "list", source: "notes", notesFrom: { kind: "modifiedToday" } }),
			field("7", "tags", { type: "list", source: "typed" }),
			field("8", "summary", { source: "typed" }),
		],
	});
	const resolved = resolveForm(
		shape,
		answers({
			"1": answered("[[Dune]]"),
			"2": answered("Herbert"),
			"3": answered("4"),
			"4": answered(412),
			"5": answered(["a", "b"]),
			"6": answered(["[[Paul]]", "[[People/Leto]]"]),
			"7": answered(["fiction", " ", "classic"]),
			"8": answered("Great read"),
		}),
		clock,
	);
	assert.equal(resolved.name, "Dune by Herbert");
	assert.equal(resolved.fields.find((each) => each.field.key === "people")?.text, "Paul, People/Leto");
	assert.equal(resolved.content, "[[Dune]] with Paul, People/Leto");
	assert.deepEqual(resolved.frontmatter, [
		["book", "[[Dune]]"],
		["author", "Herbert"],
		["rating", 4],
		["pages", 412],
		["topics", ["a", "b"]],
		["people", ["[[Paul]]", "[[People/Leto]]"]],
		["tags", ["fiction", "classic"]],
		["summary", "Great read"],
	]);
	const partial = resolveForm(shape, answers({ "3": answered("n/a"), "5": answered([]), "7": answered([" "]) }), clock);
	assert.deepEqual(partial.frontmatter, [["rating", "n/a"]]);
});

test("option values may hold placeholders, filled when the form runs, and an option that ends up empty is skipped", () => {
	const shape = form({
		fields: [
			variable("1", "book", { source: "typed", optional: true }),
			field("2", "about", { source: "options", choices: [{ value: "[[{{book}}]]", label: "The book" }, { value: "[[{{today}}]]", label: "Today" }] }),
			field("3", "dates", { type: "list", source: "options", choices: [{ value: "[[{{today}}]]", label: "Today" }, { value: "[[{{tomorrow}}]]", label: "Tomorrow" }, { value: "{{book}}" }] }),
			field("4", "score", { type: "number", source: "options", choices: [{ value: "{{points}}", label: "From points" }] }),
			variable("5", "points", { type: "number", source: "typed" }),
		],
	});
	const resolved = resolveForm(shape, answers({ "1": answered("Dune"), "2": answered("[[{{book}}]]"), "3": answered(["[[{{today}}]]", "{{book}}"]), "4": answered("{{points}}"), "5": answered(7) }), clock);
	assert.deepEqual(resolved.frontmatter, [
		["about", "[[Dune]]"],
		["dates", ["[[2024-03-09]]", "Dune"]],
		["score", 7],
	]);
	const skipped = resolveForm(shape, answers({ "1": skippedAnswer(), "2": answered("[[{{book}}]]"), "3": answered(["[[{{tomorrow}}]]", "{{book}}"]) }), clock);
	assert.deepEqual(skipped.frontmatter, [["dates", ["[[2024-03-10]]"]]]);
});

test("the notes offered to a question come from its list source, most recently changed first, with links that stay unique", () => {
	const vault = fakeVault([
		{ path: "books/Dune.md", mtime: HOURS_AGO(1) },
		{ path: "books/Emma.md", mtime: HOURS_AGO(3) },
		{ path: "books/old/Emma.md", mtime: HOURS_AGO(2) },
		{ path: "people/Paul.md", mtime: HOURS_AGO(1), links: ["books/Dune.md"] },
	]);
	const linkText = (path: string) => vault.linkText(path, "");
	const dateNotes = defaultSettings().dateNotes;
	const inFolder = offeredNotes({ kind: "inFolder", folder: "books" }, vault, undefined, dateNotes, linkText);
	assert.deepEqual(inFolder.map((note) => [note.name, note.link]), [["Dune", "[[Dune]]"], ["Emma", "[[books/old/Emma]]"], ["Emma", "[[books/Emma]]"]]);
	const linking = offeredNotes({ kind: "linksToNote", note: "Dune" }, vault, undefined, dateNotes, linkText);
	assert.deepEqual(linking.map((note) => note.path), ["people/Paul.md"]);
	const current = vault.note("people/Paul.md");
	assert.deepEqual(offeredNotes({ kind: "linksOut" }, vault, current, dateNotes, linkText).map((note) => note.link), ["[[Dune]]"]);
	assert.deepEqual(offeredNotes({ kind: "linksOut" }, vault, undefined, dateNotes, linkText), []);
});
