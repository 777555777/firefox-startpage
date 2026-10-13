import { bool, oneOf, record } from '$lib/config/parse';

export type ClockSettings = {
	showSeconds: boolean;
	/** `auto` = aus der Sprache ableiten */
	hourCycle: 'auto' | '12' | '24';
	showDate: boolean;
	dateStyle: 'short' | 'long';
};

export const defaultClockSettings = (): ClockSettings => ({
	showSeconds: false,
	hourCycle: 'auto',
	showDate: true,
	dateStyle: 'long'
});

export function parseClockSettings(raw: unknown): ClockSettings {
	const d = defaultClockSettings();
	const r = record(raw);
	return {
		showSeconds: bool(r.showSeconds, d.showSeconds),
		hourCycle: oneOf(r.hourCycle, ['auto', '12', '24'], d.hourCycle),
		showDate: bool(r.showDate, d.showDate),
		dateStyle: oneOf(r.dateStyle, ['short', 'long'], d.dateStyle)
	};
}
