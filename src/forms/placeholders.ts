export type PlaceholderSegment = { kind: "text"; text: string } | { kind: "pill"; inner: string; link: boolean };

export const RELATIVE_DAYS = ["today", "tomorrow", "yesterday"] as const;

export type RelativeDay = (typeof RELATIVE_DAYS)[number];

export const CORE_PLACEHOLDERS = ["date", "time"] as const;

export const TITLE_PLACEHOLDER = "title";

export const DEFAULT_DAILY_FORMAT = "YYYY-MM-DD";

const RELATIVE_DAY_OFFSETS: Record<RelativeDay, number> = { today: 0, tomorrow: 1, yesterday: -1 };

const SEGMENT = /\[\[{{([^{}]+?)}}\]\]|{{([^{}]+?)}}/;

export function splitPlaceholders(text: string): PlaceholderSegment[] {
	const segments: PlaceholderSegment[] = [];
	const pattern = new RegExp(SEGMENT.source, "g");
	let last = 0;
	for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
		const start = match.index;
		if (start > last) segments.push({ kind: "text", text: text.slice(last, start) });
		const linked = match[1];
		segments.push(linked !== undefined ? { kind: "pill", inner: linked, link: true } : { kind: "pill", inner: match[2], link: false });
		last = start + match[0].length;
	}
	if (last < text.length) segments.push({ kind: "text", text: text.slice(last) });
	return segments;
}

export function joinSegments(segments: readonly PlaceholderSegment[]): string {
	return segments.map((segment) => (segment.kind === "text" ? segment.text : placeholderToken(segment.inner, segment.link))).join("");
}

export function placeholderToken(inner: string, link: boolean): string {
	const placeholder = `{{${inner}}}`;
	return link ? `[[${placeholder}]]` : placeholder;
}

export function pillLabel(inner: string, link: boolean): string {
	return link ? `[[${inner}]]` : inner;
}

export function placeholderKey(inner: string): string {
	const separator = inner.indexOf(":");
	return (separator === -1 ? inner : inner.slice(0, separator)).trim();
}

export function placeholderFormat(inner: string): string | undefined {
	const separator = inner.indexOf(":");
	return separator === -1 ? undefined : inner.slice(separator + 1);
}

export function relativeDayOffset(key: string): number | undefined {
	const day = RELATIVE_DAYS.find((candidate) => candidate === key.toLowerCase());
	return day === undefined ? undefined : RELATIVE_DAY_OFFSETS[day];
}

export function hasPlaceholders(text: string): boolean {
	return splitPlaceholders(text).some((segment) => segment.kind === "pill");
}
