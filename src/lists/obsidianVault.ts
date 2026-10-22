import { moment } from "obsidian";
import type { App } from "obsidian";
import type { JumpListVault, PropertyValueCount } from "./vault";

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
		updateFrontmatter: async (path, update) => {
			const file = app.vault.getFileByPath(path);
			if (!file) throw new Error(`No note at ${path}`);
			await app.fileManager.processFrontMatter(file, update);
		},
		linksFrom: (path) => Object.keys(app.metadataCache.resolvedLinks[path] ?? {}),
		linksTo: (path) =>
			Object.entries(app.metadataCache.resolvedLinks)
				.filter(([, targets]) => path in targets)
				.map(([source]) => source),
		mtime: (path) => app.vault.getFileByPath(path)?.stat.mtime ?? 0,
		periodicNotesSettings: () => readSafely(() => registries.plugins?.getPlugin("periodic-notes")?.settings),
		dailyNotesOptions: () =>
			readSafely(() => {
				const dailyNotes = registries.internalPlugins?.getPluginById("daily-notes");
				return dailyNotes?.enabled ? dailyNotes.instance?.options : undefined;
			}),
		propertyTypes: () => readSafely(() => propertyWidgets(registries.metadataTypeManager?.getAllProperties())) ?? {},
		propertyValueCounts: (property) =>
			countValues(
				app.vault.getMarkdownFiles().map((file): unknown => app.metadataCache.getFileCache(file)?.frontmatter?.[property]),
			),
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

function countValues(values: unknown[]): PropertyValueCount[] {
	const counts = new Map<string | number, number>();
	for (const value of values) {
		for (const item of Array.isArray(value) ? (value as unknown[]) : [value]) {
			if ((typeof item === "string" && item !== "") || typeof item === "number") counts.set(item, (counts.get(item) ?? 0) + 1);
		}
	}
	return Array.from(counts, ([value, count]) => ({ value, count }));
}

function readSafely<T>(read: () => T): T | undefined {
	try {
		return read();
	} catch {
		return undefined;
	}
}
