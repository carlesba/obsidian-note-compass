import { test } from "node:test";
import { strict as assert } from "node:assert";
import type { Frontmatter, JumpListVault, PropertyValueCount, VaultNote } from "../src/lists/vault.ts";
import { defaultSettings } from "../src/settings.ts";
import type { EditableProperty, EditablePropertyType } from "../src/settings.ts";
import {
	CANCEL_LABEL,
	SAVE_LABEL,
	initialPropertyState,
	pickerChoices,
	propertyType,
	withValue,
	writeProperties,
} from "../src/setProperties/picker.ts";
import type { PropertyState } from "../src/setProperties/picker.ts";
import { CLEAR_LABEL, DONE_LABEL, valueChoices, valuePicker } from "../src/setProperties/valuePicker.ts";
import type { ValueChoice } from "../src/setProperties/valuePicker.ts";
import { moment } from "./moment.ts";

interface FakeNote {
	path: string;
	mtime?: number;
	frontmatter?: Frontmatter;
	links?: string[];
}

const NOW = new Date(2024, 2, 9, 15).getTime();
const HOURS_AGO = (hours: number) => NOW - hours * 3600 * 1000;
const OFF = "\u2003";

function fakeVault(fakes: FakeNote[]): JumpListVault & { note(path: string): VaultNote } {
	const notes = fakes.map((fake) => ({ path: fake.path, basename: fake.path.split("/").pop()!.replace(/\.md$/, ""), ctime: 0 }));
	const byPath = new Map(fakes.map((fake) => [fake.path, fake]));
	return {
		notes: () => notes,
		frontmatter: (path) => byPath.get(path)?.frontmatter,
		updateFrontmatter: async (path, update) => {
			const fake = byPath.get(path)!;
			fake.frontmatter = { ...fake.frontmatter };
			update(fake.frontmatter);
		},
		linksFrom: (path) => byPath.get(path)?.links ?? [],
		linksTo: (path) => fakes.filter((fake) => fake.links?.includes(path)).map((fake) => fake.path),
		mtime: (path) => byPath.get(path)?.mtime ?? HOURS_AGO(48),
		periodicNotesSettings: () => undefined,
		dailyNotesOptions: () => undefined,
		propertyTypes: () => ({}),
		propertyValueCounts: (property) => {
			const counts: PropertyValueCount[] = [];
			for (const fake of fakes) {
				const value = fake.frontmatter?.[property];
				for (const item of Array.isArray(value) ? value : [value]) {
					if (typeof item !== "string" && typeof item !== "number") continue;
					const known = counts.find((count) => count.value === item);
					if (known) known.count++;
					else counts.push({ value: item, count: 1 });
				}
			}
			return counts;
		},
		now: () => NOW,
		moment,
		note: (path) => notes.find((note) => note.path === path)!,
	};
}

function vaultNotes(): FakeNote[] {
	return [
		{
			path: "Today.md",
			mtime: HOURS_AGO(1),
			frontmatter: { active: true, status: "doing", people: ["[[people/Ann|Ann]]", "[[Stranger]]"], topic: "x" },
		},
		{ path: "types/Person.md" },
		{ path: "people/Ann.md", mtime: HOURS_AGO(30), links: ["types/Person.md"], frontmatter: { status: "done" } },
		{ path: "people/Bob.md", mtime: HOURS_AGO(2), links: ["types/Person.md"], frontmatter: { status: "done", rating: 3 } },
		{ path: "people/Cy.md", mtime: HOURS_AGO(5), links: ["types/Person.md"], frontmatter: { rating: 3 } },
		{ path: "people/Old.md", mtime: HOURS_AGO(3), links: ["types/Person.md"], frontmatter: { archived: true } },
		{ path: "templates/Person.md", links: ["types/Person.md"] },
		{ path: "Today too.md", links: ["types/Person.md", "Today.md"], frontmatter: { rating: 4.5 } },
	];
}

function entry(property: string, type: EditablePropertyType, extra: Partial<EditableProperty> = {}): EditableProperty {
	const linked = type === "link" || type === "links";
	return {
		id: property + type,
		enabled: true,
		prefix: "",
		property,
		type,
		...(linked ? { source: { kind: "linksToNote" as const, note: "types/Person.md" }, excludedFolder: "templates" } : {}),
		...extra,
	};
}

function setup(properties: EditableProperty[]) {
	const settings = defaultSettings();
	settings.setProperties.properties = properties;
	const vault = fakeVault(vaultNotes());
	const target = vault.note("Today.md");
	const initial = initialPropertyState(settings.setProperties, vault.frontmatter(target.path));
	const choicesFor = (picked: EditableProperty, state: PropertyState = initial, query = "") =>
		valueChoices(
			valuePicker(settings, vault, target, picked, propertyType(settings.setProperties, picked)),
			state.get(picked.property),
			query,
		);
	return { settings, vault, target, initial, choicesFor };
}

const labels = (choices: readonly { label: string }[]) => choices.map((choice) => choice.label);

const pick = (choices: readonly ValueChoice[], label: string) => choices.find((choice) => choice.label.endsWith(label))!;

function written(initial: PropertyState, state: PropertyState, frontmatter: Frontmatter = {}): Frontmatter {
	const result = { ...frontmatter };
	writeProperties(result, initial, state);
	return result;
}

test("the main picker shows save, cancel and each enabled property with its pending value", () => {
	const active = entry("active", "checkbox", { prefix: "🎛️" });
	const { settings, initial } = setup([
		active,
		entry("due", "date", { prefix: "📅" }),
		entry("people", "links", { prefix: "👤" }),
		entry("hidden", "text", { enabled: false }),
		entry("people", "links", { id: "more", prefix: "🧑" }),
	]);
	assert.deepEqual(labels(pickerChoices(settings.setProperties, initial, initial)), [
		SAVE_LABEL,
		CANCEL_LABEL,
		`${OFF} 🎛️ active · true`,
		`${OFF} 📅 due · —`,
		`${OFF} 👤 people · Ann, Stranger`,
		`${OFF} 🧑 people · Ann, Stranger`,
	]);
	const changed = withValue(initial, "active", false);
	assert.equal(labels(pickerChoices(settings.setProperties, initial, changed))[2], "• 🎛️ active · false");
	const choice = pickerChoices(settings.setProperties, initial, initial)[2].choice;
	assert.deepEqual(choice, { action: "edit", entry: active });
});

test("the first enabled entry decides the type of a shared property", () => {
	const { settings } = setup([entry("due", "text", { enabled: false }), entry("due", "date"), entry("due", "text")]);
	assert.equal(propertyType(settings.setProperties, settings.setProperties.properties[2]), "date");
});

test("a checkbox offers true, false and clear, marks the pending value and can write false", () => {
	const active = entry("active", "checkbox");
	const { initial, choicesFor } = setup([active]);
	const choices = choicesFor(active);
	assert.deepEqual(labels(choices), ["✓ true", `${OFF} false`, `${OFF} ${CLEAR_LABEL}`]);
	const state = withValue(initial, "active", pick(choices, "false").value);
	assert.deepEqual(written(initial, state, { active: true }), { active: false });
	assert.deepEqual(labels(choicesFor(active, state)), [`${OFF} true`, "✓ false", `${OFF} ${CLEAR_LABEL}`]);
});

test("a text picker offers the typed value, then vault values most used first, then clear", () => {
	const status = entry("status", "text");
	const { choicesFor } = setup([status]);
	assert.deepEqual(labels(choicesFor(status)), [`${OFF} done (2)`, "✓ doing (1)", `${OFF} ${CLEAR_LABEL}`]);
	const typed = choicesFor(status, undefined, "dne");
	assert.deepEqual(labels(typed), [`${OFF} ✏️ Use "dne"`, `${OFF} done (2)`]);
	assert.equal(typed[0].value, "dne");
	assert.deepEqual(labels(choicesFor(status, undefined, "zzz")), [`${OFF} ✏️ Use "zzz"`]);
});

test("a number picker offers use only for numbers, with vault numbers by count", () => {
	const rating = entry("rating", "number");
	const { choicesFor } = setup([rating]);
	assert.deepEqual(labels(choicesFor(rating)), [`${OFF} 3 (2)`, `${OFF} 4.5 (1)`, `✓ ${CLEAR_LABEL}`]);
	assert.equal(choicesFor(rating, undefined, "-2.5")[0].value, -2.5);
	assert.deepEqual(labels(choicesFor(rating, undefined, "12a")), []);
});

test("a date picker accepts YYYYMMDD and YYYY-MM-DD and offers presets from today", () => {
	const due = entry("due", "date");
	const { choicesFor } = setup([due]);
	assert.deepEqual(labels(choicesFor(due)), [
		`${OFF} Today (2024-03-09)`,
		`${OFF} Tomorrow (2024-03-10)`,
		`${OFF} Next Monday (2024-03-11)`,
		`${OFF} In a week (2024-03-16)`,
		`✓ ${CLEAR_LABEL}`,
	]);
	assert.equal(choicesFor(due, undefined, "20240402")[0].value, "2024-04-02");
	assert.equal(choicesFor(due, undefined, "2024-04-02")[0].label, `${OFF} ✏️ Use "2024-04-02"`);
	assert.deepEqual(labels(choicesFor(due, undefined, "2024-02-30")), []);
	assert.deepEqual(labels(choicesFor(due, undefined, "tmrw")), [`${OFF} Tomorrow (2024-03-10)`]);
});

test("a datetime picker accepts the three typed forms and offers now", () => {
	const start = entry("start", "datetime");
	const { choicesFor } = setup([start]);
	assert.deepEqual(labels(choicesFor(start)), [`${OFF} Now (2024-03-09T15:00)`, `✓ ${CLEAR_LABEL}`]);
	for (const input of ["20240402 0930", "2024-04-02 09:30", "2024-04-02T09:30"]) {
		assert.equal(choicesFor(start, undefined, input)[0].value, "2024-04-02T09:30");
	}
	assert.deepEqual(labels(choicesFor(start, undefined, "2024-04-02 24:00")), []);
	assert.deepEqual(labels(choicesFor(start, undefined, "2024-04-02")), []);
});

test("a link picker lists the source's notes, selected first then newest, and choosing the selected one clears it", () => {
	const owner = entry("owner", "link");
	const { initial, choicesFor } = setup([owner]);
	assert.deepEqual(labels(choicesFor(owner)), [
		`${OFF} Bob`,
		`${OFF} Cy`,
		`${OFF} Ann`,
		`${OFF} Today too`,
		`✓ ${CLEAR_LABEL}`,
	]);
	const state = withValue(initial, "owner", pick(choicesFor(owner), "Ann").value);
	assert.equal(state.get("owner"), "[[Ann]]");
	assert.deepEqual(labels(choicesFor(owner, state)).slice(0, 2), ["✓ Ann", `${OFF} Bob`]);
	assert.equal(pick(choicesFor(owner, state), "Ann").value, undefined);
	assert.deepEqual(written(initial, state), { owner: "[[Ann]]" });
});

test("a links picker starts with done, toggles notes and keeps values no row offers", () => {
	const people = entry("people", "links");
	const { initial, choicesFor } = setup([people]);
	const choices = choicesFor(people);
	assert.deepEqual(labels(choices), [
		DONE_LABEL,
		"✓ Ann",
		`${OFF} Bob`,
		`${OFF} Cy`,
		`${OFF} Today too`,
		`${OFF} ${CLEAR_LABEL}`,
	]);
	assert.equal(pick(choices, "Bob").reopens, true);
	const withBob = withValue(initial, "people", pick(choices, "Bob").value);
	const withoutAnn = withValue(withBob, "people", pick(choicesFor(people, withBob), "Ann").value);
	const done = pick(choicesFor(people, withoutAnn), DONE_LABEL);
	assert.equal(done.reopens, false);
	assert.deepEqual(written(initial, withValue(withoutAnn, "people", done.value)), { people: ["[[Stranger]]", "[[Bob]]"] });
});

test("clear deletes the key and unchanged properties are not written", () => {
	const people = entry("people", "links");
	const status = entry("status", "text");
	const { initial, choicesFor } = setup([people, status, entry("active", "checkbox")]);
	const saved = { people: ["[[people/Ann|Ann]]", "[[Stranger]]"], status: "doing", active: true };
	assert.deepEqual(written(initial, initial, saved), saved);
	const cleared = withValue(initial, "people", pick(choicesFor(people), CLEAR_LABEL).value);
	assert.deepEqual(written(initial, cleared, saved), { status: "doing", active: true });
	assert.deepEqual(written(initial, withValue(initial, "status", "doing"), {}), {});
});
