import type { Frontmatter, VaultNote } from "./vault";

const DAY_NAME = /^\d{4}-\d{2}-\d{2}$/;
const WEEK_NAME = /^\d{4}-W\d{2}$/;
const MONTH_NAME = /^\d{4}-\d{2}$/;
const YEAR_NAME = /^\d{4}$/;
const DATE_PERIODS = ["day", "week", "month", "year"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
	"January", "February", "March", "April", "May", "June",
	"July", "August", "September", "October", "November", "December",
];
const DAY_MS = 24 * 60 * 60 * 1000;

export interface AdjacentDateNames {
	previous: string;
	next: string;
	previousLabel: string;
	nextLabel: string;
}

export function isDateNote(note: VaultNote, frontmatter: Frontmatter | undefined): boolean {
	const period = frontmatter?.period;
	if (typeof period === "string" && DATE_PERIODS.includes(period)) return true;
	const name = note.basename;
	const hasDateName = DAY_NAME.test(name) || WEEK_NAME.test(name) || MONTH_NAME.test(name);
	return hasDateName && note.path.startsWith("on/");
}

export function dateNoteSuffix(name: string): string | undefined {
	if (DAY_NAME.test(name)) {
		const [year, month, day] = name.split("-").map(Number);
		return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
	}
	if (WEEK_NAME.test(name)) return `week ${Number(name.slice(6))}`;
	if (MONTH_NAME.test(name)) return `month - ${MONTHS[Number(name.slice(5)) - 1]}`;
	if (YEAR_NAME.test(name)) return "year";
	return undefined;
}

export function adjacentDateNames(name: string): AdjacentDateNames | undefined {
	if (DAY_NAME.test(name)) {
		const [year, month, day] = name.split("-").map(Number);
		return {
			previous: formatDay(Date.UTC(year, month - 1, day - 1)),
			next: formatDay(Date.UTC(year, month - 1, day + 1)),
			previousLabel: "prev day",
			nextLabel: "next day",
		};
	}
	if (WEEK_NAME.test(name)) {
		const monday = isoWeekMonday(Number(name.slice(0, 4)), Number(name.slice(6)));
		return {
			previous: formatIsoWeek(monday - 7 * DAY_MS),
			next: formatIsoWeek(monday + 7 * DAY_MS),
			previousLabel: "prev week",
			nextLabel: "next week",
		};
	}
	if (MONTH_NAME.test(name)) {
		const [year, month] = name.split("-").map(Number);
		return {
			previous: formatMonth(Date.UTC(year, month - 2, 1)),
			next: formatMonth(Date.UTC(year, month, 1)),
			previousLabel: "prev month",
			nextLabel: "next month",
		};
	}
	return undefined;
}

export function dayFromName(name: string): number | undefined {
	const match = name.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!match) return undefined;
	return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
}

export function isSameLocalDay(reference: number, timestamp: number): boolean {
	return new Date(reference).toDateString() === new Date(timestamp).toDateString();
}

function isoWeekMonday(isoYear: number, week: number): number {
	const fourthOfJanuary = Date.UTC(isoYear, 0, 4);
	const daysSinceMonday = (new Date(fourthOfJanuary).getUTCDay() + 6) % 7;
	return fourthOfJanuary - daysSinceMonday * DAY_MS + (week - 1) * 7 * DAY_MS;
}

function formatIsoWeek(monday: number): string {
	const thursday = new Date(monday + 3 * DAY_MS);
	const isoYear = thursday.getUTCFullYear();
	const week = Math.floor((thursday.getTime() - Date.UTC(isoYear, 0, 1)) / DAY_MS / 7) + 1;
	return `${isoYear}-W${pad(week)}`;
}

function formatDay(timestamp: number): string {
	const date = new Date(timestamp);
	return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function formatMonth(timestamp: number): string {
	const date = new Date(timestamp);
	return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

function pad(value: number): string {
	return String(value).padStart(2, "0");
}
