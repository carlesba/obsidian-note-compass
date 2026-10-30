import { test } from "node:test";
import { strict as assert } from "node:assert";
import { DEFAULT_LANGUAGE, TRANSLATIONS, setLanguage, t, tCount } from "../src/i18n/index.ts";
import { en } from "../src/i18n/en.ts";
import { es } from "../src/i18n/es.ts";
import { pickerChoices, pickerState } from "../src/setProperties/picker.ts";
import { sourceSummary } from "../src/settings/listForm.ts";

const englishKeys = new Set(Object.keys(en));

function placeholders(text: string): string[] {
	return (text.match(/\{\w+\}/g) ?? []).sort();
}

function inLanguage(language: string, run: () => void): void {
	setLanguage(language);
	try {
		run();
	} finally {
		setLanguage(DEFAULT_LANGUAGE);
	}
}

test("every locale only has keys that exist in English", () => {
	for (const [language, translation] of Object.entries(TRANSLATIONS)) {
		const unknown = Object.keys(translation).filter((key) => !englishKeys.has(key));
		assert.deepEqual(unknown, [], `${language} has keys English does not`);
	}
});

test("every translated string uses the same placeholders as its English string", () => {
	for (const [language, translation] of Object.entries(TRANSLATIONS)) {
		for (const [key, text] of Object.entries(translation)) {
			const english = en[key as keyof typeof en];
			assert.equal(typeof text, "string", `${language}.${key} is not a string`);
			assert.deepEqual(placeholders(text ?? ""), placeholders(english), `${language}.${key} placeholders differ`);
		}
	}
});

test("English is the default, and unknown languages fall back to it", () => {
	assert.equal(t("cancel"), "Cancel");
	for (const language of ["fr", "pt-BR", "", "EN", "zh-HK"]) {
		inLanguage(language, () => {
			assert.equal(t("cancel"), "Cancel");
			assert.equal(t("couldNotCreate", { name: "Ana" }), 'Could not create "Ana".');
		});
	}
});

test("Traditional Chinese reads its own locale and never the Simplified one", () => {
	const traditional = TRANSLATIONS["zh-TW"];
	assert.ok(traditional);
	inLanguage("zh-TW", () => {
		for (const key of Object.keys(en) as (keyof typeof en)[]) assert.equal(t(key), traditional[key] ?? en[key]);
	});
});

test("after choosing Spanish, picker rows and source summaries are in Spanish", () => {
	inLanguage("es", () => {
		const [save, cancel] = pickerChoices([], new Map(), pickerState(new Map()), "");
		assert.equal(save.parts.content, es.saveAndClose);
		assert.equal(cancel.parts.content, es.cancel);
		assert.notEqual(save.parts.content, en.saveAndClose);
		const summary = sourceSummary({ kind: "linksToNote", note: "People/Ana.md" });
		assert.equal(summary, es.linksTo?.replace("{name}", "Ana"));
		assert.notEqual(summary, "Links to Ana");
	});
	assert.equal(sourceSummary({ kind: "linksToNote", note: "People/Ana.md" }), "Links to Ana");
});

test("a key missing from a locale falls back to its English string", () => {
	const saved = es.cancel;
	delete es.cancel;
	try {
		inLanguage("es", () => assert.equal(t("cancel"), "Cancel"));
	} finally {
		if (saved !== undefined) es.cancel = saved;
	}
});

test("placeholders are filled by name, and plurals pick the one or other key by count", () => {
	assert.equal(t("noteCreated", { name: "Ana", folder: "People" }), 'Created "Ana" in People.');
	assert.equal(t("formEntryTimeDesc").includes("{{date}}"), true);
	assert.equal(tCount("allOfOne", "allOfOther", 1), "All of 1 condition");
	assert.equal(tCount("allOfOne", "allOfOther", 3), "All of 3 conditions");
});
