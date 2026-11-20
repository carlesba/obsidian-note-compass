import type { Setting, SettingDefinitionItem, SettingDefinitionPage, TextComponent } from "obsidian";
import { t } from "../i18n";
import { TASK_STATUS_TYPES, isColor, isSymbol, isThemeDrawn, newTaskStatus, taskStatusLabel, taskStatusName, taskStatusWarning } from "../tasks/taskStatuses";
import type { TaskStatus, TaskStatusSettings, TaskStatusType } from "../tasks/taskStatuses";
import { statusPreviewIcon } from "../tasks/statusIcons";
import type { TranslationKey } from "../i18n";
import { CYCLE_ON_CLICK_KEY, DRAW_STATUS_ICONS_KEY, taskStatusKey } from "./controlKeys";
import { IconPickerModal, iconName, renderIconPreview } from "./iconPicker";
import { editableRow } from "./listPage";
import type { ListPageContext } from "./listPage";

const SORTABLE_LIST_CLASS = "note-compass-sortable-list";

const NEUTRAL_COLOR = "#888888";

type IdentifiedPage = SettingDefinitionPage & { id: string };

export function taskStatusPageId(status: TaskStatus): string {
	return `task-status-${status.id}`;
}

export function taskStatusItems(settings: TaskStatusSettings, context: ListPageContext): SettingDefinitionItem[] {
	const { statuses } = settings;
	return [
		{
			type: "list",
			heading: t("statusesHeading"),
			cls: SORTABLE_LIST_CLASS,
			emptyState: t("noTaskStatuses"),
			items: statuses.map((status) => {
				const row = editableRow(
					{
						name: taskStatusName(status),
						label: taskStatusLabel(status),
						warning: taskStatusWarning(statuses, status),
						desc: status.inCycle ? t("statusInCycle") : undefined,
						broken: false,
						pageId: taskStatusPageId(status),
						editTooltip: t("editTaskStatus"),
					},
					{ ...context, showPrefixes: false },
				);
				return {
					...row,
					searchable: false,
					render: (setting: Setting, group: unknown) => {
						const rendered = row.render(setting, group as never);
						renderIconPreview(setting.nameEl.createSpan(), statusPreviewIcon(status), status.color);
						setting.nameEl.prepend(setting.nameEl.lastChild as Node);
						return rendered;
					},
				};
			}),
			onReorder: (from, to) => context.change(() => statuses.splice(to, 0, ...statuses.splice(from, 1))),
			onDelete: (index) => context.change(() => statuses.splice(index, 1)),
			addItem: {
				name: t("addTaskStatus"),
				action: () => {
					const status = newTaskStatus(statuses);
					context.change(() => statuses.push(status));
					context.openPage(taskStatusPageId(status));
				},
			},
		},
		{
			type: "group",
			items: [
				{ name: t("cycleOnClick"), desc: t("cycleOnClickDesc"), control: { type: "toggle", key: CYCLE_ON_CLICK_KEY } },
				{ name: t("drawStatusIcons"), desc: t("drawStatusIconsDesc"), control: { type: "toggle", key: DRAW_STATUS_ICONS_KEY } },
			],
		},
		{ type: "group", visible: false, items: statuses.map((status) => taskStatusPage(status, statuses, context)) },
	];
}

function taskStatusPage(status: TaskStatus, statuses: readonly TaskStatus[], context: ListPageContext): SettingDefinitionPage {
	const page: IdentifiedPage = {
		type: "page",
		id: taskStatusPageId(status),
		get name() {
			return taskStatusName(status);
		},
		status: () => (taskStatusWarning(statuses, status) ? "warning" : null),
		items: [
			{
				type: "group",
				items: [
					{
						name: t("statusSymbol"),
						desc: t("statusSymbolDesc"),
						control: {
							type: "text",
							key: taskStatusKey(status.id, "symbol"),
							placeholder: t("statusBullet"),
							validate: (value: string) => (isSymbol([...value].slice(-1).join("")) ? taskStatusWarning(statuses, status) : t("statusSymbolInvalid")),
						},
					},
					{ name: t("statusName"), desc: t("statusNameDesc"), control: { type: "text", key: taskStatusKey(status.id, "name") } },
					{ name: t("statusInCycle"), desc: t("statusInCycleDesc"), control: { type: "toggle", key: taskStatusKey(status.id, "inCycle") } },
				],
			},
			{
				type: "group",
				heading: t("statusLook"),
				items: [
					{ name: t("statusType"), desc: t("statusTypeDesc"), control: { type: "dropdown", key: taskStatusKey(status.id, "type"), options: typeOptions() } },
					{
						name: t("statusIcon"),
						desc: t("statusIconDesc"),
						visible: () => status.type === "other",
						render: (setting: Setting) => iconSetting(setting, status, context),
					},
					{
						name: t("statusColour"),
						desc: t("statusColourDesc"),
						visible: () => !isThemeDrawn(status),
						render: (setting: Setting) => colourSetting(setting, status, context),
					},
				],
			},
		],
	};
	return page;
}

const TYPE_KEYS: Record<TaskStatusType, TranslationKey> = {
	todo: "statusTypeTodo",
	inProgress: "statusTypeInProgress",
	done: "statusTypeDone",
	cancelled: "statusTypeCancelled",
	other: "statusTypeOther",
};

function typeOptions(): Record<string, string> {
	return Object.fromEntries(TASK_STATUS_TYPES.map((type) => [type, t(TYPE_KEYS[type])]));
}

function iconSetting(setting: Setting, status: TaskStatus, context: ListPageContext): void {
	const previewEl = setting.controlEl.createSpan();
	const nameEl = setting.controlEl.createSpan({ cls: "note-compass-status-icon-name" });
	const show = () => {
		renderIconPreview(previewEl, status.icon, status.color);
		nameEl.setText(iconName(status.icon));
	};
	show();
	setting.addButton((button) =>
		button.setButtonText(t("chooseIcon")).onClick(() => {
			new IconPickerModal(context.app, status.color, (icon) => {
				context.write(taskStatusKey(status.id, "icon"), icon);
				show();
			}).open();
		}),
	);
}

function colourSetting(setting: Setting, status: TaskStatus, context: ListPageContext): void {
	const write = (color: string) => context.write(taskStatusKey(status.id, "color"), color);
	let hexInput: TextComponent | undefined;
	setting.addColorPicker((picker) => {
		picker.setValue(status.color || NEUTRAL_COLOR).onChange((color) => {
			write(color);
			hexInput?.setValue(color);
		});
		setting.addText((text) => {
			hexInput = text;
			text.setPlaceholder(t("statusColourPlaceholder")).setValue(status.color);
			text.inputEl.addClass("note-compass-status-hex");
			text.inputEl.setAttribute("aria-label", t("statusColour"));
			text.onChange((typed) => {
				const color = typed.trim();
				const valid = color === "" || isColor(color);
				text.inputEl.toggleClass("is-invalid", !valid);
				text.inputEl.setAttribute("aria-invalid", String(!valid));
				if (!valid) return;
				write(color);
				if (color !== "") picker.setValue(color);
			});
		});
		setting.addExtraButton((button) =>
			button
				.setIcon("rotate-ccw")
				.setTooltip(t("removeColour"))
				.onClick(() => {
					write("");
					hexInput?.setValue("");
					picker.setValue(NEUTRAL_COLOR);
				}),
		);
	});
}
