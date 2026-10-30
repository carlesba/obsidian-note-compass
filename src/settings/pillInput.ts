import { AbstractInputSuggest, setTooltip } from "obsidian";
import type { App, TFile } from "obsidian";
import { joinSegments, pillLabel, placeholderToken, splitPlaceholders } from "../forms/placeholders";
import type { PlaceholderSegment } from "../forms/placeholders";
import { t } from "../i18n";
import { isKnownPlaceholder, matchingPlaceholderEntries, placeholderTriggerAt } from "./placeholderMenu";
import type { PlaceholderEntry } from "./placeholderMenu";
import { LINK_SUGGESTION_LIMIT, insertLink, matchingLinkCandidates, openLinkAt } from "./wikiLinks";
import type { OpenLink } from "./wikiLinks";

export interface PillInputOptions {
	app: App;
	multiline: boolean;
	placeholder: string;
	ariaLabel: string;
	entries: () => PlaceholderEntry[];
	knownKeys: () => ReadonlySet<string>;
	changed: (text: string) => void;
	linkPicked?: () => void;
}

export interface PillInput {
	el: HTMLDivElement;
	suggest: PillSuggest;
	value: () => string;
	setValue: (text: string) => void;
}

type PillSuggestion = { kind: "placeholder"; entry: PlaceholderEntry } | { kind: "link"; file: TFile };

interface Caret {
	node: Text;
	offset: number;
}

const PILL_CLASS = "note-compass-pill";

const INPUT_CLASS = "note-compass-pill-input";

const PLACEHOLDER_ATTRIBUTE = "data-placeholder";

const PILL_ATTRIBUTE = "data-note-compass-pill";

export function renderPillText(parentEl: HTMLElement, text: string, known?: ReadonlySet<string>): void {
	for (const segment of splitPlaceholders(text)) {
		if (segment.kind === "text") parentEl.appendText(segment.text);
		else parentEl.appendChild(pillElement(segment, known));
	}
}

function pillElement(segment: Extract<PlaceholderSegment, { kind: "pill" }>, known: ReadonlySet<string> | undefined): HTMLElement {
	const pillEl = createSpan({ cls: PILL_CLASS, text: pillLabel(segment.inner, segment.link) });
	pillEl.setAttr(PILL_ATTRIBUTE, placeholderToken(segment.inner, segment.link));
	pillEl.setAttr("contenteditable", "false");
	if (segment.link) pillEl.addClass("mod-link");
	if (known && !isKnownPlaceholder(segment.inner, known)) {
		pillEl.addClass("is-unknown");
		setTooltip(pillEl, t("formUnknownPlaceholder", { key: segment.inner }));
	}
	return pillEl;
}

function isPill(node: Node | null | undefined): node is HTMLElement {
	return node instanceof Node && node.instanceOf(HTMLElement) && node.hasAttribute(PILL_ATTRIBUTE);
}

function isBreak(node: Node | null | undefined): node is HTMLElement {
	return node instanceof Node && node.instanceOf(HTMLElement) && node.tagName === "BR";
}

export function pillInput(parentEl: HTMLElement, options: PillInputOptions): PillInput {
	const el = parentEl.createDiv({ cls: options.multiline ? `${INPUT_CLASS} mod-multiline` : INPUT_CLASS });
	el.setAttrs({ contenteditable: "true", role: "textbox", "aria-label": options.ariaLabel, [PLACEHOLDER_ATTRIBUTE]: options.placeholder });
	if (options.multiline) el.setAttr("aria-multiline", "true");
	el.setAttr("autocapitalize", "off");
	el.setAttr("spellcheck", "false");

	let composing = false;
	const value = () => readText(el, options.multiline, true);
	const showEmpty = () => el.toggleClass("is-empty", value() === "");
	const ensureSentinel = () => {
		if (!options.multiline) return;
		if (!isBreak(el.lastChild)) el.appendChild(createEl("br"));
	};
	const render = (text: string) => {
		el.empty();
		appendSegments(el, splitPlaceholders(text), options.multiline, options.knownKeys());
		ensureSentinel();
	};
	const pillifyTyped = () => {
		const text = value();
		if (sameSegments(splitPlaceholders(text), readSegments(el, options.multiline, true))) return;
		const offset = caretOffset(el, options.multiline);
		render(text);
		if (offset !== undefined) placeCaretAt(el, offset, options.multiline);
	};
	const changed = () => {
		if (!composing) pillifyTyped();
		ensureSentinel();
		showEmpty();
		options.changed(value());
	};
	const setValue = (text: string) => {
		render(text);
		showEmpty();
	};
	const announce = () => el.dispatchEvent(new Event("input", { bubbles: true }));

	const suggest = new PillSuggest(options.app, el, {
		entries: options.entries,
		pickPlaceholder: (caret, start, entry) => {
			const after = replaceInText(caret.node, start, caret.offset, [pillElement({ kind: "pill", inner: entry.key, link: entry.link }, options.knownKeys())]);
			placeCaret(el, after, 0);
			changed();
		},
		pickLink: (caret, link, linktext) => {
			const inserted = insertLink(caret.node.data, caret.offset, link, linktext);
			caret.node.data = inserted.text;
			placeCaret(el, caret.node, inserted.caret);
			changed();
			options.linkPicked?.();
		},
	});

	el.addEventListener("compositionstart", () => (composing = true));
	el.addEventListener("compositionend", () => {
		composing = false;
		changed();
	});
	el.addEventListener("input", () => changed());
	el.addEventListener("beforeinput", (event) => {
		if (event.inputType !== "insertParagraph" && event.inputType !== "insertLineBreak") return;
		event.preventDefault();
		if (!options.multiline) return;
		insertAtSelection(el, [createEl("br")]);
		announce();
	});
	el.addEventListener("keydown", (event) => {
		if (event.isComposing) return;
		if (event.key !== "Backspace" && event.key !== "Delete") return;
		const pill = adjacentPill(el, event.key === "Backspace" ? "before" : "after");
		if (!pill) return;
		event.preventDefault();
		pill.remove();
		announce();
	});
	el.addEventListener("paste", (event) => {
		const text = event.clipboardData?.getData("text/plain");
		if (text === undefined) return;
		event.preventDefault();
		const nodes = createDiv();
		appendSegments(nodes, splitPlaceholders(options.multiline ? text : text.replace(/\s*\n\s*/g, " ")), options.multiline, options.knownKeys());
		insertAtSelection(el, Array.from(nodes.childNodes));
		announce();
	});
	el.addEventListener("drop", (event) => event.preventDefault());

	return { el, suggest, value, setValue };
}

function appendSegments(parentEl: HTMLElement, segments: readonly PlaceholderSegment[], multiline: boolean, known: ReadonlySet<string>): void {
	for (const segment of segments) {
		if (segment.kind === "pill") {
			parentEl.appendChild(pillElement(segment, known));
			continue;
		}
		const lines = multiline ? segment.text.split("\n") : [segment.text];
		lines.forEach((line, index) => {
			if (index > 0) parentEl.appendChild(createEl("br"));
			if (line !== "") parentEl.appendChild(parentEl.doc.createTextNode(line));
		});
	}
}

function readText(el: Node, multiline: boolean, trailingBreakIsSentinel: boolean): string {
	return joinSegments(readSegments(el, multiline, trailingBreakIsSentinel));
}

function readSegments(el: Node, multiline: boolean, trailingBreakIsSentinel: boolean): PlaceholderSegment[] {
	const leaves = leavesOf(el);
	const segments: PlaceholderSegment[] = [];
	const text = (value: string) => {
		const last = segments[segments.length - 1];
		if (last && last.kind === "text") last.text += value;
		else segments.push({ kind: "text", text: value });
	};
	leaves.forEach((leaf, index) => {
		if (leaf === "block") {
			if (multiline && segments.length > 0) text("\n");
		} else if (leaf.nodeType === Node.TEXT_NODE) {
			if ((leaf as Text).data !== "") text((leaf as Text).data);
		} else if (isPill(leaf)) {
			for (const segment of splitPlaceholders(leaf.getAttribute(PILL_ATTRIBUTE) ?? "")) {
				if (segment.kind === "text") text(segment.text);
				else segments.push(segment);
			}
		} else if (multiline && !(trailingBreakIsSentinel && index === leaves.length - 1)) text("\n");
	});
	return segments;
}

function sameSegments(expected: readonly PlaceholderSegment[], actual: readonly PlaceholderSegment[]): boolean {
	if (expected.length !== actual.length) return false;
	return expected.every((segment, index) => {
		const other = actual[index];
		if (segment.kind === "text") return other.kind === "text" && other.text === segment.text;
		return other.kind === "pill" && other.inner === segment.inner && other.link === segment.link;
	});
}

function caretOffset(el: HTMLElement, multiline: boolean): number | undefined {
	const range = selectionIn(el);
	if (!range) return undefined;
	const before = el.doc.createRange();
	before.setStart(el, 0);
	before.setEnd(range.startContainer, range.startOffset);
	return readText(before.cloneContents(), multiline, false).length;
}

function placeCaretAt(el: HTMLElement, offset: number, multiline: boolean): void {
	const leaves = leavesOf(el);
	let passed = 0;
	for (let index = 0; index < leaves.length; index++) {
		const leaf = leaves[index];
		if (leaf === "block") {
			if (multiline && passed > 0) passed += 1;
			continue;
		}
		if (leaf.nodeType === Node.TEXT_NODE) {
			const length = (leaf as Text).data.length;
			if (offset <= passed + length) return placeCaret(el, leaf, offset - passed);
			passed += length;
		} else if (isPill(leaf)) {
			passed += (leaf.getAttribute(PILL_ATTRIBUTE) ?? "").length;
			if (offset <= passed) return placeCaretAfter(el, leaf);
		} else if (multiline && index < leaves.length - 1) {
			if (offset === passed) return placeCaretBefore(el, leaf);
			passed += 1;
		}
	}
	const end = endRange(el);
	placeCaret(el, end.startContainer, end.startOffset);
}

function leavesOf(el: Node): (Node | "block")[] {
	const leaves: (Node | "block")[] = [];
	const walk = (parent: Node) => {
		for (const node of Array.from(parent.childNodes)) {
			if (node.nodeType === Node.TEXT_NODE || isPill(node) || isBreak(node)) leaves.push(node);
			else if (node.instanceOf(HTMLElement)) {
				if (leaves.length > 0 && isBlock(node)) leaves.push("block");
				walk(node);
			}
		}
	};
	walk(el);
	return leaves;
}

function isBlock(node: HTMLElement): boolean {
	return node.tagName === "DIV" || node.tagName === "P";
}

function selectionIn(el: HTMLElement): Range | undefined {
	const selection = el.win.getSelection();
	if (!selection || selection.rangeCount === 0) return undefined;
	const range = selection.getRangeAt(0);
	return el.contains(range.startContainer) && el.contains(range.endContainer) ? range : undefined;
}

function caretIn(el: HTMLElement): Caret | undefined {
	const range = selectionIn(el);
	if (!range || !range.collapsed) return undefined;
	const { startContainer, startOffset } = range;
	if (startContainer.nodeType !== Node.TEXT_NODE) return undefined;
	return { node: startContainer as Text, offset: startOffset };
}

function placeCaret(el: HTMLElement, node: Node, offset: number): void {
	const selection = el.win.getSelection();
	if (!selection) return;
	const range = el.doc.createRange();
	range.setStart(node, offset);
	range.collapse(true);
	selection.removeAllRanges();
	selection.addRange(range);
}

function placeCaretAfter(el: HTMLElement, node: Node): void {
	const next = node.nextSibling;
	if (next && next.nodeType === Node.TEXT_NODE) return placeCaret(el, next, 0);
	const tail = el.doc.createTextNode("");
	node.parentNode?.insertBefore(tail, next);
	placeCaret(el, tail, 0);
}

function placeCaretBefore(el: HTMLElement, node: Node): void {
	const parent = node.parentNode;
	if (!parent) return;
	placeCaret(el, parent, Array.from(parent.childNodes).indexOf(node as ChildNode));
}

function replaceInText(node: Text, start: number, end: number, inserted: Node[]): Text {
	const after = node.splitText(end);
	node.deleteData(start, end - start);
	for (const item of inserted) after.before(item);
	return after;
}

function insertAtSelection(el: HTMLElement, nodes: Node[]): void {
	el.focus();
	const range = selectionIn(el) ?? endRange(el);
	range.deleteContents();
	for (const node of nodes) {
		range.insertNode(node);
		range.setStartAfter(node);
		range.collapse(true);
	}
	const tail = el.doc.createTextNode("");
	range.insertNode(tail);
	placeCaret(el, tail, 0);
}

function endRange(el: HTMLElement): Range {
	const range = el.doc.createRange();
	const end = isBreak(el.lastChild) ? el.childNodes.length - 1 : el.childNodes.length;
	range.setStart(el, end);
	range.collapse(true);
	return range;
}

function adjacentPill(el: HTMLElement, side: "before" | "after"): HTMLElement | undefined {
	const range = selectionIn(el);
	if (!range || !range.collapsed) return undefined;
	const { startContainer, startOffset } = range;
	let candidate: Node | null;
	if (startContainer.nodeType === Node.TEXT_NODE) {
		const text = startContainer as Text;
		if (side === "before") candidate = startOffset === 0 ? text.previousSibling : null;
		else candidate = startOffset === text.data.length ? text.nextSibling : null;
	} else {
		candidate = side === "before" ? startContainer.childNodes[startOffset - 1] ?? null : startContainer.childNodes[startOffset] ?? null;
	}
	return isPill(candidate) ? candidate : undefined;
}

interface PillSuggestActions {
	entries: () => PlaceholderEntry[];
	pickPlaceholder: (caret: Caret, start: number, entry: PlaceholderEntry) => void;
	pickLink: (caret: Caret, link: OpenLink, linktext: string) => void;
}

export class PillSuggest extends AbstractInputSuggest<PillSuggestion> {
	private readonly el: HTMLDivElement;
	private readonly actions: PillSuggestActions;
	isOpen = false;

	constructor(app: App, el: HTMLDivElement, actions: PillSuggestActions) {
		super(app, el);
		this.el = el;
		this.actions = actions;
		this.limit = LINK_SUGGESTION_LIMIT;
	}

	open(): void {
		super.open();
		this.isOpen = true;
	}

	close(): void {
		super.close();
		this.isOpen = false;
	}

	protected getSuggestions(): PillSuggestion[] {
		const caret = caretIn(this.el);
		if (!caret) return [];
		const trigger = placeholderTriggerAt(caret.node.data, caret.offset);
		if (trigger) return matchingPlaceholderEntries(this.actions.entries(), trigger.query).map((entry) => ({ kind: "placeholder" as const, entry }));
		const link = openLinkAt(caret.node.data, caret.offset);
		if (!link) return [];
		return matchingLinkCandidates(this.app.vault.getMarkdownFiles(), link.query).map((file) => ({ kind: "link" as const, file }));
	}

	renderSuggestion(suggestion: PillSuggestion, el: HTMLElement): void {
		if (suggestion.kind === "placeholder") {
			const { entry } = suggestion;
			const rowEl = el.createDiv({ cls: "note-compass-pill-suggestion" });
			const pillEl = rowEl.createSpan({ cls: PILL_CLASS, text: entry.label });
			if (entry.link) pillEl.addClass("mod-link");
			if (entry.detail) el.createDiv({ text: entry.detail, cls: "setting-item-description" });
			return;
		}
		const { file } = suggestion;
		el.createDiv({ text: file.basename });
		const folder = file.parent?.path ?? "/";
		if (folder !== "/") el.createDiv({ text: folder, cls: "setting-item-description" });
	}

	selectSuggestion(suggestion: PillSuggestion): void {
		const caret = caretIn(this.el);
		if (caret) {
			if (suggestion.kind === "placeholder") {
				const trigger = placeholderTriggerAt(caret.node.data, caret.offset);
				if (trigger) this.actions.pickPlaceholder(caret, trigger.start, suggestion.entry);
			} else {
				const link = openLinkAt(caret.node.data, caret.offset);
				if (link) this.actions.pickLink(caret, link, this.app.metadataCache.fileToLinktext(suggestion.file, "", true));
			}
		}
		this.close();
	}
}
