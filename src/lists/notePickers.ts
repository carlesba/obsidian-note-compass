import { matchesInOrder, rowLabel } from "../render.ts";
import type { RowParts } from "../render";
import { notePickerName } from "../settings.ts";
import type { NotePicker } from "../settings.ts";

export interface NotePickerChoice {
	label: string;
	parts: RowParts;
	picker: NotePicker;
}

export function notePickerChoices(pickers: readonly NotePicker[], query: string): NotePickerChoice[] {
	const choices = pickers.map((picker) => {
		const parts: RowParts = { content: notePickerName(picker) };
		return { label: rowLabel(parts), parts, picker };
	});
	return query ? choices.filter((choice) => matchesInOrder(query, choice.label)) : choices;
}
