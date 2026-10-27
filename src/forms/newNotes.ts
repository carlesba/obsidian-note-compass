import { t } from "../i18n/index.ts";
import type { MomentDate } from "../lists/vault";

const UNSAFE_NAME = /[\\/:*?"<>|#^[\]]/;
const DEFAULT_DATE_FORMAT = "YYYY-MM-DD";
const DEFAULT_TIME_FORMAT = "HH:mm";

export function isCreatableName(name: string): boolean {
	return name !== "" && !name.startsWith(".") && !UNSAFE_NAME.test(name);
}

export function createdNotice(name: string, folder: string): string {
	return t("noteCreated", { name, folder: folder === "" ? t("theVaultRoot") : folder });
}

export function coreDatePlaceholder(kind: string, format: string | undefined, now: MomentDate, options: unknown): string {
	const formats = coreTemplateFormats(options);
	return now.format(format || (kind.toLowerCase() === "date" ? formats.date : formats.time));
}

function coreTemplateFormats(options: unknown): { date: string; time: string } {
	const read = (key: string, fallback: string) => {
		const value = typeof options === "object" && options !== null ? (options as Record<string, unknown>)[key] : undefined;
		return typeof value === "string" && value.trim() !== "" ? value : fallback;
	};
	return { date: read("dateFormat", DEFAULT_DATE_FORMAT), time: read("timeFormat", DEFAULT_TIME_FORMAT) };
}

export function trimSlashes(folder: string): string {
	return folder.trim().replace(/^\/+|\/+$/g, "");
}
