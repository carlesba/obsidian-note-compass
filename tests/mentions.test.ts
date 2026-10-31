import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mentionPicker, readMention } from "../src/mentions/settings.ts";
import { isInCode, mentionAt } from "../src/mentions/trigger.ts";
import { readControl, writeControl, MENTION_TRIGGER_KEY } from "../src/settings/controlKeys.ts";
import { defaultSettings } from "../src/settings.ts";
import type { NotePicker } from "../src/settings.ts";

const picker = (id: string, enabled = true): NotePicker => ({
	id,
	enabled,
	name: `Picker ${id}`,
	filter: { kind: "group", mode: "all", items: [] },
	lists: [],
});

test("the trigger opens a mention at the start of a line or after whitespace", () => {
	assert.deepEqual(mentionAt("@", "@"), { start: 0, query: "" });
	assert.deepEqual(mentionAt("Met with @pro", "@"), { start: 9, query: "pro" });
	assert.deepEqual(mentionAt("\t;;jor", ";;"), { start: 1, query: "jor" });
});

test("the trigger inside a word, such as an email address, opens nothing", () => {
	assert.equal(mentionAt("me@mail", "@"), undefined);
});

test("a space after the trigger ends the mention", () => {
	assert.equal(mentionAt("@project jor", "@"), undefined);
	assert.equal(mentionAt("@ ", "@"), undefined);
});

test("an empty trigger never opens a mention", () => {
	assert.equal(mentionAt("@pro", ""), undefined);
});

test("a mention inside code or frontmatter is ignored", () => {
	assert.equal(isInCode(["```js"], "const @"), true);
	assert.equal(isInCode(["```js", "```"], "@"), false);
	assert.equal(isInCode([], "see `@"), true);
	assert.equal(isInCode([], "see `code` @"), false);
	assert.equal(isInCode(["---", "tags: x"], "people: @"), true);
	assert.equal(isInCode(["---", "tags: x", "---"], "@"), false);
});

test("mention settings start off with @ and the first navigation picker", () => {
	assert.deepEqual(defaultSettings().mention, { enabled: false, trigger: "@", pickerId: "1" });
});

test("stored mention settings drop whitespace from the trigger", () => {
	assert.deepEqual(readMention({ enabled: true, trigger: " ; ; ", pickerId: "2" }, [picker("1")]), {
		enabled: true,
		trigger: ";;",
		pickerId: "2",
	});
});

test("a mention only runs with a trigger and a navigation picker that is on", () => {
	const pickers = [picker("1"), picker("2", false)];
	assert.equal(mentionPicker({ enabled: true, trigger: "@", pickerId: "1" }, pickers)?.id, "1");
	assert.equal(mentionPicker({ enabled: false, trigger: "@", pickerId: "1" }, pickers), undefined);
	assert.equal(mentionPicker({ enabled: true, trigger: "", pickerId: "1" }, pickers), undefined);
	assert.equal(mentionPicker({ enabled: true, trigger: "@", pickerId: "2" }, pickers), undefined);
	assert.equal(mentionPicker({ enabled: true, trigger: "@", pickerId: "9" }, pickers), undefined);
});

test("typing a trigger in settings drops its spaces", () => {
	const settings = defaultSettings();
	assert.equal(writeControl(settings, MENTION_TRIGGER_KEY, "@ @"), true);
	assert.equal(readControl(settings, MENTION_TRIGGER_KEY), "@@");
});
