import { SuggestModal, setIcon } from "obsidian";
import type { App } from "obsidian";
import { t } from "../i18n";
import { matchesInOrder } from "../render";
import { HEROICONS } from "../tasks/heroicons";

const SUGGESTED_ICONS = [
	"paper-airplane",
	"calendar",
	"arrow-right",
	"information-circle",
	"exclamation-triangle",
	"exclamation-circle",
	"no-symbol",
	"x-circle",
	"question-mark-circle",
	"star",
	"bookmark",
	"fire",
	"key",
	"light-bulb",
	"map-pin",
	"flag",
	"clock",
	"hand-thumb-up",
	"hand-thumb-down",
	"arrow-trending-up",
	"arrow-trending-down",
	"chat-bubble-left",
	"currency-dollar",
];

export function iconName(icon: string): string {
	return icon === "" ? t("iconThemeDefault") : icon;
}

export function renderIconPreview(el: HTMLElement, icon: string, color: string): void {
	el.empty();
	el.addClass("note-compass-status-icon");
	el.setCssProps({ "--note-compass-status-color": color });
	const paths = HEROICONS[icon];
	if (!paths) {
		if (icon !== "") setIcon(el, icon);
		return;
	}
	const svg = el.createSvg("svg", { attr: { viewBox: "0 0 20 20", fill: "currentColor", width: "100%", height: "100%" } });
	for (const [d, evenOdd] of paths) svg.createSvg("path", { attr: evenOdd ? { d, "fill-rule": "evenodd", "clip-rule": "evenodd" } : { d } });
}

const ALL_ICONS = Object.keys(HEROICONS);

export class IconPickerModal extends SuggestModal<string> {
	private readonly color: string;
	private readonly choose: (icon: string) => void;

	constructor(app: App, color: string, choose: (icon: string) => void) {
		super(app);
		this.color = color;
		this.choose = choose;
		this.limit = Number.MAX_SAFE_INTEGER;
		this.setPlaceholder(t("searchIcons"));
	}

	getSuggestions(query: string): string[] {
		const fixed = [""];
		const suggested = SUGGESTED_ICONS.filter((icon) => ALL_ICONS.includes(icon));
		const ordered = [...fixed, ...suggested, ...ALL_ICONS.filter((icon) => !suggested.includes(icon))];
		return query.trim() === "" ? ordered : ordered.filter((icon) => matchesInOrder(query, iconName(icon)));
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
