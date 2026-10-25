import { Notice } from "obsidian";
import type { App } from "obsidian";
import { ChoiceModal } from "../choiceModal";
import { createdNotice } from "../createNote/newNotes";
import { t } from "../i18n";
import type { JumpListVault, NewNoteVault } from "../lists/vault";
import { createFormNote } from "./create";
import { askedFields } from "./form";
import type { Form, FormField } from "./form";
import { confirmChoices, formChoices, questionChoices, questionPlaceholder, toggledChoice } from "./questions";
import type { ConfirmChoice, FormChoice, Question, QuestionChoice } from "./questions";
import { hasCreatableName, resolveForm, unansweredQuestions } from "./resolve";
import type { Answer, Answers, FormClock } from "./resolve";

export function pickForm(app: App, vault: JumpListVault & NewNoteVault, forms: readonly Form[], sourcePath: string | undefined): void {
	const runnable = forms.filter(isRunnable);
	if (!runnable.length) {
		new Notice(t("noFormsYet"));
		return;
	}
	new ChoiceModal<FormChoice>(app, t("pickAForm"), (query) => formChoices(runnable, query), {
		choose: ({ action }) => fillForm(app, vault, action.form, sourcePath),
		dismiss: () => undefined,
	}).open();
}

export function isRunnable(form: Form): boolean {
	return form.enabled && form.unreadable === undefined;
}

export function fillForm(app: App, vault: JumpListVault & NewNoteVault, form: Form, sourcePath: string | undefined): void {
	const questions = askedFields(form);
	const clock: FormClock = { now: vault.now(), moment: vault.moment, coreTemplatesOptions: vault.coreTemplatesOptions() };
	const isProperty = (field: FormField) => form.properties.includes(field);
	const question = (field: FormField): Question => ({
		field,
		vaultValues: isProperty(field) && (field.type === "text" || field.type === "number") && field.key !== "" ? vault.propertyValueCounts(field.key) : [],
		now: clock.now,
		moment: clock.moment,
	});

	const create = async (answers: Answers, back: () => void) => {
		if (unansweredQuestions(form, answers).length > 0) return back();
		const resolved = resolveForm(form, answers, clock);
		if (!hasCreatableName(resolved)) {
			new Notice(resolved.name === "" ? t("formNameEmpty") : t("nameHasUnsafeCharacters", { name: resolved.name }));
			return openConfirm(answers);
		}
		try {
			const note = await createFormNote(vault, form, resolved, sourcePath);
			new Notice(createdNotice(note.name, { outcome: "created", path: note.path, folder: note.folder }));
			if (!form.opensNote) return;
			const file = app.vault.getFileByPath(note.path);
			if (file) await app.workspace.getLeaf(false).openFile(file);
		} catch {
			new Notice(t("couldNotCreate", { name: resolved.name }));
		}
	};

	const after = (index: number, answers: Answers, editing: boolean) => {
		if (editing || index + 1 >= questions.length) openConfirm(answers);
		else openQuestion(index + 1, answers, false);
	};

	const openQuestion = (index: number, answers: Answers, editing: boolean, query = ""): void => {
		const field = questions[index];
		const answerOf = () => answers.get(field.id);
		const withAnswer = (answer: Answer) => new Map(answers).set(field.id, answer);
		const back = () => {
			if (editing) openConfirm(answers);
			else if (index > 0) openQuestion(index - 1, answers, false);
		};
		new ChoiceModal<QuestionChoice>(app, questionPlaceholder(field), (typed) => questionChoices(question(field), answerOf(), typed), {
			choose: ({ action }) => {
				if (action.action === "answer") return after(index, withAnswer(action.answer), editing);
				if (action.action === "toggle") return openQuestion(index, withAnswer(toggledChoice(answerOf(), action.value, field)), editing);
				const picked = answerOf();
				if (picked && !picked.skipped && Array.isArray(picked.value) && picked.value.length > 0) return after(index, answers, editing);
				if (field.optional) return after(index, withAnswer({ skipped: true }), editing);
				openQuestion(index, answers, editing);
			},
			dismiss: back,
			save: () => void create(answers, () => openQuestion(index, answers, editing, query)),
		}).openWithQuery(query);
	};

	const openConfirm = (answers: Answers): void => {
		const resolved = resolveForm(form, answers, clock);
		new ChoiceModal<ConfirmChoice>(app, t("checkAndCreate"), (typed) => confirmChoices(resolved, typed), {
			choose: ({ action }) => {
				if (action.action === "create") return void create(answers, () => openConfirm(answers));
				if (action.action === "edit") return openQuestion(questions.indexOf(action.field), answers, true);
				if (action.action === "stay") return openConfirm(answers);
			},
			dismiss: () => {
				if (questions.length > 0) openQuestion(questions.length - 1, answers, false);
			},
			save: () => void create(answers, () => openConfirm(answers)),
		}).open();
	};

	if (questions.length > 0) openQuestion(0, new Map(), false);
	else openConfirm(new Map());
}
