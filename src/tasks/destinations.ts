import { t } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import type { Period, ResolvedDateNotes } from "../lists/dateNotes.ts";
import { notePath } from "../lists/dates.ts";
import { findNote } from "../lists/sources.ts";
import type { JumpListVault, MomentDate, VaultNote } from "../lists/vault";
import type { CopyAction, PeriodRelation, PeriodicDestination } from "./taskCommand.ts";

export interface MissingPeriodNote {
	period: Period;
	date: MomentDate;
}

export interface ResolvedDestination {
	path: string;
	label: string;
	missing?: MissingPeriodNote;
}

export interface DestinationContext {
	vault: JumpListVault;
	dateNotes: ResolvedDateNotes;
	today: MomentDate;
}

export interface ActionDestinations {
	destinations: ResolvedDestination[];
	missingNotes: string[];
}

const PERIODIC_LABELS: Record<Period, Record<PeriodRelation, TranslationKey>> = {
	day: { this: "destinationToday", next: "destinationTomorrow" },
	week: { this: "destinationThisWeek", next: "destinationNextWeek" },
	month: { this: "destinationThisMonth", next: "destinationNextMonth" },
	quarter: { this: "destinationThisQuarter", next: "destinationNextQuarter" },
	year: { this: "destinationThisYear", next: "destinationNextYear" },
};

export function periodicDestinationName(period: Period, relation: PeriodRelation): string {
	return t(PERIODIC_LABELS[period][relation]);
}

export function periodDate(today: MomentDate, period: Period, relation: PeriodRelation): MomentDate {
	return today.clone().add(relation === "next" ? 1 : 0, period);
}

export function periodNotePath(dateNotes: ResolvedDateNotes, period: Period, date: MomentDate): string | undefined {
	const settings = dateNotes.periods[period];
	if (!settings.enabled) return undefined;
	return notePath(settings.folder, date.format(settings.format));
}

export function actionDestinations(action: CopyAction, sourcePath: string, context: DestinationContext): ActionDestinations {
	const notes = context.vault.notes();
	const destinations: ResolvedDestination[] = [];
	const missingNotes: string[] = [];
	const add = (destination: ResolvedDestination | undefined) => {
		if (!destination || destination.path === sourcePath || destinations.some((known) => known.path === destination.path)) return;
		destinations.push(destination);
	};
	for (const destination of action.destinations) {
		if (destination.kind === "periodic") {
			add(periodicTarget(destination, notes, context));
			continue;
		}
		if (destination.path.trim() === "") continue;
		const note = noteDestinationTarget(notes, destination.path);
		if (note) add({ path: note.path, label: note.basename });
		else missingNotes.push(destination.path.trim());
	}
	return { destinations, missingNotes };
}

export function noteDestinationTarget(notes: readonly VaultNote[], path: string): VaultNote | undefined {
	const typed = path.trim();
	return typed === "" ? undefined : findNote(notes, typed);
}

function periodicTarget(destination: PeriodicDestination, notes: readonly VaultNote[], context: DestinationContext): ResolvedDestination | undefined {
	const { period, relation } = destination;
	const date = periodDate(context.today, period, relation);
	const path = periodNotePath(context.dateNotes, period, date);
	if (path === undefined) return undefined;
	const label = `${periodicDestinationName(period, relation)} · ${basenameOf(path)}`;
	return notes.some((note) => note.path === path) ? { path, label } : { path, label, missing: { period, date } };
}

export function basenameOf(path: string): string {
	return (path.split("/").pop() ?? path).replace(/\.md$/, "");
}

export function fallbackLinkText(path: string, notePaths: readonly string[]): string {
	const basename = basenameOf(path);
	const sharesName = notePaths.some((other) => other !== path && basenameOf(other) === basename);
	return sharesName ? path.replace(/\.md$/, "") : basename;
}
