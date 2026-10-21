import { moment } from "obsidian";
import type { App } from "obsidian";
import type { JumpListVault } from "./vault";

interface PluginRegistries {
	metadataTypeManager?: { getAllProperties(): Record<string, { widget?: unknown } | undefined> };
	plugins?: { getPlugin(id: string): { settings?: unknown } | null | undefined };
	internalPlugins?: {
		getPluginById(id: string): { enabled?: boolean; instance?: { options?: unknown } } | null | undefined;
	};
}

export function createObsidianVault(app: App): JumpListVault {
	const registries = app as App & PluginRegistries;
	return {
		notes: () =>
			app.vault.getMarkdownFiles().map((file) => ({ path: file.path, basename: file.basename, ctime: file.stat.ctime })),
		frontmatter: (path) => {
			const file = app.vault.getFileByPath(path);
			return file ? app.metadataCache.getFileCache(file)?.frontmatter : undefined;
		},
		linksFrom: (path) => Object.keys(app.metadataCache.resolvedLinks[path] ?? {}),
		linksTo: (path) =>
			Object.entries(app.metadataCache.resolvedLinks)
				.filter(([, targets]) => path in targets)
				.map(([source]) => source),
		periodicNotesSettings: () => readSafely(() => registries.plugins?.getPlugin("periodic-notes")?.settings),
		dailyNotesOptions: () =>
			readSafely(() => {
				const dailyNotes = registries.internalPlugins?.getPluginById("daily-notes");
				return dailyNotes?.enabled ? dailyNotes.instance?.options : undefined;
			}),
		propertyTypes: () => readSafely(() => propertyWidgets(registries.metadataTypeManager?.getAllProperties())) ?? {},
		now: () => Date.now(),
		moment,
	};
}

function propertyWidgets(properties: Record<string, { widget?: unknown } | undefined> | undefined): Record<string, string> {
	const widgets: Record<string, string> = {};
	for (const [name, property] of Object.entries(properties ?? {})) {
		if (typeof property?.widget === "string") widgets[name.toLowerCase()] = property.widget;
	}
	return widgets;
}

function readSafely<T>(read: () => T): T | undefined {
	try {
		return read();
	} catch {
		return undefined;
	}
}
