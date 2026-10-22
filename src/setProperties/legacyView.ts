import { isLinkType, newListId } from "../settings";
import type { EditableProperty, LegacySetPropertiesSettings, LinkList, SetPropertiesSettings } from "../settings";

export function legacyView(settings: SetPropertiesSettings): LegacySetPropertiesSettings {
	const checkboxes = settings.properties.filter((entry) => entry.type === "checkbox");
	const links = settings.properties.filter((entry) => isLinkType(entry.type));
	return {
		flagsPrefix: checkboxes[0]?.prefix ?? "",
		flags: checkboxes.map((entry) => entry.property),
		templatesFolder: links[0]?.excludedFolder ?? "",
		linkLists: links.map(
			(entry): LinkList => ({
				id: entry.id,
				enabled: entry.enabled,
				prefix: entry.prefix,
				name: "",
				property: entry.property,
				mode: entry.type === "link" ? "single" : "multi",
				source: entry.source ?? { kind: "modifiedToday" },
			}),
		),
	};
}

export function applyLegacyView(settings: SetPropertiesSettings, view: LegacySetPropertiesSettings): void {
	const previousCheckboxes = settings.properties.filter((entry) => entry.type === "checkbox");
	const others = settings.properties.filter((entry) => entry.type !== "checkbox" && !isLinkType(entry.type));
	const links: EditableProperty[] = view.linkLists.map((list) => ({
		id: list.id,
		enabled: list.enabled,
		prefix: list.prefix,
		property: list.property,
		type: list.mode === "single" ? "link" : "links",
		source: list.source,
		excludedFolder: view.templatesFolder,
	}));
	const checkboxes: EditableProperty[] = [];
	view.flags.forEach((flag, index) => {
		const previous = previousCheckboxes[index];
		const taken = [...links, ...checkboxes, ...others];
		const id = previous && !taken.some((entry) => entry.id === previous.id) ? previous.id : newListId(taken);
		checkboxes.push({ id, enabled: previous?.enabled ?? true, prefix: view.flagsPrefix, property: flag, type: "checkbox" });
	});
	settings.properties = [...checkboxes, ...links, ...others];
}

export function editLegacyView<Result>(
	settings: SetPropertiesSettings,
	edit: (view: LegacySetPropertiesSettings) => Result,
): Result {
	const view = legacyView(settings);
	const result = edit(view);
	applyLegacyView(settings, view);
	return result;
}
