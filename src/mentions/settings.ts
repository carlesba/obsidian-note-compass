import { t } from "../i18n/index.ts";
import type { NotePicker } from "../settings.ts";

export interface Mention {
	id: string;
	trigger: string;
	pickerId: string;
}

export interface ActiveMention extends Mention {
	picker: NotePicker;
}

export const DEFAULT_MENTION_TRIGGER = "@";

export function readMentions(stored: Record<string, unknown>, pickers: readonly NotePicker[]): Mention[] {
	if (Array.isArray(stored.mentions)) return stored.mentions.flatMap((entry, index) => readMention(entry, index, pickers));
	const legacy = isRecord(stored.mention) ? stored.mention : undefined;
	if (legacy?.enabled !== true) return [];
	return readMention({ ...legacy, id: "1" }, 0, pickers);
}

function readMention(stored: unknown, index: number, pickers: readonly NotePicker[]): Mention[] {
	if (!isRecord(stored)) return [];
	return [
		{
			id: typeof stored.id === "string" && stored.id ? stored.id : String(index + 1),
			trigger: typeof stored.trigger === "string" ? withoutWhitespace(stored.trigger) : DEFAULT_MENTION_TRIGGER,
			pickerId: typeof stored.pickerId === "string" ? stored.pickerId : (pickers[0]?.id ?? ""),
		},
	];
}

export function newMention(mentions: readonly Mention[], pickers: readonly NotePicker[]): Mention {
	const highest = Math.max(0, ...mentions.map((mention) => Number(mention.id) || 0));
	let trigger = DEFAULT_MENTION_TRIGGER;
	while (mentions.some((mention) => mention.trigger === trigger)) trigger += DEFAULT_MENTION_TRIGGER;
	return {
		id: String(highest + 1),
		trigger,
		pickerId: pickers.find((picker) => !picker.unreadable)?.id ?? "",
	};
}

export function isTriggerTaken(trigger: string, mention: Mention, mentions: readonly Mention[]): boolean {
	const typed = withoutWhitespace(trigger);
	return typed !== "" && mentions.some((candidate) => candidate !== mention && candidate.trigger === typed);
}

export function withoutWhitespace(trigger: string): string {
	return trigger.replace(/\s/g, "");
}

export function mentionPicker(mention: Mention, pickers: readonly NotePicker[]): NotePicker | undefined {
	if (!mention.trigger) return undefined;
	return pickers.find((picker) => picker.id === mention.pickerId && !picker.unreadable);
}

function isShadowed(mention: Mention, mentions: readonly Mention[]): boolean {
	const first = mentions.find((candidate) => candidate.trigger === mention.trigger);
	return first !== undefined && first !== mention;
}

export function activeMentions(mentions: readonly Mention[], pickers: readonly NotePicker[]): ActiveMention[] {
	return mentions.flatMap((mention) => {
		const picker = isShadowed(mention, mentions) ? undefined : mentionPicker(mention, pickers);
		return picker ? [{ ...mention, picker }] : [];
	});
}

export function mentionWarning(mention: Mention, mentions: readonly Mention[], pickers: readonly NotePicker[]): string | undefined {
	if (!mention.trigger) return t("mentionTriggerEmpty");
	if (isShadowed(mention, mentions)) return t("mentionTriggerTaken");
	return mentionPicker(mention, pickers) ? undefined : t("mentionPickerOff");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
