import { EditorSuggest, Platform } from "obsidian";
import type { App, Editor, EditorPosition, EditorSuggestContext, EditorSuggestTriggerInfo, TFile } from "obsidian";
import { t } from "../i18n";
import { buildJumpList } from "../lists/jumpList";
import { createObsidianVault } from "../lists/obsidianVault";
import type { JumpListEntry } from "../lists/vault";
import { RESULTS_CLASS, entryLabel, entryParts, matchesInOrder, renderRow } from "../render";
import type { JumpSettings } from "../settings";
import { mentionPicker } from "./settings";
import { isInCode, mentionAt } from "./trigger";

export class MentionSuggest extends EditorSuggest<JumpListEntry> {
	private readonly settings: () => JumpSettings;
	private entries: JumpListEntry[] = [];
	private entriesFor: string | undefined;
	private dismissedAt: string | undefined;

	constructor(app: App, settings: () => JumpSettings) {
		super(app);
		this.settings = settings;
	}

	onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
		const settings = this.settings();
		const picker = mentionPicker(settings.mention, settings.notePickers);
		if (!picker || !file) return null;
		const lineBeforeCaret = editor.getLine(cursor.line).slice(0, cursor.ch);
		const match = mentionAt(lineBeforeCaret, settings.mention.trigger);
		if (!match) {
			this.dismissedAt = undefined;
			return null;
		}
		const start = { line: cursor.line, ch: match.start };
		const position = positionKey(file, start);
		if (position === this.dismissedAt) return null;
		if (isInCode(linesAbove(editor, cursor.line), lineBeforeCaret)) return null;
		if (position !== this.entriesFor) {
			this.entries = buildJumpList(
				picker.lists,
				createObsidianVault(this.app),
				{ path: file.path, basename: file.basename, ctime: file.stat.ctime },
				settings.dateNotes,
				picker.filter,
			);
			this.entriesFor = position;
			this.showInstructions(settings.mention.trigger);
		}
		return { start, end: cursor, query: match.query };
	}

	getSuggestions(context: EditorSuggestContext): JumpListEntry[] {
		if (!context.query) return this.entries;
		return this.entries.filter((entry) => matchesInOrder(context.query, entryLabel(entry)));
	}

	renderSuggestion(entry: JumpListEntry, el: HTMLElement): void {
		el.parentElement?.addClass(RESULTS_CLASS);
		renderRow(el, entryParts(entry));
	}

	selectSuggestion(entry: JumpListEntry): void {
		const context = this.context;
		this.finish();
		if (context) void this.insertLink(entry, context);
	}

	close(): void {
		const context = this.context;
		if (context && this.isStillTyped(context)) this.dismissedAt = positionKey(context.file, context.start);
		this.finish();
	}

	private finish(): void {
		this.entriesFor = undefined;
		super.close();
	}

	private isStillTyped({ editor, file, start }: EditorSuggestContext): boolean {
		const cursor = editor.getCursor();
		if (cursor.line !== start.line || this.app.workspace.getActiveFile() !== file) return false;
		const match = mentionAt(editor.getLine(cursor.line).slice(0, cursor.ch), this.settings().mention.trigger);
		return match?.start === start.ch;
	}

	private async insertLink(entry: JumpListEntry, { editor, file, start, end }: EditorSuggestContext): Promise<void> {
		const target = this.app.vault.getFileByPath(entry.file.path) ?? (await this.createMissing(entry));
		if (!target) return;
		editor.replaceRange(this.app.fileManager.generateMarkdownLink(target, file.path), start, end);
	}

	private async createMissing(entry: JumpListEntry): Promise<TFile | null> {
		const missing = entry.missing;
		if (!missing) return null;
		const vault = createObsidianVault(this.app);
		if (missing.date) await vault.createPeriodNote(entry.file.path, missing.period, missing.date, missing.from);
		else await vault.createNote(entry.file.path, "");
		return this.app.vault.getFileByPath(entry.file.path);
	}

	private showInstructions(trigger: string): void {
		if (Platform.isMobile) return;
		this.setInstructions([
			{ command: "↵", purpose: t("instructionInsertLink") },
			{ command: "esc", purpose: t("instructionTypeTrigger", { trigger }) },
		]);
	}
}

function positionKey(file: TFile, { line, ch }: EditorPosition): string {
	return `${file.path}:${line}:${ch}`;
}

function linesAbove(editor: Editor, line: number): string[] {
	const lines: string[] = [];
	for (let index = 0; index < line; index++) lines.push(editor.getLine(index));
	return lines;
}
