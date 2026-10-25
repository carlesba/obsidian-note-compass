export function sortableRows(listEl: HTMLElement, rowSelector: string, handleSelector: string, moved: (from: number, to: number) => void): void {
	const rows = () => Array.from(listEl.children).filter((child): child is HTMLElement => child.instanceOf(HTMLElement) && child.matches(rowSelector));
	listEl.addEventListener("pointerdown", (event) => {
		if (!event.isPrimary || event.button !== 0 || !(event.target instanceof Element)) return;
		const handleEl = event.target.closest(handleSelector);
		const rowEl = handleEl?.closest(rowSelector);
		if (!(handleEl instanceof HTMLElement) || !(rowEl instanceof HTMLElement) || rowEl.parentElement !== listEl) return;
		event.preventDefault();
		const from = rows().indexOf(rowEl);
		handleEl.setPointerCapture(event.pointerId);
		rowEl.addClass("is-dragging");
		const move = (moveEvent: PointerEvent) => {
			const target = rows().find((other) => {
				const rect = other.getBoundingClientRect();
				return other !== rowEl && moveEvent.clientY >= rect.top && moveEvent.clientY <= rect.bottom;
			});
			if (!target) return;
			const rect = target.getBoundingClientRect();
			listEl.insertBefore(rowEl, moveEvent.clientY < rect.top + rect.height / 2 ? target : target.nextSibling);
		};
		const end = () => {
			handleEl.removeEventListener("pointermove", move);
			handleEl.removeEventListener("pointerup", end);
			handleEl.removeEventListener("pointercancel", end);
			rowEl.removeClass("is-dragging");
			const to = rows().indexOf(rowEl);
			if (from !== to) moved(from, to);
		};
		handleEl.addEventListener("pointermove", move);
		handleEl.addEventListener("pointerup", end);
		handleEl.addEventListener("pointercancel", end);
	});
}
