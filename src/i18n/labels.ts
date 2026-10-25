import type { ConditionOperator } from "../lists/conditions.ts";
import { t } from "./index.ts";
import type { TranslationKey } from "./index.ts";

const OPERATOR_KEYS: Partial<Record<ConditionOperator, TranslationKey>> = {
	"is true": "operatorIsTrue",
	"is false": "operatorIsFalse",
	"is set": "operatorIsSet",
	"is not set": "operatorIsNotSet",
	is: "operatorIs",
	"is not": "operatorIsNot",
	contains: "operatorContains",
	"does not contain": "operatorDoesNotContain",
	"has item": "operatorHasItem",
	"does not have item": "operatorDoesNotHaveItem",
	on: "operatorOn",
	"not on": "operatorNotOn",
	before: "operatorBefore",
	after: "operatorAfter",
};

const TYPE_KEYS: Record<string, TranslationKey> = {
	text: "typeText",
	multitext: "typeMultitext",
	tags: "typeTags",
	aliases: "typeAliases",
	number: "typeNumber",
	checkbox: "typeCheckbox",
	date: "typeDate",
	datetime: "typeDatetime",
	link: "typeLink",
	links: "typeLinks",
};

export function operatorLabel(operator: ConditionOperator): string {
	const key = OPERATOR_KEYS[operator];
	return key === undefined ? operator : t(key);
}

export function typeLabel(type: string): string {
	const key = Object.prototype.hasOwnProperty.call(TYPE_KEYS, type) ? TYPE_KEYS[type] : undefined;
	return key === undefined ? type : t(key);
}
