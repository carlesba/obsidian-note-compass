import { BULLET_SYMBOL, isThemeDrawn, usableStatuses } from "./taskStatuses.ts";
import type { StatusColor, TaskStatus, TaskStatusSettings, TaskStatusType } from "./taskStatuses.ts";

const HALF_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="5" height="10"/></svg>';

const DASH_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="2" y="4" width="6" height="2" rx="1"/></svg>';

const COLOR_VALUES: Readonly<Record<StatusColor, string>> = {
	"": "var(--checkbox-color)",
	accent: "var(--color-accent)",
	grey: "var(--text-muted)",
	red: "var(--color-red)",
	orange: "var(--color-orange)",
	yellow: "var(--color-yellow)",
	green: "var(--color-green)",
	cyan: "var(--color-cyan)",
	blue: "var(--color-blue)",
	purple: "var(--color-purple)",
	pink: "var(--color-pink)",
};

export function statusColorValue(color: StatusColor): string {
	return COLOR_VALUES[color];
}

const TYPE_PREVIEWS: Readonly<Record<Exclude<TaskStatusType, "other">, string>> = {
	todo: "square",
	inProgress: "square-split-horizontal",
	done: "square-check",
	cancelled: "square-minus",
};

export function statusPreviewIcon(status: TaskStatus): string {
	return status.type === "other" ? status.icon : TYPE_PREVIEWS[status.type];
}

function cssString(value: string): string {
	return `"${value.replace(/["\\]/g, "\\$&")}"`;
}

function lineSelectors(symbol: string): string {
	const value = cssString(symbol);
	return [`body .markdown-source-view.mod-cm6 .HyperMD-task-line[data-task=${value}]`, `body ul > li.task-list-item[data-task=${value}]`].join(",\n");
}

function selectors(symbol: string, pseudo = ""): string {
	const value = cssString(symbol);
	return [
		`body input.task-list-item-checkbox[data-task=${value}]${pseudo}`,
		`body li[data-task=${value}] > input.task-list-item-checkbox${pseudo}`,
		`body li[data-task=${value}] > p > input.task-list-item-checkbox${pseudo}`,
	].join(",\n");
}

function maskUrl(svg: string): string {
	return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function rule(selector: string, declarations: Record<string, string>): string {
	const body = Object.entries(declarations)
		.map(([property, value]) => `\t${property}: ${value} !important;`)
		.join("\n");
	return `${selector} {\n${body}\n}`;
}

function maskDeclarations(color: string, svg: string, size: string): Record<string, string> {
	const url = maskUrl(svg);
	return {
		content: '""',
		display: "block",
		position: "absolute",
		top: "-1px",
		"inset-inline-start": "-1px",
		width: "var(--checkbox-size)",
		height: "var(--checkbox-size)",
		"background-color": color,
		"-webkit-mask-image": url,
		"mask-image": url,
		"-webkit-mask-size": size,
		"mask-size": size,
		"-webkit-mask-position": "center",
		"mask-position": "center",
		"-webkit-mask-repeat": "no-repeat",
		"mask-repeat": "no-repeat",
	};
}

export function maskSvg(svg: string): string {
	const withNamespace = /xmlns=/.test(svg) ? svg : svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
	return withNamespace.replace(/currentColor/g, "black");
}

function statusRules(status: TaskStatus, iconSvg: (icon: string) => string | undefined): string[] {
	const color = statusColorValue(status.color);
	const box = (border: string) =>
		rule(selectors(status.symbol), { appearance: "none", "-webkit-appearance": "none", position: "relative", "background-color": "transparent", "border-color": border });
	const drawing = (svg: string) => rule(selectors(status.symbol, "::after"), maskDeclarations(color, svg, "100%"));
	switch (status.type) {
		case "todo":
		case "done":
			return [];
		case "inProgress":
			return [box(color), drawing(HALF_SVG)];
		case "cancelled":
			return [
				box(color),
				drawing(DASH_SVG),
				rule(lineSelectors(status.symbol), { "text-decoration": "var(--checklist-done-decoration)", color: "var(--checklist-done-color)" }),
			];
		case "other": {
			const svg = status.icon === "" ? undefined : iconSvg(status.icon);
			return svg ? [box("transparent"), drawing(maskSvg(svg))] : [];
		}
	}
}

export function statusIconCss(settings: TaskStatusSettings, iconSvg: (icon: string) => string | undefined): string {
	if (!settings.drawIcons) return "";
	return usableStatuses(settings.statuses)
		.filter((status) => status.symbol !== BULLET_SYMBOL && !isThemeDrawn(status))
		.flatMap((status) => statusRules(status, iconSvg))
		.join("\n\n");
}
