import type { Language, LanguageSetting } from '$lib/config/types';
import { de } from './de';
import { en } from './en';

export type PluralMessage = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
export type Message = string | PluralMessage;

export type I18nKey = keyof typeof de;

/** Alle Wörterbücher haben dieselben Keys und dieselbe Form wie `de` */
export type Dictionary = {
	[K in I18nKey]: (typeof de)[K] extends string ? string : PluralMessage;
};

export type Params = Record<string, string | number>;

export const dictionaries: Record<Language, Dictionary> = { de, en };

const pluralRules = new Map<Language, Intl.PluralRules>();

function plural(lang: Language, count: number): Intl.LDMLPluralRule {
	let rules = pluralRules.get(lang);
	if (!rules) {
		rules = new Intl.PluralRules(lang);
		pluralRules.set(lang, rules);
	}
	return rules.select(count);
}

/**
 * Übersetzt einen Key. `{name}` wird durch Parameter ersetzt. Pluralformen wählen über
 * `params.count` die passende Form (`Intl.PluralRules`).
 */
export function translate(lang: Language, key: I18nKey, params?: Params): string {
	const message: Message = dictionaries[lang][key] ?? dictionaries.en[key] ?? key;
	let text: string;
	if (typeof message === 'string') text = message;
	else {
		const count = typeof params?.count === 'number' ? params.count : 0;
		text = message[plural(lang, count)] ?? message.other;
	}
	if (!params) return text;
	return text.replace(/\{(\w+)\}/g, (match, name: string) =>
		name in params ? String(params[name]) : match
	);
}

/** Ermittelt die Sprache aus einem BCP-47-Tag; alles außer Deutsch wird Englisch */
export function languageFromTag(tag: string | undefined): Language {
	return tag?.toLowerCase().startsWith('de') ? 'de' : 'en';
}

export function resolveLanguage(setting: LanguageSetting, detected: Language): Language {
	return setting === 'auto' ? detected : setting;
}
