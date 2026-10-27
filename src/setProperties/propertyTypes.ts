import { isMultiRow } from "../settings.ts";
import type { EditableProperty, EditablePropertyType } from "../settings";

export function decidedPropertyType(
	properties: readonly EditableProperty[],
	name: string,
): EditablePropertyType | undefined {
	return singleRows(properties).find((entry) => entry.enabled && entry.source?.kind !== "unreadable" && entry.property === name)?.type;
}

export function mixedTypeProperties(properties: readonly EditableProperty[]): string[] {
	const typesByName = new Map<string, Set<EditablePropertyType>>();
	for (const entry of singleRows(properties)) {
		const types = typesByName.get(entry.property) ?? new Set<EditablePropertyType>();
		typesByName.set(entry.property, types.add(entry.type));
	}
	return [...typesByName].filter(([, types]) => types.size > 1).map(([name]) => name);
}

function singleRows(properties: readonly EditableProperty[]): EditableProperty[] {
	return properties.filter((entry) => !isMultiRow(entry));
}
