import { t, translatedLabels } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import { operatorLabel } from "../i18n/labels.ts";
import { CONDITIONS_BY_TYPE, DATE_OPERATORS, NUMBER_OPERATORS, TEXT_OPERATORS, conditionAppliesTo, propertyType } from "../lists/conditions.ts";
import type { ConditionOperator, PropertyType } from "../lists/conditions.ts";
import { PERIODS } from "../lists/dateNotes.ts";
import type { Period } from "../lists/dateNotes.ts";
import { emptyFilter } from "../lists/filters.ts";
import type { JumpListVault } from "../lists/vault.ts";
import { ADJACENT_ENTRIES, RELATION_SOURCE_KINDS, showsMissingNotes, currentPeriodsInOrder, newListId, orderedChoices, writePrefixColor } from "../settings.ts";
import type { AdjacentDatesSource, AdjacentEntry, CurrentPeriodsSource, ListSource, NoteList } from "../settings.ts";
import { filterSummary, inapplicableFilter } from "./filterForm.ts";

export type SourceChoice = Exclude<ListSource["kind"], "unreadable">;

const SOURCE_KEYS: Record<SourceChoice, TranslationKey> = {
	adjacentDates: "sourceAdjacentDates",
	linksOut: "sourceLinksOut",
	linksIn: "sourceLinksIn",
	sameDay: "sourceSameDay",
	filter: "filter",
	linksToNote: "sourceLinksToNote",
	inFolder: "sourceInFolder",
	modifiedToday: "sourceModifiedToday",
	currentPeriods: "sourceCurrentPeriods",
};

const CURRENT_PERIOD_KEYS: Record<Period, TranslationKey> = {
	day: "today",
	week: "thisWeek",
	month: "thisMonth",
	quarter: "thisQuarter",
	year: "thisYear",
};

export function unreadableListWarning(): string {
	return t("unreadableListWarning");
}

export function sourceOptions(): Record<SourceChoice, string> {
	return translatedLabels(SOURCE_KEYS);
}

export function currentPeriodName(period: Period): string {
	return t(CURRENT_PERIOD_KEYS[period]);
}

export type CurrentPeriodField = "currentDay" | "currentWeek" | "currentMonth" | "currentQuarter" | "currentYear";

export const CURRENT_PERIOD_FIELDS: Record<Period, CurrentPeriodField> = {
	day: "currentDay",
	week: "currentWeek",
	month: "currentMonth",
	quarter: "currentQuarter",
	year: "currentYear",
};

export type AdjacentEntryField = `adjacent-${AdjacentEntry}`;

export function adjacentEntryField(entry: AdjacentEntry): AdjacentEntryField {
	return `adjacent-${entry}`;
}

const ADJACENT_ENTRY_KEYS: Record<AdjacentEntry, TranslationKey> = {
	"previous-day": "adjacentPreviousDay",
	"next-day": "adjacentNextDay",
	"previous-week": "adjacentPreviousWeek",
	"next-week": "adjacentNextWeek",
	"previous-month": "adjacentPreviousMonth",
	"next-month": "adjacentNextMonth",
	"previous-quarter": "adjacentPreviousQuarter",
	"next-quarter": "adjacentNextQuarter",
	"previous-year": "adjacentPreviousYear",
	"next-year": "adjacentNextYear",
};

export function adjacentEntryName(entry: AdjacentEntry): string {
	return t(ADJACENT_ENTRY_KEYS[entry]);
}

export function dateModeOptions(): Record<"fixed" | "relative", string> {
	return { fixed: t("fixedDate"), relative: t("relativeToToday") };
}

export function directionOptions(): Record<"ago" | "today" | "fromNow", string> {
	return { ago: t("daysAgo"), today: t("today"), fromNow: t("daysFromNow") };
}

export type ListField =
	| "enabled"
	| "prefix"
	| "prefixColor"
	| "source"
	| "note"
	| "folder"
	| CurrentPeriodField
	| AdjacentEntryField
	| "showsMissing";

export type ValueShape = "none" | "text" | "number" | "date";

export interface PropertySuggestion {
	name: string;
	type: PropertyType;
}

const FIXED_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function newList(lists: readonly NoteList[]): NoteList {
	return { id: newListId(lists), enabled: true, prefix: "", source: { kind: "filter", filter: emptyFilter() } };
}

export function listName(list: NoteList): string {
	return `${list.prefix} ${sourceSummary(list.source)}`.trim();
}

export function sourceSummary(source: ListSource): string {
	if (source.kind === "linksToNote") {
		const name = source.note.split("/").pop()?.replace(/\.md$/, "") ?? "";
		return name === "" ? t("noteNotChosen") : t("linksTo", { name });
	}
	if (source.kind === "inFolder") return source.folder === "" ? t("folderNotChosen") : t("inFolder", { folder: source.folder });
	if (source.kind === "currentPeriods") {
		if (source.periods.length === 0) return t("noDateNotesChosen");
		return currentPeriodsInOrder(source)
			.map((period, index) => (index === 0 ? currentPeriodName(period) : currentPeriodName(period).toLowerCase()))
			.join(t("listSeparator"));
	}
	if (source.kind === "filter") return filterSummary(source.filter);
	if (source.kind === "unreadable") return t("unreadableList");
	return t(SOURCE_KEYS[source.kind]);
}

export function listDisplayValue(list: NoteList): string {
	return list.enabled && list.source.kind !== "unreadable" ? "" : t("off");
}

export function inapplicableCondition(source: ListSource, types: Record<string, string>): string | undefined {
	return source.kind === "filter" ? inapplicableFilter(source.filter, types) : undefined;
}

export function operatorOptions(type: PropertyType, current?: ConditionOperator): Record<string, string> {
	const options: Record<string, string> = {};
	for (const operator of CONDITIONS_BY_TYPE[type]) options[operator] = operatorLabel(operator);
	if (current !== undefined && !(current in options)) {
		const label = operatorLabel(current);
		options[current] = conditionAppliesTo(current, type) ? label : t("operatorDoesNotApply", { operator: label });
	}
	return options;
}

export function valueShape(operator: ConditionOperator): ValueShape {
	if (includes(TEXT_OPERATORS, operator)) return "text";
	if (includes(NUMBER_OPERATORS, operator)) return "number";
	if (includes(DATE_OPERATORS, operator)) return "date";
	return "none";
}

export function propertySuggestions(vault: Pick<JumpListVault, "notes" | "frontmatter" | "propertyTypes">): PropertySuggestion[] {
	const types = vault.propertyTypes();
	const names = new Map<string, string>();
	for (const note of vault.notes()) {
		for (const name of Object.keys(vault.frontmatter(note.path) ?? {})) {
			if (!names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
		}
	}
	for (const name of Object.keys(types)) if (!names.has(name)) names.set(name, name);
	return Array.from(names.values())
		.sort((a, b) => a.localeCompare(b))
		.map((name) => ({ name, type: propertyType(types, name) }));
}

export function matchingSuggestions(suggestions: readonly PropertySuggestion[], query: string): PropertySuggestion[] {
	const typed = query.trim().toLowerCase();
	return suggestions.filter((suggestion) => suggestion.name.toLowerCase().includes(typed));
}

export function readListField(list: NoteList, field: ListField): unknown {
	if (field === "enabled") return list.enabled;
	if (field === "prefix") return list.prefix;
	if (field === "prefixColor") return list.prefixColor ?? "";
	if (field === "source") return list.source.kind;
	const { source } = list;
	if (source.kind === "linksToNote") return field === "note" ? source.note : undefined;
	if (source.kind === "inFolder") return field === "folder" ? source.folder : undefined;
	if (field === "showsMissing") return source.kind === "adjacentDates" || source.kind === "currentPeriods" ? showsMissingNotes(source) : undefined;
	if (source.kind === "currentPeriods") {
		const period = currentPeriodOf(field);
		return period === undefined ? undefined : source.periods.includes(period);
	}
	if (source.kind === "adjacentDates") {
		const entry = entryOf(field);
		return entry === undefined ? undefined : (source.entries ?? ADJACENT_ENTRIES).includes(entry);
	}
	return undefined;
}

export function writeListField(list: NoteList, field: ListField, value: unknown): void {
	if (field === "enabled") list.enabled = value === true;
	else if (field === "prefix") list.prefix = typeof value === "string" ? value : "";
	else if (field === "prefixColor") writePrefixColor(list, value);
	else if (field === "source") list.source = sourceFor(value, list.source);
	else if (field === "note" && list.source.kind === "linksToNote") list.source.note = typeof value === "string" ? value.trim() : "";
	else if (field === "folder" && list.source.kind === "inFolder") list.source.folder = typeof value === "string" ? value.trim() : "";
	else if (field === "showsMissing" && (list.source.kind === "currentPeriods" || list.source.kind === "adjacentDates")) {
		const source = list.source;
		if ((value === true) === (source.kind === "currentPeriods")) delete source.showsMissing;
		else source.showsMissing = value === true;
	} else if (list.source.kind === "currentPeriods") writeCurrentPeriod(list.source, field, value);
	else if (list.source.kind === "adjacentDates") writeAdjacentEntry(list.source, field, value);
}

export function sourceChoiceOrder(source: ListSource): string[] {
	if (source.kind === "currentPeriods") return orderedChoices(source.order, PERIODS);
	if (source.kind === "adjacentDates") return orderedChoices(source.order, ADJACENT_ENTRIES);
	return [];
}

export function moveSourceChoice(source: ListSource, from: number, to: number): void {
	if (source.kind === "currentPeriods") source.order = moved(orderedChoices(source.order, PERIODS), from, to);
	else if (source.kind === "adjacentDates") source.order = moved(orderedChoices(source.order, ADJACENT_ENTRIES), from, to);
}

function moved<T>(items: T[], from: number, to: number): T[] {
	const copy = [...items];
	copy.splice(to, 0, ...copy.splice(from, 1));
	return copy;
}

function entryOf(field: ListField): AdjacentEntry | undefined {
	return ADJACENT_ENTRIES.find((entry) => adjacentEntryField(entry) === field);
}

function writeAdjacentEntry(source: AdjacentDatesSource, field: ListField, value: unknown): void {
	const changed = entryOf(field);
	if (changed === undefined) return;
	const enabled = source.entries ?? ADJACENT_ENTRIES;
	const entries = ADJACENT_ENTRIES.filter((entry) => (entry === changed ? value === true : enabled.includes(entry)));
	if (entries.length === ADJACENT_ENTRIES.length) delete source.entries;
	else source.entries = entries;
}

function currentPeriodOf(field: ListField): Period | undefined {
	return PERIODS.find((period) => CURRENT_PERIOD_FIELDS[period] === field);
}

function writeCurrentPeriod(source: CurrentPeriodsSource, field: ListField, value: unknown): void {
	const changed = currentPeriodOf(field);
	if (changed === undefined) return;
	source.periods = PERIODS.filter((period) => (period === changed ? value === true : source.periods.includes(period)));
}

export function fixedDateError(value: string): string | undefined {
	if (FIXED_DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value))) return undefined;
	return t("fixedDateFormat");
}

function sourceFor(kind: unknown, current: ListSource): ListSource {
	if (kind === current.kind) return current;
	if (kind === "filter") return { kind, filter: emptyFilter() };
	if (kind === "linksToNote") return { kind, note: "" };
	if (kind === "inFolder") return { kind, folder: "" };
	if (kind === "modifiedToday") return { kind };
	if (kind === "currentPeriods") return { kind, periods: [...PERIODS] };
	if (kind === "adjacentDates") return { kind };
	const relation = RELATION_SOURCE_KINDS.find((choice) => choice === kind);
	return relation && relation !== "adjacentDates" ? { kind: relation } : current;
}

function includes<T extends string>(values: readonly T[], value: string): value is T {
	return (values as readonly string[]).includes(value);
}
