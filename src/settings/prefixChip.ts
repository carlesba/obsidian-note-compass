import { t } from "../i18n/index.ts";

export interface PrefixChip {
	text: string;
	placeholder: boolean;
}

export function prefixChip(prefix: string): PrefixChip {
	const shown = prefix.trim();
	return shown === "" ? { text: t("prefixPlaceholder"), placeholder: true } : { text: shown, placeholder: false };
}
