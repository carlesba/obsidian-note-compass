import { Notice, Platform } from "obsidian";
import type { App, Instruction, Modifier } from "obsidian";
import { ChoiceModal } from "../choiceModal";
import { createObsidianVault } from "../lists/obsidianVault";
import { t, tCount } from "../i18n";
import { resolveDateNotes } from "../lists/dateNotes";
import type { JumpListVault, NoteBodyVault, VaultNote } from "../lists/vault";
import type { JumpSettings } from "../settings";
import { applyCopyAction, applyStatusAction, applyStagedChanges, cancelBatch, finishBatch, prepareChanges, remainingTasks, shouldFinishBatch, stageChanges } from "./apply";
import type { ApplyContext, ApplyResult, TaskBatch } from "./apply";
import { actionDestinations } from "./destinations";
import type { ResolvedDestination } from "./destinations";
import { actionChoices, choiceTargets, destinationChoices, keyInstructions, planAction, taskChoices } from "./picker";
import type { ActionChoice, DestinationChoice, TaskChoice } from "./picker";
import { keyBehavior } from "./taskCommand";
import type { TaskAction, TaskCommand, TaskKey } from "./taskCommand";
import type { TaskLine } from "./taskLines";

const MODIFIED_KEYS: readonly [Modifier[], TaskKey][] = [
	[["Mod"], "mod-enter"],
	[["Alt"], "alt-enter"],
	[["Shift"], "shift-enter"],
];

export function runTaskCommand(
	app: App,
	vault: JumpListVault & NoteBodyVault,
	settings: JumpSettings,
	command: TaskCommand,
	source: VaultNote,
): void {
	const lineNumbers = vault.taskLineNumbers(source.path);
	const dateNotes = resolveDateNotes(settings.dateNotes, vault);
	let batch: TaskBatch = { remaining: [], changes: [] };
	if (command.actions.length === 0) return;
	const today = () => vault.moment(vault.now()).startOf("day");
	const applyContext = (): ApplyContext => ({ vault, source, today: today(), dateNotes, now: vault.moment(vault.now()), templatesOptions: createObsidianVault(app).coreTemplatesOptions() });
	const load = () => remainingTasks(vault, source, lineNumbers, command);

	const instructions: Instruction[] = [
		...keyInstructions(command, Platform.isMacOS),
		{ command: "esc", purpose: command.batch ? t("instructionCancelProcessing") : t("instructionDismiss") },
	];

	const finish = async (applying: Promise<ApplyResult>) => {
		try {
			const result = await applying;
			if (result.skipped > 0) new Notice(tCount("taskChangedOne", "taskChangedOther", result.skipped));
		} catch {
			new Notice(t("couldNotProcessTasks"));
			return;
		}
	};

	const applyBatch = () => void finish(applyStagedChanges(applyContext(), finishBatch(batch)));
	const cancel = () => {
		batch = cancelBatch(batch);
		new Notice(t("noTaskChangesMade"));
	};
	const stage = (action: TaskAction, targets: TaskLine[], destination?: ResolvedDestination, selectedAll = false) => {
		batch = stageChanges(batch, prepareChanges(applyContext(), action, targets, destination));
		if (shouldFinishBatch(batch, selectedAll)) applyBatch();
		else openTasks(batch.remaining, "");
	};

	const runAction = (action: TaskAction, targets: TaskLine[], back: () => void, selectedAll = false) => {
		if (targets.length === 0) return back();
		if (action.kind === "status") return command.batch ? stage(action, targets, undefined, selectedAll) : void finish(applyStatusAction(applyContext(), action, targets));
		const { destinations, missingNotes } = actionDestinations(action, source.path, { vault, dateNotes, today: today() });
		for (const note of missingNotes) new Notice(t("taskDestinationSkipped", { note }));
		const plan = planAction(action, destinations);
		if (plan.plan === "none") {
			new Notice(t("noTaskDestinations"));
			return back();
		}
		const copyTo = (destination: ResolvedDestination) => command.batch ? stage(action, targets, destination, selectedAll) : void finish(applyCopyAction(applyContext(), action, targets, destination));
		if (plan.plan === "pick") return openDestinations(plan.destinations, copyTo, back);
		if (plan.destination) copyTo(plan.destination);
	};

	const openTasks = (tasks: TaskLine[], query: string): void => {
		const back = (typed: string) => () => openTasks(tasks, typed);
		const press = (key: TaskKey) => ({ action }: TaskChoice, typed: string) => {
			if (action.action === "finish") return applyBatch();
			if (action.action === "cancel") return cancel();
			const behavior = keyBehavior(command, key);
			if (behavior.behavior === "finish") return applyBatch();
			if (behavior.behavior === "run") runAction(behavior.action, choiceTargets(action), back(typed), action.action === "all");
			else openActions(choiceTargets(action), back(typed), action.action === "all");
		};
		new ChoiceModal<TaskChoice>(app, t("pickATask"), (typed) => taskChoices(command, tasks, typed, batch.changes.length), {
			choose: press("enter"),
			shortcuts: MODIFIED_KEYS.map(([modifiers, key]) => ({ modifiers, run: press(key) })),
			dismiss: () => { if (command.batch) cancel(); },
			secondary:
				command.actions.length > 0
					? {
							label: t("moreTaskActions"),
							offers: (choice) => choice.action.action === "task" || choice.action.action === "all",
							open: (choice, typed) => openActions(choiceTargets(choice.action), back(typed), choice.action.action === "all"),
						}
					: undefined,
			instructions,
		}).openWithQuery(query);
	};

	const openActions = (targets: TaskLine[], back: () => void, selectedAll = false): void => {
		new ChoiceModal<ActionChoice>(app, t("pickATaskAction"), (typed) => actionChoices(command.actions, typed), {
			choose: ({ action }) => runAction(action, targets, () => openActions(targets, back, selectedAll), selectedAll),
			dismiss: back,
		}).open();
	};

	const openDestinations = (destinations: ResolvedDestination[], chosen: (destination: ResolvedDestination) => void, back: () => void): void => {
		new ChoiceModal<DestinationChoice>(app, t("pickADestination"), (typed) => destinationChoices(destinations, typed), {
			choose: ({ destination }) => chosen(destination),
			dismiss: back,
		}).open();
	};

	load().then(
		(tasks) => {
			if (tasks.length === 0) new Notice(t("noTasksToProcess"));
			else {
				batch = { remaining: tasks, changes: [] };
				openTasks(tasks, "");
			}
		},
		() => new Notice(t("couldNotProcessTasks")),
	);
}
