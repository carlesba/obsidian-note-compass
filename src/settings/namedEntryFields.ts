import type { SettingDefinition, TextComponent } from "obsidian";

export interface NamedEntryFields {
	write: (key: string, value: unknown) => void;
	name: { key: string; label: string; desc: string; placeholder: string; value: () => string };
	placeholder: { key: string; label: string; desc: string; value: () => string; shownWhenEmpty: () => string };
}

export function nameAndPlaceholderItems({ write, name, placeholder }: NamedEntryFields): [SettingDefinition, SettingDefinition] {
	let placeholderText: TextComponent | undefined;
	return [
		{
			name: name.label,
			desc: name.desc,
			render: (setting) => {
				setting.addText((text) =>
					text
						.setPlaceholder(name.placeholder)
						.setValue(name.value())
						.onChange((typed) => {
							write(name.key, typed);
							placeholderText?.setPlaceholder(placeholder.shownWhenEmpty());
						}),
				);
			},
		},
		{
			name: placeholder.label,
			desc: placeholder.desc,
			render: (setting) => {
				let own: TextComponent | undefined;
				setting.addText((component) => {
					own = component;
					placeholderText = component;
					component
						.setPlaceholder(placeholder.shownWhenEmpty())
						.setValue(placeholder.value())
						.onChange((typed) => write(placeholder.key, typed));
				});
				return () => {
					if (placeholderText === own) placeholderText = undefined;
				};
			},
		},
	];
}
