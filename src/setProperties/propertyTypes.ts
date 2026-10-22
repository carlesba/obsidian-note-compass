import type { EditableProperty, EditablePropertyType } from "../settings";

export function decidedPropertyType(
	properties: readonly EditableProperty[],
	name: string,
): EditablePropertyType | undefined {
	return properties.find((entry) => entry.enabled && entry.property === name)?.type;
}

export function mixedTypeProperties(properties: readonly EditableProperty[]): string[] {
	const typesByName = new Map<string, Set<EditablePropertyType>>();
	for (const entry of properties) {
		const types = typesByName.get(entry.property) ?? new Set<EditablePropertyType>();
		typesByName.set(entry.property, types.add(entry.type));
	}
	return [...typesByName].filter(([, types]) => types.size > 1).map(([name]) => name);
}
