import type { Language, LanguageSetting } from '$lib/config/types';
import { extensionApi } from '$lib/storage/extension';
import {
	languageFromTag,
	resolveLanguage,
	translate,
	type I18nKey,
	type Params
} from './translate';

export type { I18nKey, Params } from './translate';

/** Sprache des Browsers bzw. der Firefox-Oberfläche */
export function detectLanguage(): Language {
	try {
		const ui = extensionApi()?.i18n?.getUILanguage();
		if (ui) return languageFromTag(ui);
	} catch {
		// außerhalb der Extension gibt es kein browser.i18n
	}
	return languageFromTag(typeof navigator === 'undefined' ? undefined : navigator.language);
}

class I18nState {
	setting = $state<LanguageSetting>('auto');
	detected: Language = detectLanguage();
	/** Aktive Sprache; reaktiv, damit ein Wechsel sofort ohne Reload wirkt */
	readonly lang = $derived(resolveLanguage(this.setting, this.detected));
}

export const i18n = new I18nState();

/** Übersetzt in die aktive Sprache; in Templates und `$derived` reaktiv */
export function t(key: I18nKey, params?: Params): string {
	return translate(i18n.lang, key, params);
}
