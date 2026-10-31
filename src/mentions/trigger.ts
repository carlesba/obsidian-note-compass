export interface MentionMatch {
	start: number;
	query: string;
}

const WHITESPACE = /\s/;

const CODE_FENCE = /^\s*(```|~~~)/;

const FRONTMATTER_FENCE = "---";

export function mentionAt(lineBeforeCaret: string, trigger: string): MentionMatch | undefined {
	if (!trigger) return undefined;
	const start = lineBeforeCaret.lastIndexOf(trigger);
	if (start < 0) return undefined;
	const query = lineBeforeCaret.slice(start + trigger.length);
	if (WHITESPACE.test(query)) return undefined;
	const before = lineBeforeCaret[start - 1];
	if (before !== undefined && !WHITESPACE.test(before)) return undefined;
	return { start, query };
}

export function isInCode(linesAbove: readonly string[], lineBeforeCaret: string): boolean {
	if (isInFrontmatter(linesAbove)) return true;
	const fences = linesAbove.filter((line) => CODE_FENCE.test(line)).length;
	if (fences % 2 === 1) return true;
	const backticks = lineBeforeCaret.split("`").length - 1;
	return backticks % 2 === 1;
}

function isInFrontmatter(linesAbove: readonly string[]): boolean {
	if (linesAbove[0]?.trim() !== FRONTMATTER_FENCE) return false;
	return !linesAbove.slice(1).some((line) => line.trim() === FRONTMATTER_FENCE);
}
