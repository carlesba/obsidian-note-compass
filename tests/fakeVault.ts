import type { Frontmatter, JumpListVault, NewNoteVault, PropertyValueCount, VaultNote } from "../src/lists/vault.ts";
import { moment } from "./moment.ts";

export interface FakeNote {
	path: string;
	ctime?: number;
	mtime?: number;
	frontmatter?: Frontmatter;
	tags?: string[];
	links?: string[];
	content?: string;
}

export interface FakeVaultOptions {
	propertyTypes?: Record<string, string>;
	coreTemplatesOptions?: unknown;
	defaultNoteFolder?: (sourcePath: string | undefined) => string;
}

export type FakeVault = JumpListVault &
	NewNoteVault & { note(path: string): VaultNote; content(path: string): string | undefined; paths(): string[] };

export const NOW = new Date(2024, 2, 9, 15).getTime();
export const HOURS_AGO = (hours: number) => NOW - hours * 3600 * 1000;

export function fakeVault(fakes: FakeNote[], options: FakeVaultOptions = {}): FakeVault {
	const toNote = (fake: FakeNote) => ({ path: fake.path, basename: fake.path.split("/").pop()!.replace(/\.md$/, ""), ctime: fake.ctime ?? 0 });
	const byPath = (path: string) => fakes.find((fake) => fake.path === path);
	const create = (path: string, content: string) => {
		if (byPath(path)) throw new Error(`${path} exists`);
		fakes.push({ path, content, mtime: NOW });
	};
	return {
		notes: () => fakes.map(toNote),
		frontmatter: (path) => byPath(path)?.frontmatter,
		tags: (path) => byPath(path)?.tags ?? [],
		updateFrontmatter: async (path, update) => {
			const fake = byPath(path)!;
			fake.frontmatter = { ...fake.frontmatter };
			update(fake.frontmatter);
		},
		linksFrom: (path) => byPath(path)?.links ?? [],
		linksTo: (path) => fakes.filter((fake) => fake.links?.includes(path)).map((fake) => fake.path),
		mtime: (path) => byPath(path)?.mtime ?? HOURS_AGO(48),
		periodicNotesSettings: () => undefined,
		dailyNotesOptions: () => undefined,
		propertyTypes: () => options.propertyTypes ?? {},
		propertyValueCounts: (property) => {
			const counts: PropertyValueCount[] = [];
			for (const fake of fakes) {
				const value = fake.frontmatter?.[property];
				for (const item of Array.isArray(value) ? value : [value]) {
					if (typeof item !== "string" && typeof item !== "number") continue;
					const known = counts.find((count) => count.value === item);
					if (known) known.count++;
					else counts.push({ value: item, count: 1 });
				}
			}
			return counts;
		},
		defaultNoteFolder: options.defaultNoteFolder ?? (() => "inbox"),
		createNote: async (path, content) => create(path, content),
		coreTemplatesOptions: () => options.coreTemplatesOptions,
		now: () => NOW,
		moment,
		note: (path) => toNote(byPath(path)!),
		content: (path) => byPath(path)?.content,
		paths: () => fakes.map((fake) => fake.path),
	};
}
