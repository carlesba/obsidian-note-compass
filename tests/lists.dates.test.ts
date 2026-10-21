import { test } from "node:test";
import { strict as assert } from "node:assert";
import { DEFAULT_CUSTOM_DATE_NOTES } from "../src/lists/dateNotes.ts";
import type { DateNoteFormats, ResolvedDateNotes } from "../src/lists/dateNotes.ts";
import { adjacentDatePaths, dateNoteSuffix, isSameLocalDay, parseDateNote } from "../src/lists/dates.ts";
import { moment } from "./moment.ts";

const note = (path: string) => ({ path, basename: path.split("/").pop()!.replace(/\.md$/, ""), ctime: 0 });

const custom = (overrides: Partial<DateNoteFormats> = {}): ResolvedDateNotes => ({
	from: "custom",
	periods: { ...DEFAULT_CUSTOM_DATE_NOTES, ...overrides },
});

const withQuarters = custom({ quarter: { enabled: true, folder: "on", format: "YYYY-[Q]Q" } });

const parse = (path: string, dateNotes = custom()) => parseDateNote(note(path), dateNotes, moment);

const parsed = (path: string, dateNotes = custom()) => {
	const dateNote = parse(path, dateNotes);
	assert.ok(dateNote, `${path} is a date note`);
	return dateNote;
};

const adjacent = (path: string, dateNotes = custom()) => {
	const { previous, next } = adjacentDatePaths(parsed(path, dateNotes));
	return [previous, next];
};

test("parseDateNote ignores the period property and needs the period's folder and format", () => {
	assert.equal(parse("journal/anything.md"), undefined);
	assert.equal(parse("journal/2024-03-05.md"), undefined);
	assert.equal(parse("on/2024-Q1.md"), undefined);
	assert.equal(parse("on/2024-Q1.md", withQuarters)?.period, "quarter");
});

test("parseDateNote reads day, week, month and year names directly under on/", () => {
	assert.equal(parse("on/2024-03-05.md")?.period, "day");
	assert.equal(parse("on/2024-W10.md")?.period, "week");
	assert.equal(parse("on/2024-03.md")?.period, "month");
	assert.equal(parse("on/2024.md")?.period, "year");
	assert.equal(parse("notes/2024-03-05.md"), undefined);
	assert.equal(parse("on/archive/2024-03-05.md"), undefined);
	assert.equal(parse("on/meeting.md"), undefined);
});

test("parseDateNote parses strictly and accepts the vault root as a folder", () => {
	assert.equal(parse("on/2024-3-5.md"), undefined);
	assert.equal(parse("on/2024-03-05 standup.md"), undefined);
	const atRoot = custom({ day: { enabled: true, folder: "", format: "DD.MM.YYYY" } });
	assert.equal(parse("05.03.2024.md", atRoot)?.date.valueOf(), new Date(2024, 2, 5).getTime());
	assert.equal(parse("on/05.03.2024.md", atRoot), undefined);
});

test("dateNoteSuffix names the weekday, week number, month, quarter or year", () => {
	assert.equal(dateNoteSuffix(parsed("on/2024-03-05.md")), "Tuesday");
	assert.equal(dateNoteSuffix(parsed("on/2024-W07.md")), "week 7");
	assert.equal(dateNoteSuffix(parsed("on/2024-03.md")), "month - March");
	assert.equal(dateNoteSuffix(parsed("on/2024-Q2.md", withQuarters)), "quarter 2");
	assert.equal(dateNoteSuffix(parsed("on/2024.md")), "year");
	const localeWeeks = custom({ week: { enabled: true, folder: "on", format: "gggg-[W]ww" } });
	assert.equal(dateNoteSuffix(parsed("on/2023-W52.md", localeWeeks)), "week 52");
});

test("adjacentDatePaths steps days across month and year boundaries", () => {
	assert.deepEqual(adjacentDatePaths(parsed("on/2024-03-01.md")), {
		previous: "on/2024-02-29.md",
		next: "on/2024-03-02.md",
		previousLabel: "prev day",
		nextLabel: "next day",
	});
	assert.deepEqual(adjacent("on/2023-12-31.md"), ["on/2023-12-30.md", "on/2024-01-01.md"]);
});

test("adjacentDatePaths steps ISO weeks across years", () => {
	assert.deepEqual(adjacentDatePaths(parsed("on/2024-W10.md")), {
		previous: "on/2024-W09.md",
		next: "on/2024-W11.md",
		previousLabel: "prev week",
		nextLabel: "next week",
	});
	assert.equal(adjacent("on/2021-W01.md")[0], "on/2020-W53.md");
	assert.equal(adjacent("on/2020-W53.md")[1], "on/2021-W01.md");
	assert.equal(adjacent("on/2024-W52.md")[1], "on/2025-W01.md");
});

test("adjacentDatePaths steps locale weeks across years", () => {
	const localeWeeks = custom({ week: { enabled: true, folder: "on", format: "gggg-[W]ww" } });
	assert.deepEqual(adjacent("on/2024-W01.md", localeWeeks), ["on/2023-W52.md", "on/2024-W02.md"]);
});

test("adjacentDatePaths steps months, quarters and years across years", () => {
	assert.deepEqual(adjacentDatePaths(parsed("on/2024-01.md")), {
		previous: "on/2023-12.md",
		next: "on/2024-02.md",
		previousLabel: "prev month",
		nextLabel: "next month",
	});
	assert.deepEqual(adjacent("on/2024-Q1.md", withQuarters), ["on/2023-Q4.md", "on/2024-Q2.md"]);
	assert.deepEqual(adjacent("on/2024-Q4.md", withQuarters), ["on/2024-Q3.md", "on/2025-Q1.md"]);
	assert.deepEqual(adjacentDatePaths(parsed("on/2024.md")), {
		previous: "on/2023.md",
		next: "on/2025.md",
		previousLabel: "prev year",
		nextLabel: "next year",
	});
});

test("adjacentDatePaths re-formats in the period's own format and folder", () => {
	const journal = custom({ day: { enabled: true, folder: "journal/daily", format: "DD.MM.YYYY" } });
	assert.deepEqual(adjacent("journal/daily/31.12.2023.md", journal), [
		"journal/daily/30.12.2023.md",
		"journal/daily/01.01.2024.md",
	]);
});

test("isSameLocalDay compares calendar days in local time", () => {
	const morning = new Date(2024, 2, 5, 0, 0).getTime();
	assert.equal(isSameLocalDay(morning, new Date(2024, 2, 5, 23, 59, 59, 999).getTime()), true);
	assert.equal(isSameLocalDay(morning, new Date(2024, 2, 6, 0, 0).getTime()), false);
	assert.equal(isSameLocalDay(morning, new Date(2024, 2, 4, 23, 59).getTime()), false);
});
