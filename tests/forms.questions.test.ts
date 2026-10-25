import { test } from "node:test";
import { strict as assert } from "node:assert";
import type { FormField } from "../src/forms/form.ts";
import { confirmChoices, formChoices, questionChoices, questionPlaceholder, toggledChoice } from "../src/forms/questions.ts";
import type { Question } from "../src/forms/questions.ts";
import { answered, resolveForm, skippedAnswer } from "../src/forms/resolve.ts";
import { NOW } from "./fakeVault.ts";
import { moment } from "./moment.ts";

function question(extra: Partial<FormField>, vaultValues: Question["vaultValues"] = []): Question {
	return { field: { id: "1", key: "topic", saveAs: "property", mode: "ask", type: "text", ...extra }, vaultValues, now: NOW, moment };
}

const labels = (choices: { label: string }[]) => choices.map((choice) => choice.label);

test("an optional question offers Skip first, marked when it was the answer", () => {
	assert.deepEqual(labels(questionChoices(question({ type: "checkbox", optional: true }), undefined, "")), ["⏭️ Skip", "true", "false"]);
	assert.deepEqual(labels(questionChoices(question({ type: "checkbox", optional: true }), skippedAnswer(), "")), ["✓ Skip", "true", "false"]);
	assert.deepEqual(labels(questionChoices(question({ type: "checkbox" }), answered(false), "")), ["true", "✓ false"]);
});

test("a text question offers what was typed, the earlier answer and the property's vault values", () => {
	const choices = questionChoices(question({}, [{ value: "Roadmap", count: 2 }, { value: 3, count: 1 }]), answered("Hiring"), "Bud");
	assert.deepEqual(labels(choices), ['✏️ Use "Bud"']);
	assert.deepEqual(labels(questionChoices(question({}, [{ value: "Roadmap", count: 2 }]), answered("Hiring"), "")), ["✓ Hiring", "Roadmap ×2"]);
	const [use] = questionChoices(question({ type: "number" }), undefined, "4.5");
	assert.deepEqual(use.action, { action: "answer", answer: answered(4.5) });
});

test("select shows labels and answers with the value", () => {
	const choices = questionChoices(question({ type: "select", choices: [{ value: "4", label: "4 · Great" }, { value: "2" }, { value: "" }] }), answered("2"), "");
	assert.deepEqual(labels(choices), ["4 · Great", "✓ 2"]);
	assert.deepEqual(choices[0].action, { action: "answer", answer: answered("4") });
});

test("multiselect toggles choices in choice order and finishes with Done", () => {
	const shape = question({ type: "multiselect", choices: [{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }] });
	const once = toggledChoice(undefined, "b", shape.field);
	const twice = toggledChoice(once, "a", shape.field);
	assert.deepEqual(twice, answered(["a", "b"]));
	assert.deepEqual(toggledChoice(twice, "a", shape.field), answered(["b"]));
	const choices = questionChoices(shape, once, "");
	assert.deepEqual(labels(choices), ["🏁 Done", "Alpha", "✓ Beta"]);
	assert.deepEqual(choices[1].action, { action: "toggle", value: "a" });
	assert.deepEqual(labels(questionChoices(shape, once, "al")), ["Alpha", "🏁 Done"]);
});

test("date questions parse typed dates and offer now, today and tomorrow", () => {
	const date = questionChoices(question({ type: "date" }), undefined, "20240311");
	assert.equal(date[0].label, '✏️ Use "2024-03-11"');
	assert.deepEqual(date[0].action, { action: "answer", answer: answered(new Date(2024, 2, 11).getTime()) });
	assert.deepEqual(labels(questionChoices(question({ type: "date" }), undefined, "")).slice(0, 3), [
		"Now 2024-03-09",
		"Today 2024-03-09",
		"Tomorrow 2024-03-10",
	]);
	const time = questionChoices(question({ type: "time" }), undefined, "0930");
	assert.deepEqual(time[0].action, { action: "answer", answer: answered(new Date(2024, 2, 9, 9, 30).getTime()) });
	const datetime = questionChoices(question({ type: "datetime" }), answered(new Date(2024, 2, 1, 8, 0).getTime()), "");
	assert.deepEqual(labels(datetime), ["✓ 2024-03-01 08:00", "Now 2024-03-09 15:00"]);
});

test("the confirm view offers creating the named note, each field with its value, then Cancel", () => {
	const shape = {
		id: "1",
		enabled: true,
		name: "Meeting",
		namePattern: "Meeting {{topic}}",
		contentPattern: "",
		folder: "",
		opensNote: true,
		fields: [
			{ id: "1", key: "topic", saveAs: "variable" as const, mode: "ask" as const, type: "text" as const },
			{ id: "2", key: "room", saveAs: "property" as const, mode: "ask" as const, type: "text" as const, optional: true },
			{ id: "3", key: "kind", saveAs: "property" as const, mode: "static" as const, type: "text" as const, value: "meeting" },
		],
	};
	const resolved = resolveForm(shape, new Map([["1", answered("Roadmap")], ["2", skippedAnswer()]]), { now: NOW, moment, coreTemplatesOptions: undefined });
	const choices = confirmChoices(resolved, "");
	assert.deepEqual(labels(choices), ['✅ Create "Meeting Roadmap"', "topic Roadmap", "room skipped", "kind meeting", "🛑 Cancel"]);
	assert.deepEqual(choices[1].action, { action: "edit", field: shape.fields[0] });
	assert.deepEqual(choices[3].action, { action: "stay" });
	assert.deepEqual(labels(formChoices([shape, { ...shape, name: "" }], "")), ["Meeting", "Untitled form"]);
});

test("an entry time question shows the time it keeps as its placeholder and offers Keep first", () => {
	const entry = question({ type: "time", entryTime: true, question: "When?" });
	assert.equal(questionPlaceholder(entry.field, NOW, moment), moment(NOW).format("HHmm"));
	assert.equal(questionPlaceholder({ ...entry.field, type: "datetime" }, NOW, moment), moment(NOW).format("YYYYMMDDHHmm"));
	const [first] = questionChoices(entry, undefined, "");
	assert.ok(first);
	assert.equal(first.parts.content, "Keep");
	assert.deepEqual(first.action, { action: "answer", answer: answered(NOW) });
	assert.equal(questionPlaceholder(question({ type: "datetime", question: "When?" }).field, NOW, moment), "When?");
});

test("a datetime question reads a bare time as that time today", () => {
	const [first] = questionChoices(question({ type: "datetime" }), undefined, "0930");
	const expected = moment(`${moment(NOW).format("YYYY-MM-DD")}T09:30`, "YYYY-MM-DDTHH:mm", true).valueOf();
	assert.deepEqual(first?.action, { action: "answer", answer: answered(expected) });
});
