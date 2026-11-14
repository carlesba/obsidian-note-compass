import type { NotePicker } from "../settings.ts";

export interface MentionSettings {
	enabled: boolean;
	trigger: string;
	pickerId: string;
}

export const DEFAULT_MENTION_TRIGGER = "@";

export function readMention(stored: unknown, pickers: readonly NotePicker[]): MentionSettings {
	const data = typeof stored === "object" && stored !== null ? (stored as Record<string, unknown>) : {};
	return {
		enabled: data.enabled === true,
		trigger: typeof data.trigger === "string" ? withoutWhitespace(data.trigger) : DEFAULT_MENTION_TRIGGER,
		pickerId: typeof data.pickerId === "string" ? data.pickerId : (pickers[0]?.id ?? ""),
	};
}

export function withoutWhitespace(trigger: string): string {
	return trigger.replace(/\s/g, "");
}

export function mentionPicker(mention: MentionSettings, pickers: readonly NotePicker[]): NotePicker | undefined {
	if (!mention.enabled || !mention.trigger) return undefined;
	return pickers.find((picker) => picker.id === mention.pickerId && !picker.unreadable);
}
