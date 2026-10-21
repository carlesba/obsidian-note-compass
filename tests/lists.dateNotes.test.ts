import { test } from "node:test";
import { strict as assert } from "node:assert";
import { DEFAULT_CUSTOM_DATE_NOTES, defaultDateNoteSettings, resolveDateNotes } from "../src/lists/dateNotes.ts";
import type { DateNoteSettings } from "../src/lists/dateNotes.ts";

const periodicNotes = {
	showGettingStartedBanner: false,
	daily: { enabled: true, folder: "/journal/daily/", format: "" },
	weekly: { enabled: true, folder: "journal/weekly", format: "GGGG-[W]WW" },
	monthly: { enabled: false, folder: "", format: "" },
	quarterly: { enabled: true, folder: "journal", format: "" },
	yearly: { enabled: true, folder: "journal", format: "  " },
};

const dailyNotes = { folder: "daily", format: "DD.MM.YYYY", template: "" };

const plugins = (periodic: unknown, daily: unknown) => ({
	periodicNotesSettings: () => periodic,
	dailyNotesOptions: () => daily,
});

const readFrom = (from: DateNoteSettings["from"]): DateNoteSettings => ({ ...defaultDateNoteSettings(), from });

test("defaultDateNoteSettings reads automatically and copies the Custom defaults", () => {
	const settings = defaultDateNoteSettings();
	assert.equal(settings.from, "auto");
	assert.deepEqual(settings.custom, DEFAULT_CUSTOM_DATE_NOTES);
	settings.custom.day.folder = "elsewhere";
	assert.equal(DEFAULT_CUSTOM_DATE_NOTES.day.folder, "on");
	assert.deepEqual(DEFAULT_CUSTOM_DATE_NOTES.quarter.enabled, false);
});

test("Periodic Notes supplies every period, its default formats and trimmed folders", () => {
	for (const from of ["auto", "periodicNotes"] as const) {
		assert.deepEqual(resolveDateNotes(readFrom(from), plugins(periodicNotes, dailyNotes)), {
			from: "periodicNotes",
			periods: {
				day: { enabled: true, folder: "journal/daily", format: "YYYY-MM-DD" },
				week: { enabled: true, folder: "journal/weekly", format: "GGGG-[W]WW" },
				month: { enabled: false, folder: "", format: "YYYY-MM" },
				quarter: { enabled: true, folder: "journal", format: "YYYY-[Q]Q" },
				year: { enabled: true, folder: "journal", format: "YYYY" },
			},
		});
	}
});

test("Periodic Notes without a period's entry leaves that period off", () => {
	const resolved = resolveDateNotes(readFrom("auto"), plugins({ daily: periodicNotes.daily }, undefined));
	assert.equal(resolved.from, "periodicNotes");
	assert.deepEqual(resolved.periods.week, { enabled: false, folder: "", format: "gggg-[W]ww" });
});

test("Daily notes supplies the day and Custom the other periods", () => {
	for (const from of ["auto", "dailyNotes"] as const) {
		const resolved = resolveDateNotes(readFrom(from), plugins(undefined, dailyNotes));
		assert.deepEqual(resolved, {
			from: "dailyNotes",
			periods: { ...DEFAULT_CUSTOM_DATE_NOTES, day: { enabled: true, folder: "daily", format: "DD.MM.YYYY" } },
		});
	}
	const blank = resolveDateNotes(readFrom("dailyNotes"), plugins(undefined, {}));
	assert.deepEqual(blank.periods.day, { enabled: true, folder: "", format: "YYYY-MM-DD" });
});

test("Automatic falls through unreadable plugin settings to the next source", () => {
	const unreadable = [undefined, null, "settings", { calendarSets: [] }];
	for (const periodic of unreadable) {
		assert.equal(resolveDateNotes(readFrom("auto"), plugins(periodic, dailyNotes)).from, "dailyNotes");
		assert.deepEqual(resolveDateNotes(readFrom("auto"), plugins(periodic, undefined)), {
			from: "custom",
			periods: DEFAULT_CUSTOM_DATE_NOTES,
		});
	}
});

test("an explicit plugin choice that cannot be read falls back to Custom", () => {
	assert.equal(resolveDateNotes(readFrom("periodicNotes"), plugins(undefined, dailyNotes)).from, "custom");
	assert.equal(resolveDateNotes(readFrom("dailyNotes"), plugins(periodicNotes, undefined)).from, "custom");
});

test("Custom ignores the installed plugins and uses the plugin's own formats", () => {
	const settings = readFrom("custom");
	settings.custom.quarter.enabled = true;
	const resolved = resolveDateNotes(settings, plugins(periodicNotes, dailyNotes));
	assert.equal(resolved.from, "custom");
	assert.equal(resolved.periods.quarter.enabled, true);
});
