import { App, Platform, SuggestModal } from "obsidian";
import type { Instruction, Modifier } from "obsidian";
import { MARK_COLUMN_CLASS, RESULTS_CLASS, renderRow } from "./render";
import type { RowParts } from "./render";
import { ROW_ACTION_ICON, renderRowAction, selectedRow } from "./rowAction";

export interface SecondaryChoice<Choice> {
	label: string;
	offers(choice: Choice): boolean;
	open(choice: Choice, query: string): void;
}

export interface ChoiceShortcut<Choice> {
	modifiers: Modifier[];
	run(choice: Choice, query: string): void;
}

export interface ChoiceHandlers<Choice> {
	choose(choice: Choice, query: string): void;
	dismiss(): void;
	save?: () => void;
	secondary?: SecondaryChoice<Choice>;
	shortcuts?: ChoiceShortcut<Choice>[];
	instructions?: Instruction[];
}

export class ChoiceModal<Choice extends { parts: RowParts }> extends SuggestModal<Choice> {
	private readonly suggestions: (query: string) => Choice[];
	private readonly handlers: ChoiceHandlers<Choice>;
	private chosen = false;
	private readonly rowChoices = new WeakMap<HTMLElement, Choice>();

	constructor(app: App, placeholder: string, suggestions: (query: string) => Choice[], handlers: ChoiceHandlers<Choice>) {
		super(app);
		this.suggestions = suggestions;
		this.handlers = handlers;
		this.limit = Number.MAX_SAFE_INTEGER;
		this.resultContainerEl.addClass(RESULTS_CLASS, MARK_COLUMN_CLASS);
		this.setPlaceholder(placeholder);
		const { save } = handlers;
		if (save) {
			this.scope.register(["Mod"], "Enter", (evt) => {
				evt.preventDefault();
				this.chosen = true;
				this.close();
				save();
				return false;
			});
		}
		for (const shortcut of handlers.shortcuts ?? []) {
			this.scope.register(shortcut.modifiers, "Enter", (evt) => {
				if (evt.isComposing) return;
				evt.preventDefault();
				const selected = selectedRow(this.resultContainerEl);
				const choice = selected ? this.rowChoices.get(selected) : undefined;
				if (choice) this.runShortcut(shortcut, choice);
				return false;
			});
		}
		if (handlers.instructions && !Platform.isMobile) this.setInstructions(handlers.instructions);
	}

	openWithQuery(query: string): void {
		this.open();
		if (!query) return;
		this.inputEl.value = query;
		this.inputEl.dispatchEvent(new Event("input"));
	}

	getSuggestions(query: string): Choice[] {
		return this.suggestions(query);
	}

	renderSuggestion(choice: Choice, el: HTMLElement): void {
		renderRow(el, choice.parts, true);
		this.rowChoices.set(el, choice);
		const { secondary } = this.handlers;
		if (secondary?.offers(choice)) renderRowAction(el, ROW_ACTION_ICON, secondary.label, () => this.openSecondary(secondary, choice));
	}

	selectSuggestion(choice: Choice, evt: MouseEvent | KeyboardEvent): void {
		this.chosen = true;
		evt.preventDefault();
		evt.stopImmediatePropagation();
		super.selectSuggestion(choice, evt);
	}

	onChooseSuggestion(choice: Choice): void {
		this.handlers.choose(choice, this.inputEl.value);
	}

	onClose(): void {
		if (!this.chosen) this.handlers.dismiss();
	}

	private runShortcut(shortcut: ChoiceShortcut<Choice>, choice: Choice): void {
		const query = this.inputEl.value;
		this.chosen = true;
		this.close();
		shortcut.run(choice, query);
	}

	private openSecondary(secondary: SecondaryChoice<Choice>, choice: Choice): void {
		const query = this.inputEl.value;
		this.chosen = true;
		this.close();
		secondary.open(choice, query);
	}
}
