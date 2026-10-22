import type { Frontmatter } from "../lists/vault";
import type { EditableProperty, EditablePropertyType, SetPropertiesSettings } from "../settings";
import { decidedPropertyType } from "./propertyTypes.ts";
import { formatPendingValue, isUnset, sameValue } from "./values.ts";

export type PropertyState = ReadonlyMap<string, unknown>;

export type PickerChoice = { action: "save" } | { action: "cancel" } | { action: "edit"; entry: EditableProperty };

export interface LabelledChoice {
	label: string;
	choice: PickerChoice;
}

export const SAVE_LABEL = "🏁 Save & close";
export const CANCEL_LABEL = "🛑 Cancel";

const CHANGED_MARK = "•";
const UNCHANGED_MARK = "\u2003";

export function offeredProperties(settings: SetPropertiesSettings): EditableProperty[] {
	return settings.properties.filter((entry) => entry.enabled && entry.property.trim() !== "");
}

export function propertyType(settings: SetPropertiesSettings, entry: EditableProperty): EditablePropertyType {
	return decidedPropertyType(settings.properties, entry.property) ?? entry.type;
}

export function initialPropertyState(settings: SetPropertiesSettings, frontmatter: Frontmatter | undefined): PropertyState {
	const saved = frontmatter ?? {};
	const state = new Map<string, unknown>();
	for (const entry of offeredProperties(settings)) state.set(entry.property, ownValue(saved, entry.property));
	return state;
}

export function withValue(state: PropertyState, property: string, value: unknown): PropertyState {
	return new Map(state).set(property, value);
}

export function propertyLabel(
	settings: SetPropertiesSettings,
	entry: EditableProperty,
	initial: PropertyState,
	state: PropertyState,
): string {
	const pending = state.get(entry.property);
	const mark = sameValue(pending, initial.get(entry.property)) ? UNCHANGED_MARK : CHANGED_MARK;
	const name = [entry.prefix, entry.property].filter(Boolean).join(" ");
	return `${mark} ${name} · ${formatPendingValue(propertyType(settings, entry), pending)}`;
}

export function pickerChoices(
	settings: SetPropertiesSettings,
	initial: PropertyState,
	state: PropertyState,
): LabelledChoice[] {
	return [
		{ label: SAVE_LABEL, choice: { action: "save" } },
		{ label: CANCEL_LABEL, choice: { action: "cancel" } },
		...offeredProperties(settings).map((entry) => ({
			label: propertyLabel(settings, entry, initial, state),
			choice: { action: "edit" as const, entry },
		})),
	];
}

export function writeProperties(frontmatter: Frontmatter, initial: PropertyState, state: PropertyState): void {
	state.forEach((value, property) => {
		if (sameValue(value, initial.get(property))) return;
		if (isUnset(value)) delete frontmatter[property];
		else frontmatter[property] = value;
	});
}

function ownValue(frontmatter: Frontmatter, key: string): unknown {
	return Object.prototype.hasOwnProperty.call(frontmatter, key) ? frontmatter[key] : undefined;
}
