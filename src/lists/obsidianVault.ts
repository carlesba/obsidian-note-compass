import type { App } from "obsidian";
import type { JumpListVault } from "./vault";

export function createObsidianVault(app: App): JumpListVault {
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
	};
}
