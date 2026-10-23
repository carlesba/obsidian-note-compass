import { test } from "node:test";
import { strict as assert } from "node:assert";
import { defaultDateNoteSettings } from "../src/lists/dateNotes.ts";
import { buildJumpList } from "../src/lists/jumpList.ts";
import type { Frontmatter, JumpListVault, VaultNote } from "../src/lists/vault.ts";
import type { Condition } from "../src/lists/conditions.ts";
import { defaultSettings } from "../src/settings.ts";
import type { ListSource, NoteList, RelationSourceKind } from "../src/settings.ts";
import { moment } from "./moment.ts";

interface FakeNote {
	path: string;
	ctime?: number;
	mtime?: number;
	frontmatter?: Frontmatter;
	links?: string[];
}

const MARCH_5 = new Date(2024, 2, 5, 10).getTime();
const MARCH_9 = new Date(2024, 2, 9, 10).getTime();

interface FakePlugins {
	periodicNotes?: unknown;
	dailyNotes?: unknown;
	propertyTypes?: Record<string, string>;
	now?: number;
}

function fakeVault(fakes: FakeNote[], plugins: FakePlugins = {}): JumpListVault & { note(path: string): VaultNote } {
	const notes = fakes.map((fake) => ({
		path: fake.path,
		basename: fake.path.split("/").pop()!.replace(/\.md$/, ""),
		ctime: fake.ctime ?? MARCH_9,
	}));
	const byPath = new Map(fakes.map((fake) => [fake.path, fake]));
	return {
		notes: () => notes,
		frontmatter: (path) => byPath.get(path)?.frontmatter,
		updateFrontmatter: async () => {},
		linksFrom: (path) => byPath.get(path)?.links ?? [],
		linksTo: (path) => fakes.filter((fake) => fake.links?.includes(path)).map((fake) => fake.path),
		mtime: (path) => byPath.get(path)?.mtime ?? MARCH_5,
		periodicNotesSettings: () => plugins.periodicNotes,
		dailyNotesOptions: () => plugins.dailyNotes,
		propertyTypes: () => plugins.propertyTypes ?? {},
		propertyValueCounts: () => [],
		now: () => plugins.now ?? MARCH_9,
		moment,
		note: (path) => notes.find((note) => note.path === path)!,
	};
}

function onlyList(kind: RelationSourceKind): NoteList[] {
	return defaultSettings().lists.map((list) => ({ ...list, enabled: list.source.kind === kind }));
}

function propertyList(prefix: string, property: string, condition: Condition): NoteList {
	return { id: `list-${prefix}`, enabled: true, prefix, source: { kind: "frontmatter", property, condition } };
}

function sourceList(source: ListSource): NoteList[] {
	return [{ id: "list-1", enabled: true, prefix: "src", source }];
}

const describe = (entries: { name: string; prefix: string; suffix?: string }[]) =>
	entries.map((entry) => [`${entry.prefix} ${entry.name}`, entry.suffix].filter((part) => part !== undefined).join(" | "));

test("adjacent days lists the previous and next date notes with direction and date suffixes", () => {
	const vault = fakeVault([
		{ path: "on/2024-03-05.md" },
		{ path: "on/2024-03-04.md" },
		{ path: "on/2024-03-06.md" },
		{ path: "on/2024-03-07.md" },
	]);
	const entries = buildJumpList(onlyList("adjacentDates"), vault, vault.note("on/2024-03-05.md"));
	assert.deepEqual(describe(entries), [
		"📅 day 2024-03-04 | prev day - Monday",
		"📅 day 2024-03-06 | next day - Wednesday",
	]);
});

test("adjacent days covers weeks and months and looks neighbours up only in the period's folder", () => {
	const vault = fakeVault([
		{ path: "on/2024-W10.md" },
		{ path: "on/2024-W11.md" },
		{ path: "archive/2024-W09.md" },
		{ path: "on/2024-03.md" },
		{ path: "on/2024-02.md" },
	]);
	const lists = onlyList("adjacentDates");
	assert.deepEqual(describe(buildJumpList(lists, vault, vault.note("on/2024-W10.md"))), [
		"📅 day 2024-W11 | next week - week 11",
	]);
	assert.deepEqual(describe(buildJumpList(lists, vault, vault.note("on/2024-03.md"))), [
		"📅 day 2024-02 | prev month - month - February",
	]);
});

test("adjacent days covers quarters and years from the Custom formats", () => {
	const vault = fakeVault([{ path: "on/2024-Q1.md" }, { path: "on/2023-Q4.md" }, { path: "on/2024.md" }, { path: "on/2025.md" }]);
	const dateNotes = defaultDateNoteSettings();
	dateNotes.custom.quarter.enabled = true;
	const lists = onlyList("adjacentDates");
	assert.deepEqual(describe(buildJumpList(lists, vault, vault.note("on/2024-Q1.md"), dateNotes)), [
		"📅 day 2023-Q4 | prev quarter - quarter 4",
	]);
	assert.deepEqual(describe(buildJumpList(lists, vault, vault.note("on/2024.md"), dateNotes)), [
		"📅 day 2025 | next year - year",
	]);
});

test("date notes follow Periodic Notes when it is installed", () => {
	const periodicNotes = {
		daily: { enabled: true, folder: "journal", format: "DD.MM.YYYY" },
		weekly: { enabled: false, folder: "on", format: "" },
	};
	const vault = fakeVault(
		[{ path: "journal/05.03.2024.md" }, { path: "journal/06.03.2024.md" }, { path: "on/2024-W10.md" }, { path: "on/2024-03-04.md" }],
		{ periodicNotes, dailyNotes: { folder: "on", format: "" } },
	);
	assert.deepEqual(describe(buildJumpList(onlyList("adjacentDates"), vault, vault.note("journal/05.03.2024.md"))), [
		"📅 day 06.03.2024 | next day - Wednesday",
	]);
	assert.deepEqual(buildJumpList(onlyList("adjacentDates"), vault, vault.note("on/2024-W10.md")), []);
});

test("date notes follow the Daily notes folder and format for days", () => {
	const vault = fakeVault([{ path: "daily/2024.03.05.md" }, { path: "daily/2024.03.04.md" }, { path: "on/2024-03-04.md" }], {
		dailyNotes: { folder: "daily", format: "YYYY.MM.DD" },
	});
	assert.deepEqual(describe(buildJumpList(onlyList("adjacentDates"), vault, vault.note("daily/2024.03.05.md"))), [
		"📅 day 2024.03.04 | prev day - Monday",
	]);
});

test("adjacent days is empty for a note that is not a date note", () => {
	const vault = fakeVault([{ path: "notes/2024-03-05.md" }, { path: "on/2024-03-06.md" }]);
	assert.deepEqual(buildJumpList(onlyList("adjacentDates"), vault, vault.note("notes/2024-03-05.md")), []);
});

test("outbound lists linked notes once each, sorted by name", () => {
	const vault = fakeVault([
		{ path: "current.md", links: ["people/Zoe.md", "Alpha.md", "people/Zoe.md", "missing.md"] },
		{ path: "people/Zoe.md" },
		{ path: "Alpha.md" },
		{ path: "unrelated.md" },
	]);
	const entries = buildJumpList(onlyList("linksOut"), vault, vault.note("current.md"));
	assert.deepEqual(describe(entries), ["🔗 out Alpha", "🔗 out Zoe"]);
	assert.equal(entries[1].file.path, "people/Zoe.md");
});

test("inbound lists the notes that link to the current note, with date suffixes", () => {
	const vault = fakeVault([
		{ path: "current.md" },
		{ path: "on/2024-03-05.md", links: ["current.md"] },
		{ path: "Beta.md", links: ["current.md"] },
		{ path: "unrelated.md", links: ["Beta.md"] },
	]);
	const entries = buildJumpList(onlyList("linksIn"), vault, vault.note("current.md"));
	assert.deepEqual(describe(entries), ["🔗 in 2024-03-05 | Tuesday", "🔗 in Beta"]);
});

test("same day uses ctime for ordinary notes", () => {
	const vault = fakeVault([
		{ path: "current.md", ctime: MARCH_5 },
		{ path: "b.md", ctime: new Date(2024, 2, 5, 23, 59).getTime() },
		{ path: "a.md", ctime: new Date(2024, 2, 5, 0, 1).getTime() },
		{ path: "c.md", ctime: new Date(2024, 2, 6, 0, 1).getTime() },
	]);
	const entries = buildJumpList(onlyList("sameDay"), vault, vault.note("current.md"));
	assert.deepEqual(describe(entries), ["🔅 ctx a", "🔅 ctx b"]);
});

test("same day uses the date in the name for date notes", () => {
	const vault = fakeVault([
		{ path: "on/2024-03-05.md", ctime: MARCH_9 },
		{ path: "written-that-day.md", ctime: MARCH_5 },
		{ path: "written-later.md", ctime: MARCH_9 },
	]);
	const entries = buildJumpList(onlyList("sameDay"), vault, vault.note("on/2024-03-05.md"));
	assert.deepEqual(describe(entries), ["🔅 ctx written-that-day"]);
});

test("property lists match every note whether or not there is a current note", () => {
	const vault = fakeVault(
		[
			{ path: "b.md", frontmatter: { active: true } },
			{ path: "a.md", frontmatter: { active: "true" } },
			{ path: "c.md", frontmatter: { active: false } },
			{ path: "d.md" },
		],
		{ propertyTypes: { active: "checkbox" } },
	);
	const lists = [propertyList("📍 act", "active", { operator: "is true" })];
	assert.deepEqual(describe(buildJumpList(lists, vault)), ["📍 act a", "📍 act b"]);
	assert.deepEqual(describe(buildJumpList(lists, vault, vault.note("d.md"))), ["📍 act a", "📍 act b"]);
});

test("without a current note only the property lists run", () => {
	const vault = fakeVault([
		{ path: "on/2024-03-05.md", ctime: MARCH_5, links: ["linked.md"] },
		{ path: "linked.md", ctime: MARCH_5, frontmatter: { tags: ["[[Work|work]]"] } },
	]);
	const lists = [...defaultSettings().lists, propertyList("💼 work", "tags", { operator: "has item", value: "Work" })];
	assert.deepEqual(describe(buildJumpList(lists, vault)), ["💼 work linked"]);
});

test("the lists run in order, a note appears in every list that holds it and the current note never appears", () => {
	const vault = fakeVault(
		[
			{ path: "on/2024-03-05.md", ctime: MARCH_5, links: ["on/2024-03-06.md", "zed.md", "on/2024-03-05.md"] },
			{ path: "on/2024-03-06.md", ctime: MARCH_9 },
			{ path: "zed.md", ctime: MARCH_5, links: ["on/2024-03-05.md"], frontmatter: { active: true } },
			{ path: "backlink.md", links: ["on/2024-03-05.md"], frontmatter: { area: "home" } },
			{ path: "same-day.md", ctime: MARCH_5, frontmatter: { active: true } },
			{ path: "active.md", frontmatter: { active: true, area: "home" } },
			{ path: "home.md", frontmatter: { area: "home" } },
		],
		{ propertyTypes: { active: "checkbox", area: "text" } },
	);
	const lists = [
		...defaultSettings().lists,
		propertyList("📍 act", "active", { operator: "is true" }),
		propertyList("🏠 home", "area", { operator: "is", value: "home" }),
	];
	const entries = buildJumpList(lists, vault, vault.note("on/2024-03-05.md"));
	assert.deepEqual(describe(entries), [
		"📅 day 2024-03-06 | next day - Wednesday",
		"🔗 out 2024-03-06 | Wednesday",
		"🔗 out zed",
		"🔗 in backlink",
		"🔗 in zed",
		"🔅 ctx same-day",
		"🔅 ctx zed",
		"📍 act active",
		"📍 act same-day",
		"📍 act zed",
		"🏠 home active",
		"🏠 home backlink",
		"🏠 home home",
	]);
});

test("disabled lists are skipped", () => {
	const vault = fakeVault([
		{ path: "current.md", ctime: MARCH_5, links: ["out.md"] },
		{ path: "out.md", ctime: MARCH_5, links: ["current.md"] },
		{ path: "in.md", links: ["current.md"] },
	]);
	const lists = defaultSettings().lists.map((list) => ({
		...list,
		enabled: list.source.kind !== "linksOut" && list.source.kind !== "sameDay",
	}));
	lists.push({ ...propertyList("🏠 home", "area", { operator: "is set" }), enabled: false });
	assert.deepEqual(describe(buildJumpList(lists, vault, vault.note("current.md"))), ["🔗 in in", "🔗 in out"]);
});

test("a note held by two lists appears under each, in the user's order", () => {
	const vault = fakeVault([
		{ path: "current.md", links: ["shared.md"] },
		{ path: "shared.md", frontmatter: { area: "home" } },
	]);
	const linksOut = onlyList("linksOut").filter((list) => list.enabled);
	const home = propertyList("🏠 home", "area", { operator: "is", value: "home" });
	assert.deepEqual(describe(buildJumpList([...linksOut, home], vault, vault.note("current.md"))), ["🔗 out shared", "🏠 home shared"]);
	assert.deepEqual(describe(buildJumpList([home, ...linksOut], vault, vault.note("current.md"))), ["🏠 home shared", "🔗 out shared"]);
});

test("property lists follow the property's type and evaluate relative dates against the clock", () => {
	const vault = fakeVault(
		[
			{ path: "due-today.md", frontmatter: { Due: "2024-03-09" } },
			{ path: "due-tomorrow.md", frontmatter: { Due: "2024-03-10T09:30" } },
			{ path: "overdue.md", frontmatter: { Due: "2024-03-01" } },
		],
		{ propertyTypes: { due: "date" }, now: new Date(2024, 2, 9, 23, 30).getTime() },
	);
	const tomorrow = [propertyList("⏰ due", "Due", { operator: "on", value: { kind: "relative", days: 1 } })];
	assert.deepEqual(describe(buildJumpList(tomorrow, vault)), ["⏰ due due-tomorrow"]);
	const asText = [propertyList("⏰ due", "Due", { operator: "is", value: "2024-03-09" })];
	assert.deepEqual(buildJumpList(asText, vault), []);
});

test("every property reads as text when the vault reports no types", () => {
	const vault = fakeVault([{ path: "a.md", frontmatter: { area: "home" } }]);
	assert.deepEqual(describe(buildJumpList([propertyList("🏠", "area", { operator: "contains", value: "om" })], vault)), ["🏠 a"]);
});

test("links to note lists the notes linking to the chosen note by path or name, without the current note", () => {
	const vault = fakeVault([
		{ path: "types/Person 👤.md" },
		{ path: "people/Zoe.md", links: ["types/Person 👤.md"] },
		{ path: "people/Ann.md", links: ["types/Person 👤.md"] },
		{ path: "unrelated.md", links: ["people/Zoe.md"] },
	]);
	for (const note of ["types/Person 👤.md", "types/Person 👤", "Person 👤"]) {
		assert.deepEqual(describe(buildJumpList(sourceList({ kind: "linksToNote", note }), vault)), ["src Ann", "src Zoe"]);
	}
	assert.deepEqual(describe(buildJumpList(sourceList({ kind: "linksToNote", note: "Person 👤" }), vault, vault.note("people/Zoe.md"))), [
		"src Ann",
	]);
});

test("links to note lists nothing for a note that does not exist or is not chosen", () => {
	const vault = fakeVault([{ path: "people/Zoe.md", links: ["Gone.md"] }]);
	assert.deepEqual(buildJumpList(sourceList({ kind: "linksToNote", note: "Gone.md" }), vault), []);
	assert.deepEqual(buildJumpList(sourceList({ kind: "linksToNote", note: "" }), vault), []);
});

test("in folder lists the notes under the folder, subfolders included, but not the current note", () => {
	const vault = fakeVault([
		{ path: "categories/Work.md" },
		{ path: "categories/home/Garden.md" },
		{ path: "categories-old/Leisure.md" },
		{ path: "Work.md" },
	]);
	assert.deepEqual(describe(buildJumpList(sourceList({ kind: "inFolder", folder: "categories" }), vault, vault.note("categories/Work.md"))), [
		"src Garden",
	]);
	assert.deepEqual(describe(buildJumpList(sourceList({ kind: "inFolder", folder: "/categories/home/" }), vault)), ["src Garden"]);
});

test("in folder lists nothing for a missing, empty or unchosen folder", () => {
	const vault = fakeVault([{ path: "notes/A.md" }]);
	for (const folder of ["missing", "", "/"]) {
		assert.deepEqual(buildJumpList(sourceList({ kind: "inFolder", folder }), vault), []);
	}
});

test("modified today lists notes changed since local midnight of the vault's clock", () => {
	const now = new Date(2024, 2, 9, 10).getTime();
	const vault = fakeVault(
		[
			{ path: "midnight.md", mtime: new Date(2024, 2, 9, 0, 0).getTime() },
			{ path: "late-yesterday.md", mtime: new Date(2024, 2, 8, 23, 59, 59).getTime() },
			{ path: "this-morning.md", mtime: new Date(2024, 2, 9, 9).getTime() },
			{ path: "current.md", mtime: now },
		],
		{ now },
	);
	assert.deepEqual(describe(buildJumpList(sourceList({ kind: "modifiedToday" }), vault, vault.note("current.md"))), [
		"src midnight",
		"src this-morning",
	]);
});

test("each entry carries its list's prefix colour, and lists without one leave it out", () => {
	const vault = fakeVault([{ path: "current.md", links: ["Alpha.md", "Beta.md"] }, { path: "Alpha.md" }, { path: "Beta.md", links: ["current.md"] }]);
	const lists: NoteList[] = [
		{ id: "list-1", enabled: true, prefix: "🔗 out", prefixColor: "#e0a030", source: { kind: "linksOut" } },
		{ id: "list-2", enabled: true, prefix: "🔗 in", source: { kind: "linksIn" } },
	];
	const entries = buildJumpList(lists, vault, vault.note("current.md"));
	assert.deepEqual(
		entries.map((entry) => [entry.name, entry.prefixColor]),
		[
			["Alpha", "#e0a030"],
			["Beta", "#e0a030"],
			["Beta", undefined],
		],
	);
	const inbound = buildJumpList([lists[1]], vault, vault.note("current.md"));
	assert.deepEqual(inbound.map((entry) => "prefixColor" in entry), [false]);
});

test("current date notes lists the chosen periods' notes for today in period order, offering to create the missing ones", () => {
	const vault = fakeVault([
		{ path: "on/2024.md" },
		{ path: "on/2024-03.md" },
		{ path: "on/2024-W10.md" },
		{ path: "on/2024-03-09.md" },
		{ path: "on/2024-03-08.md" },
		{ path: "notes/elsewhere.md" },
	]);
	const dateNotes = defaultDateNoteSettings();
	dateNotes.custom.quarter.enabled = true;
	const all = sourceList({ kind: "currentPeriods", periods: ["day", "week", "month", "quarter", "year"] });
	const entries = buildJumpList(all, vault, undefined, dateNotes);
	assert.deepEqual(describe(entries), [
		"src 2024-03-09 | today - Saturday",
		"src 2024-W10 | this week - week 10",
		"src 2024-03 | this month - month - March",
		"src 2024-Q1 | create this quarter - quarter 1",
		"src 2024 | this year - year",
	]);
	assert.deepEqual(
		entries.map((entry) => [entry.file.path, entry.missing]),
		[
			["on/2024-03-09.md", undefined],
			["on/2024-W10.md", undefined],
			["on/2024-03.md", undefined],
			["on/2024-Q1.md", { period: "quarter", from: "custom" }],
			["on/2024.md", undefined],
		],
	);
	const chosen = sourceList({ kind: "currentPeriods", periods: ["month"] });
	assert.deepEqual(describe(buildJumpList(chosen, vault, vault.note("notes/elsewhere.md"))), [
		"src 2024-03 | this month - month - March",
	]);
	assert.deepEqual(buildJumpList(chosen, vault, vault.note("on/2024-03.md")), []);
});
