import { describe, expect, it } from 'vitest';
import { de } from './de';
import { en } from './en';
import { languageFromTag, resolveLanguage, translate } from './translate';

describe('translate', () => {
	it('übersetzt in beide Sprachen', () => {
		expect(translate('de', 'common.save')).toBe('Speichern');
		expect(translate('en', 'common.save')).toBe('Save');
	});

	it('setzt Parameter ein und lässt unbekannte Platzhalter stehen', () => {
		expect(translate('de', 'edit.remove', { name: 'Uhr' })).toBe('Uhr entfernen');
		expect(translate('en', 'edit.remove')).toBe('Remove {name}');
	});

	it('wählt die Pluralform über Intl.PluralRules', () => {
		expect(translate('de', 'links.openCount', { count: 1 })).toBe('Einmal geöffnet');
		expect(translate('de', 'links.openCount', { count: 5 })).toBe('5× geöffnet');
		expect(translate('en', 'links.openCount', { count: 1 })).toBe('Opened once');
		expect(translate('en', 'links.openCount', { count: 0 })).toBe('Opened 0×');
	});

	it('hat in allen Sprachen dieselben Keys und Formen', () => {
		expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
		for (const key of Object.keys(de) as (keyof typeof de)[]) {
			expect(typeof en[key], key).toBe(typeof de[key]);
		}
	});
});

describe('Sprachwahl', () => {
	it('erkennt Deutsch, alles andere wird Englisch', () => {
		expect(languageFromTag('de-AT')).toBe('de');
		expect(languageFromTag('DE')).toBe('de');
		expect(languageFromTag('fr-FR')).toBe('en');
		expect(languageFromTag(undefined)).toBe('en');
	});

	it('löst auto über die erkannte Sprache auf', () => {
		expect(resolveLanguage('auto', 'de')).toBe('de');
		expect(resolveLanguage('en', 'de')).toBe('en');
	});
});
