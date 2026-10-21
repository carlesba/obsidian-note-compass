import { test } from "node:test";
import { strict as assert } from "node:assert";
import { adjacentDateNames, dateNoteSuffix, dayFromName, isDateNote, isSameLocalDay } from "../src/lists/dates.ts";

const note = (path: string) => ({ path, basename: path.split("/").pop()!.replace(/\.md$/, ""), ctime: 0 });

test("isDateNote accepts a date period in the frontmatter wherever the note lives", () => {
	for (const period of ["day", "week", "month", "year"]) {
		assert.equal(isDateNote(note("journal/anything.md"), { period }), true);
	}
	assert.equal(isDateNote(note("journal/anything.md"), { period: "quarter" }), false);
});

test("isDateNote accepts day, week and month names only under on/", () => {
	assert.equal(isDateNote(note("on/2024-03-05.md"), undefined), true);
	assert.equal(isDateNote(note("on/2024-W10.md"), undefined), true);
	assert.equal(isDateNote(note("on/2024-03.md"), {}), true);
	assert.equal(isDateNote(note("on/2024.md"), {}), false);
	assert.equal(isDateNote(note("notes/2024-03-05.md"), {}), false);
	assert.equal(isDateNote(note("on/meeting.md"), {}), false);
});

test("dateNoteSuffix names the weekday, week number, month or year", () => {
	assert.equal(dateNoteSuffix("2024-03-05"), "Tuesday");
	assert.equal(dateNoteSuffix("2024-W07"), "week 7");
	assert.equal(dateNoteSuffix("2024-03"), "month - March");
	assert.equal(dateNoteSuffix("2024"), "year");
	assert.equal(dateNoteSuffix("meeting"), undefined);
});

test("adjacentDateNames steps days across month and year boundaries", () => {
	assert.deepEqual(adjacentDateNames("2024-03-01"), {
		previous: "2024-02-29",
		next: "2024-03-02",
		previousLabel: "prev day",
		nextLabel: "next day",
	});
	assert.equal(adjacentDateNames("2023-12-31")?.next, "2024-01-01");
});

test("adjacentDateNames steps ISO weeks across years", () => {
	assert.deepEqual(adjacentDateNames("2024-W10"), {
		previous: "2024-W09",
		next: "2024-W11",
		previousLabel: "prev week",
		nextLabel: "next week",
	});
	assert.equal(adjacentDateNames("2021-W01")?.previous, "2020-W53");
	assert.equal(adjacentDateNames("2020-W53")?.next, "2021-W01");
	assert.equal(adjacentDateNames("2024-W52")?.next, "2025-W01");
});

test("adjacentDateNames steps months across years and has nothing for other names", () => {
	assert.deepEqual(adjacentDateNames("2024-01"), {
		previous: "2023-12",
		next: "2024-02",
		previousLabel: "prev month",
		nextLabel: "next month",
	});
	assert.equal(adjacentDateNames("2024"), undefined);
	assert.equal(adjacentDateNames("meeting"), undefined);
});

test("dayFromName reads a leading date as local midnight", () => {
	assert.equal(dayFromName("2024-03-05"), new Date(2024, 2, 5).getTime());
	assert.equal(dayFromName("2024-03-05 standup"), new Date(2024, 2, 5).getTime());
	assert.equal(dayFromName("2024-W10"), undefined);
});

test("isSameLocalDay compares calendar days in local time", () => {
	const morning = new Date(2024, 2, 5, 0, 0).getTime();
	assert.equal(isSameLocalDay(morning, new Date(2024, 2, 5, 23, 59, 59, 999).getTime()), true);
	assert.equal(isSameLocalDay(morning, new Date(2024, 2, 6, 0, 0).getTime()), false);
	assert.equal(isSameLocalDay(morning, new Date(2024, 2, 4, 23, 59).getTime()), false);
});
