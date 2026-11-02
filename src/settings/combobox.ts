import { SearchComponent, setIcon } from "obsidian";

export interface ComboboxItem {
	value: string;
	label: string;
	icon?: string;
	detail?: string;
}

export interface ComboboxOptions {
	items: () => ComboboxItem[];
	placeholder: string;
	searchPlaceholder: string;
	onSelect: (item: ComboboxItem) => void;
	extraItem?: (query: string, items: readonly ComboboxItem[]) => ComboboxItem | undefined;
}

const POPOVER_GAP = 5;

export class Combobox {
	readonly buttonEl: HTMLElement;
	private readonly iconEl: HTMLElement;
	private readonly labelEl: HTMLElement;
	private readonly options: ComboboxOptions;
	private selected: ComboboxItem | undefined;
	private disabled = false;
	private popover: ComboboxPopover | undefined;

	constructor(parentEl: HTMLElement, options: ComboboxOptions) {
		this.options = options;
		this.buttonEl = parentEl.createDiv({ cls: "combobox-button", attr: { tabindex: "0", role: "combobox", "aria-expanded": "false" } });
		this.iconEl = this.buttonEl.createDiv({ cls: "combobox-button-icon" });
		this.iconEl.hide();
		this.labelEl = this.buttonEl.createDiv({ cls: "combobox-button-label", attr: { placeholder: options.placeholder } });
		setIcon(this.buttonEl.createDiv({ cls: "combobox-button-chevron" }), "lucide-chevrons-up-down");
		this.buttonEl.addEventListener("click", (event) => {
			event.preventDefault();
			this.toggle();
		});
		this.buttonEl.addEventListener("keydown", (event) => {
			if (this.disabled || event.isComposing || this.popover) return;
			if (event.key === "Enter" || event.key === " " || event.key.startsWith("Arrow")) {
				event.preventDefault();
				this.open();
			} else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
				event.preventDefault();
				this.open(event.key);
			}
		});
	}

	setValue(item: ComboboxItem | undefined): this {
		this.selected = item;
		this.labelEl.setText(item?.label ?? "");
		this.iconEl.empty();
		if (item?.icon) {
			setIcon(this.iconEl, item.icon);
			this.iconEl.show();
		} else {
			this.iconEl.hide();
		}
		return this;
	}

	setDisabled(disabled: boolean): this {
		this.disabled = disabled;
		this.buttonEl.toggleClass("mod-disabled", disabled);
		this.buttonEl.setAttribute("tabindex", disabled ? "-1" : "0");
		return this;
	}

	private toggle(): void {
		if (this.popover) this.close();
		else this.open();
	}

	private open(query = ""): void {
		if (this.disabled || this.popover) return;
		this.buttonEl.addClass("has-focus");
		this.buttonEl.setAttribute("aria-expanded", "true");
		this.popover = new ComboboxPopover(this.buttonEl, this.options, this.selected?.value, query, {
			choose: (item) => {
				this.close();
				this.setValue(item);
				this.options.onSelect(item);
			},
			dismiss: () => {
				this.close();
				this.buttonEl.focus();
			},
		});
	}

	private close(): void {
		this.popover?.destroy();
		this.popover = undefined;
		this.buttonEl.removeClass("has-focus");
		this.buttonEl.setAttribute("aria-expanded", "false");
	}
}

interface PopoverActions {
	choose: (item: ComboboxItem) => void;
	dismiss: () => void;
}

class ComboboxPopover {
	private readonly suggestEl: HTMLElement;
	private readonly listEl: HTMLElement;
	private readonly search: SearchComponent;
	private shown: ComboboxItem[] = [];
	private highlighted = 0;
	private readonly removeOutsideListener: () => void;

	constructor(
		private readonly anchorEl: HTMLElement,
		private readonly options: ComboboxOptions,
		private readonly selectedValue: string | undefined,
		query: string,
		private readonly actions: PopoverActions,
	) {
		const doc = anchorEl.doc;
		this.suggestEl = doc.body.createDiv({ cls: ["suggestion-container", "combobox", "note-compass-combobox"] });
		this.search = new SearchComponent(this.suggestEl).setPlaceholder(options.searchPlaceholder).setValue(query);
		this.search.onChange(() => this.render(true));
		this.listEl = this.suggestEl.createDiv({ cls: "suggestion" });
		this.suggestEl.addEventListener("mousedown", (event) => {
			if (event.target !== this.search.inputEl) event.preventDefault();
		});
		this.search.inputEl.addEventListener("focus", () => this.suggestEl.addClass("has-input-focus"));
		this.search.inputEl.addEventListener("blur", () => this.suggestEl.removeClass("has-input-focus"));
		this.search.inputEl.addEventListener("keydown", (event) => this.onKey(event));
		const onOutside = (event: MouseEvent) => {
			const target = event.targetNode;
			if (target && (this.suggestEl.contains(target) || anchorEl.contains(target))) return;
			actions.dismiss();
		};
		doc.addEventListener("mousedown", onOutside, true);
		this.removeOutsideListener = () => doc.removeEventListener("mousedown", onOutside, true);
		this.render(false);
		this.position();
		this.search.inputEl.focus();
	}

	destroy(): void {
		this.removeOutsideListener();
		this.suggestEl.remove();
	}

	private onKey(event: KeyboardEvent): void {
		if (event.isComposing) return;
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			if (this.shown.length === 0) return;
			const step = event.key === "ArrowDown" ? 1 : -1;
			this.highlight((this.highlighted + step + this.shown.length) % this.shown.length, true);
		} else if (event.key === "Enter") {
			event.preventDefault();
			const item = this.shown[this.highlighted];
			if (item) this.actions.choose(item);
		} else if (event.key === "Escape" || event.key === "Tab") {
			event.preventDefault();
			event.stopPropagation();
			this.actions.dismiss();
		}
	}

	private render(fromTyping: boolean): void {
		const query = this.search.getValue().trim().toLowerCase();
		const items = this.options.items();
		this.shown = query === "" ? items : items.filter((item) => matches(item, query));
		const extra = this.options.extraItem?.(this.search.getValue().trim(), items);
		if (extra) this.shown.push(extra);
		this.listEl.empty();
		this.shown.forEach((item, index) => this.renderItem(item, index));
		const selectedIndex = this.shown.findIndex((item) => item.value === this.selectedValue);
		this.highlight(!fromTyping && selectedIndex !== -1 ? selectedIndex : 0, true);
	}

	private renderItem(item: ComboboxItem, index: number): void {
		const itemEl = this.listEl.createDiv({ cls: ["suggestion-item", "mod-complex", "mod-toggle"] });
		if (item.value === this.selectedValue) setIcon(itemEl.createDiv({ cls: ["suggestion-icon", "mod-checked"] }), "lucide-check");
		if (item.icon) {
			const flairEl = itemEl.createDiv({ cls: "suggestion-icon" }).createSpan({ cls: "suggestion-flair" });
			setIcon(flairEl, item.icon);
		}
		itemEl.createDiv({ cls: "suggestion-content" }).createDiv({ cls: "suggestion-title", text: item.label });
		if (item.detail) itemEl.createDiv({ cls: "suggestion-aux" }).createSpan({ cls: ["suggestion-flair", "u-small"], text: item.detail });
		itemEl.addEventListener("mousemove", () => this.highlight(index, false));
		itemEl.addEventListener("click", (event) => {
			event.preventDefault();
			this.actions.choose(item);
		});
	}

	private highlight(index: number, scroll: boolean): void {
		const itemEls = Array.from(this.listEl.children);
		itemEls[this.highlighted]?.removeClass("is-selected");
		this.highlighted = index;
		const itemEl = itemEls[index];
		if (!itemEl) return;
		itemEl.addClass("is-selected");
		if (scroll) itemEl.scrollIntoView({ block: "nearest" });
	}

	private position(): void {
		const rect = this.anchorEl.getBoundingClientRect();
		const win = this.anchorEl.win;
		this.suggestEl.setCssStyles({ minWidth: `${Math.max(rect.width, 200)}px` });
		const height = this.suggestEl.offsetHeight;
		const width = this.suggestEl.offsetWidth;
		const below = rect.bottom + POPOVER_GAP;
		const top = below + height > win.innerHeight && rect.top - POPOVER_GAP - height > 0 ? rect.top - POPOVER_GAP - height : below;
		const left = Math.max(POPOVER_GAP, Math.min(rect.left, win.innerWidth - width - POPOVER_GAP));
		this.suggestEl.setCssStyles({ top: `${top}px`, left: `${left}px` });
	}
}

function matches(item: ComboboxItem, query: string): boolean {
	return item.label.toLowerCase().includes(query) || (item.detail?.toLowerCase().includes(query) ?? false);
}
