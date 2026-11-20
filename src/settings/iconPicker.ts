import { SuggestModal, getIconIds, setIcon } from "obsidian";
import type { App } from "obsidian";
import { t } from "../i18n";
import { matchesInOrder } from "../render";

const SUGGESTED_ICONS = [
	"arrow-right",
	"calendar",
	"circle-slash-2",
	"info",
	"triangle-alert",
	"ban",
	"octagon-x",
	"trending-up",
	"trending-down",
	"map-pin",
	"bookmark",
	"thumbs-up",
	"thumbs-down",
	"key-round",
	"flame",
	"star",
	"circle-help",
];

const SUGGESTION_LIMIT = 200;

export function iconName(icon: string): string {
	return icon === "" ? t("iconThemeDefault") : icon;
}

export function renderIconPreview(el: HTMLElement, icon: string, color: string): void {
	el.empty();
	el.addClass("note-compass-status-icon");
	el.setCssProps({ "--note-compass-status-color": color });
	if (icon !== "") setIcon(el, icon);
}

function lucideIds(): string[] {
	return [...new Set(getIconIds().map((id) => id.replace(/^lucide-/, "")))].sort();
}

export class IconPickerModal extends SuggestModal<string> {
	private readonly color: string;
	private readonly choose: (icon: string) => void;
	private allIcons?: string[];

	constructor(app: App, color: string, choose: (icon: string) => void) {
		super(app);
		this.color = color;
		this.choose = choose;
		this.limit = SUGGESTION_LIMIT;
		this.setPlaceholder(t("searchIcons"));
	}

	getSuggestions(query: string): string[] {
		const fixed = [""];
		const allIcons = (this.allIcons = this.allIcons ?? lucideIds());
		if (query.trim() === "") return [...fixed, ...SUGGESTED_ICONS.filter((icon) => allIcons.includes(icon))];
		return [...fixed, ...allIcons].filter((icon) => matchesInOrder(query, iconName(icon)));
	}

	renderSuggestion(icon: string, el: HTMLElement): void {
		el.addClass("note-compass-icon-suggestion");
		renderIconPreview(el.createSpan(), icon, this.color);
		el.createSpan({ text: iconName(icon) });
	}

	onChooseSuggestion(icon: string): void {
		this.choose(icon);
	}
}
