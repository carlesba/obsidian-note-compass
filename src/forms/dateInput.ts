import type { MomentFactory } from "../lists/vault.ts";
import { parseDate, parseDateTime, parseTime } from "../setProperties/values.ts";
import type { DateFieldType } from "./form.ts";

export const DIGIT_DATE_FORMATS: Record<DateFieldType, string> = {
	date: "YYYYMMDD",
	time: "HHmm",
	datetime: "YYYYMMDDHHmm",
};

export const SET_DATE_PLACEHOLDERS: Record<DateFieldType, string> = {
	date: "YYYYMMDD",
	time: "HHmm",
	datetime: "YYYYMMDDHHmm",
};

export function readsAsDate(type: DateFieldType, text: string): boolean {
	if (type === "time") return parseTime(text) !== undefined;
	if (type === "date") return parseDate(text) !== undefined;
	return parseDateTime(text) !== undefined || parseDate(text) !== undefined;
}

export function typedTime(type: DateFieldType, query: string, now: number, moment: MomentFactory): number | undefined {
	const parsed =
		type === "time"
			? timeToday(parseTime(query), now, moment)
			: type === "date"
				? fromText(parseDate(query), "YYYY-MM-DD", moment)
				: fromText(parseDateTime(query), "YYYY-MM-DDTHH:mm", moment) ?? fromText(parseDate(query), "YYYY-MM-DD", moment) ?? timeToday(parseTime(query), now, moment);
	return parsed;
}

function timeToday(time: string | undefined, now: number, moment: MomentFactory): number | undefined {
	if (time === undefined) return undefined;
	return fromText(`${moment(now).format("YYYY-MM-DD")}T${time}`, "YYYY-MM-DDTHH:mm", moment);
}

function fromText(text: string | undefined, format: string, moment: MomentFactory): number | undefined {
	if (text === undefined) return undefined;
	const date = moment(text, format, true);
	return date.isValid() ? date.valueOf() : undefined;
}

export function confirmedTime(type: DateFieldType, value: number, now: number, moment: MomentFactory): number {
	if (type === "datetime") return value;
	const date = moment(type === "date" ? value : now).format("YYYY-MM-DD");
	const time = moment(type === "time" ? value : now).format("HH:mm:ss.SSS");
	return moment(`${date}T${time}`, "YYYY-MM-DDTHH:mm:ss.SSS", true).valueOf();
}
