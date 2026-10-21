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

export interface ResolvedPeriodRow {
	period: Period;
	name: string;
	desc: string;
}

type DateNoteVault = Pick<JumpListVault, "periodicNotesSettings" | "dailyNotesOptions">;

export function resolvedSourceName(settings: DateNoteSettings, vault: DateNoteVault): string {
	return DATE_NOTE_SOURCE_OPTIONS[resolveDateNotes(settings, vault).from];
}

export function resolvedPeriodRows(settings: DateNoteSettings, vault: DateNoteVault): ResolvedPeriodRow[] {
	const { periods } = resolveDateNotes(settings, vault);
	return PERIODS.map((period) => ({ period, name: PERIOD_NAMES[period], desc: describePeriod(periods[period]) }));
}

export function readsCustomFormats(settings: DateNoteSettings): boolean {
	return settings.from === "custom";
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

function describePeriod(format: PeriodFormat): string {
	if (!format.enabled) return "Off";
	return format.folder === "" ? `${format.format} at the vault root` : `${format.format} in the "${format.folder}" folder`;
}
