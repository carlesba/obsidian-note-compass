import { tabMove } from "./tabStops";

const ROW_SELECTOR = ".setting-item:not(.setting-item-heading), .setting-group-search, .setting-item-heading .extra-setting-button";

const ROW_OWNER_SELECTOR = ".setting-item, .setting-group-search";

const FOCUSABLE_SELECTOR = [
	"a[href]",
	"button",
	"input",
	"select",
	"textarea",
	'[contenteditable]:not([contenteditable="false"])',
	"[tabindex]",
]
	.map((selector) => `${selector}:not([disabled]):not([tabindex="-1"])`)
	.join(", ");

export const ROW_CONTROL_CLASS = "note-compass-row-control";

function tabSequence(containerEl: HTMLElement): HTMLElement[] {
	return Array.from(containerEl.querySelectorAll<HTMLElement>(`${ROW_SELECTOR}, ${FOCUSABLE_SELECTOR}`)).filter(
		(el) => el.isShown() && (el.matches(ROW_SELECTOR) || el.closest(ROW_OWNER_SELECTOR) !== null),
	);
}

function wraps(outer: HTMLElement, inner: HTMLElement): boolean {
	return outer.hasClass("setting-item") && !outer.hasClass(ROW_CONTROL_CLASS) && outer !== inner && outer.contains(inner);
}

export function tabPastRows(event: KeyboardEvent, containerEl: HTMLElement, leaveBefore: () => boolean): void {
	if (event.key !== "Tab" || event.isComposing || event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
	const target = event.target;
	if (!(target instanceof Node) || !target.instanceOf(HTMLElement) || !containerEl.contains(target)) return;
	const current = target === containerEl ? undefined : target;
	const move = tabMove(tabSequence(containerEl), current, event.shiftKey, wraps);
	if (move.kind === "native") return;
	if (move.kind === "leaveBefore") {
		if (leaveBefore()) event.preventDefault();
		return;
	}
	event.preventDefault();
	if (move.kind === "stay") return;
	const options = { preventScroll: true, focusVisible: true };
	move.stop.focus(options);
	move.stop.scrollIntoView({ block: "nearest" });
}
