import { setIcon } from "obsidian";

export const ROW_ACTION_ICON = "settings";

export function renderRowAction(rowEl: HTMLElement, icon: string, label: string, run: () => void): void {
	const bodyEl = rowEl.querySelector<HTMLElement>(".note-compass-row-body") ?? rowEl;
	const actionEl = bodyEl.createSpan({
		cls: ["clickable-icon", "note-compass-row-action"],
		attr: { role: "button", "aria-label": label },
	});
	setIcon(actionEl, icon);
	for (const type of ["pointerdown", "mousedown"]) {
		actionEl.addEventListener(type, (event) => {
			event.preventDefault();
			event.stopPropagation();
		});
	}
	actionEl.addEventListener("click", (event) => {
		event.preventDefault();
		event.stopPropagation();
		run();
	});
}

export function selectedRow(resultContainerEl: HTMLElement): HTMLElement | null {
	return resultContainerEl.querySelector<HTMLElement>(".suggestion-item.is-selected");
}
