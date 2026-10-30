import { Notice } from "obsidian";
import type { App } from "obsidian";
import { ChoiceModal } from "../choiceModal";
import { createdNotice } from "./newNotes";
import { t } from "../i18n";
import type { JumpListVault, NewNoteVault } from "../lists/vault";
import { createFormNote } from "./create";
import type { Form, FormField } from "./form";
import { confirmChoices, formChoices, questionChoices, questionPlaceholder, toggledChoice } from "./questions";
import type { ConfirmChoice, FormChoice, Question, QuestionChoice } from "./questions";
import { activeQuestions, entryClock, hasCreatableName, resolveForm, unansweredQuestions } from "./resolve";
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
	const clock: FormClock = { now: vault.now(), moment: vault.moment, coreTemplatesOptions: vault.coreTemplatesOptions() };
	const question = (field: FormField, answers: Answers): Question => ({
		field,
		vaultValues: field.saveAs === "property" && (field.type === "text" || field.type === "number") && field.key !== "" ? vault.propertyValueCounts(field.key) : [],
		now: entryClock(form, answers, clock).now,
		moment: clock.moment,
	});

	const create = async (answers: Answers, back: () => void) => {
		if (unansweredQuestions(form, answers, clock).length > 0) return back();
		const resolved = resolveForm(form, answers, clock);
		if (!hasCreatableName(resolved)) {
			new Notice(resolved.name === "" ? t("formNameEmpty") : t("nameHasUnsafeCharacters", { name: resolved.name }));
			return openConfirm(answers);
		}
		try {
			const note = await createFormNote(vault, form, resolved, sourcePath);
			new Notice(createdNotice(note.name, note.folder));
			if (!form.opensNote) return;
			const file = app.vault.getFileByPath(note.path);
			if (file) await app.workspace.getLeaf(false).openFile(file);
		} catch {
			new Notice(t("couldNotCreate", { name: resolved.name }));
		}
	};

	const questionsFor = (answers: Answers) => activeQuestions(form, answers, clock);

	const after = (field: FormField, answers: Answers, editing: boolean) => {
		const questions = questionsFor(answers);
		const next = editing ? unansweredQuestions(form, answers, clock)[0] : questions[questions.indexOf(field) + 1];
		if (next) openQuestion(next, answers, editing);
		else openConfirm(answers);
	};

	const openQuestion = (field: FormField, answers: Answers, editing: boolean, query = ""): void => {
		const answerOf = () => answers.get(field.id);
		const withAnswer = (answer: Answer) => new Map(answers).set(field.id, answer);
		const back = () => {
			if (editing) return openConfirm(answers);
			const questions = questionsFor(answers);
			const previous = questions[questions.indexOf(field) - 1];
			if (previous) openQuestion(previous, answers, false);
		};
		new ChoiceModal<QuestionChoice>(app, questionPlaceholder(field, entryClock(form, answers, clock).now, clock.moment), (typed) => questionChoices(question(field, answers), answerOf(), typed), {
			choose: ({ action }) => {
				if (action.action === "answer") return after(field, withAnswer(action.answer), editing);
				if (action.action === "toggle") return openQuestion(field, withAnswer(toggledChoice(answerOf(), action.value, field)), editing);
				const picked = answerOf();
				if (picked && !picked.skipped && Array.isArray(picked.value) && picked.value.length > 0) return after(field, answers, editing);
				if (field.optional) return after(field, withAnswer({ skipped: true }), editing);
				openQuestion(field, answers, editing);
			},
			dismiss: back,
			save: () => void create(answers, () => openQuestion(field, answers, editing, query)),
		}).openWithQuery(query);
	};

	const openConfirm = (answers: Answers): void => {
		const resolved = resolveForm(form, answers, clock);
		new ChoiceModal<ConfirmChoice>(app, t("checkAndCreate"), (typed) => confirmChoices(resolved, typed), {
			choose: ({ action }) => {
				if (action.action === "create") return void create(answers, () => openConfirm(answers));
				if (action.action === "edit") return openQuestion(action.field, answers, true);
				if (action.action === "stay") return openConfirm(answers);
			},
			dismiss: () => {
				const questions = questionsFor(answers);
				if (questions.length > 0) openQuestion(questions[questions.length - 1], answers, false);
			},
			save: () => void create(answers, () => openConfirm(answers)),
		}).open();
	};

	const first = questionsFor(new Map())[0];
	if (first) openQuestion(first, new Map(), false);
	else openConfirm(new Map());
}
