import { getAllTags, moment } from "obsidian";
import type { App, TFile } from "obsidian";
import { fallbackLinkText } from "../tasks/destinations";
import type { Period } from "./dateNotes";
import type { JumpListVault, MomentDate, MomentFactory, NewNoteVault, NoteBodyVault, PropertyValueCount } from "./vault";

interface PluginRegistries {
	metadataTypeManager?: { getAllProperties(): Record<string, { widget?: unknown } | undefined> };
	plugins?: { getPlugin(id: string): { settings?: unknown; createPeriodicNote?: unknown } | null | undefined };
	internalPlugins?: {
		getPluginById(id: string): { enabled?: boolean; instance?: { options?: unknown } } | null | undefined;
	};
}

type PeriodicNoteCreator = (period: Period, date: MomentDate) => Promise<unknown>;

export function createObsidianVault(app: App): JumpListVault & NewNoteVault & NoteBodyVault {
	const registries = app as App & PluginRegistries;
	const markdownFile = (path: string): TFile => {
		const file = app.vault.getFileByPath(path);
		if (!file) throw new Error(`No note at ${path}`);
		return file;
	};
	const createNote = async (path: string, content: string) => {
		await ensureFolder(app, path.split("/").slice(0, -1).join("/"));
		await app.vault.create(path, content);
	};
	return {
		notes: () =>
			app.vault.getMarkdownFiles().map((file) => ({ path: file.path, basename: file.basename, ctime: file.stat.ctime })),
		frontmatter: (path) => {
			const file = app.vault.getFileByPath(path);
			return file ? app.metadataCache.getFileCache(file)?.frontmatter : undefined;
		},
		tags: (path) => {
			const file = app.vault.getFileByPath(path);
			const cache = file ? app.metadataCache.getFileCache(file) : null;
			return cache ? getAllTags(cache) ?? [] : [];
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
		createNote,
		readNote: (path) => app.vault.read(markdownFile(path)),
		processNote: async (path, edit) => {
			await app.vault.process(markdownFile(path), edit);
		},
		taskLineNumbers: (path) => {
			const file = app.vault.getFileByPath(path);
			const items = file ? app.metadataCache.getFileCache(file)?.listItems ?? [] : [];
			return items.filter((item) => item.task !== undefined).map((item) => item.position.start.line);
		},
		linkText: (path, sourcePath) => {
			const file = app.vault.getFileByPath(path);
			if (file) return app.metadataCache.fileToLinktext(file, sourcePath, true);
			return fallbackLinkText(path, app.vault.getMarkdownFiles().map((note) => note.path));
		},
		createPeriodNote: async (path, period, date, from) => {
			const creator = from === "periodicNotes" ? periodicNoteCreator(registries) : undefined;
			if (creator) await creator(period, date).catch(() => undefined);
			if (!app.vault.getFileByPath(path)) await createNote(path, "");
		},
		coreTemplatesOptions: () => readSafely(() => registries.internalPlugins?.getPluginById("templates")?.instance?.options),
		now: () => Date.now(),
		moment: asMomentFactory(moment),
	};
}

function periodicNoteCreator(registries: PluginRegistries): PeriodicNoteCreator | undefined {
	const plugin = readSafely(() => registries.plugins?.getPlugin("periodic-notes"));
	const create = plugin?.createPeriodicNote;
	if (typeof create !== "function") return undefined;
	return async (period, date) => {
		await create.call(plugin, period, date);
	};
}

function asMomentFactory(obsidianMoment: unknown): MomentFactory {
	return obsidianMoment as MomentFactory;
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
