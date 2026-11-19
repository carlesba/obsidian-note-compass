import { test } from "node:test";
import { strict as assert } from "node:assert";
import { activeMentions, mentionPicker, mentionWarning, newMention, readMentions } from "../src/mentions/settings.ts";
import { closestMentionAt, isInCode, mentionAt } from "../src/mentions/trigger.ts";
import { mentionKey, readControl, writeControl } from "../src/settings/controlKeys.ts";
import { defaultSettings } from "../src/settings.ts";
import type { NotePicker } from "../src/settings.ts";

const picker = (id: string): NotePicker => ({
	id,
	name: `Picker ${id}`,
	placeholder: "",
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

test("a fresh install has no triggers", () => {
	assert.deepEqual(defaultSettings().mentions, []);
});

test("a switched-on single trigger becomes the first row and a switched-off one leaves no rows", () => {
	const pickers = [picker("1")];
	assert.deepEqual(readMentions({ mention: { enabled: true, trigger: " ; ; ", pickerId: "2" } }, pickers), [{ id: "1", trigger: ";;", pickerId: "2" }]);
	assert.deepEqual(readMentions({ mention: { enabled: false, trigger: "@", pickerId: "1" } }, pickers), []);
});

test("stored trigger rows keep their order and drop whitespace from each trigger", () => {
	const stored = { mentions: [{ id: "4", trigger: "@ ", pickerId: "1" }, { id: "2", trigger: ";;", pickerId: "2" }] };
	assert.deepEqual(readMentions(stored, [picker("1")]), [
		{ id: "4", trigger: "@", pickerId: "1" },
		{ id: "2", trigger: ";;", pickerId: "2" },
	]);
});

test("a trigger row only runs with a trigger and a readable navigation picker", () => {
	const pickers = [picker("1"), picker("2")];
	assert.equal(mentionPicker({ id: "1", trigger: "@", pickerId: "1" }, pickers)?.id, "1");
	assert.equal(mentionPicker({ id: "1", trigger: "", pickerId: "1" }, pickers), undefined);
	assert.equal(mentionPicker({ id: "1", trigger: "@", pickerId: "9" }, pickers), undefined);
});

test("each trigger opens its own navigation picker", () => {
	const pickers = [picker("1"), picker("2")];
	const active = activeMentions([{ id: "1", trigger: "@", pickerId: "1" }, { id: "2", trigger: "!", pickerId: "2" }], pickers);
	assert.equal(closestMentionAt("Met @pro", active)?.candidate.picker.id, "1");
	assert.equal(closestMentionAt("Met !pro", active)?.candidate.picker.id, "2");
	assert.equal(closestMentionAt("Met !pro @jo", active)?.candidate.picker.id, "1");
});

test("a longer trigger that starts with a shorter one wins where both are typed", () => {
	const active = activeMentions([{ id: "1", trigger: "@", pickerId: "1" }, { id: "2", trigger: "@@", pickerId: "2" }], [picker("1"), picker("2")]);
	assert.deepEqual(closestMentionAt("@@pro", active)?.candidate.id, "2");
	assert.deepEqual(closestMentionAt("@pro", active)?.candidate.id, "1");
});

test("stored rows that repeat a trigger only open the first row's picker and warn on the later row", () => {
	const pickers = [picker("1"), picker("2")];
	const mentions = [{ id: "1", trigger: "@", pickerId: "1" }, { id: "2", trigger: "@", pickerId: "2" }];
	assert.deepEqual(activeMentions(mentions, pickers).map((mention) => mention.id), ["1"]);
	assert.equal(mentionWarning(mentions[0], mentions, pickers), undefined);
	assert.notEqual(mentionWarning(mentions[1], mentions, pickers), undefined);
});

test("a new row takes the shortest free run of @ and the first readable picker", () => {
	const pickers = [{ ...picker("1"), unreadable: { stored: {} } } as NotePicker, picker("2")];
	assert.deepEqual(newMention([], pickers), { id: "1", trigger: "@", pickerId: "2" });
	assert.deepEqual(newMention([{ id: "3", trigger: "@", pickerId: "2" }], pickers), { id: "4", trigger: "@@", pickerId: "2" });
});

test("settings refuse a trigger another row already uses", () => {
	const settings = defaultSettings();
	settings.mentions.push({ id: "1", trigger: "@", pickerId: "1" }, { id: "2", trigger: "!", pickerId: "1" });
	assert.equal(writeControl(settings, mentionKey("2", "trigger"), " @"), false);
	assert.equal(readControl(settings, mentionKey("2", "trigger")), "!");
	assert.equal(writeControl(settings, mentionKey("2", "trigger"), ""), true);
	assert.equal(writeControl(settings, mentionKey("1", "trigger"), ""), true);
});

test("typing a trigger in settings drops its spaces", () => {
	const settings = defaultSettings();
	settings.mentions.push({ id: "1", trigger: "@", pickerId: "1" });
	assert.equal(writeControl(settings, mentionKey("1", "trigger"), "@ @"), true);
	assert.equal(readControl(settings, mentionKey("1", "trigger")), "@@");
	assert.equal(writeControl(settings, mentionKey("1", "picker"), "2"), true);
	assert.equal(readControl(settings, mentionKey("1", "picker")), "2");
});
