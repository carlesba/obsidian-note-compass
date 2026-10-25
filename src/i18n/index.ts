import { en } from "./en.ts";
import type { Translation, TranslationKey } from "./en.ts";
import { es } from "./es.ts";
import { ja } from "./ja.ts";
import { ko } from "./ko.ts";
import { zh } from "./zh.ts";
import { zhTW } from "./zhTW.ts";

export type { Translation, TranslationKey } from "./en.ts";

export const DEFAULT_LANGUAGE = "en";

export const TRANSLATIONS: Readonly<Record<string, Translation>> = {
	en,
	es,
	zh,
	"zh-TW": zhTW,
	ja,
	ko,
};

export type Placeholders = Record<string, string | number>;

let active: Translation = en;

export function setLanguage(language: string): void {
	active = Object.prototype.hasOwnProperty.call(TRANSLATIONS, language) ? TRANSLATIONS[language] : en;
}

export function t(key: TranslationKey, placeholders?: Placeholders): string {
	const template = active[key] ?? en[key];
	if (!placeholders) return template;
	return template.replace(/\{(\w+)\}/g, (match: string, name: string) =>
		Object.prototype.hasOwnProperty.call(placeholders, name) ? String(placeholders[name]) : match,
	);
}

export function tCount(one: TranslationKey, other: TranslationKey, count: number, placeholders: Placeholders = {}): string {
	return t(count === 1 ? one : other, { ...placeholders, count });
}

export function translatedLabels<Choice extends string>(keys: Record<Choice, TranslationKey>): Record<Choice, string> {
	const labels = {} as Record<Choice, string>;
	for (const choice of Object.keys(keys) as Choice[]) labels[choice] = t(keys[choice]);
	return labels;
}
