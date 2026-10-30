import { t } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import { PERIODS } from "./dateNotes.ts";
import type { Period, ResolvedDateNotes } from "./dateNotes.ts";
import type { MomentDate, MomentFactory, VaultNote } from "./vault";

const WEEKDAYS: readonly TranslationKey[] = [
	"weekdaySunday",
	"weekdayMonday",
	"weekdayTuesday",
	"weekdayWednesday",
	"weekdayThursday",
	"weekdayFriday",
	"weekdaySaturday",
];

const MONTHS: readonly TranslationKey[] = [
	"monthJanuary",
	"monthFebruary",
	"monthMarch",
	"monthApril",
	"monthMay",
	"monthJune",
	"monthJuly",
	"monthAugust",
	"monthSeptember",
	"monthOctober",
	"monthNovember",
	"monthDecember",
];

const PREVIOUS_LABELS: Record<Period, TranslationKey> = {
	day: "previousDay",
	week: "previousWeek",
	month: "previousMonth",
	quarter: "previousQuarter",
	year: "previousYear",
};

const NEXT_LABELS: Record<Period, TranslationKey> = {
	day: "nextDay",
	week: "nextWeek",
	month: "nextMonth",
	quarter: "nextQuarter",
	year: "nextYear",
};

export interface DateNote {
	period: Period;
	date: MomentDate;
	folder: string;
	format: string;
}

export interface AdjacentDatePaths {
	previous: string;
	next: string;
	previousLabel: string;
	nextLabel: string;
}

export function parseDateNote(note: VaultNote, dateNotes: ResolvedDateNotes, moment: MomentFactory): DateNote | undefined {
	const folder = parentFolder(note.path);
	for (const period of PERIODS) {
		const settings = dateNotes.periods[period];
		if (!settings.enabled || settings.folder !== folder) continue;
		const date = moment(note.basename, settings.format, true);
		if (date.isValid()) return { period, date, folder: settings.folder, format: settings.format };
	}
	return undefined;
}

export function adjacentDatePaths(dateNote: DateNote): AdjacentDatePaths {
	const { period, date, folder, format } = dateNote;
	const pathAt = (offset: number) => notePath(folder, date.clone().add(offset, period).format(format));
	return {
		previous: pathAt(-1),
		next: pathAt(1),
		previousLabel: t(PREVIOUS_LABELS[period]),
		nextLabel: t(NEXT_LABELS[period]),
	};
}

export interface AdjacentDatePath {
	path: string;
	label: string;
	date: MomentDate;
}

export function adjacentDatePath(
	dateNote: DateNote,
	dateNotes: ResolvedDateNotes,
	period: Period,
	direction: "previous" | "next",
): AdjacentDatePath | undefined {
	const settings = dateNotes.periods[period];
	if (!settings.enabled || PERIODS.indexOf(period) < PERIODS.indexOf(dateNote.period)) return undefined;
	const date = dateNote.date.clone().add(direction === "previous" ? -1 : 1, period);
	const label = t(direction === "previous" ? PREVIOUS_LABELS[period] : NEXT_LABELS[period]);
	return { path: notePath(settings.folder, date.format(settings.format)), label, date };
}

export function currentDatePath(dateNotes: ResolvedDateNotes, period: Period, today: MomentDate): string | undefined {
	const settings = dateNotes.periods[period];
	if (!settings.enabled) return undefined;
	return notePath(settings.folder, today.format(settings.format));
}

export function dateNoteSuffix(dateNote: DateNote): string {
	const { date } = dateNote;
	switch (dateNote.period) {
		case "day":
			return t(WEEKDAYS[date.day()]);
		case "week":
			return t("suffixWeek", { week: usesIsoWeeks(dateNote.format) ? date.isoWeek() : date.week() });
		case "month":
			return t("suffixMonth", { month: t(MONTHS[date.month()]) });
		case "quarter":
			return t("suffixQuarter", { quarter: date.quarter() });
		case "year":
			return t("suffixYear");
	}
}

export function isSameLocalDay(reference: number, timestamp: number): boolean {
	return new Date(reference).toDateString() === new Date(timestamp).toDateString();
}

function usesIsoWeeks(format: string): boolean {
	return /[GW]/.test(format.replace(/\[[^\]]*\]/g, ""));
}

function parentFolder(path: string): string {
	const slash = path.lastIndexOf("/");
	return slash === -1 ? "" : path.slice(0, slash);
}

export function notePath(folder: string, basename: string): string {
	return folder === "" ? `${basename}.md` : `${folder}/${basename}.md`;
}
