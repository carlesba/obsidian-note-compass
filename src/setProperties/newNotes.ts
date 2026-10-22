import { propertyType } from "../lists/conditions.ts";
import { findNote } from "../lists/sources.ts";
import type { Frontmatter, JumpListVault, NewNoteVault, VaultNote } from "../lists/vault";
import type { EditableProperty, ListSource } from "../settings";

export interface NewNoteRule {
	folder?: string;
	linkTo?: VaultNote;
	property?: { name: string; value: unknown };
}

export interface NoteCreation {
	name: string;
	entry: EditableProperty;
	rule: NewNoteRule;
}

const UNSAFE_NAME = /[\\/:*?"<>|#^[\]]/;

export function newNoteRule(source: ListSource | undefined, vault: JumpListVault): NewNoteRule | undefined {
	if (!source) return undefined;
	switch (source.kind) {
		case "inFolder": {
			const folder = trimSlashes(source.folder);
			return folder === "" ? undefined : { folder };
		}
		case "linksToNote": {
			const note = findNote(vault.notes(), source.note);
			return note ? { linkTo: note } : undefined;
		}
		case "modifiedToday":
			return {};
		case "frontmatter": {
			if (source.property === "") return undefined;
			const value = satisfyingValue(source, propertyType(vault.propertyTypes(), source.property));
			return value === undefined ? undefined : { property: { name: source.property, value } };
		}
		default:
			return undefined;
	}
}

export function createsNotes(source: ListSource, propertyTypes: Record<string, string>): boolean {
	if (source.kind === "inFolder" || source.kind === "linksToNote" || source.kind === "modifiedToday") return true;
	if (source.kind !== "frontmatter" || source.property === "") return false;
	return satisfyingValue(source, propertyType(propertyTypes, source.property)) !== undefined;
}

export function isCreatableName(name: string): boolean {
	return name !== "" && !name.startsWith(".") && !UNSAFE_NAME.test(name);
}

export async function createNotes(
	vault: JumpListVault & NewNoteVault,
	sourcePath: string,
	creations: readonly NoteCreation[],
): Promise<void> {
	for (const creation of creations) await createNote(vault, sourcePath, creation);
}

async function createNote(vault: JumpListVault & NewNoteVault, sourcePath: string, creation: NoteCreation): Promise<void> {
	const { name, entry, rule } = creation;
	const folder = trimSlashes(rule.folder ?? (entry.newNoteFolder?.trim() || vault.defaultNoteFolder(sourcePath)));
	const path = folder === "" ? `${name}.md` : `${folder}/${name}.md`;
	const notes = vault.notes();
	if (notes.some((note) => note.path.toLowerCase() === path.toLowerCase())) return;
	const template = findNote(notes, entry.newNoteTemplate?.trim() ?? "");
	const content = template ? await vault.readNote(template.path) : "";
	await vault.createNote(path, rule.linkTo ? withLink(content, rule.linkTo, notes) : content);
	const property = rule.property;
	if (property) await vault.updateFrontmatter(path, (frontmatter) => satisfy(frontmatter, property.name, property.value));
}

function satisfyingValue(source: Extract<ListSource, { kind: "frontmatter" }>, type: string): unknown {
	const { condition } = source;
	if (condition.operator === "is true") return true;
	if (condition.operator === "is" && "value" in condition) return condition.value;
	if (condition.operator === "has item" && "value" in condition) return [condition.value];
	if (condition.operator === "is set" && type === "checkbox") return true;
	return undefined;
}

function satisfy(frontmatter: Frontmatter, property: string, value: unknown): void {
	const current = frontmatter[property];
	if (Array.isArray(value) && Array.isArray(current)) {
		const existing: unknown[] = current;
		const wanted: unknown[] = value;
		frontmatter[property] = existing.concat(wanted.filter((item) => !existing.includes(item)));
	} else {
		frontmatter[property] = value;
	}
}

function withLink(content: string, note: VaultNote, notes: readonly VaultNote[]): string {
	const pathName = note.path.replace(/\.md$/, "");
	const targets = (content.match(/\[\[[^\]|#]+/g) ?? []).map((match) => match.slice(2).trim());
	if (targets.some((target) => target === note.basename || target === pathName)) return content;
	const unique = notes.filter((candidate) => candidate.basename === note.basename).length === 1;
	const link = `[[${unique ? note.basename : pathName}]]`;
	const body = content.replace(/\s+$/, "");
	return body === "" ? `${link}\n` : `${body}\n\n${link}\n`;
}

function trimSlashes(folder: string): string {
	return folder.trim().replace(/^\/+|\/+$/g, "");
}
