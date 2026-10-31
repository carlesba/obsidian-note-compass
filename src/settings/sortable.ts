export function sortableRows(listEl: HTMLElement, rowSelector: string, handleSelector: string, moved: (from: number, to: number) => void): void {
	const rows = () => Array.from(listEl.children).filter((child): child is HTMLElement => child.instanceOf(HTMLElement) && child.matches(rowSelector));
	listEl.addEventListener("pointerdown", (event) => {
		if (!event.isPrimary || event.button !== 0 || !(event.target instanceof Element)) return;
		const handleEl = event.target.closest(handleSelector);
		const rowEl = handleEl?.closest(rowSelector);
		if (!(handleEl instanceof HTMLElement) || !(rowEl instanceof HTMLElement) || rowEl.parentElement !== listEl) return;
		event.preventDefault();
		const { pointerId } = event;
		const from = rows().indexOf(rowEl);
		const docEl = listEl.doc;
		rowEl.addClass("is-dragging");
		const move = (moveEvent: PointerEvent) => {
			if (moveEvent.pointerId !== pointerId) return;
			const target = rows().find((other) => {
				const rect = other.getBoundingClientRect();
				return other !== rowEl && moveEvent.clientY >= rect.top && moveEvent.clientY <= rect.bottom;
			});
			if (!target) return;
			const rect = target.getBoundingClientRect();
			listEl.insertBefore(rowEl, moveEvent.clientY < rect.top + rect.height / 2 ? target : target.nextSibling);
		};
		const end = (endEvent: PointerEvent) => {
			if (endEvent.pointerId !== pointerId) return;
			docEl.removeEventListener("pointermove", move);
			docEl.removeEventListener("pointerup", end);
			docEl.removeEventListener("pointercancel", end);
			rowEl.removeClass("is-dragging");
			const to = rows().indexOf(rowEl);
			if (from !== to) moved(from, to);
		};
		docEl.addEventListener("pointermove", move);
		docEl.addEventListener("pointerup", end);
		docEl.addEventListener("pointercancel", end);
	});
}
