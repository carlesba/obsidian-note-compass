export interface BuiltInList {
	enabled: boolean;
	prefix: string;
}

export interface BuiltInLists {
	linksIn: BuiltInList;
	linksOut: BuiltInList;
	sameDay: BuiltInList;
	adjacentDays: BuiltInList;
}

export type CustomListOperator = "is true" | "equals" | "contains" | "exists";

export interface CustomList {
	prefix: string;
	property: string;
	operator: CustomListOperator;
	value: string;
}

export interface JumpListSettings {
	builtIns: BuiltInLists;
	customLists: CustomList[];
}

export function defaultSettings(): JumpListSettings {
	return {
		builtIns: {
			linksIn: { enabled: true, prefix: "🔗 in " },
			linksOut: { enabled: true, prefix: "🔗 out" },
			sameDay: { enabled: true, prefix: "🔅 ctx" },
			adjacentDays: { enabled: true, prefix: "📅 day" },
		},
		customLists: [],
	};
}

export function mergeSettings(stored: unknown): JumpListSettings {
	const defaults = defaultSettings();
	const data = isRecord(stored) ? stored : {};
	const builtIns = isRecord(data.builtIns) ? data.builtIns : {};

	return {
		builtIns: {
			linksIn: readBuiltInList(builtIns.linksIn, defaults.builtIns.linksIn),
			linksOut: readBuiltInList(builtIns.linksOut, defaults.builtIns.linksOut),
			sameDay: readBuiltInList(builtIns.sameDay, defaults.builtIns.sameDay),
			adjacentDays: readBuiltInList(builtIns.adjacentDays, defaults.builtIns.adjacentDays),
		},
		customLists: Array.isArray(data.customLists) ? (data.customLists as CustomList[]) : defaults.customLists,
	};
}

function readBuiltInList(stored: unknown, fallback: BuiltInList): BuiltInList {
	const list = isRecord(stored) ? stored : {};
	return {
		enabled: typeof list.enabled === "boolean" ? list.enabled : fallback.enabled,
		prefix: typeof list.prefix === "string" ? list.prefix : fallback.prefix,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
