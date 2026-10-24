import { buildJumpList } from "../lists/jumpList.ts";
import type { JumpListVault, VaultNote } from "../lists/vault";
import { isLinkType, isUnreadable } from "../settings.ts";
import type { EditableProperty, EditablePropertyType, JumpSettings, SetPropertiesSettings } from "../settings";
import type { PickableNote } from "./links";
import { decidedPropertyType } from "./propertyTypes.ts";

export interface OfferedEntry {
	entry: EditableProperty;
	type: EditablePropertyType;
	notes: PickableNote[];
	values: string[];
}

export function offeredProperties(settings: SetPropertiesSettings): EditableProperty[] {
	return settings.properties.filter((entry) => entry.enabled && entry.property.trim() !== "" && !isUnreadable(entry.source));
}

export function propertyType(settings: SetPropertiesSettings, entry: EditableProperty): EditablePropertyType {
	return decidedPropertyType(settings.properties, entry.property) ?? entry.type;
}

export function offeredEntries(settings: JumpSettings, vault: JumpListVault, target: VaultNote): OfferedEntry[] {
	return offeredProperties(settings.setProperties).map((entry) => {
		const type = propertyType(settings.setProperties, entry);
		const offered: OfferedEntry = { entry, type, notes: [], values: [] };
		if (isLinkType(type)) offered.notes = pickableNotes(settings, vault, target, entry);
		if (type === "text") offered.values = [...new Set([...presetTexts(entry), ...vaultTexts(vault, entry.property)])];
		return offered;
	});
}

function presetTexts(entry: EditableProperty): string[] {
	return (entry.presetValues ?? []).map((value) => value.trim()).filter((value) => value !== "");
}

function vaultTexts(vault: JumpListVault, property: string): string[] {
	return vault
		.propertyValueCounts(property)
		.filter((count) => typeof count.value === "string")
		.sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)))
		.map((count) => String(count.value));
}

function pickableNotes(
	settings: JumpSettings,
	vault: JumpListVault,
	target: VaultNote,
	entry: EditableProperty,
): PickableNote[] {
	if (!entry.source) return [];
	const list = { id: entry.id, enabled: true, prefix: "", source: entry.source };
	const excludedFolders = (entry.excludedFolders ?? [])
		.map((folder) => folder.trim().replace(/^\/+|\/+$/g, ""))
		.filter((folder) => folder !== "");
	return buildJumpList([list], vault, target, settings.dateNotes)
		.filter((listed) => listed.missing === undefined)
		.map((listed) => listed.file)
		.filter(
			(file) =>
				file.path !== target.path &&
				!excludedFolders.some((folder) => file.path.startsWith(`${folder}/`)) &&
				vault.frontmatter(file.path)?.archived !== true,
		)
		.map((file) => ({ name: file.basename, path: file.path, mtime: vault.mtime(file.path) }))
		.sort((a, b) => b.mtime - a.mtime);
}
