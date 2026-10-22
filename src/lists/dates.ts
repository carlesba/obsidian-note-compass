import { PERIODS } from "./dateNotes.ts";
import type { Period, ResolvedDateNotes } from "./dateNotes.ts";
import type { MomentDate, MomentFactory, VaultNote } from "./vault";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
	"January", "February", "March", "April", "May", "June",
	"July", "August", "September", "October", "November", "December",
];

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
		previousLabel: `prev ${period}`,
		nextLabel: `next ${period}`,
	};
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
			return WEEKDAYS[date.day()];
		case "week":
			return `week ${usesIsoWeeks(dateNote.format) ? date.isoWeek() : date.week()}`;
		case "month":
			return `month - ${MONTHS[date.month()]}`;
		case "quarter":
			return `quarter ${date.quarter()}`;
		case "year":
			return "year";
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

function notePath(folder: string, basename: string): string {
	return folder === "" ? `${basename}.md` : `${folder}/${basename}.md`;
}
