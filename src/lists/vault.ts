export interface VaultNote {
	path: string;
	basename: string;
	ctime: number;
}

export type Frontmatter = Record<string, unknown>;

export interface JumpListVault {
	notes(): VaultNote[];
	frontmatter(path: string): Frontmatter | undefined;
	linksFrom(path: string): string[];
	linksTo(path: string): string[];
}

export interface JumpListEntry {
	file: VaultNote;
	prefix: string;
	name: string;
	suffix?: string;
}
