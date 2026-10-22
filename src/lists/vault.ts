import type { moment } from "obsidian";

export interface VaultNote {
	path: string;
	basename: string;
	ctime: number;
}

export type Frontmatter = Record<string, unknown>;

export interface PropertyValueCount {
	value: string | number;
	count: number;
}

export type MomentFactory = typeof moment;

export type MomentDate = ReturnType<MomentFactory>;

export interface JumpListVault {
	notes(): VaultNote[];
	frontmatter(path: string): Frontmatter | undefined;
	updateFrontmatter(path: string, update: (frontmatter: Frontmatter) => void): Promise<void>;
	linksFrom(path: string): string[];
	linksTo(path: string): string[];
	mtime(path: string): number;
	periodicNotesSettings(): unknown;
	dailyNotesOptions(): unknown;
	propertyTypes(): Record<string, string>;
	propertyValueCounts(property: string): PropertyValueCount[];
	now(): number;
	moment: MomentFactory;
}

export interface NoteTemplater {
	createFromTemplate(templatePath: string, folder: string, name: string): Promise<string | undefined>;
}

export interface NewNoteVault {
	defaultNoteFolder(sourcePath: string | undefined): string;
	readNote(path: string): Promise<string>;
	createNote(path: string, content: string): Promise<void>;
	processNote(path: string, update: (content: string) => string): Promise<void>;
	templater(): NoteTemplater | undefined;
	coreTemplatesOptions(): unknown;
}

export interface JumpListEntry {
	file: VaultNote;
	prefix: string;
	name: string;
	suffix?: string;
}
