import { test } from "node:test";
import { strict as assert } from "node:assert";
import { tabMove } from "../src/settings/tabStops.ts";

interface Node {
	name: string;
	children?: string[];
}

const row = (name: string, ...children: string[]): Node => ({ name, children });
const control = (name: string): Node => ({ name });

const nameRow = row("nameRow", "nameInput");
const nameInput = control("nameInput");
const enabledRow = row("enabledRow", "enabledToggle", "editButton");
const enabledToggle = control("enabledToggle");
const editButton = control("editButton");
const pageRow = row("pageRow");
const sequence = [nameRow, nameInput, enabledRow, enabledToggle, editButton, pageRow];

const wraps = (outer: Node, inner: Node) => outer.children?.includes(inner.name) ?? false;

test("Tab skips rows that only wrap other tab stops", () => {
	assert.deepEqual(tabMove(sequence, nameInput, false, wraps), { kind: "focus", stop: enabledToggle });
	assert.deepEqual(tabMove(sequence, enabledToggle, false, wraps), { kind: "focus", stop: editButton });
});

test("a row with no controls inside stays a tab stop", () => {
	assert.deepEqual(tabMove(sequence, editButton, false, wraps), { kind: "focus", stop: pageRow });
	assert.deepEqual(tabMove(sequence, pageRow, true, wraps), { kind: "focus", stop: editButton });
});

test("Shift+Tab skips wrapping rows going back", () => {
	assert.deepEqual(tabMove(sequence, enabledToggle, true, wraps), { kind: "focus", stop: nameInput });
});

test("from the page itself, Tab goes to the first control", () => {
	assert.deepEqual(tabMove(sequence, undefined, false, wraps), { kind: "focus", stop: nameInput });
	assert.deepEqual(tabMove(sequence, undefined, true, wraps), { kind: "native" });
});

test("a focused row moves on to its own controls", () => {
	assert.deepEqual(tabMove(sequence, enabledRow, false, wraps), { kind: "focus", stop: enabledToggle });
	assert.deepEqual(tabMove(sequence, enabledRow, true, wraps), { kind: "focus", stop: nameInput });
});

test("the ends of the sequence leave or stay put", () => {
	assert.deepEqual(tabMove(sequence, nameInput, true, wraps), { kind: "leaveBefore" });
	assert.deepEqual(tabMove(sequence, pageRow, false, wraps), { kind: "stay" });
});

test("an element outside the sequence keeps the browser's own Tab", () => {
	assert.deepEqual(tabMove(sequence, control("elsewhere"), false, wraps), { kind: "native" });
});

test("a row that is the control itself stays a tab stop", () => {
	const keeps = (outer: Node, inner: Node) => outer !== enabledRow && wraps(outer, inner);
	assert.deepEqual(tabMove(sequence, nameInput, false, keeps), { kind: "focus", stop: enabledRow });
});
