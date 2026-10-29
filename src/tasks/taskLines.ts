export interface TaskLine {
	line: number;
	text: string;
	status: string;
	statusIndex: number;
	marker: string;
	body: string;
}

export interface StatusFilter {
	statuses: string;
	skippedStatuses: string;
}

export interface LineEdit {
	line: number;
	expected: string;
	replacement: string;
}

export interface EditedContent {
	content: string;
	applied: LineEdit[];
	skipped: LineEdit[];
}

const TASK_PATTERN = /^((?:[ \t]*>)*[ \t]*)([-*+]|\d+[.)])([ \t]+)\[([^\]\r\n])\](?:[ \t](.*))?$/;

const BLOCK_ID_PATTERN = /[ \t]+\^[A-Za-z0-9-]+$/;

const COMPLETION_SYMBOL = "✅";

const DESTINATION_SYMBOL = "→";

const SOURCE_SYMBOL = "←";

export function parseTaskLine(text: string, line: number): TaskLine | undefined {
	const match = TASK_PATTERN.exec(text);
	if (!match) return undefined;
	const [, prefix, marker, gap, status, body = ""] = match;
	return { line, text, status, statusIndex: prefix.length + marker.length + gap.length + 1, marker, body };
}

export function listsStatus(filter: StatusFilter, status: string): boolean {
	return (filter.statuses === "" || filter.statuses.includes(status)) && !filter.skippedStatuses.includes(status);
}

export function contentLines(content: string): string[] {
	return content.split("\n").map((line) => line.replace(/\r$/, ""));
}

export function noteTasks(content: string, taskLineNumbers: readonly number[], filter: StatusFilter): TaskLine[] {
	const lines = contentLines(content);
	const tasks: TaskLine[] = [];
	for (const line of [...new Set(taskLineNumbers)].sort((a, b) => a - b)) {
		const text = lines[line];
		const task = text === undefined ? undefined : parseTaskLine(text, line);
		if (task && listsStatus(filter, task.status)) tasks.push(task);
	}
	return tasks;
}

export function withStatus(task: TaskLine, status: string): string {
	return task.text.slice(0, task.statusIndex) + status + task.text.slice(task.statusIndex + 1);
}

export function withSuffix(text: string, suffix: string): string {
	const blockId = BLOCK_ID_PATTERN.exec(text);
	if (!blockId) return text + suffix;
	return text.slice(0, blockId.index) + suffix + blockId[0];
}

export function wikiLink(linkText: string): string {
	return `[[${linkText}]]`;
}

export function completionText(date: string): string {
	return ` ${COMPLETION_SYMBOL} ${date}`;
}

export function destinationMention(linkText: string): string {
	return ` ${DESTINATION_SYMBOL} ${wikiLink(linkText)}`;
}

export function sourceMention(linkText: string): string {
	return ` ${SOURCE_SYMBOL} ${wikiLink(linkText)}`;
}

export function copiedLine(task: TaskLine, sourceLinkText?: string): string {
	const line = `${task.marker} [ ] ${task.body}`;
	return sourceLinkText === undefined ? line : withSuffix(line, sourceMention(sourceLinkText));
}

export function applyLineEdits(content: string, edits: readonly LineEdit[]): EditedContent {
	const lines = content.split("\n");
	const applied: LineEdit[] = [];
	const skipped: LineEdit[] = [];
	for (const edit of edits) {
		const current = lines[edit.line];
		const ending = current?.endsWith("\r") ? "\r" : "";
		if (current === undefined || current.slice(0, current.length - ending.length) !== edit.expected) {
			skipped.push(edit);
			continue;
		}
		lines[edit.line] = edit.replacement + ending;
		applied.push(edit);
	}
	return { content: lines.join("\n"), applied, skipped };
}

export function appendLines(content: string, lines: readonly string[]): string {
	if (lines.length === 0) return content;
	const ending = content.includes("\r\n") ? "\r\n" : "\n";
	const separator = content === "" || content.endsWith("\n") ? "" : ending;
	return content + separator + lines.join(ending) + ending;
}
