import { test } from "node:test";
import { strict as assert } from "node:assert";
import type { Frontmatter, JumpListVault, VaultNote } from "../src/lists/vault.ts";
import { defaultSettings } from "../src/settings.ts";
import type { LegacySetPropertiesSettings } from "../src/settings.ts";
import { editLegacyView } from "../src/setProperties/legacyView.ts";
import {
	CANCEL_LABEL,
	SAVE_LABEL,
	initialPropertyState,
	pickerChoices,
	propertyRows,
	toggleRow,
	writeProperties,
} from "../src/setProperties/picker.ts";
import type { PropertyRow, PropertyState } from "../src/setProperties/picker.ts";
import { linkTitle } from "../src/setProperties/values.ts";
import { moment } from "./moment.ts";

interface FakeNote {
	path: string;
	mtime?: number;
	frontmatter?: Frontmatter;
	links?: string[];
}

const NOW = new Date(2024, 2, 9, 15).getTime();
const HOURS_AGO = (hours: number) => NOW - hours * 3600 * 1000;

function fakeVault(fakes: FakeNote[]): JumpListVault & { note(path: string): VaultNote; saved: Frontmatter[] } {
	const notes = fakes.map((fake) => ({ path: fake.path, basename: fake.path.split("/").pop()!.replace(/\.md$/, ""), ctime: 0 }));
	const byPath = new Map(fakes.map((fake) => [fake.path, fake]));
	const saved: Frontmatter[] = [];
	return {
		notes: () => notes,
		frontmatter: (path) => byPath.get(path)?.frontmatter,
		updateFrontmatter: async (path, update) => {
			const fake = byPath.get(path)!;
			fake.frontmatter = { ...fake.frontmatter };
			update(fake.frontmatter);
			saved.push(fake.frontmatter);
		},
		linksFrom: (path) => byPath.get(path)?.links ?? [],
		linksTo: (path) => fakes.filter((fake) => fake.links?.includes(path)).map((fake) => fake.path),
		mtime: (path) => byPath.get(path)?.mtime ?? HOURS_AGO(48),
		periodicNotesSettings: () => undefined,
		dailyNotesOptions: () => undefined,
		propertyTypes: () => ({ active: "checkbox", evergreen: "checkbox", archived: "checkbox" }),
		now: () => NOW,
		moment,
		note: (path) => notes.find((note) => note.path === path)!,
		saved,
	};
}

function vaultNotes(): FakeNote[] {
	return [
		{ path: "Today.md", mtime: HOURS_AGO(1), frontmatter: { active: true, people: ["[[people/Ann|Ann]]", "[[Stranger]]"], topic: "x" } },
		{ path: "types/Person 👤.md" },
		{ path: "types/Org 🏢.md" },
		{ path: "people/Ann.md", mtime: HOURS_AGO(30), links: ["types/Person 👤.md"] },
		{ path: "people/Bob.md", mtime: HOURS_AGO(2), links: ["types/Person 👤.md"] },
		{ path: "people/Old.md", mtime: HOURS_AGO(3), links: ["types/Person 👤.md"], frontmatter: { archived: true } },
		{ path: "templates/Person.md", links: ["types/Person 👤.md"] },
		{ path: "orgs/Acme.md", mtime: HOURS_AGO(40), links: ["types/Org 🏢.md"], frontmatter: { evergreen: true } },
		{ path: "categories/Work.md", mtime: HOURS_AGO(50) },
		{ path: "categories/Home.md", mtime: HOURS_AGO(60) },
		{ path: "Ideas.md", mtime: HOURS_AGO(70), frontmatter: { evergreen: true } },
	];
}

function setup(change: (view: LegacySetPropertiesSettings) => void = () => {}) {
	const settings = defaultSettings();
	editLegacyView(settings.setProperties, (view) => {
		view.flags = ["active", "someday"];
		change(view);
	});
	const vault = fakeVault(vaultNotes());
	const target = vault.note("Today.md");
	const rows = propertyRows(settings, vault, target);
	const state = initialPropertyState(settings.setProperties, vault.frontmatter(target.path));
	return { settings, vault, target, rows, state };
}

const labels = (rows: PropertyRow[], state: PropertyState) => pickerChoices(rows, state).map((choice) => choice.label);

const row = (rows: PropertyRow[], prefix: string, name: string) =>
	rows.find((candidate) => candidate.prefix === prefix && candidate.name === name)!;

function saved(initial: PropertyState, state: PropertyState, frontmatter: Frontmatter = {}): Frontmatter {
	const written = { ...frontmatter };
	writeProperties(written, initial, state);
	return written;
}

test("the picker opens with save and cancel, then selected rows, then flags and each list in settings order by mtime", () => {
	const { rows, state } = setup();
	assert.deepEqual(labels(rows, state), [
		SAVE_LABEL,
		CANCEL_LABEL,
		"✓ 🎛️ meta | active",
		"✓ 👤 peop | Ann",
		"\u2003 🎛️ meta | someday",
		"\u2003 👤 peop | Bob",
		"\u2003 📂 catg | Work",
		"\u2003 📂 catg | Home",
		"\u2003 🏷️ ever | Acme",
		"\u2003 🏷️ ever | Ideas",
	]);
});

test("rows leave out the target note, templates, archived notes and disabled lists, and the first list owns a shared note", () => {
	const { rows } = setup((view) => {
		view.linkLists[3].enabled = false;
	});
	const names = rows.map((candidate) => `${candidate.prefix} ${candidate.name}`);
	assert.ok(!names.some((name) => name.endsWith("| Today") || name.endsWith("| Old") || name.endsWith("| Person")));
	assert.ok(!names.some((name) => name.startsWith("📂 catg |")));
	assert.deepEqual(
		names.filter((name) => name.endsWith("| Acme")),
		["🏷️ ever | Acme"],
	);
});

test("the templates folder setting decides which notes are excluded", () => {
	const { rows } = setup((view) => {
		view.templatesFolder = "people/";
	});
	assert.deepEqual(
		rows.filter((candidate) => candidate.prefix === "👤 peop |").map((candidate) => candidate.name),
		["Person"],
	);
});

test("today lists notes modified since midnight that no earlier list owns", () => {
	const todayRows = (rows: PropertyRow[]) => rows.filter((candidate) => candidate.prefix === "🔅 tday |").map((candidate) => candidate.name);
	assert.deepEqual(todayRows(setup().rows), []);
	const withoutPeople = setup((view) => {
		view.linkLists[0].enabled = false;
	});
	assert.deepEqual(todayRows(withoutPeople.rows), ["Bob"]);
});

test("choosing a row toggles it and the reopened picker moves it among the selected rows", () => {
	const { rows, state } = setup();
	const next = toggleRow(state, row(rows, "📂 catg |", "Home"));
	assert.deepEqual(labels(rows, next).slice(2, 5), ["✓ 🎛️ meta | active", "✓ 👤 peop | Ann", "✓ 📂 catg | Home"]);
	assert.deepEqual(labels(rows, toggleRow(next, row(rows, "📂 catg |", "Home"))), labels(rows, state));
});

test("a flag writes true when selected and deletes its key when not, never false", () => {
	const { rows, state } = setup();
	const flipped = toggleRow(toggleRow(state, row(rows, "🎛️ meta |", "active")), row(rows, "🎛️ meta |", "someday"));
	assert.deepEqual(saved(state, flipped, { active: true }), { someday: true });
});

test("a property the picker did not change keeps its saved value", () => {
	const { rows, state } = setup();
	const someday = row(rows, "🎛️ meta |", "someday");
	const untouched = toggleRow(toggleRow(state, someday), someday);
	const original = { someday: "later", people: "[[people/Ann|Ann]]" };
	assert.deepEqual(saved(state, untouched, original), original);
});

test("a multi list adds and removes links and keeps the values it does not offer", () => {
	const { rows, state } = setup();
	const withBob = toggleRow(state, row(rows, "👤 peop |", "Bob"));
	assert.deepEqual(saved(state, withBob).people, ["[[people/Ann|Ann]]", "[[Stranger]]", "[[Bob]]"]);
	const withoutAnn = toggleRow(withBob, row(rows, "👤 peop |", "Ann"));
	assert.deepEqual(saved(state, withoutAnn).people, ["[[Stranger]]", "[[Bob]]"]);
});

test("a multi list deletes its key when nothing is selected", () => {
	const { settings, rows, state } = setup();
	assert.deepEqual(saved(state, toggleRow(state, row(rows, "🏷️ ever |", "Acme")), { related: [] }).related, ["[[Acme]]"]);
	const onlyAnn = initialPropertyState(settings.setProperties, { people: ["[[Ann]]"] });
	assert.ok(!("people" in saved(onlyAnn, toggleRow(onlyAnn, row(rows, "👤 peop |", "Ann")), { people: ["[[Ann]]"] })));
});

test("a single list writes one link, replaces it with another row and clears it when chosen again", () => {
	const { settings, rows, state } = setup();
	const work = toggleRow(state, row(rows, "📂 catg |", "Work"));
	assert.equal(saved(state, work).category, "[[Work]]");
	const home = toggleRow(work, row(rows, "📂 catg |", "Home"));
	assert.equal(saved(state, home).category, "[[Home]]");
	const atHome = initialPropertyState(settings.setProperties, { category: "[[Home]]" });
	assert.ok(!("category" in saved(atHome, toggleRow(atHome, row(rows, "📂 catg |", "Home")), { category: "[[Home]]" })));
});

test("the initial state matches saved links by alias or link text and keeps unmatched values on save", () => {
	const { settings, rows } = setup();
	const original = {
		someday: true,
		category: "[[categories/Work|Work]]",
		people: "[[Ann]]",
		related: ["Ideas", 42],
		archived: true,
	};
	const state = initialPropertyState(settings.setProperties, original);
	assert.deepEqual(labels(rows, state).slice(2, 7), [
		"✓ 🎛️ meta | someday",
		"✓ 👤 peop | Ann",
		"✓ 📂 catg | Work",
		"✓ 🏷️ ever | Ideas",
		"\u2003 🎛️ meta | active",
	]);
	const withAcme = toggleRow(toggleRow(state, row(rows, "🏷️ ever |", "Acme")), row(rows, "👤 peop |", "Bob"));
	assert.deepEqual(saved(state, withAcme, original), {
		...original,
		people: ["[[Ann]]", "[[Bob]]"],
		related: ["Ideas", 42, "[[Acme]]"],
	});
});

test("properties outside every list and links no row offers survive a save through the vault", async () => {
	const { vault, target, rows, state } = setup();
	const changed = toggleRow(toggleRow(state, row(rows, "👤 peop |", "Bob")), row(rows, "🎛️ meta |", "someday"));
	await vault.updateFrontmatter(target.path, (frontmatter) => writeProperties(frontmatter, state, changed));
	assert.deepEqual(vault.saved, [
		{ active: true, someday: true, people: ["[[people/Ann|Ann]]", "[[Stranger]]", "[[Bob]]"], topic: "x" },
	]);
});

test("disabled link lists leave their property alone", () => {
	const { rows, state } = setup((view) => {
		view.linkLists[3].enabled = false;
	});
	assert.ok(!state.links.has("category"));
	assert.equal(saved(state, state, { category: "[[Work]]" }).category, "[[Work]]");
	assert.ok(rows.every((candidate) => candidate.property !== "category"));
});

test("link titles follow the alias, then the link target, then the bare text", () => {
	assert.equal(linkTitle("[[a/B|Bee]]"), "Bee");
	assert.equal(linkTitle("[[a/B]]"), "a/B");
	assert.equal(linkTitle("'Plain'"), "Plain");
	assert.equal(linkTitle(7), 7);
});
