import { bool, oneOf, record } from '$lib/config/parse';
import { GERMAN_STATES, type GermanState } from './holidays';

export type CalendarSettings = {
	weekStart: 'monday' | 'sunday';
	weekNumbers: boolean;
	holidays: boolean;
	/** Bundesland für Landesfeiertage; `none` = nur bundesweite Feiertage */
	region: GermanState | 'none';
};

export const defaultCalendarSettings = (): CalendarSettings => ({
	weekStart: 'monday',
	weekNumbers: true,
	holidays: true,
	region: 'none'
});

export function parseCalendarSettings(raw: unknown): CalendarSettings {
	const d = defaultCalendarSettings();
	const r = record(raw);
	return {
		weekStart: oneOf(r.weekStart, ['monday', 'sunday'], d.weekStart),
		weekNumbers: bool(r.weekNumbers, d.weekNumbers),
		holidays: bool(r.holidays, d.holidays),
		region: oneOf(r.region, [...GERMAN_STATES, 'none'], d.region)
	};
}
