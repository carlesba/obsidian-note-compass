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

export const OPERATORS = ["is true", "equals", "contains", "exists"] as const;

export type CustomListOperator = (typeof OPERATORS)[number];

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

export function operatorTakesValue(operator: CustomListOperator): boolean {
	return operator === "equals" || operator === "contains";
}

export function isOperator(value: string): value is CustomListOperator {
	return (OPERATORS as readonly string[]).includes(value);
}

export function newCustomList(): CustomList {
	return { prefix: "", property: "", operator: "is true", value: "" };
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
