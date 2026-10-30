import { test } from "node:test";
import { strict as assert } from "node:assert";
import { formFields, newBlock, newField, newForm } from "../src/forms/form.ts";
import type { BlockCondition, Form, FormBlock, FormField } from "../src/forms/form.ts";
import { defaultSettings } from "../src/settings.ts";
import { formBlockKey, readControl, writeControl } from "../src/settings/controlKeys.ts";
import {
	blockSummary,
	blockWarning,
	conditionKeyOptions,
	conditionOperatorOptions,
	conditionValueOptions,
	deleteFieldRow,
	duplicateBlock,
	duplicateField,
	fieldRows,
	fieldsAbove,
	formWarning,
	moveFieldRow,
} from "../src/settings/formsForm.ts";

function field(id: string, key: string, extra: Partial<FormField> = {}): FormField {
	return { id, key, saveAs: "property", mode: "ask", type: "text", ...extra };
}

function block(id: string, conditions: BlockCondition[], fields: FormField[]): FormBlock {
	return { id, kind: "block", conditions, fields };
}

const kind = () => field("1", "kind", { type: "select", choices: [{ value: "book", label: "Book" }, { value: "article" }], storeAs: "text" });

function readingLog(): Form {
	return {
		...newForm([]),
		fields: [
			kind(),
			block("2", [{ key: "kind", operator: "is", value: "book" }], [field("3", "pages", { type: "number" }), field("4", "author")]),
			field("5", "rating", { type: "number" }),
			block("6", [{ key: "rating", operator: ">", value: "3" }], [field("7", "favourite", { type: "checkbox" })]),
		],
	};
}

function rowIds(form: Form): string[] {
	return fieldRows(form).map((row) => (row.kind === "field" ? row.field.id : `${row.kind}${row.block.id}`));
}

function layout(form: Form): string[] {
	return form.fields.map((item) => ("kind" in item ? `${item.id}[${item.fields.map((member) => member.id).join(",")}]` : item.id));
}

test("field rows flatten each block into a head, its members and a foot", () => {
	const form = readingLog();
	assert.deepEqual(rowIds(form), ["1", "head2", "3", "4", "foot2", "5", "head6", "7", "foot6"]);
	const members = fieldRows(form).filter((row) => row.kind === "field" && row.block);
	assert.deepEqual(members.map((row) => (row.kind === "field" ? row.block?.id : undefined)), ["2", "2", "6"]);
});

test("moving a field between a head and its foot puts it inside that block, and moving it out puts it at top level", () => {
	const form = readingLog();
	assert.equal(moveFieldRow(form, 0, 2), true);
	assert.deepEqual(layout(form), ["2[3,1,4]", "5", "6[7]"]);
	assert.equal(moveFieldRow(form, 2, 4), true);
	assert.deepEqual(layout(form), ["2[3,4]", "1", "5", "6[7]"]);
	assert.equal(moveFieldRow(form, 7, 4), true);
	assert.deepEqual(layout(form), ["2[3,4]", "7", "1", "5", "6[]"]);
});

test("moving a head moves the whole block, downwards and upwards", () => {
	const form = readingLog();
	assert.equal(moveFieldRow(form, 1, 5), true);
	assert.deepEqual(layout(form), ["1", "5", "2[3,4]", "6[7]"]);
	assert.equal(moveFieldRow(form, 2, 0), true);
	assert.deepEqual(layout(form), ["2[3,4]", "1", "5", "6[7]"]);
	assert.equal(moveFieldRow(form, 0, 8), true);
	assert.deepEqual(layout(form), ["1", "5", "6[7]", "2[3,4]"]);
});

test("a block cannot land inside another block and a foot cannot move", () => {
	const form = readingLog();
	const before = layout(form);
	assert.equal(moveFieldRow(form, 1, 7), false);
	assert.equal(moveFieldRow(form, 6, 2), false);
	assert.equal(moveFieldRow(form, 4, 0), false);
	assert.equal(moveFieldRow(form, 8, 0), false);
	assert.equal(moveFieldRow(form, 3, 3), false);
	assert.equal(moveFieldRow(form, 3, 9), false);
	assert.deepEqual(layout(form), before);
});

test("deleting a field removes it from its block, deleting a head keeps the block's fields in place, and a foot is left alone", () => {
	const form = readingLog();
	assert.equal(deleteFieldRow(form, 2), "3");
	assert.deepEqual(layout(form), ["1", "2[4]", "5", "6[7]"]);
	assert.equal(deleteFieldRow(form, 1), "2");
	assert.deepEqual(layout(form), ["1", "4", "5", "6[7]"]);
	assert.equal(deleteFieldRow(form, 5), undefined);
	assert.deepEqual(layout(form), ["1", "4", "5", "6[7]"]);
	assert.equal(deleteFieldRow(form, 2), "5");
	assert.deepEqual(layout(form), ["1", "4", "6[7]"]);
});

test("a condition only sees the fields above its block and offers the operators of the last field with that key", () => {
	const form = readingLog();
	const second = form.fields[3] as FormBlock;
	assert.deepEqual(fieldsAbove(form, second).map((above) => above.id), ["1", "3", "4", "5"]);
	assert.deepEqual(conditionKeyOptions(form, second, second.conditions[0]), { kind: "kind", pages: "pages", author: "author", rating: "rating" });
	assert.deepEqual(Object.keys(conditionOperatorOptions(form, second, second.conditions[0])), ["=", "≠", "<", ">", "is set", "is not set"]);
	assert.deepEqual(conditionKeyOptions(form, second, { key: "", operator: "is" }), {
		"": "choose a field",
		kind: "kind",
		pages: "pages",
		author: "author",
		rating: "rating",
	});
	assert.deepEqual(conditionKeyOptions(form, second, { key: "favourite", operator: "is set" }).favourite, "Field favourite is not above this block.");
	assert.deepEqual(conditionOperatorOptions(form, second, { key: "rating", operator: "is" }).is, "is (does not apply)");
});

test("choice fields offer their choices as values, with labels, and keep an unknown value visible", () => {
	const form = readingLog();
	const first = form.fields[1] as FormBlock;
	assert.deepEqual(conditionValueOptions(form, first, first.conditions[0]), { book: "Book", article: "article" });
	assert.deepEqual(conditionValueOptions(form, first, { key: "kind", operator: "is" }), { book: "Book", article: "article", "": "choose a value" });
	assert.deepEqual(conditionValueOptions(form, first, { key: "kind", operator: "is", value: "film" }), { book: "Book", article: "article", film: "film" });
	assert.equal(conditionValueOptions(form, first, { key: "pages", operator: "=" }), undefined);
});

test("the head summary reads each condition in words", () => {
	const form = readingLog();
	assert.equal(blockSummary(form, form.fields[1] as FormBlock), "kind is Book");
	const second = form.fields[3] as FormBlock;
	second.conditions.push({ key: "author", operator: "is set" }, { key: "", operator: "is" }, { key: "kind", operator: "is not" });
	assert.equal(blockSummary(form, second), "rating > 3 · author is set · choose a field is choose a value · kind is not choose a value");
	assert.equal(blockSummary(form, block("9", [], [])), "no conditions yet");
});

test("block warnings cover missing conditions, fields, keys, values, operators and members, and count towards the form warning", () => {
	const form = readingLog();
	const first = form.fields[1] as FormBlock;
	assert.equal(blockWarning(form, first), undefined);
	assert.equal(formWarning(form), undefined);
	assert.equal(blockWarning(form, block("9", [], [field("10", "x")])), "Add at least one condition.");
	assert.equal(blockWarning(form, block("9", [{ key: "", operator: "is" }], [])), "Choose a field for each condition.");
	form.fields.unshift(block("9", [{ key: "rating", operator: "is set" }], []));
	assert.equal(blockWarning(form, form.fields[0] as FormBlock), "Field rating is not above this block.");
	form.fields.shift();
	form.fields.push(block("9", [{ key: "kind", operator: "is" }], [field("10", "x")]));
	assert.equal(blockWarning(form, form.fields[4] as FormBlock), "Give each condition a value.");
	assert.equal(formWarning(form), "Some fields need attention. Edit to see why.");
	form.fields.pop();
	first.fields.splice(0, first.fields.length);
	assert.equal(blockWarning(form, first), "Add at least one field to this block.");
	first.conditions[0] = { key: "kind", operator: ">", value: "3" };
	assert.equal(blockWarning(form, first), '">" does not apply to a select, one choice field.');
});

test("conditions are read and written through formBlock control keys, resetting the operator when the key's type no longer allows it", () => {
	const settings = defaultSettings();
	const form = readingLog();
	settings.forms.push(form);
	const first = form.fields[1] as FormBlock;
	const key = (setting: Parameters<typeof formBlockKey>[2], index = 0) => formBlockKey(form.id, first.id, setting, index);
	assert.equal(readControl(settings, key("key")), "kind");
	assert.equal(readControl(settings, key("operator")), "is");
	assert.equal(readControl(settings, key("value")), "book");
	assert.equal(readControl(settings, key("value", 3)), undefined);
	assert.equal(writeControl(settings, key("operator"), "is not set"), true);
	assert.deepEqual(first.conditions[0], { key: "kind", operator: "is not set" });
	assert.equal(writeControl(settings, key("operator"), "contains"), false);
	assert.equal(writeControl(settings, key("operator"), "is not"), true);
	assert.equal(writeControl(settings, key("value"), " article "), true);
	assert.deepEqual(first.conditions[0], { key: "kind", operator: "is not", value: "article" });
	first.fields.push(field("11", "tags", { type: "multiselect", choices: [], storeAs: "text" }));
	const second = form.fields[3] as FormBlock;
	const secondKey = formBlockKey(form.id, second.id, "key", 0);
	assert.equal(writeControl(settings, secondKey, "tags"), true);
	assert.deepEqual(second.conditions[0], { key: "tags", operator: "has item", value: "3" });
	assert.equal(writeControl(settings, formBlockKey(form.id, second.id, "key", 0), "favourite"), true);
	assert.deepEqual(second.conditions[0], { key: "favourite", operator: "is", value: "3" });
	assert.equal(writeControl(settings, formBlockKey(form.id, second.id, "key", 0), ""), true);
	assert.deepEqual(second.conditions[0], { key: "", operator: "is", value: "3" });
	assert.equal(writeControl(settings, formBlockKey(form.id, "99", "key", 0), "kind"), false);
	assert.equal(writeControl(settings, formBlockKey(form.id, first.id, "key", 5), "kind"), false);
	assert.equal(readControl(settings, formBlockKey(form.id, "99", "key", 0)), undefined);
});

test("duplicating a block copies its conditions and fields with fresh ids right after it", () => {
	const form = readingLog();
	const first = form.fields[1] as FormBlock;
	const copy = duplicateBlock(form, first);
	assert.ok(copy);
	assert.deepEqual(layout(form), ["1", "2[3,4]", "8[9,10]", "5", "6[7]"]);
	assert.deepEqual(copy.conditions, first.conditions);
	assert.notEqual(copy.conditions, first.conditions);
	assert.deepEqual(copy.fields.map((member) => member.key), ["pages", "author"]);
	assert.equal(new Set(formFields(form).map((member) => member.id)).size, formFields(form).length);
	assert.equal(duplicateBlock(form, block("42", [], [])), undefined);
});

test("duplicating a field keeps the copy inside its block, and a new block or field never reuses a member's id", () => {
	const form = readingLog();
	const copy = duplicateField(form, (form.fields[1] as FormBlock).fields[0]);
	assert.ok(copy);
	assert.deepEqual(layout(form), ["1", "2[3,8,4]", "5", "6[7]"]);
	const top = duplicateField(form, form.fields[0] as FormField);
	assert.ok(top);
	assert.deepEqual(layout(form), ["1", "9", "2[3,8,4]", "5", "6[7]"]);
	assert.equal(newBlock(form).id, "10");
	assert.equal(newField(form).id, "10");
});
