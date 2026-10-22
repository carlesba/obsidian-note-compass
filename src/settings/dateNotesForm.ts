import { PERIODS, resolveDateNotes } from "../lists/dateNotes.ts";
import type { DateNoteSettings, Period, PeriodFormat } from "../lists/dateNotes.ts";
import type { JumpListVault } from "../lists/vault.ts";

export const DATE_NOTE_SOURCE_OPTIONS: Record<DateNoteSettings["from"], string> = {
	auto: "Automatic",
	periodicNotes: "Periodic Notes",
	dailyNotes: "Daily notes",
	custom: "Custom",
};

export const PERIOD_NAMES: Record<Period, string> = {
	day: "Day",
	week: "Week",
	month: "Month",
	quarter: "Quarter",
	year: "Year",
};

export type PeriodField = keyof PeriodFormat;

type DateNoteVault = Pick<JumpListVault, "periodicNotesSettings" | "dailyNotesOptions">;

const AUTOMATIC_ORDER = "Automatic picks Periodic Notes, then Daily notes, then Custom.";

export function customPeriods(settings: DateNoteSettings, vault: DateNoteVault): Period[] {
	const { from } = resolveDateNotes(settings, vault);
	if (from === "periodicNotes") return [];
	return from === "dailyNotes" ? PERIODS.filter((period) => period !== "day") : [...PERIODS];
}

export function dateNoteSourceDescription(settings: DateNoteSettings, vault: DateNoteVault): string {
	const { from } = resolveDateNotes(settings, vault);
	const reading =
		from === "periodicNotes"
			? "Every period comes from Periodic Notes."
			: from === "dailyNotes"
				? "Days come from Daily notes. Edit the other periods with the pencil."
				: "Edit each period's folder and format with the pencil.";
	if (settings.from === "auto") return `${AUTOMATIC_ORDER} ${reading}`;
	if (settings.from !== from) return `${DATE_NOTE_SOURCE_OPTIONS[settings.from]} is not enabled. ${reading}`;
	return reading;
}

export function writeDateNoteSource(settings: DateNoteSettings, value: unknown): void {
	const from = (Object.keys(DATE_NOTE_SOURCE_OPTIONS) as DateNoteSettings["from"][]).find((source) => source === value);
	if (from) settings.from = from;
}

export function readPeriodField(settings: DateNoteSettings, period: Period, field: PeriodField): unknown {
	return settings.custom[period][field];
}

export function writePeriodField(settings: DateNoteSettings, period: Period, field: PeriodField, value: unknown): void {
	const format = settings.custom[period];
	if (field === "enabled") format.enabled = value === true;
	else if (typeof value === "string") format[field] = value.trim();
}

export function formatError(value: string): string | undefined {
	return value.trim() === "" ? "Enter a Moment format, such as YYYY-MM-DD." : undefined;
}

export function isPeriod(value: string): value is Period {
	return (PERIODS as readonly string[]).includes(value);
}
