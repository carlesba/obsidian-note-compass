import { TFile, moment } from "obsidian";
import type { App, TFolder } from "obsidian";
import type { JumpListVault, MomentFactory, NewNoteVault, NoteTemplater, PropertyValueCount } from "./vault";

interface PluginRegistries {
	metadataTypeManager?: { getAllProperties(): Record<string, { widget?: unknown } | undefined> };
	plugins?: { getPlugin(id: string): { settings?: unknown; templater?: unknown } | null | undefined };
	internalPlugins?: {
		getPluginById(id: string): { enabled?: boolean; instance?: { options?: unknown } } | null | undefined;
	};
}

export function createObsidianVault(app: App): JumpListVault & NewNoteVault {
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
		defaultNoteFolder: (sourcePath) => app.fileManager.getNewFileParent(sourcePath ?? "").path,
		readNote: async (path) => {
			const file = app.vault.getFileByPath(path);
			return file ? app.vault.cachedRead(file) : "";
		},
		createNote: async (path, content) => {
			await ensureFolder(app, path.split("/").slice(0, -1).join("/"));
			await app.vault.create(path, content);
		},
		processNote: async (path, update) => {
			const file = app.vault.getFileByPath(path);
			if (!file) throw new Error(`No note at ${path}`);
			await app.vault.process(file, update);
		},
		templater: () => readSafely(() => templaterFor(app, registries.plugins?.getPlugin("templater-obsidian")?.templater)),
		coreTemplatesOptions: () => readSafely(() => registries.internalPlugins?.getPluginById("templates")?.instance?.options),
		now: () => Date.now(),
		moment: asMomentFactory(moment),
	};
}

function asMomentFactory(obsidianMoment: unknown): MomentFactory {
	return obsidianMoment as MomentFactory;
}

interface TemplaterApi {
	create_new_note_from_template(template: TFile, folder: TFolder, filename: string, openNewNote: boolean): Promise<unknown>;
}

function templaterFor(app: App, templater: unknown): NoteTemplater | undefined {
	if (!isTemplaterApi(templater)) return undefined;
	return {
		createFromTemplate: async (templatePath, folder, name) => {
			const template = app.vault.getFileByPath(templatePath);
			if (!template) return undefined;
			await ensureFolder(app, folder);
			const parent = folder === "" ? app.vault.getRoot() : app.vault.getFolderByPath(folder);
			if (!parent) return undefined;
			const created = await templater.create_new_note_from_template(template, parent, name, false);
			return created instanceof TFile ? created.path : undefined;
		},
	};
}

function isTemplaterApi(templater: unknown): templater is TemplaterApi {
	return (
		typeof templater === "object" &&
		templater !== null &&
		typeof (templater as Partial<Record<keyof TemplaterApi, unknown>>).create_new_note_from_template === "function"
	);
}

async function ensureFolder(app: App, folder: string): Promise<void> {
	if (folder !== "" && !app.vault.getFolderByPath(folder)) await app.vault.createFolder(folder);
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
