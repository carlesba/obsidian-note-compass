import { test } from "node:test";
import { strict as assert } from "node:assert";
import { OPERATORS_BY_TYPE, PROPERTY_TYPES, propertyValueType, valueShape } from "../src/lists/conditions.ts";
import type { Condition } from "../src/lists/conditions.ts";
import { defaultDateNoteSettings } from "../src/lists/dateNotes.ts";
import type { Frontmatter, JumpListVault } from "../src/lists/vault.ts";
import { defaultSettings } from "../src/settings.ts";
import type { NoteList } from "../src/settings.ts";
import {
	DATE_NOTE_SOURCE_KEY,
	listKey,
	periodKey,
	prefixColorKey,
	readControl,
	writeControl,
} from "../src/settings/controlKeys.ts";
import { customPeriods, dateNoteSourceDescription, formatError, writePeriodField } from "../src/settings/dateNotesForm.ts";
import { fitRuleToProperty, newRule, operatorOptions, readConditionField, writeConditionField, writeProperty } from "../src/settings/filterForm.ts";
import type { ConditionField } from "../src/settings/filterForm.ts";
import type { PropertyRule } from "../src/lists/filters.ts";
import {
	fixedDateError,
	inapplicableCondition,
	listName,
	matchingSuggestions,
	moveSourceChoice,
	newList,
	propertySuggestions,
	readListField,
	sourceChoiceOrder,
	sourceSummary,
	writeListField,
} from "../src/settings/listForm.ts";
import { prefixChip } from "../src/settings/prefixChip.ts";
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
		tags: () => [],
		updateFrontmatter: async () => {},
		linksFrom: () => [],
		linksTo: () => [],
		embeds: () => [],
		size: () => 0,
		mtime: () => 0,
		periodicNotesSettings: () => fakes.periodicNotes,
		dailyNotesOptions: () => fakes.dailyNotes,
		propertyTypes: () => fakes.propertyTypes ?? {},
		propertyValueCounts: () => [],
		now: () => 0,
		moment,
	};
}

function propertyList(property: string, condition: Condition): NoteList {
	return { id: "list-5", prefix: "⭐", source: { kind: "filter", filter: { kind: "group", mode: "all", items: [propertyRule(property, condition)] } } };
}

function propertyRule(property: string, condition: Condition): PropertyRule {
	return { kind: "property", property, condition };
}

test("operator options follow the conditions table for every property type", () => {
	for (const type of PROPERTY_TYPES) assert.deepEqual(Object.keys(operatorOptions(propertyValueType(type))), OPERATORS_BY_TYPE[propertyValueType(type)]);
});

test("operator options keep a stored operator that the type does not offer", () => {
	assert.deepEqual(operatorOptions("number", "is"), {
		"=": "=",
		"≠": "≠",
		"<": "<",
		"≤": "≤",
		">": ">",
		"≥": "≥",
		"is empty": "is empty",
		"is not empty": "is not empty",
		is: "is (does not apply)",
	});
	assert.equal(operatorOptions("list", "contains").contains, "contains");
	assert.equal(Object.keys(operatorOptions("boolean", "is")).length, 2);
});

test("a row is named by its prefix and a summary of its source", () => {
	const lists = defaultSettings().notePickers[0].lists;
	assert.equal(listName(lists[0]), "📅 day Adjacent dates");
	assert.equal(listName(propertyList("favorite", { operator: "is", value: true })), "⭐ favorite is true");
	assert.equal(listName(propertyList("status", { operator: "is", value: "active" })), "⭐ status is active");
	assert.equal(listName(propertyList("rating", { operator: ">", value: 3 })), "⭐ rating > 3");
	assert.equal(listName(propertyList("due", { operator: "on", value: { kind: "fixed", date: "2024-03-05" } })), "⭐ due on 2024-03-05");
	assert.equal(listName(propertyList("due", { operator: "before", value: { kind: "relative", days: -3 } })), "⭐ due before 3 days ago");
	assert.equal(listName(propertyList("due", { operator: "after", value: { kind: "relative", days: 1 } })), "⭐ due after 1 day from now");
	assert.equal(listName(propertyList("due", { operator: "on", value: { kind: "relative", days: 0 } })), "⭐ due on today");
	assert.equal(listName({ ...newList(lists), prefix: "" }), "No conditions yet");
	assert.equal(listName(propertyList("", { operator: "is not empty" })), "⭐ Property not chosen");
	assert.equal(listName({ ...lists[0], prefix: "👤", source: { kind: "linksToNote", note: "types/Person 👤.md" } }), "👤 Links to Person 👤");
	assert.equal(listName({ ...lists[0], prefix: "👤", source: { kind: "linksToNote", note: "" } }), "👤 Note not chosen");
	assert.equal(listName({ ...lists[0], prefix: "📂", source: { kind: "filter", filter: { kind: "group", mode: "all", items: [{ kind: "file", field: "file", condition: { operator: "in folder", value: "areas/categories" } }] } } }), "📂 file in folder areas/categories");
	assert.equal(listName({ ...lists[0], prefix: "🔅", source: { kind: "modifiedToday" } }), "🔅 Modified today");
});

test("a new list is a filter list with no conditions, the next id and no prefix", () => {
	assert.deepEqual(newList(defaultSettings().notePickers[0].lists), {
		id: "list-5",
		prefix: "",
		source: { kind: "filter", filter: { kind: "group", mode: "all", items: [] } },
	});
});

test("a condition that no longer fits the property's type is reported without being rewritten", () => {
	const migratedEquals = propertyList("rating", { operator: "is", value: "3" });
	const types = { rating: "number", starred: "text" };
	assert.match(inapplicableCondition(migratedEquals.source, types) ?? "", /"is" does not apply to a number property/);
	assert.match(inapplicableCondition(propertyList("starred", { operator: "is", value: true }).source, types) ?? "", /text property/);
	assert.equal(inapplicableCondition(propertyList("rating", { operator: ">", value: 3 }).source, types), undefined);
	assert.equal(inapplicableCondition(propertyList("unknown", { operator: "contains", value: "x" }).source, {}), undefined);
	assert.equal(inapplicableCondition(defaultSettings().notePickers[0].lists[0].source, types), undefined);

	const rule = propertyRule("rating", { operator: "is", value: "3" });
	writeProperty(rule, "Starred");
	assert.deepEqual(rule, propertyRule("Starred", { operator: "is", value: "3" }));
});

test("the value control follows the operator", () => {
	assert.equal(valueShape("text", "is empty"), "none");
	assert.equal(valueShape("text", "contains"), "text");
	assert.equal(valueShape("text", "contains all of"), "texts");
	assert.equal(valueShape("list", "is exactly"), "texts");
	assert.equal(valueShape("number", "<"), "number");
	assert.equal(valueShape("date", "after"), "date");
	assert.equal(valueShape("boolean", "is"), "boolean");
	assert.equal(valueShape("file", "links to"), "note");
	assert.equal(valueShape("file", "in folder"), "folder");
	assert.equal(valueShape("file", "has property"), "property");
	assert.equal(valueShape("number", "contains"), undefined);
});

test("changing the operator keeps a value of the same shape and converts or drops the rest", () => {
	const types = { rating: "number" };
	const rule = propertyRule("status", { operator: "is", value: "active" });
	writeConditionField(rule, "operator", "contains", types);
	assert.equal(readConditionField(rule, "text"), "active");
	writeConditionField(rule, "operator", "contains any of", types);
	assert.deepEqual(rule.condition, { operator: "contains any of", value: ["active"] });
	writeConditionField(rule, "texts", "a, b ,, c", types);
	assert.deepEqual(rule.condition, { operator: "contains any of", value: ["a", "b", "c"] });
	assert.equal(readConditionField(rule, "texts"), "a, b, c");
	writeConditionField(rule, "operator", "is empty", types);
	assert.deepEqual(rule.condition, { operator: "is empty" });
	writeConditionField(rule, "operator", "=", types);
	assert.deepEqual(rule.condition, { operator: "is empty" });
	const rating = propertyRule("rating", { operator: "=", value: 4 });
	writeConditionField(rating, "operator", "≥", types);
	assert.deepEqual(rating.condition, { operator: "≥", value: 4 });
	writeConditionField(rating, "operator", "on or after", types);
	assert.deepEqual(rating.condition, { operator: "≥", value: 4 });
	writeConditionField(rating, "operator", "nonsense", types);
	assert.equal(readConditionField(rating, "operator"), "≥");
});

test("date values map onto a mode, a date, a number of days and a direction", () => {
	const DUE_DATE = { due: "date" };
	const rule = propertyRule("due", { operator: "before", value: { kind: "relative", days: -3 } });
	const read = (fields: ConditionField[]) => fields.map((field) => readConditionField(rule, field));
	assert.deepEqual(read(["dateMode", "days", "direction"]), ["relative", 3, "ago"]);
	writeConditionField(rule, "direction", "fromNow", DUE_DATE);
	assert.equal(readConditionField(rule, "direction"), "fromNow");
	writeConditionField(rule, "days", 5, DUE_DATE);
	writeConditionField(rule, "days", 0, DUE_DATE);
	assert.deepEqual(readConditionField(rule, "days"), 5);
	writeConditionField(rule, "direction", "today", DUE_DATE);
	assert.deepEqual(read(["direction", "days"]), ["today", 0]);
	writeConditionField(rule, "direction", "ago", DUE_DATE);
	assert.deepEqual(rule.condition, { operator: "before", value: { kind: "relative", days: -1 } });
	writeConditionField(rule, "days", 5, DUE_DATE);
	assert.deepEqual(rule.condition, { operator: "before", value: { kind: "relative", days: -5 } });
	writeConditionField(rule, "dateMode", "fixed", DUE_DATE);
	writeConditionField(rule, "date", " 2024-03-05 ", DUE_DATE);
	assert.deepEqual(rule.condition, { operator: "before", value: { kind: "fixed", date: "2024-03-05" } });
	assert.equal(readConditionField(rule, "dateMode"), "fixed");
	assert.equal(fixedDateError("2024-03-05"), undefined);
	assert.ok(fixedDateError("05/03/2024"));
});

test("switching the source to a relation and back starts an empty filter", () => {
	const list = propertyList("status", { operator: "is", value: "active" });
	writeListField(list, "source", "linksIn");
	assert.deepEqual(list.source, { kind: "linksIn" });
	writeListField(list, "source", "filter");
	assert.deepEqual(list.source, { kind: "filter", filter: { kind: "group", mode: "all", items: [] } });
	writeListField(list, "source", "unknown");
	assert.equal(list.source.kind, "filter");
});

test("switching to a note source starts it unchosen, its field reads and writes only for that kind, and in folder is no longer a source", () => {
	const list = propertyList("status", { operator: "is", value: "active" });
	writeListField(list, "source", "linksToNote");
	assert.deepEqual(list.source, { kind: "linksToNote", note: "" });
	writeListField(list, "note", " types/Person 👤.md ");
	assert.equal(readListField(list, "note"), "types/Person 👤.md");
	writeListField(list, "source", "inFolder");
	assert.deepEqual(list.source, { kind: "linksToNote", note: "types/Person 👤.md" });
	writeListField(list, "source", "modifiedToday");
	assert.deepEqual(list.source, { kind: "modifiedToday" });
	assert.equal(readListField(list, "note"), undefined);
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
	assert.equal(writeControl(settings, listKey("list-1", "prefix"), "Related"), true);
	assert.equal(settings.notePickers[0].lists[0].prefix, "Related");
	assert.equal(writeControl(settings, listKey("list-99", "prefix"), "Missing"), false);
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

test("the date notes row says where each period comes from and which formats are editable", () => {
	const settings = defaultDateNoteSettings();
	assert.match(dateNoteSourceDescription(settings, fakeVault()), /^Automatic picks .* Edit each period's folder and format/);
	assert.deepEqual(customPeriods(settings, fakeVault()), ["day", "week", "month", "quarter", "year"]);

	const dailyNotes = fakeVault({ dailyNotes: { folder: "", format: "" } });
	assert.match(dateNoteSourceDescription(settings, dailyNotes), /Days come from Daily notes/);
	assert.deepEqual(customPeriods(settings, dailyNotes), ["week", "month", "quarter", "year"]);

	const periodic = fakeVault({ periodicNotes: { weekly: { enabled: true, folder: "/weeks/", format: "" } }, dailyNotes: {} });
	assert.equal(dateNoteSourceDescription(settings, periodic).endsWith("Every period comes from Periodic Notes."), true);
	assert.deepEqual(customPeriods(settings, periodic), []);

	settings.from = "periodicNotes";
	assert.match(dateNoteSourceDescription(settings, fakeVault()), /^Periodic Notes is not enabled\. Edit each period's/);

	settings.from = "custom";
	assert.equal(dateNoteSourceDescription(settings, periodic), "Edit each period's folder and format with the pencil.");
	writePeriodField(settings, "week", "format", " GGGG-WW ");
	assert.equal(settings.custom.week.format, "GGGG-WW");
	assert.ok(formatError(" "));
	assert.equal(formatError("YYYY"), undefined);
});

test("choosing a property switches the condition to one its type offers, and keeps one that already applies", () => {
	const types = { done: "checkbox", status: "text" };
	const rule = propertyRule("done", { operator: "is", value: "x" });
	fitRuleToProperty(rule, types);
	assert.deepEqual(rule, propertyRule("done", { operator: "is", value: true }));
	const status = propertyRule("", { operator: "is", value: "x" });
	writeProperty(status, " done ");
	assert.deepEqual(status, propertyRule("done", { operator: "is", value: "x" }));
	fitRuleToProperty(status, types);
	assert.deepEqual(status, propertyRule("done", { operator: "is", value: true }));
	const kept = propertyRule("status", { operator: "is not empty" });
	fitRuleToProperty(kept, types);
	assert.deepEqual(kept, propertyRule("status", { operator: "is not empty" }));
});

test("a list row's label leaves the prefix to its chip", () => {
	assert.equal(sourceSummary({ kind: "linksOut" }), "Outbound links");
	assert.equal(sourceSummary(propertyList("favorite", { operator: "is not empty" }).source), "favorite is not empty");
	assert.equal(listName({ ...propertyList("favorite", { operator: "is not empty" }), prefix: "⭐ fav" }), "⭐ fav favorite is not empty");
});

test("the prefix chip shows the trimmed prefix, or a placeholder when blank", () => {
	assert.deepEqual(prefixChip(" 🔗 out "), { text: "🔗 out", placeholder: false });
	assert.deepEqual(prefixChip("📅"), { text: "📅", placeholder: false });
	assert.deepEqual(prefixChip(""), { text: "prefix", placeholder: true });
	assert.deepEqual(prefixChip("  "), { text: "prefix", placeholder: true });
});

test("a list's prefix colour key reads blank until set, keeps valid hex and clears on anything else", () => {
	const settings = defaultSettings();
	const key = listKey("list-2", "prefixColor");
	assert.equal(prefixColorKey(listKey("list-2", "prefix")), key);
	assert.equal(readControl(settings, key), "");
	assert.equal(writeControl(settings, key, "#e0a030"), true);
	assert.equal(settings.notePickers[0].lists[1].prefixColor, "#e0a030");
	assert.equal(readControl(settings, key), "#e0a030");
	writeControl(settings, key, "");
	assert.equal("prefixColor" in settings.notePickers[0].lists[1], false);
	writeControl(settings, key, "#abc");
	writeControl(settings, key, "orange");
	assert.equal("prefixColor" in settings.notePickers[0].lists[1], false);
});

test("a current date notes list toggles each period and names the chosen ones", () => {
	const list: NoteList = { id: "list-1", prefix: "🗓️", source: { kind: "linksOut" } };
	writeListField(list, "source", "currentPeriods");
	assert.deepEqual(list.source, { kind: "currentPeriods", periods: ["day", "week", "month", "quarter", "year"] });
	writeListField(list, "currentWeek", false);
	writeListField(list, "currentQuarter", false);
	assert.deepEqual(readListField(list, "currentWeek"), false);
	assert.deepEqual(readListField(list, "currentDay"), true);
	assert.equal(sourceSummary(list.source), "Today, this month, this year");
	writeListField(list, "currentWeek", true);
	assert.deepEqual(list.source, { kind: "currentPeriods", periods: ["day", "week", "month", "year"] });
	for (const field of ["currentDay", "currentWeek", "currentMonth", "currentYear"] as const) writeListField(list, field, false);
	assert.equal(sourceSummary(list.source), "No date notes chosen");
});

test("a current date notes list keeps the dragged order and names its periods in that order", () => {
	const list: NoteList = { id: "list-1", prefix: "🗓️", source: { kind: "currentPeriods", periods: ["day", "week", "month", "quarter", "year"] } };
	moveSourceChoice(list.source, 2, 0);
	assert.deepEqual(sourceChoiceOrder(list.source), ["month", "day", "week", "quarter", "year"]);
	writeListField(list, "currentWeek", false);
	assert.equal(sourceSummary(list.source), "This month, today, this quarter, this year");
	assert.deepEqual(sourceChoiceOrder(list.source), ["month", "day", "week", "quarter", "year"]);
});

test("an adjacent dates list offers every period in both directions, all on, and switches each one off", () => {
	const list: NoteList = { id: "list-1", prefix: "📅", source: { kind: "adjacentDates" } };
	assert.deepEqual(sourceChoiceOrder(list.source), [
		"previous-day",
		"next-day",
		"previous-week",
		"next-week",
		"previous-month",
		"next-month",
		"previous-quarter",
		"next-quarter",
		"previous-year",
		"next-year",
	]);
	assert.equal(readListField(list, "adjacent-previous-week"), true);
	writeListField(list, "adjacent-previous-week", false);
	assert.equal(readListField(list, "adjacent-previous-week"), false);
	assert.equal(list.source.kind === "adjacentDates" && list.source.entries?.includes("previous-week"), false);
	writeListField(list, "adjacent-previous-week", true);
	assert.deepEqual(list.source, { kind: "adjacentDates" });
	moveSourceChoice(list.source, 9, 0);
	assert.deepEqual(sourceChoiceOrder(list.source).slice(0, 3), ["next-year", "previous-day", "next-day"]);
});

test("date lists switch missing notes on and off, keeping each source's default unsaved", () => {
	const adjacent: NoteList = { id: "list-1", prefix: "📅", source: { kind: "adjacentDates" } };
	assert.equal(readListField(adjacent, "showsMissing"), false);
	writeListField(adjacent, "showsMissing", true);
	assert.deepEqual(adjacent.source, { kind: "adjacentDates", showsMissing: true });
	writeListField(adjacent, "showsMissing", false);
	assert.deepEqual(adjacent.source, { kind: "adjacentDates" });
	const current: NoteList = { id: "list-2", prefix: "🗓️", source: { kind: "currentPeriods", periods: ["day"] } };
	assert.equal(readListField(current, "showsMissing"), true);
	writeListField(current, "showsMissing", false);
	assert.deepEqual(current.source, { kind: "currentPeriods", periods: ["day"], showsMissing: false });
});

test("a new property rule starts with contains, and picking a list property keeps contains", () => {
	const rule = newRule("property");
	assert.deepEqual(rule, { kind: "property", property: "", condition: { operator: "contains", value: "" } });
	if (rule.kind !== "property") return;
	rule.property = "tags";
	fitRuleToProperty(rule, { tags: "tags" });
	assert.equal(rule.condition.operator, "contains");
	rule.property = "rating";
	fitRuleToProperty(rule, { rating: "number" });
	assert.deepEqual(rule.condition, { operator: "=", value: 0 });
});
