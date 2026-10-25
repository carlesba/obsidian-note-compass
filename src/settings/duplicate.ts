import { t } from "../i18n/index.ts";

export function duplicateEntry<Entry extends { id: string }>(
	entries: Entry[],
	entry: Entry,
	id: string,
	adjust: (copy: Entry) => void = () => undefined,
): Entry | undefined {
	const index = entries.indexOf(entry);
	if (index === -1) return undefined;
	const copy: Entry = { ...structuredClone(entry), id };
	adjust(copy);
	entries.splice(index + 1, 0, copy);
	return copy;
}

export function duplicateName(name: string): string {
	return name.trim() === "" ? "" : t("duplicateName", { name: name.trim() });
}
