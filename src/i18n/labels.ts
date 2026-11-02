import { t } from "./index.ts";
import type { TranslationKey } from "./index.ts";

const OPERATOR_KEYS: Record<string, TranslationKey> = {
	"is true": "operatorIsTrue",
	"is false": "operatorIsFalse",
	is: "operatorIs",
	"is not": "operatorIsNot",
	"is exactly": "operatorIsExactly",
	"is not exactly": "operatorIsNotExactly",
	on: "operatorOn",
	"not on": "operatorNotOn",
	before: "operatorBefore",
	"on or before": "operatorOnOrBefore",
	after: "operatorAfter",
	"on or after": "operatorOnOrAfter",
	"starts with": "operatorStartsWith",
	"does not start with": "operatorDoesNotStartWith",
	"ends with": "operatorEndsWith",
	"does not end with": "operatorDoesNotEndWith",
	"is empty": "operatorIsEmpty",
	"is not empty": "operatorIsNotEmpty",
	contains: "operatorContains",
	"does not contain": "operatorDoesNotContain",
	"contains any of": "operatorContainsAnyOf",
	"does not contain any of": "operatorDoesNotContainAnyOf",
	"contains all of": "operatorContainsAllOf",
	"does not contain all of": "operatorDoesNotContainAllOf",
	"links to": "operatorLinksTo",
	"does not link to": "operatorDoesNotLinkTo",
	"in folder": "operatorInFolder",
	"is not in folder": "operatorIsNotInFolder",
	"has tag": "operatorHasTag",
	"does not have tag": "operatorDoesNotHaveTag",
	"has property": "operatorHasProperty",
	"does not have property": "operatorDoesNotHaveProperty",
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

export function operatorLabel(operator: string): string {
	const key = Object.prototype.hasOwnProperty.call(OPERATOR_KEYS, operator) ? OPERATOR_KEYS[operator] : undefined;
	return key === undefined ? operator : t(key);
}

export function typeLabel(type: string): string {
	const key = Object.prototype.hasOwnProperty.call(TYPE_KEYS, type) ? TYPE_KEYS[type] : undefined;
	return key === undefined ? type : t(key);
}
