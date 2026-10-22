import { test } from "node:test";
import { strict as assert } from "node:assert";
import { formatPendingValue, parseDate, parseDateTime, parseNumber } from "../src/setProperties/values.ts";

test("dates are accepted compact or dashed and saved dashed", () => {
	assert.equal(parseDate("20241005"), "2024-10-05");
	assert.equal(parseDate("2024-10-05"), "2024-10-05");
	assert.equal(parseDate(" 2024-02-29 "), "2024-02-29");
});

test("dates that are malformed or not on the calendar are rejected", () => {
	for (const input of ["", "2024-1-05", "2024/10/05", "2024-1005", "202410-05", "2024-13-01", "2023-02-29", "2024-04-31", "tomorrow", "20241005 1200"]) {
		assert.equal(parseDate(input), undefined, input);
	}
});

test("datetimes are accepted in the three forms and saved with a T", () => {
	assert.equal(parseDateTime("20241005 0930"), "2024-10-05T09:30");
	assert.equal(parseDateTime("2024-10-05 09:30"), "2024-10-05T09:30");
	assert.equal(parseDateTime("2024-10-05T23:59"), "2024-10-05T23:59");
});

test("datetimes that are malformed or out of range are rejected", () => {
	for (const input of ["", "2024-10-05", "20241005T0930", "2024-10-05 0930", "20241005 09:30", "2024-10-05T24:00", "2024-10-05T12:60", "2024-02-30T10:00", "now"]) {
		assert.equal(parseDateTime(input), undefined, input);
	}
});

test("numbers parse from plain decimal text", () => {
	assert.equal(parseNumber("42"), 42);
	assert.equal(parseNumber(" -3.5 "), -3.5);
	assert.equal(parseNumber(".5"), 0.5);
	assert.equal(parseNumber("1e3"), 1000);
});

test("text that is not a plain number is rejected", () => {
	for (const input of ["", " ", "abc", "1,5", "0x10", "Infinity", "NaN", "1e999", "4 2"]) {
		assert.equal(parseNumber(input), undefined, input);
	}
});

test("pending values read as true, false, the text, the number or the date", () => {
	assert.equal(formatPendingValue("checkbox", true), "true");
	assert.equal(formatPendingValue("checkbox", false), "false");
	assert.equal(formatPendingValue("text", "In progress"), "In progress");
	assert.equal(formatPendingValue("number", 0), "0");
	assert.equal(formatPendingValue("date", "2024-10-05"), "2024-10-05");
	assert.equal(formatPendingValue("datetime", "2024-10-05T09:30"), "2024-10-05T09:30");
});

test("pending links read as their titles joined by commas", () => {
	assert.equal(formatPendingValue("link", "[[categories/Work|Work]]"), "Work");
	assert.equal(formatPendingValue("links", ["[[Ann]]", "[[people/Bob|Bob]]"]), "Ann, Bob");
});

test("a pending value is a dash when unset", () => {
	for (const value of [undefined, null, "", []]) assert.equal(formatPendingValue("links", value), "—");
	assert.equal(formatPendingValue("text", undefined), "—");
});

test("a long pending value is truncated near 40 characters", () => {
	const value = formatPendingValue("links", ["[[Alexandra Smith]]", "[[Bartholomew Jones]]", "[[Cecilia Brown]]"]);
	assert.equal(value, "Alexandra Smith, Bartholomew Jones, Cec…");
	assert.equal(Array.from(value).length, 40);
	assert.equal(formatPendingValue("text", "👤".repeat(41)), `${"👤".repeat(39)}…`);
	assert.equal(formatPendingValue("text", "x".repeat(40)), "x".repeat(40));
});
