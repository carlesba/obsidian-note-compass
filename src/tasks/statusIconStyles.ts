import type { App, Plugin } from "obsidian";
import { statusIconCss } from "./statusIcons";
import type { TaskStatusSettings } from "./taskStatuses";

interface AdoptedSheet {
	doc: Document;
	sheet: CSSStyleSheet;
}

export class StatusIconStyles {
	private readonly app: App;
	private readonly sheets: AdoptedSheet[] = [];
	private css = "";

	constructor(app: App) {
		this.app = app;
	}

	register(plugin: Plugin): void {
		this.adopt(document);
		plugin.registerEvent(this.app.workspace.on("window-open", (win) => this.adopt(win.doc)));
		plugin.register(() => {
			for (const { doc, sheet } of this.sheets) doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter((adopted) => adopted !== sheet);
			this.sheets.length = 0;
		});
	}

	update(settings: TaskStatusSettings): void {
		this.css = statusIconCss(settings);
		for (const { sheet } of this.sheets) sheet.replaceSync(this.css);
	}

	private adopt(doc: Document): void {
		const win = doc.defaultView;
		if (!win) return;
		const sheet = new win.CSSStyleSheet();
		sheet.replaceSync(this.css);
		doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
		this.sheets.push({ doc, sheet });
	}
}
