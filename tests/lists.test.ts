import { test } from "node:test";
import { strict as assert } from "node:assert";
import { buildJumpList } from "../src/lists/jumpList.ts";
import type { Frontmatter, JumpListVault, VaultNote } from "../src/lists/vault.ts";
import { defaultSettings } from "../src/settings.ts";
import type { JumpListSettings } from "../src/settings.ts";

interface FakeNote {
	path: string;
	ctime?: number;
	frontmatter?: Frontmatter;
	links?: string[];
}

const MARCH_5 = new Date(2024, 2, 5, 10).getTime();
const MARCH_9 = new Date(2024, 2, 9, 10).getTime();

function fakeVault(fakes: FakeNote[]): JumpListVault & { note(path: string): VaultNote } {
	const notes = fakes.map((fake) => ({
		path: fake.path,
		basename: fake.path.split("/").pop()!.replace(/\.md$/, ""),
		ctime: fake.ctime ?? MARCH_9,
	}));
	const byPath = new Map(fakes.map((fake) => [fake.path, fake]));
	return {
		notes: () => notes,
		frontmatter: (path) => byPath.get(path)?.frontmatter,
		linksFrom: (path) => byPath.get(path)?.links ?? [],
		linksTo: (path) => fakes.filter((fake) => fake.links?.includes(path)).map((fake) => fake.path),
		note: (path) => notes.find((note) => note.path === path)!,
	};
}

function onlyBuiltIn(name: keyof JumpListSettings["builtIns"]): JumpListSettings {
	const settings = defaultSettings();
	for (const key of Object.keys(settings.builtIns) as (keyof JumpListSettings["builtIns"])[]) {
		settings.builtIns[key].enabled = key === name;
	}
	return settings;
}

const describe = (entries: { name: string; prefix: string; suffix?: string }[]) =>
	entries.map((entry) => [entry.prefix, entry.name, entry.suffix].filter((part) => part !== undefined).join(" | "));

test("adjacent days lists the previous and next date notes with direction and date suffixes", () => {
	const vault = fakeVault([
		{ path: "on/2024-03-05.md" },
		{ path: "on/2024-03-04.md" },
		{ path: "on/2024-03-06.md" },
		{ path: "on/2024-03-07.md" },
	]);
	const entries = buildJumpList(onlyBuiltIn("adjacentDays"), vault, vault.note("on/2024-03-05.md"));
	assert.deepEqual(describe(entries), [
		"📅 day | 2024-03-04 | prev day - Monday",
		"📅 day | 2024-03-06 | next day - Wednesday",
	]);
});

test("adjacent days covers weeks and months and labels non-date neighbours by direction only", () => {
	const vault = fakeVault([
		{ path: "on/2024-W10.md" },
		{ path: "on/2024-W11.md" },
		{ path: "archive/2024-W09.md" },
		{ path: "on/2024-03.md" },
		{ path: "on/2024-02.md" },
	]);
	const settings = onlyBuiltIn("adjacentDays");
	assert.deepEqual(describe(buildJumpList(settings, vault, vault.note("on/2024-W10.md"))), [
		"📅 day | 2024-W09 | prev week",
		"📅 day | 2024-W11 | next week - week 11",
	]);
	assert.deepEqual(describe(buildJumpList(settings, vault, vault.note("on/2024-03.md"))), [
		"📅 day | 2024-02 | prev month - month - February",
	]);
});

test("adjacent days is empty for a note that is not a date note", () => {
	const vault = fakeVault([{ path: "notes/2024-03-05.md" }, { path: "on/2024-03-06.md" }]);
	assert.deepEqual(buildJumpList(onlyBuiltIn("adjacentDays"), vault, vault.note("notes/2024-03-05.md")), []);
});

test("outbound lists linked notes once each, sorted by name", () => {
	const vault = fakeVault([
		{ path: "current.md", links: ["people/Zoe.md", "Alpha.md", "people/Zoe.md", "missing.md"] },
		{ path: "people/Zoe.md" },
		{ path: "Alpha.md" },
		{ path: "unrelated.md" },
	]);
	const entries = buildJumpList(onlyBuiltIn("linksOut"), vault, vault.note("current.md"));
	assert.deepEqual(describe(entries), ["🔗 out | Alpha", "🔗 out | Zoe"]);
	assert.equal(entries[1].file.path, "people/Zoe.md");
});

test("inbound lists the notes that link to the current note, with date suffixes", () => {
	const vault = fakeVault([
		{ path: "current.md" },
		{ path: "on/2024-03-05.md", links: ["current.md"] },
		{ path: "Beta.md", links: ["current.md"] },
		{ path: "unrelated.md", links: ["Beta.md"] },
	]);
	const entries = buildJumpList(onlyBuiltIn("linksIn"), vault, vault.note("current.md"));
	assert.deepEqual(describe(entries), ["🔗 in  | 2024-03-05 | Tuesday", "🔗 in  | Beta"]);
});

test("same day uses ctime for ordinary notes", () => {
	const vault = fakeVault([
		{ path: "current.md", ctime: MARCH_5 },
		{ path: "b.md", ctime: new Date(2024, 2, 5, 23, 59).getTime() },
		{ path: "a.md", ctime: new Date(2024, 2, 5, 0, 1).getTime() },
		{ path: "c.md", ctime: new Date(2024, 2, 6, 0, 1).getTime() },
	]);
	const entries = buildJumpList(onlyBuiltIn("sameDay"), vault, vault.note("current.md"));
	assert.deepEqual(describe(entries), ["🔅 ctx | a", "🔅 ctx | b"]);
});

test("same day uses the date in the name for date notes", () => {
	const vault = fakeVault([
		{ path: "on/2024-03-05.md", ctime: MARCH_9 },
		{ path: "written-that-day.md", ctime: MARCH_5 },
		{ path: "written-later.md", ctime: MARCH_9 },
	]);
	const entries = buildJumpList(onlyBuiltIn("sameDay"), vault, vault.note("on/2024-03-05.md"));
	assert.deepEqual(describe(entries), ["🔅 ctx | written-that-day"]);
});

test("custom lists match every note by frontmatter whether or not there is a current note", () => {
	const vault = fakeVault([
		{ path: "b.md", frontmatter: { active: true } },
		{ path: "a.md", frontmatter: { active: "true" } },
		{ path: "c.md", frontmatter: { active: false } },
		{ path: "d.md" },
	]);
	const settings = onlyBuiltIn("linksIn");
	settings.builtIns.linksIn.enabled = false;
	settings.customLists = [{ prefix: "📍 act", property: "active", operator: "is true", value: "" }];
	assert.deepEqual(describe(buildJumpList(settings, vault)), ["📍 act | a", "📍 act | b"]);
	assert.deepEqual(describe(buildJumpList(settings, vault, vault.note("d.md"))), ["📍 act | a", "📍 act | b"]);
});

test("without a current note only the custom lists run", () => {
	const vault = fakeVault([
		{ path: "on/2024-03-05.md", ctime: MARCH_5, links: ["linked.md"] },
		{ path: "linked.md", ctime: MARCH_5, frontmatter: { tags: ["[[Work|work]]"] } },
	]);
	const settings = defaultSettings();
	settings.customLists = [{ prefix: "💼 work", property: "tags", operator: "contains", value: "Work" }];
	assert.deepEqual(describe(buildJumpList(settings, vault)), ["💼 work | linked"]);
});

test("the lists run in order, the first occurrence of a note wins and the current note never appears", () => {
	const vault = fakeVault([
		{ path: "on/2024-03-05.md", ctime: MARCH_5, links: ["on/2024-03-06.md", "zed.md", "on/2024-03-05.md"] },
		{ path: "on/2024-03-06.md", ctime: MARCH_9 },
		{ path: "zed.md", ctime: MARCH_5, links: ["on/2024-03-05.md"], frontmatter: { active: true } },
		{ path: "backlink.md", links: ["on/2024-03-05.md"], frontmatter: { area: "home" } },
		{ path: "same-day.md", ctime: MARCH_5, frontmatter: { active: true } },
		{ path: "active.md", frontmatter: { active: true, area: "home" } },
		{ path: "home.md", frontmatter: { area: "home" } },
	]);
	const settings = defaultSettings();
	settings.customLists = [
		{ prefix: "📍 act", property: "active", operator: "is true", value: "" },
		{ prefix: "🏠 home", property: "area", operator: "equals", value: "home" },
	];
	const entries = buildJumpList(settings, vault, vault.note("on/2024-03-05.md"));
	assert.deepEqual(describe(entries), [
		"📅 day | 2024-03-06 | next day - Wednesday",
		"🔗 out | zed",
		"🔗 in  | backlink",
		"🔅 ctx | same-day",
		"📍 act | active",
		"🏠 home | home",
	]);
});

test("disabled built-ins are skipped", () => {
	const vault = fakeVault([
		{ path: "current.md", ctime: MARCH_5, links: ["out.md"] },
		{ path: "out.md", ctime: MARCH_5, links: ["current.md"] },
		{ path: "in.md", links: ["current.md"] },
	]);
	const settings = defaultSettings();
	settings.builtIns.linksOut.enabled = false;
	settings.builtIns.sameDay.enabled = false;
	assert.deepEqual(describe(buildJumpList(settings, vault, vault.note("current.md"))), ["🔗 in  | in", "🔗 in  | out"]);
});
