import { formFields } from "../forms/form.ts";
import type { Form } from "../forms/form.ts";
import { coreDatePlaceholder } from "../forms/newNotes.ts";
import { relativeDay } from "../forms/resolve.ts";
import type { FormClock } from "../forms/resolve.ts";
import { CORE_PLACEHOLDERS, RELATIVE_DAYS, TITLE_PLACEHOLDER, placeholderKey, placeholderToken, pillLabel } from "../forms/placeholders.ts";
import { t } from "../i18n/index.ts";
import { fieldBadges } from "./formsForm.ts";

export interface PlaceholderEntry {
	key: string;
	link: boolean;
	token: string;
	label: string;
	detail?: string;
}

export interface PlaceholderTrigger {
	start: number;
	query: string;
}

export interface PlaceholderMenuOptions {
	inContent: boolean;
	preview: (key: string) => string | undefined;
}

const TRIGGER_BOUNDARY = /(?:^|[\s[(])@([^\s@[\]()]*)$/;

export function placeholderEntries(form: Pick<Form, "fields">, options: PlaceholderMenuOptions): PlaceholderEntry[] {
	const entries: PlaceholderEntry[] = [];
	const add = (key: string, detail: (link: boolean) => string | undefined) => {
		for (const link of [false, true]) entries.push({ key, link, token: placeholderToken(key, link), label: pillLabel(key, link), detail: detail(link) });
	};
	const previewed = (key: string) => (link: boolean) => {
		const preview = options.preview(key);
		return preview === undefined ? undefined : pillLabel(preview, link);
	};
	for (const day of RELATIVE_DAYS) add(day, previewed(day));
	for (const [key, detail] of fieldDetails(form)) add(key, () => detail);
	for (const core of CORE_PLACEHOLDERS) if (!hasKey(form, core)) add(core, previewed(core));
	if (options.inContent && !hasKey(form, TITLE_PLACEHOLDER)) add(TITLE_PLACEHOLDER, () => t("formPlaceholderTitleDetail"));
	return entries;
}

function fieldDetails(form: Pick<Form, "fields">): Map<string, string> {
	const details = new Map<string, string>();
	for (const field of formFields(form)) {
		if (field.key === "" || details.has(field.key)) continue;
		details.set(
			field.key,
			fieldBadges(field)
				.map((badge) => badge.text)
				.join(" · "),
		);
	}
	return details;
}

function hasKey(form: Pick<Form, "fields">, key: string): boolean {
	return formFields(form).some((field) => field.key === key);
}

export function placeholderPreview(key: string, clock: FormClock): string | undefined {
	const day = relativeDay(key, clock);
	if (day !== undefined) return day;
	if (CORE_PLACEHOLDERS.some((core) => core === key)) return coreDatePlaceholder(key, undefined, clock.moment(clock.now), clock.coreTemplatesOptions);
	return undefined;
}

export function knownPlaceholderKeys(form: Pick<Form, "fields">, inContent: boolean): Set<string> {
	const keys = new Set<string>([...RELATIVE_DAYS, ...CORE_PLACEHOLDERS]);
	if (inContent) keys.add(TITLE_PLACEHOLDER);
	for (const field of formFields(form)) if (field.key !== "") keys.add(field.key);
	return keys;
}

export function isKnownPlaceholder(inner: string, known: ReadonlySet<string>): boolean {
	const key = placeholderKey(inner);
	return known.has(key) || known.has(key.toLowerCase());
}

export function placeholderTriggerAt(text: string, caret: number): PlaceholderTrigger | undefined {
	const match = TRIGGER_BOUNDARY.exec(text.slice(0, caret));
	if (!match) return undefined;
	const query = match[1];
	return { start: caret - query.length - 1, query };
}

export function matchingPlaceholderEntries(entries: readonly PlaceholderEntry[], query: string): PlaceholderEntry[] {
	const typed = query.trim().toLowerCase();
	if (typed === "") return [...entries];
	return entries
		.filter((entry) => entry.key.toLowerCase().includes(typed))
		.sort((a, b) => Number(!a.key.toLowerCase().startsWith(typed)) - Number(!b.key.toLowerCase().startsWith(typed)));
}
