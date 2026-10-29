import type { DateNoteSource, Period } from "./dateNotes";

export interface MissingDateNote {
	period: Period;
	from: DateNoteSource;
}

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

export type MomentUnit = "day" | "week" | "month" | "quarter" | "year";

export interface MomentDate {
	clone(): MomentDate;
	add(amount: number, unit: MomentUnit): MomentDate;
	startOf(unit: MomentUnit): MomentDate;
	format(format?: string): string;
	toISOString(): string;
	isValid(): boolean;
	valueOf(): number;
	day(): number;
	week(): number;
	isoWeek(): number;
	month(): number;
	quarter(): number;
}

export type MomentFactory = (input?: number | string, format?: string, strict?: boolean) => MomentDate;

export interface JumpListVault {
	notes(): VaultNote[];
	frontmatter(path: string): Frontmatter | undefined;
	tags(path: string): string[];
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

export interface NewNoteVault {
	defaultNoteFolder(sourcePath: string | undefined): string;
	createNote(path: string, content: string): Promise<void>;
	coreTemplatesOptions(): unknown;
}

export interface NoteBodyVault {
	readNote(path: string): Promise<string>;
	processNote(path: string, edit: (content: string) => string): Promise<void>;
	taskLineNumbers(path: string): number[];
	linkText(path: string, sourcePath: string): string;
	createPeriodNote(path: string, period: Period, date: MomentDate, from: DateNoteSource): Promise<void>;
}

export interface JumpListEntry {
	file: VaultNote;
	prefix: string;
	prefixColor?: string;
	name: string;
	suffix?: string;
	missing?: MissingDateNote;
}
