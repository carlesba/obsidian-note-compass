import { test } from "node:test";
import { strict as assert } from "node:assert";
import { CONDITIONS_BY_TYPE, PROPERTY_TYPES } from "../src/lists/conditions.ts";
import type { Condition } from "../src/lists/conditions.ts";
import { defaultDateNoteSettings } from "../src/lists/dateNotes.ts";
import type { Frontmatter, JumpListVault } from "../src/lists/vault.ts";
import { defaultSettings } from "../src/settings.ts";
import type { NoteList } from "../src/settings.ts";
import {
	DATE_NOTE_SOURCE_KEY,
	SHOW_PREFIXES_KEY,
	listKey,
	periodKey,
	prefixColorKey,
	readControl,
	writeControl,
} from "../src/settings/controlKeys.ts";
import { customPeriods, dateNoteSourceDescription, formatError, writePeriodField } from "../src/settings/dateNotesForm.ts";
import { fitRuleToProperty, readConditionField, writeConditionField, writeRuleText } from "../src/settings/filterForm.ts";
import type { ConditionField } from "../src/settings/filterForm.ts";
import type { PropertyRule } from "../src/lists/filters.ts";
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
	sourceSummary,
	valueShape,
	writeListField,
} from "../src/settings/listForm.ts";
import {
	changedColor,
	changedPrefix,
	draftChange,
	movedHighlight,
	pickSuggestion,
	prefixChip,
	startDraft,
} from "../src/settings/prefixChip.ts";
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
		mtime: () => 0,
		periodicNotesSettings: () => fakes.periodicNotes,
		dailyNotesOptions: () => fakes.dailyNotes,
		propertyTypes: () => fakes.propertyTypes ?? {},
		propertyValueCounts: () => [],
		now: () => 0,
		moment,
	};
}

function propertyList(property: string, condition: Condition, enabled = true): NoteList {
	return { id: "list-5", enabled, prefix: "⭐", source: { kind: "filter", filter: { kind: "group", mode: "all", items: [propertyRule(property, condition)] } } };
}

function propertyRule(property: string, condition: Condition): PropertyRule {
	return { kind: "property", property, condition };
}

test("operator options follow the conditions table for every property type", () => {
	for (const type of PROPERTY_TYPES) assert.deepEqual(Object.keys(operatorOptions(type)), CONDITIONS_BY_TYPE[type]);
});

test("operator options keep a stored operator that the type does not offer", () => {
	assert.deepEqual(operatorOptions("number", "is"), {
		"=": "=",
		"≠": "≠",
		"<": "<",
		">": ">",
		"is set": "is set",
		"is not set": "is not set",
		is: "is (does not apply)",
	});
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
	assert.equal(listName({ ...newList(lists), prefix: "" }), "No conditions yet");
	assert.equal(listName(propertyList("", { operator: "is set" })), "⭐ Property not chosen");
	assert.equal(listName({ ...lists[0], prefix: "👤", source: { kind: "linksToNote", note: "types/Person 👤.md" } }), "👤 Links to Person 👤");
	assert.equal(listName({ ...lists[0], prefix: "👤", source: { kind: "linksToNote", note: "" } }), "👤 Note not chosen");
	assert.equal(listName({ ...lists[0], prefix: "📂", source: { kind: "inFolder", folder: "areas/categories" } }), "📂 In areas/categories");
	assert.equal(listName({ ...lists[0], prefix: "📂", source: { kind: "inFolder", folder: "" } }), "📂 Folder not chosen");
	assert.equal(listName({ ...lists[0], prefix: "🔅", source: { kind: "modifiedToday" } }), "🔅 Modified today");
	assert.equal(listDisplayValue(propertyList("favorite", { operator: "is true" }, false)), "off");
	assert.equal(listDisplayValue(lists[0]), "");
});

test("a new list is an enabled filter list with no conditions, the next id and no prefix", () => {
	assert.deepEqual(newList(defaultSettings().lists), {
		id: "list-5",
		enabled: true,
		prefix: "",
		source: { kind: "filter", filter: { kind: "group", mode: "all", items: [] } },
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

	const rule = propertyRule("rating", { operator: "is", value: "3" });
	writeRuleText(rule, "Starred");
	assert.deepEqual(rule, propertyRule("Starred", { operator: "is", value: "3" }));
});

test("the value control follows the operator", () => {
	assert.equal(valueShape("is set"), "none");
	assert.equal(valueShape("contains"), "text");
	assert.equal(valueShape("<"), "number");
	assert.equal(valueShape("after"), "date");
});

test("changing the operator keeps a value of the same shape and starts others empty", () => {
	const rule = propertyRule("status", { operator: "is", value: "active" });
	writeConditionField(rule, "operator", "contains");
	assert.deepEqual(readConditionField(rule, "text"), "active");
	writeConditionField(rule, "operator", "=");
	assert.equal(readConditionField(rule, "number"), 0);
	writeConditionField(rule, "number", 4);
	writeConditionField(rule, "operator", "on");
	assert.deepEqual(rule, propertyRule("status", { operator: "on", value: { kind: "relative", days: 0 } }));
	writeConditionField(rule, "operator", "is not set");
	assert.deepEqual(rule, propertyRule("status", { operator: "is not set" }));
	writeConditionField(rule, "operator", "nonsense");
	assert.equal(readConditionField(rule, "operator"), "is not set");
});

test("date values map onto a mode, a date, a number of days and a direction", () => {
	const rule = propertyRule("due", { operator: "before", value: { kind: "relative", days: -3 } });
	const read = (fields: ConditionField[]) => fields.map((field) => readConditionField(rule, field));
	assert.deepEqual(read(["dateMode", "days", "direction"]), ["relative", 3, "ago"]);
	writeConditionField(rule, "direction", "fromNow");
	assert.equal(readConditionField(rule, "direction"), "fromNow");
	writeConditionField(rule, "days", 5);
	writeConditionField(rule, "days", 0);
	assert.deepEqual(readConditionField(rule, "days"), 5);
	writeConditionField(rule, "direction", "today");
	assert.deepEqual(read(["direction", "days"]), ["today", 0]);
	writeConditionField(rule, "direction", "ago");
	assert.deepEqual(rule.condition, { operator: "before", value: { kind: "relative", days: -1 } });
	writeConditionField(rule, "days", 5);
	assert.deepEqual(rule.condition, { operator: "before", value: { kind: "relative", days: -5 } });
	writeConditionField(rule, "dateMode", "fixed");
	writeConditionField(rule, "date", " 2024-03-05 ");
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
	settings.lists.push({ id: "list-5", enabled: true, prefix: "", source: { kind: "inFolder", folder: "areas" } });
	assert.equal(readControl(settings, listKey("list-5", "folder")), "areas");
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

test("the show prefixes toggle reads and writes the display setting and refuses non-booleans", () => {
	const settings = defaultSettings();
	assert.equal(readControl(settings, SHOW_PREFIXES_KEY), true);
	assert.equal(writeControl(settings, SHOW_PREFIXES_KEY, false), true);
	assert.equal(settings.showPrefixes, false);
	assert.equal(readControl(settings, SHOW_PREFIXES_KEY), false);
	assert.equal(writeControl(settings, SHOW_PREFIXES_KEY, "yes"), false);
	assert.equal(settings.showPrefixes, false);
	assert.equal(settings.lists[0].prefix, "📅 day");
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
	assert.deepEqual(rule, propertyRule("done", { operator: "is true" }));
	const status = propertyRule("", { operator: "is", value: "x" });
	writeRuleText(status, " done ");
	assert.deepEqual(status, propertyRule("done", { operator: "is", value: "x" }));
	fitRuleToProperty(status, types);
	assert.deepEqual(status, propertyRule("done", { operator: "is true" }));
	const kept = propertyRule("status", { operator: "is set" });
	fitRuleToProperty(kept, types);
	assert.deepEqual(kept, propertyRule("status", { operator: "is set" }));
});

test("a list row's label leaves the prefix to its chip", () => {
	assert.equal(sourceSummary({ kind: "linksOut" }), "Outbound links");
	assert.equal(sourceSummary(propertyList("favorite", { operator: "is set" }).source), "favorite is set");
	assert.equal(listName({ ...propertyList("favorite", { operator: "is set" }), prefix: "⭐ fav" }), "⭐ fav favorite is set");
});

test("the prefix chip shows the trimmed prefix, or a placeholder when blank", () => {
	assert.deepEqual(prefixChip(" 🔗 out "), { text: "🔗 out", placeholder: false });
	assert.deepEqual(prefixChip("📅"), { text: "📅", placeholder: false });
	assert.deepEqual(prefixChip(""), { text: "prefix", placeholder: true });
	assert.deepEqual(prefixChip("  "), { text: "prefix", placeholder: true });
});

test("editing a prefix starts from the raw prefix selected and saves only a changed value", () => {
	const draft = startDraft("🔗 out");
	assert.deepEqual(draft, {
		original: "🔗 out",
		text: "🔗 out",
		selectionStart: 0,
		selectionEnd: 6,
		linked: [],
		updatesLinked: true,
	});
	assert.equal(changedPrefix(draft), undefined);
	assert.equal(changedPrefix({ ...draft, text: "🔗 links" }), "🔗 links");
	assert.equal(changedPrefix({ ...startDraft(""), text: "⭐" }), "⭐");
	assert.equal(changedPrefix({ ...draft, text: "" }), "");
});

test("a list's prefix colour key reads blank until set, keeps valid hex and clears on anything else", () => {
	const settings = defaultSettings();
	const key = listKey("list-2", "prefixColor");
	assert.equal(prefixColorKey(listKey("list-2", "prefix")), key);
	assert.equal(readControl(settings, key), "");
	assert.equal(writeControl(settings, key, "#e0a030"), true);
	assert.equal(settings.lists[1].prefixColor, "#e0a030");
	assert.equal(readControl(settings, key), "#e0a030");
	writeControl(settings, key, "");
	assert.equal("prefixColor" in settings.lists[1], false);
	writeControl(settings, key, "#abc");
	writeControl(settings, key, "orange");
	assert.equal("prefixColor" in settings.lists[1], false);
});

test("editing a prefix tracks its colour and reports a colour change, a removal as blank, or nothing", () => {
	const draft = startDraft("🔗 out", "#e0a030");
	assert.equal(changedColor(draft), undefined);
	assert.equal(changedColor({ ...draft, color: "#336699" }), "#336699");
	assert.equal(changedColor({ ...draft, color: undefined }), "");
	assert.equal(changedColor({ ...startDraft("🔗"), color: "#336699" }), "#336699");
	assert.equal(changedColor(startDraft("🔗")), undefined);
	assert.equal(changedPrefix({ ...draft, color: "#336699" }), undefined);
});

test("a prefix draft remembers the rows linked to its original prefix and updates them by default", () => {
	const draft = startDraft("🔗 out", "#e0a030", ["list/list-3/prefix"]);
	assert.deepEqual(draft.linked, ["list/list-3/prefix"]);
	assert.equal(draft.updatesLinked, true);
});

test("a prefix draft's change holds only what changed, or nothing", () => {
	const draft = startDraft("🔗 out", "#e0a030");
	assert.equal(draftChange(draft), undefined);
	assert.deepEqual(draftChange({ ...draft, text: "🔗 links" }), { prefix: "🔗 links" });
	assert.deepEqual(draftChange({ ...draft, color: undefined }), { color: "" });
	assert.deepEqual(draftChange({ ...draft, text: "📅", color: "#336699" }), { prefix: "📅", color: "#336699" });
});

test("picking a suggested prefix sets the draft's text and colour, and keeps its linked rows", () => {
	const draft = startDraft("🔗 out", "#e0a030", ["list/list-3/prefix"]);
	pickSuggestion(draft, { prefix: "📅 due", count: 2 });
	assert.equal(draft.text, "📅 due");
	assert.equal(draft.color, undefined);
	assert.deepEqual(draft.linked, ["list/list-3/prefix"]);
	assert.deepEqual(draftChange(draft), { prefix: "📅 due", color: "" });
});

test("arrow keys move the suggestion highlight around the list, starting from either end", () => {
	assert.equal(movedHighlight(undefined, 3, 1), 0);
	assert.equal(movedHighlight(undefined, 3, -1), 2);
	assert.equal(movedHighlight(0, 3, 1), 1);
	assert.equal(movedHighlight(2, 3, 1), 0);
	assert.equal(movedHighlight(0, 3, -1), 2);
	assert.equal(movedHighlight(undefined, 0, 1), undefined);
});

test("a current date notes list toggles each period and names the chosen ones", () => {
	const list: NoteList = { id: "list-1", enabled: true, prefix: "🗓️", source: { kind: "linksOut" } };
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
