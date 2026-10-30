import { test } from "node:test";
import { strict as assert } from "node:assert";
import type { BlockCondition, Form, FormBlock, FormField } from "../src/forms/form.ts";
import { joinSegments, placeholderKey, placeholderToken, relativeDayOffset, splitPlaceholders } from "../src/forms/placeholders.ts";
import { answered, relativeDay, resolveForm, skippedAnswer } from "../src/forms/resolve.ts";
import type { Answer, FormClock } from "../src/forms/resolve.ts";
import { dailyNoteFormat, defaultDateNoteSettings, resolveDateNotes } from "../src/lists/dateNotes.ts";
import {
	isKnownPlaceholder,
	knownPlaceholderKeys,
	matchingPlaceholderEntries,
	placeholderEntries,
	placeholderPreview,
	placeholderTriggerAt,
} from "../src/settings/placeholderMenu.ts";
import { openLinkAt } from "../src/settings/wikiLinks.ts";
import { NOW, fakeVault } from "./fakeVault.ts";
import { moment } from "./moment.ts";

const clock: FormClock = { now: NOW, moment, coreTemplatesOptions: undefined };

function form(extra: Partial<Form> = {}): Form {
	return { id: "1", enabled: true, name: "Log", namePattern: "", contentPattern: "", folder: "", opensNote: true, fields: [], ...extra };
}

function field(id: string, key: string, extra: Partial<FormField> = {}): FormField {
	return { id, key, saveAs: "property", mode: "ask", type: "text", ...extra };
}

function fixed(id: string, key: string, value: string | string[], extra: Partial<FormField> = {}): FormField {
	return field(id, key, { mode: "static", type: Array.isArray(value) ? "list" : "text", value, ...extra });
}

function block(id: string, conditions: BlockCondition[], fields: FormField[]): FormBlock {
	return { id, kind: "block", conditions, fields };
}

function answers(entries: Record<string, Answer>): Map<string, Answer> {
	return new Map(Object.entries(entries));
}

function frontmatter(resolved: ReturnType<typeof resolveForm>): Record<string, unknown> {
	return Object.fromEntries(resolved.frontmatter);
}

test("text splits into text and pill segments, and joining them gives the text back", () => {
	const text = "Read {{book}} on [[{{today}}]] at {{time:HH:mm}}, see [[Books]] and {{ unknown }}";
	const segments = splitPlaceholders(text);
	assert.deepEqual(segments, [
		{ kind: "text", text: "Read " },
		{ kind: "pill", inner: "book", link: false },
		{ kind: "text", text: " on " },
		{ kind: "pill", inner: "today", link: true },
		{ kind: "text", text: " at " },
		{ kind: "pill", inner: "time:HH:mm", link: false },
		{ kind: "text", text: ", see [[Books]] and " },
		{ kind: "pill", inner: " unknown ", link: false },
	]);
	assert.equal(joinSegments(segments), text);
	for (const sample of ["", "plain", "{{a}}{{b}}", "[[{{a}}]][[{{b}}]]", "[[{{a}}]] {{a}}\nline {{b:dddd}}", "{{", "[[{{a}}", "[[{{a}}]"]) {
		assert.equal(joinSegments(splitPlaceholders(sample)), sample);
	}
	assert.deepEqual(splitPlaceholders("[[{{a}}"), [{ kind: "text", text: "[[" }, { kind: "pill", inner: "a", link: false }]);
});

test("placeholder tokens, keys and relative day offsets", () => {
	assert.equal(placeholderToken("today", false), "{{today}}");
	assert.equal(placeholderToken("today", true), "[[{{today}}]]");
	assert.equal(placeholderKey(" started : dddd"), "started");
	assert.equal(placeholderKey("book"), "book");
	assert.equal(relativeDayOffset("today"), 0);
	assert.equal(relativeDayOffset("Tomorrow"), 1);
	assert.equal(relativeDayOffset("yesterday"), -1);
	assert.equal(relativeDayOffset("date"), undefined);
});

test("the @ menu lists relative days, every distinct field key including block fields, date and time, each plain and as a link", () => {
	const log = form({
		fields: [
			field("1", "book"),
			field("2", "", { mode: "static", type: "text" }),
			block("3", [{ key: "book", operator: "is set" }], [field("4", "pages", { type: "number" }), fixed("5", "book", "x")]),
			field("6", "rating", { saveAs: "variable" }),
		],
	});
	const entries = placeholderEntries(log, { inContent: false, preview: (key) => (key === "today" ? "2024-03-09" : undefined) });
	assert.deepEqual(
		entries.map((entry) => entry.token),
		[
			"{{today}}",
			"[[{{today}}]]",
			"{{tomorrow}}",
			"[[{{tomorrow}}]]",
			"{{yesterday}}",
			"[[{{yesterday}}]]",
			"{{book}}",
			"[[{{book}}]]",
			"{{pages}}",
			"[[{{pages}}]]",
			"{{rating}}",
			"[[{{rating}}]]",
			"{{date}}",
			"[[{{date}}]]",
			"{{time}}",
			"[[{{time}}]]",
		],
	);
	assert.equal(entries[0].label, "today");
	assert.equal(entries[0].detail, "2024-03-09");
	assert.equal(entries[1].label, "[[today]]");
	assert.equal(entries[1].detail, "[[2024-03-09]]");
	assert.equal(entries[6].detail, "property · ask · text");
	const inContent = placeholderEntries(log, { inContent: true, preview: () => undefined });
	assert.deepEqual(inContent.slice(-2).map((entry) => entry.token), ["{{title}}", "[[{{title}}]]"]);
	assert.equal(inContent[inContent.length - 2].detail, "The new note's name");
});

test("a field keyed date, time or title hides the built-in entry with that name", () => {
	const log = form({ fields: [field("1", "date", { mode: "static", type: "date" }), field("2", "title")] });
	const tokens = placeholderEntries(log, { inContent: true, preview: () => undefined }).map((entry) => entry.token);
	assert.deepEqual(tokens.filter((token) => /date|title/.test(token)), ["{{date}}", "[[{{date}}]]", "{{title}}", "[[{{title}}]]"]);
});

test("menu previews format relative days and the core date and time", () => {
	assert.equal(placeholderPreview("today", clock), "2024-03-09");
	assert.equal(placeholderPreview("tomorrow", { ...clock, dailyFormat: "DD.MM.YYYY" }), "10.03.2024");
	assert.equal(placeholderPreview("date", clock), "2024-03-09");
	assert.equal(placeholderPreview("time", clock), "15:00");
	assert.equal(placeholderPreview("book", clock), undefined);
});

test("@ opens the menu at the start of the text or after whitespace, [ or (, filtered by what follows it", () => {
	assert.deepEqual(placeholderTriggerAt("@", 1), { start: 0, query: "" });
	assert.deepEqual(placeholderTriggerAt("Read @tod", 9), { start: 5, query: "tod" });
	assert.deepEqual(placeholderTriggerAt("[[@to", 5), { start: 2, query: "to" });
	assert.deepEqual(placeholderTriggerAt("(@x) later", 3), { start: 1, query: "x" });
	assert.deepEqual(placeholderTriggerAt("line\n@", 6), { start: 5, query: "" });
	assert.equal(placeholderTriggerAt("ana@example", 11), undefined);
	assert.equal(placeholderTriggerAt("@today and", 10), undefined);
	assert.deepEqual(placeholderTriggerAt("@today", 3), { start: 0, query: "to" });
});

test("menu entries are filtered by key, with keys starting with the query first", () => {
	const entries = placeholderEntries(form({ fields: [field("1", "today-note"), field("2", "day")] }), { inContent: false, preview: () => undefined });
	assert.deepEqual(matchingPlaceholderEntries(entries, "").length, entries.length);
	assert.deepEqual(
		matchingPlaceholderEntries(entries, "da").map((entry) => entry.token),
		["{{day}}", "[[{{day}}]]", "{{date}}", "[[{{date}}]]", "{{today}}", "[[{{today}}]]", "{{yesterday}}", "[[{{yesterday}}]]", "{{today-note}}", "[[{{today-note}}]]"],
	);
	assert.deepEqual(matchingPlaceholderEntries(entries, "zzz"), []);
});

test("known placeholder keys are the form's fields plus the built-in names, and title only in the content", () => {
	const log = form({ fields: [field("1", "Book"), block("2", [], [field("3", "pages")])] });
	const known = knownPlaceholderKeys(log, false);
	assert.deepEqual([...known].sort(), ["Book", "date", "pages", "time", "today", "tomorrow", "yesterday"]);
	assert.ok(knownPlaceholderKeys(log, true).has("title"));
	assert.ok(isKnownPlaceholder("Book", known));
	assert.ok(isKnownPlaceholder("TODAY", known));
	assert.ok(isKnownPlaceholder("pages:dddd", known));
	assert.equal(isKnownPlaceholder("book", known), false);
	assert.equal(isKnownPlaceholder("title", known), false);
});

test("today, tomorrow and yesterday follow the entry date in the daily-note format, falling back to YYYY-MM-DD", () => {
	const log = form({
		namePattern: "{{yesterday}} {{today}} {{tomorrow}} {{today:dddd}}",
		fields: [field("1", "entry-date", { saveAs: "variable", type: "date", entryTime: true })],
	});
	assert.equal(resolveForm(log, answers({}), clock).name, "2024-03-08 2024-03-09 2024-03-10 Saturday");
	const daily = { ...clock, dailyFormat: "DD.MM.YYYY" };
	assert.equal(resolveForm(log, answers({}), daily).name, "08.03.2024 09.03.2024 10.03.2024 Saturday");
	const moved = answers({ "1": answered(moment("2024-12-31", "YYYY-MM-DD", true).valueOf()) });
	assert.equal(resolveForm(log, moved, daily).name, "30.12.2024 31.12.2024 01.01.2025 Tuesday");
	assert.equal(relativeDay("Tomorrow", clock), "2024-03-10");
	assert.equal(relativeDay("book", clock), undefined);
});

test("the daily-note format comes from the resolved Date notes source, or is absent when the day period is off", () => {
	const vault = fakeVault([]);
	assert.equal(dailyNoteFormat(resolveDateNotes(defaultDateNoteSettings(), vault)), "YYYY-MM-DD");
	const settings = defaultDateNoteSettings();
	settings.custom.day.format = "DD MMM YYYY";
	assert.equal(dailyNoteFormat(resolveDateNotes(settings, vault)), "DD MMM YYYY");
	settings.custom.day.enabled = false;
	assert.equal(dailyNoteFormat(resolveDateNotes(settings, vault)), undefined);
});

test("a field keyed today wins over the built-in today", () => {
	const log = form({ namePattern: "{{today}}", fields: [fixed("1", "today", "mine")] });
	assert.equal(resolveForm(log, answers({}), clock).name, "mine");
});

test("fixed text values and list items compose other fields and relative days", () => {
	const log = form({
		fields: [
			field("1", "book"),
			field("2", "rating", { type: "number", source: "options", choices: [{ value: "4" }] }),
			field("3", "started", { type: "date" }),
			fixed("4", "summary", "{{book}} rated {{rating}} on {{started:dddd}}"),
			fixed("5", "dates", ["[[{{today}}]]", "[[{{yesterday}}]]", "[[Reading]]"]),
			fixed("6", "sort", "{{rating}}"),
		],
	});
	const resolved = resolveForm(log, answers({ "1": answered("Dune"), "2": answered("4"), "3": answered(NOW) }), clock);
	const written = frontmatter(resolved);
	assert.equal(written.summary, "Dune rated 4 on Saturday");
	assert.deepEqual(written.dates, ["[[2024-03-09]]", "[[2024-03-08]]", "[[Reading]]"]);
	assert.equal(written.sort, "4");
	assert.equal(written.rating, 4);
});

test("a fixed value may use a field defined later, and an unknown placeholder stays as it is", () => {
	const log = form({ fields: [fixed("1", "label", "{{book}} ({{unknown}})"), field("2", "book")] });
	assert.equal(frontmatter(resolveForm(log, answers({ "2": answered("Dune") }), clock)).label, "Dune ({{unknown}})");
});

test("a skipped field empties its placeholder, dropping the list item and skipping an empty text value", () => {
	const log = form({
		fields: [
			field("1", "topic", { saveAs: "variable", optional: true }),
			fixed("2", "tags", ["[[{{topic}}]]", "{{topic}}", "[[Kept]]"]),
			fixed("3", "note", "{{topic}}"),
			fixed("4", "only", ["[[ {{topic}} ]]"]),
		],
	});
	const written = frontmatter(resolveForm(log, answers({ "1": skippedAnswer() }), clock));
	assert.deepEqual(written.tags, ["[[Kept]]"]);
	assert.equal("note" in written, false);
	assert.equal("only" in written, false);
	const filled = frontmatter(resolveForm(log, answers({ "1": answered("Dune") }), clock));
	assert.deepEqual(filled.tags, ["[[Dune]]", "Dune", "[[Kept]]"]);
	assert.equal(filled.note, "Dune");
});

test("self and cyclic references resolve to empty instead of looping", () => {
	const log = form({
		namePattern: "{{a}}|{{b}}|{{me}}",
		fields: [fixed("1", "a", "a→{{b}}"), fixed("2", "b", "b→{{a}}"), fixed("3", "me", "me→{{me}}")],
	});
	const resolved = resolveForm(log, answers({}), clock);
	const written = frontmatter(resolved);
	assert.equal(written.me, "me→");
	assert.ok(written.a === "a→b→" || written.a === "a→");
	assert.ok(written.b === "b→a→" || written.b === "b→");
	assert.equal(resolved.name, `${String(written.a)}|${String(written.b)}|me→`);
});

test("a later field with the same key can extend the earlier value", () => {
	const log = form({ fields: [fixed("1", "tags", ["[[A]]"]), fixed("2", "tags", ["{{tags}}", "[[B]]"])] });
	assert.deepEqual(frontmatter(resolveForm(log, answers({}), clock)).tags, ["[[A]]", "[[B]]"]);
});

test("block conditions compare against the filled fixed value", () => {
	const log = form({
		fields: [
			field("1", "kind"),
			fixed("2", "label", "kind:{{kind}}", { saveAs: "variable" }),
			block("3", [{ key: "label", operator: "is", value: "kind:book" }], [fixed("4", "shelf", "[[Books]]")]),
		],
	});
	assert.equal(frontmatter(resolveForm(log, answers({ "1": answered("book") }), clock)).shelf, "[[Books]]");
	assert.equal("shelf" in frontmatter(resolveForm(log, answers({ "1": answered("article") }), clock)), false);
});

test("the [[ link suggestion ignores a link that starts with a placeholder", () => {
	assert.equal(openLinkAt("[[{{today}}", 11), undefined);
	assert.equal(openLinkAt("see [[{{bo", 10), undefined);
	assert.deepEqual(openLinkAt("see [[Bo", 8), { start: 4, query: "Bo" });
});
