import type { EditorView } from "@codemirror/view";
import type { App, Editor, EditorChange, MarkdownPostProcessorContext, Plugin } from "obsidian";
import { BULLET_SYMBOL, applyLineChange, changedContent, cycleChange, cycleSymbols, lineSymbol, symbolChange } from "./taskStatuses";
import type { LineChange, TaskStatusSettings } from "./taskStatuses";

const CHECKBOX_CLASS = "task-list-item-checkbox";

const EMBED_SELECTOR = ".internal-embed, .markdown-embed";

const EDITOR_SELECTOR = ".cm-editor";

const EDITOR_BLOCK_SELECTOR = ".cm-embed-block";

const TAP_VIBRATION_MS = 100;

interface RenderedSection {
	el: HTMLElement;
	context: MarkdownPostProcessorContext;
}

function selectedLines(editor: Editor): number[] {
	const lines = new Set<number>();
	for (const { anchor, head } of editor.listSelections()) {
		for (let line = Math.min(anchor.line, head.line); line <= Math.max(anchor.line, head.line); line++) lines.add(line);
	}
	return [...lines].sort((a, b) => a - b);
}

function changeSelectedLines(editor: Editor, change: (text: string) => LineChange | undefined, checking: boolean): boolean {
	const changes: EditorChange[] = [];
	for (const line of selectedLines(editor)) {
		const edit = change(editor.getLine(line));
		if (edit) changes.push({ from: { line, ch: edit.from }, to: { line, ch: edit.to }, text: edit.insert });
	}
	if (changes.length === 0) return false;
	if (!checking) editor.transaction({ changes });
	return true;
}

export function cycleSelectedTasks(editor: Editor, settings: TaskStatusSettings, checking: boolean): boolean {
	const cycle = cycleSymbols(settings.statuses);
	return changeSelectedLines(editor, (text) => cycleChange(cycle, text), checking);
}

export function selectsListLines(editor: Editor): boolean {
	return selectedLines(editor).some((line) => lineSymbol(editor.getLine(line)) !== undefined);
}

export function setSelectedStatus(editor: Editor, symbol: string): void {
	changeSelectedLines(editor, (text) => symbolChange(text, symbol), false);
}

export function cursorSymbol(editor: Editor): string | undefined {
	return lineSymbol(editor.getLine(editor.getCursor("head").line));
}

export class CheckboxCycler {
	private readonly app: App;
	private readonly settings: () => TaskStatusSettings;
	private readonly sections = new WeakMap<HTMLElement, MarkdownPostProcessorContext>();

	constructor(app: App, settings: () => TaskStatusSettings) {
		this.app = app;
		this.settings = settings;
	}

	register(plugin: Plugin): void {
		plugin.registerMarkdownPostProcessor((el, context) => {
			this.sections.set(el, context);
		});
		const listen = (doc: Document) => plugin.registerDomEvent(doc, "click", (event) => this.onClick(event), { capture: true });
		listen(document);
		plugin.registerEvent(this.app.workspace.on("window-open", (win) => listen(win.doc)));
	}

	private onClick(event: MouseEvent): void {
		const settings = this.settings();
		const cycle = cycleSymbols(settings.statuses);
		if (!settings.cycleOnClick || cycle.length === 0 || event.button !== 0) return;
		const checkbox = event.targetNode;
		if (!checkbox?.instanceOf(HTMLInputElement) || !checkbox.hasClass(CHECKBOX_CLASS) || checkbox.closest(EMBED_SELECTOR)) return;
		const symbol = checkbox.closest(EDITOR_SELECTOR) ? this.cycleInEditor(checkbox, cycle) : this.cycleInReadingView(checkbox, cycle);
		if (symbol === undefined) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		navigator.vibrate?.(TAP_VIBRATION_MS);
		if (symbol !== BULLET_SYMBOL) showSymbol(checkbox, symbol);
	}

	private cycleInEditor(checkbox: HTMLInputElement, cycle: readonly string[]): string | undefined {
		const editorView = this.editorViewContaining(checkbox);
		if (!editorView) return undefined;
		const lineNumber = editorLineNumber(editorView, checkbox);
		if (lineNumber === undefined || lineNumber < 1 || lineNumber > editorView.state.doc.lines) return undefined;
		const line = editorView.state.doc.line(lineNumber);
		const change = cycleChange(cycle, line.text, renderedSymbol(checkbox));
		if (!change) return undefined;
		editorView.dispatch({ changes: { from: line.from + change.from, to: line.from + change.to, insert: change.insert } });
		return lineSymbol(applyLineChange(line.text, change));
	}

	private cycleInReadingView(checkbox: HTMLInputElement, cycle: readonly string[]): string | undefined {
		const section = this.sectionContaining(checkbox);
		const offset = lineOffset(checkbox);
		const info = section?.context.getSectionInfo(section.el);
		if (!section || !info || offset === undefined) return undefined;
		const line = info.lineStart + offset;
		const expected = info.text.split("\n")[line]?.replace(/\r$/, "");
		const change = expected === undefined ? undefined : cycleChange(cycle, expected, renderedSymbol(checkbox));
		const file = this.app.vault.getFileByPath(section.context.sourcePath);
		if (expected === undefined || !change || !file) return undefined;
		void this.app.vault.process(file, (content) => changedContent(content, line, expected, (text) => cycleChange(cycle, text)));
		return lineSymbol(applyLineChange(expected, change));
	}

	private editorViewContaining(el: HTMLElement): EditorView | undefined {
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const editorView = (leaf.view as unknown as { editor?: { cm?: EditorView } }).editor?.cm;
			if (editorView?.dom.contains(el)) return editorView;
		}
		return undefined;
	}

	private sectionContaining(el: HTMLElement): RenderedSection | undefined {
		for (let current = el.parentElement; current; current = current.parentElement) {
			const context = this.sections.get(current);
			if (context) return { el: current, context };
		}
		return undefined;
	}
}

function editorLineNumber(editorView: EditorView, checkbox: HTMLInputElement): number | undefined {
	try {
		const block = checkbox.closest<HTMLElement>(EDITOR_BLOCK_SELECTOR);
		if (!block) return editorView.state.doc.lineAt(editorView.posAtDOM(checkbox)).number;
		const offset = lineOffset(checkbox);
		return offset === undefined ? undefined : editorView.state.doc.lineAt(editorView.posAtDOM(block)).number + offset;
	} catch {
		return undefined;
	}
}

function showSymbol(checkbox: HTMLInputElement, symbol: string): void {
	window.setTimeout(() => {
		const checked = symbol !== " ";
		checkbox.checked = checked;
		checkbox.setAttribute("data-task", symbol);
		const item = checkbox.closest("li");
		if (!item) return;
		item.setAttribute("data-task", symbol);
		item.toggleClass("is-checked", checked);
	}, 0);
}

function lineOffset(checkbox: HTMLInputElement): number | undefined {
	const offset = Number.parseInt(checkbox.getAttribute("data-line") ?? "", 10);
	return Number.isInteger(offset) && offset >= 0 ? offset : undefined;
}

function renderedSymbol(checkbox: HTMLInputElement): string | undefined {
	const symbol = checkbox.closest("[data-task]")?.getAttribute("data-task");
	return symbol ? symbol : undefined;
}
