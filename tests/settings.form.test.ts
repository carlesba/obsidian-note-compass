import { test } from "node:test";
import { strict as assert } from "node:assert";
import { CONDITIONS_BY_TYPE, PROPERTY_TYPES } from "../src/lists/conditions.ts";
import type { Condition } from "../src/lists/conditions.ts";
import { defaultDateNoteSettings } from "../src/lists/dateNotes.ts";
import type { Frontmatter, JumpListVault } from "../src/lists/vault.ts";
import { defaultSettings } from "../src/settings.ts";
import type { NoteList } from "../src/settings.ts";
import { DATE_NOTE_SOURCE_KEY, listKey, periodKey, readControl, writeControl } from "../src/settings/controlKeys.ts";
import { formatError, resolvedPeriodRows, resolvedSourceName, writePeriodField } from "../src/settings/dateNotesForm.ts";
import {
	fixedDateError,
	inapplicableCondition,
	listDisplayValue,
	listName,
	matchingSuggestions,
	newList,
	operatorOptions,
	propertySuggestions,
	readListField,
	valueShape,
	writeListField,
} from "../src/settings/listForm.ts";
import { moment } from "./moment.ts";

interface FakeVault {
	frontmatter?: Record<string, Frontmatter>;
	propertyTypes?: Record<string, string>;
	periodicNotes?: unknown;
	dailyNotes?: unknown;
}

function fakeVault(fakes: FakeVault = {}): JumpListVault {
	const frontmatter = fakes.frontmatter ?? {};
	return {
		notes: () => Object.keys(frontmatter).map((path) => ({ path, basename: path.replace(/\.md$/, ""), ctime: 0 })),
		frontmatter: (path) => frontmatter[path],
		updateFrontmatter: async () => {},
		linksFrom: () => [],
		linksTo: () => [],
		mtime: () => 0,
		periodicNotesSettings: () => fakes.periodicNotes,
		dailyNotesOptions: () => fakes.dailyNotes,
		propertyTypes: () => fakes.propertyTypes ?? {},
		now: () => 0,
		moment,
	};
}

function propertyList(property: string, condition: Condition, enabled = true): NoteList {
	return { id: "list-5", enabled, prefix: "⭐", source: { kind: "frontmatter", property, condition } };
}

test("operator options follow the conditions table for every property type", () => {
	for (const type of PROPERTY_TYPES) assert.deepEqual(Object.keys(operatorOptions(type)), CONDITIONS_BY_TYPE[type]);
});

test("operator options keep a stored operator that the type does not offer", () => {
	assert.deepEqual(operatorOptions("number", "is"), { "=": "=", "<": "<", ">": ">", "is set": "is set", is: "is (does not apply)" });
	assert.equal(operatorOptions("text", "has item")["has item"], "has item");
	assert.equal(Object.keys(operatorOptions("checkbox", "is true")).length, 4);
});

test("a row is named by its prefix and a summary of its source, and says off when disabled", () => {
	const lists = defaultSettings().lists;
	assert.equal(listName(lists[0]), "📅 day Adjacent dates");
	assert.equal(listName(propertyList("favorite", { operator: "is true" })), "⭐ favorite is true");
	assert.equal(listName(propertyList("status", { operator: "is", value: "active" })), "⭐ status is active");
	assert.equal(listName(propertyList("rating", { operator: ">", value: 3 })), "⭐ rating > 3");
	assert.equal(listName(propertyList("due", { operator: "on", value: { kind: "fixed", date: "2024-03-05" } })), "⭐ due on 2024-03-05");
	assert.equal(listName(propertyList("due", { operator: "before", value: { kind: "relative", days: -3 } })), "⭐ due before 3 days ago");
	assert.equal(listName(propertyList("due", { operator: "after", value: { kind: "relative", days: 1 } })), "⭐ due after 1 day from now");
	assert.equal(listName(propertyList("due", { operator: "on", value: { kind: "relative", days: 0 } })), "⭐ due on today");
	assert.equal(listName({ ...newList(lists), prefix: "" }), "Property not chosen");
	assert.equal(listName({ ...lists[0], prefix: "👤", source: { kind: "linksToNote", note: "types/Person 👤.md" } }), "👤 Links to Person 👤");
	assert.equal(listName({ ...lists[0], prefix: "👤", source: { kind: "linksToNote", note: "" } }), "👤 Note not chosen");
	assert.equal(listName({ ...lists[0], prefix: "📂", source: { kind: "inFolder", folder: "areas/categories" } }), "📂 In areas/categories");
	assert.equal(listName({ ...lists[0], prefix: "📂", source: { kind: "inFolder", folder: "" } }), "📂 Folder not chosen");
	assert.equal(listName({ ...lists[0], prefix: "🔅", source: { kind: "modifiedToday" } }), "🔅 Modified today");
	assert.equal(listDisplayValue(propertyList("favorite", { operator: "is true" }, false)), "off");
	assert.equal(listDisplayValue(lists[0]), "");
});

test("a new list is a disabled property list with the next id and no prefix", () => {
	assert.deepEqual(newList(defaultSettings().lists), {
		id: "list-5",
		enabled: false,
		prefix: "",
		source: { kind: "frontmatter", property: "", condition: { operator: "is set" } },
	});
});

test("a condition that no longer fits the property's type is reported without being rewritten", () => {
	const migratedEquals = propertyList("rating", { operator: "is", value: "3" });
	const types = { rating: "number", starred: "text" };
	assert.match(inapplicableCondition(migratedEquals.source, types) ?? "", /"is" does not apply to a number property/);
	assert.match(inapplicableCondition(propertyList("starred", { operator: "is true" }).source, types) ?? "", /text property/);
	assert.equal(inapplicableCondition(propertyList("rating", { operator: ">", value: 3 }).source, types), undefined);
	assert.equal(inapplicableCondition(propertyList("unknown", { operator: "contains", value: "x" }).source, {}), undefined);
	assert.equal(inapplicableCondition(defaultSettings().lists[0].source, types), undefined);

	writeListField(migratedEquals, "property", "Starred");
	assert.deepEqual(migratedEquals.source, { kind: "frontmatter", property: "Starred", condition: { operator: "is", value: "3" } });
});

test("the value control follows the operator", () => {
	assert.equal(valueShape("is set"), "none");
	assert.equal(valueShape("contains"), "text");
	assert.equal(valueShape("<"), "number");
	assert.equal(valueShape("after"), "date");
});

test("changing the operator keeps a value of the same shape and starts others empty", () => {
	const list = propertyList("status", { operator: "is", value: "active" });
	writeListField(list, "operator", "contains");
	assert.deepEqual(readListField(list, "text"), "active");
	writeListField(list, "operator", "=");
	assert.equal(readListField(list, "number"), 0);
	writeListField(list, "number", 4);
	writeListField(list, "operator", "on");
	assert.deepEqual(list.source, { kind: "frontmatter", property: "status", condition: { operator: "on", value: { kind: "relative", days: 0 } } });
	writeListField(list, "operator", "is not set");
	assert.deepEqual(list.source, { kind: "frontmatter", property: "status", condition: { operator: "is not set" } });
	writeListField(list, "operator", "nonsense");
	assert.equal(readListField(list, "operator"), "is not set");
});

test("date values map onto a mode, a date, a number of days and a direction", () => {
	const list = propertyList("due", { operator: "before", value: { kind: "relative", days: -3 } });
	assert.deepEqual(["dateMode", "days", "direction"].map((field) => readListField(list, field as "days")), ["relative", 3, "ago"]);
	writeListField(list, "direction", "fromNow");
	assert.equal(readListField(list, "direction"), "fromNow");
	writeListField(list, "days", 5);
	writeListField(list, "days", 0);
	assert.deepEqual(readListField(list, "days"), 5);
	writeListField(list, "direction", "today");
	assert.deepEqual(["direction", "days"].map((field) => readListField(list, field as "days")), ["today", 0]);
	writeListField(list, "direction", "ago");
	assert.deepEqual(list.source.kind === "frontmatter" && list.source.condition, { operator: "before", value: { kind: "relative", days: -1 } });
	writeListField(list, "days", 5);
	assert.deepEqual(list.source.kind === "frontmatter" && list.source.condition, { operator: "before", value: { kind: "relative", days: -5 } });
	writeListField(list, "dateMode", "fixed");
	writeListField(list, "date", " 2024-03-05 ");
	assert.deepEqual(list.source.kind === "frontmatter" && list.source.condition, { operator: "before", value: { kind: "fixed", date: "2024-03-05" } });
	assert.equal(readListField(list, "dateMode"), "fixed");
	assert.equal(fixedDateError("2024-03-05"), undefined);
	assert.ok(fixedDateError("05/03/2024"));
});

test("switching the source to a relation and back starts a fresh property condition", () => {
	const list = propertyList("status", { operator: "is", value: "active" });
	writeListField(list, "source", "linksIn");
	assert.deepEqual(list.source, { kind: "linksIn" });
	assert.equal(readListField(list, "operator"), undefined);
	writeListField(list, "source", "frontmatter");
	assert.deepEqual(list.source, { kind: "frontmatter", property: "", condition: { operator: "is set" } });
	writeListField(list, "source", "unknown");
	assert.equal(list.source.kind, "frontmatter");
});

test("switching to a note or folder source starts it unchosen, and its field reads and writes only for that kind", () => {
	const list = propertyList("status", { operator: "is", value: "active" });
	writeListField(list, "source", "linksToNote");
	assert.deepEqual(list.source, { kind: "linksToNote", note: "" });
	writeListField(list, "note", " types/Person 👤.md ");
	writeListField(list, "folder", "categories");
	assert.equal(readListField(list, "note"), "types/Person 👤.md");
	assert.equal(readListField(list, "folder"), undefined);
	writeListField(list, "source", "inFolder");
	assert.deepEqual(list.source, { kind: "inFolder", folder: "" });
	writeListField(list, "folder", "categories");
	writeListField(list, "source", "inFolder");
	assert.deepEqual(list.source, { kind: "inFolder", folder: "categories" });
	writeListField(list, "source", "modifiedToday");
	assert.deepEqual(list.source, { kind: "modifiedToday" });
	assert.equal(readListField(list, "folder"), undefined);
});

test("property suggestions keep the vault's spelling and show each property's type", () => {
	const vault = fakeVault({
		frontmatter: { "a.md": { Status: "active", due: "2024-03-05" }, "b.md": { status: "done", rating: 3 } },
		propertyTypes: { status: "text", due: "date", rating: "number", tags: "tags" },
	});
	const suggestions = propertySuggestions(vault);
	assert.deepEqual(suggestions, [
		{ name: "due", type: "date" },
		{ name: "rating", type: "number" },
		{ name: "Status", type: "text" },
		{ name: "tags", type: "tags" },
	]);
	assert.deepEqual(matchingSuggestions(suggestions, " STA").map((suggestion) => suggestion.name), ["Status"]);
});

test("control keys read and write the list they name and ignore unknown ones", () => {
	const settings = defaultSettings();
	settings.lists.push(propertyList("status", { operator: "is", value: "active" }));
	assert.equal(readControl(settings, listKey("list-5", "text")), "active");
	assert.equal(writeControl(settings, listKey("list-1", "enabled"), false), true);
	assert.equal(settings.lists[0].enabled, false);
	assert.equal(writeControl(settings, listKey("list-9", "enabled"), true), false);
	assert.equal(writeControl(settings, "theme", "dark"), false);
	assert.equal(writeControl(settings, DATE_NOTE_SOURCE_KEY, "custom"), true);
	assert.equal(readControl(settings, DATE_NOTE_SOURCE_KEY), "custom");
	writeControl(settings, DATE_NOTE_SOURCE_KEY, "elsewhere");
	assert.equal(settings.dateNotes.from, "custom");
	writeControl(settings, periodKey("quarter", "enabled"), true);
	writeControl(settings, periodKey("day", "folder"), " journal ");
	assert.equal(readControl(settings, periodKey("quarter", "enabled")), true);
	assert.equal(readControl(settings, periodKey("day", "folder")), "journal");
});

test("the date notes page shows the source actually read and its formats", () => {
	const settings = defaultDateNoteSettings();
	assert.equal(resolvedSourceName(settings, fakeVault()), "Custom");
	assert.deepEqual(resolvedPeriodRows(settings, fakeVault()).map((row) => `${row.name}: ${row.desc}`), [
		'Day: YYYY-MM-DD in the "on" folder',
		'Week: GGGG-[W]WW in the "on" folder',
		'Month: YYYY-MM in the "on" folder',
		"Quarter: Off",
		'Year: YYYY in the "on" folder',
	]);

	const dailyNotes = fakeVault({ dailyNotes: { folder: "", format: "" } });
	assert.equal(resolvedSourceName(settings, dailyNotes), "Daily notes");
	assert.equal(resolvedPeriodRows(settings, dailyNotes)[0].desc, "YYYY-MM-DD at the vault root");

	const periodic = fakeVault({ periodicNotes: { weekly: { enabled: true, folder: "/weeks/", format: "" } }, dailyNotes: {} });
	assert.equal(resolvedSourceName(settings, periodic), "Periodic Notes");
	assert.deepEqual(resolvedPeriodRows(settings, periodic).map((row) => row.desc), ["Off", 'gggg-[W]ww in the "weeks" folder', "Off", "Off", "Off"]);

	settings.from = "custom";
	assert.equal(resolvedSourceName(settings, periodic), "Custom");
	writePeriodField(settings, "week", "format", " GGGG-WW ");
	assert.equal(settings.custom.week.format, "GGGG-WW");
	assert.ok(formatError(" "));
	assert.equal(formatError("YYYY"), undefined);
});
