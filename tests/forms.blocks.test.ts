import { test } from "node:test";
import { strict as assert } from "node:assert";
import { formFields, newBlock, readForms, storedForms } from "../src/forms/form.ts";
import type { BlockCondition, Form, FormBlock, FormField } from "../src/forms/form.ts";
import { confirmChoices } from "../src/forms/questions.ts";
import { activeQuestions, answered, resolveForm, skippedAnswer, unansweredQuestions } from "../src/forms/resolve.ts";
import type { Answer, FormClock } from "../src/forms/resolve.ts";
import { NOW } from "./fakeVault.ts";
import { moment } from "./moment.ts";

const clock: FormClock = { now: NOW, moment, coreTemplatesOptions: undefined };

function field(id: string, key: string, extra: Partial<FormField> = {}): FormField {
	return { id, key, saveAs: "property", mode: "ask", type: "text", ...extra };
}

function block(id: string, conditions: BlockCondition[], fields: FormField[]): FormBlock {
	return { id, kind: "block", conditions, fields };
}

function answers(entries: Record<string, Answer>): Map<string, Answer> {
	return new Map(Object.entries(entries));
}

const kind = field("1", "kind", { type: "select", choices: [{ value: "book" }, { value: "article" }], storeAs: "text" });

const readingLog = (): Form => ({
	id: "1",
	enabled: true,
	name: "Reading log",
	namePattern: "{{kind}} {{categories}}",
	contentPattern: "",
	folder: "",
	opensNote: true,
	fields: [
		kind,
		field("2", "categories", { mode: "static", type: "list", value: ["[[Reading]]"] }),
		block("3", [{ key: "kind", operator: "is", value: "book" }], [
			field("4", "pages", { type: "number" }),
			field("5", "categories", { mode: "static", type: "list", value: ["[[Books]]"] }),
		]),
		block("6", [{ key: "kind", operator: "is", value: "article" }], [field("7", "categories", { mode: "static", type: "list", value: ["[[Articles]]"] })]),
		field("8", "rating", { optional: true }),
	],
});

const keys = (fields: readonly FormField[]) => fields.map((asked) => asked.key);

test("a block's questions are asked only while its conditions hold", () => {
	const form = readingLog();
	assert.deepEqual(keys(activeQuestions(form, answers({}), clock)), ["kind", "rating"]);
	assert.deepEqual(keys(activeQuestions(form, answers({ "1": answered("book") }), clock)), ["kind", "pages", "rating"]);
	assert.deepEqual(keys(activeQuestions(form, answers({ "1": answered("article") }), clock)), ["kind", "rating"]);
});

test("a required question in a block that does not run is not needed to create the note", () => {
	const form = readingLog();
	assert.deepEqual(keys(unansweredQuestions(form, answers({ "1": answered("article") }), clock)), []);
	assert.deepEqual(keys(unansweredQuestions(form, answers({ "1": answered("book") }), clock)), ["pages"]);
});

test("a repeated key takes the value of the last field that runs, in the place it was first written", () => {
	const form = readingLog();
	const book = resolveForm(form, answers({ "1": answered("book"), "4": answered(300) }), clock);
	assert.deepEqual(book.frontmatter, [
		["kind", "book"],
		["categories", ["[[Books]]"]],
		["pages", 300],
	]);
	assert.equal(book.name, "book [[Books]]");
	const article = resolveForm(form, answers({ "1": answered("article"), "4": answered(300) }), clock);
	assert.deepEqual(article.frontmatter, [
		["kind", "article"],
		["categories", ["[[Articles]]"]],
	]);
});

test("a skipped later field does not erase the value of an earlier field with the same key", () => {
	const form: Form = { ...readingLog(), fields: [field("1", "rating"), field("2", "rating", { optional: true })] };
	const resolved = resolveForm(form, answers({ "1": answered("5"), "2": skippedAnswer() }), clock);
	assert.deepEqual(resolved.frontmatter, [["rating", "5"]]);
});

test("the summary leaves out the fields of a block that does not run", () => {
	const resolved = resolveForm(readingLog(), answers({ "1": answered("article") }), clock);
	const labels = confirmChoices(resolved, "").map((choice) => choice.parts.content);
	assert.deepEqual(labels.slice(1, -1), ["kind", "categories", "categories", "rating"]);
});

test("conditions compare by type, and every condition of a block must hold", () => {
	const run = (conditions: BlockCondition[], value: unknown, type: FormField["type"] = "text") => {
		const form: Form = { ...readingLog(), fields: [field("1", "x", { type }), block("2", conditions, [field("3", "y")])] };
		return keys(activeQuestions(form, answers(value === undefined ? {} : { "1": answered(value) }), clock)).includes("y");
	};
	assert.equal(run([{ key: "x", operator: "is set" }], "a"), true);
	assert.equal(run([{ key: "x", operator: "is set" }], undefined), false);
	assert.equal(run([{ key: "x", operator: "is not set" }], undefined), true);
	assert.equal(run([{ key: "x", operator: "is not", value: "a" }], undefined), true);
	assert.equal(run([{ key: "x", operator: "is true" }], true, "checkbox"), true);
	assert.equal(run([{ key: "x", operator: "is false" }], true, "checkbox"), false);
	assert.equal(run([{ key: "x", operator: "has item", value: "b" }], ["a", "b"], "multiselect"), true);
	assert.equal(run([{ key: "x", operator: "does not have item", value: "b" }], ["a", "b"], "multiselect"), false);
	assert.equal(run([{ key: "x", operator: ">", value: "3" }], 4, "number"), true);
	assert.equal(run([{ key: "x", operator: "<", value: "3" }], 4, "number"), false);
	assert.equal(run([{ key: "x", operator: "≠", value: "3" }], undefined, "number"), false);
	assert.equal(run([{ key: "x", operator: "is set" }, { key: "x", operator: "is", value: "b" }], "a"), false);
	assert.equal(run([{ key: "missing", operator: "is set" }], "a"), false);
});

test("a condition only sees the fields above its block", () => {
	const form: Form = { ...readingLog(), fields: [block("1", [{ key: "later", operator: "is set" }], [field("2", "y")]), field("3", "later")] };
	assert.deepEqual(keys(activeQuestions(form, answers({ "3": answered("a") }), clock)), ["later"]);
});

test("blocks round-trip through storage, and a block with an unknown operator makes the form unreadable", () => {
	const form = readingLog();
	const [read] = readForms(storedForms([form]));
	assert.deepEqual(read, form);
	const [broken] = readForms([{ ...form, fields: [block("1", [{ key: "x", operator: "maybe" } as unknown as BlockCondition], [])] }]);
	assert.equal(broken.enabled, false);
	assert.notEqual(broken.unreadable, undefined);
});

test("ids stay unique across blocks and their fields, and a new block gets a fresh one", () => {
	const [read] = readForms([{ ...readingLog(), fields: [field("1", "a"), block("1", [], [field("1", "b")])] }]);
	const ids = [read.fields[1].id, ...formFields(read).map((each) => each.id)];
	assert.equal(new Set(ids).size, ids.length);
	assert.equal(newBlock(readingLog()).id, "9");
});
