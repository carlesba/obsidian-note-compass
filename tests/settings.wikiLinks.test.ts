import { test } from "node:test";
import { strict as assert } from "node:assert";
import { insertLink, matchingLinkCandidates, openLinkAt } from "../src/settings/wikiLinks.ts";

test("an unclosed [[ before the caret opens a link query", () => {
	assert.deepEqual(openLinkAt("Planning for [[pro", 18), { start: 13, query: "pro" });
	assert.deepEqual(openLinkAt("[[", 2), { start: 0, query: "" });
});

test("no link query without [[, after a closed link, or past an alias bar", () => {
	assert.equal(openLinkAt("Planning", 8), undefined);
	assert.equal(openLinkAt("[[project]] and", 15), undefined);
	assert.equal(openLinkAt("[[project|Pro", 13), undefined);
});

test("the query only reads up to the caret", () => {
	assert.deepEqual(openLinkAt("[[pro and more", 5), { start: 0, query: "pro" });
});

test("picking a note replaces the query with a closed link and moves the caret after it", () => {
	const text = "Planning for [[pro";
	const link = openLinkAt(text, text.length);
	assert.ok(link);
	assert.deepEqual(insertLink(text, text.length, link, "project"), { text: "Planning for [[project]]", caret: 24 });
});

test("picking a note keeps the text after the caret and reuses closing brackets already there", () => {
	const text = "[[pro]] later";
	const link = openLinkAt(text, 5);
	assert.ok(link);
	assert.deepEqual(insertLink(text, 5, link, "project"), { text: "[[project]] later", caret: 11 });
});

test("notes whose name starts with the query come first, then names and paths containing it", () => {
	const notes = [
		{ path: "work/roadmap.md", basename: "roadmap" },
		{ path: "archive/old project.md", basename: "old project" },
		{ path: "project.md", basename: "project" },
		{ path: "projects/launch.md", basename: "launch" },
	];
	assert.deepEqual(
		matchingLinkCandidates(notes, "proj").map((note) => note.basename),
		["project", "old project", "launch"],
	);
});

test("an empty query offers notes by name, at most twenty", () => {
	const notes = Array.from({ length: 25 }, (_, index) => ({ path: `n${index}.md`, basename: `note ${String(index).padStart(2, "0")}` }));
	const offered = matchingLinkCandidates(notes, "");
	assert.equal(offered.length, 20);
	assert.equal(offered[0]?.basename, "note 00");
});
