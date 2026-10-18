import { bool, oneOf, record } from '$lib/config/parse';

export type ClockSettings = {
	showSeconds: boolean;
	/** `auto` = aus der Sprache ableiten */
	hourCycle: 'auto' | '12' | '24';
	showDate: boolean;
	dateStyle: 'short' | 'long';
	/** Sonnenbogen mit Auf- und Untergang und Tageslänge, lokal berechnet aus den Koordinaten */
	showSun: boolean;
	/** Mondphase, Mondauf- und -untergang; mit `showSun` zusammen nachts statt der Sonne */
	showMoon: boolean;
	/** Dezimalgrad, Nord positiv; `null` = nicht eingetragen */
	latitude: number | null;
	/** Dezimalgrad, Ost positiv; `null` = nicht eingetragen */
	longitude: number | null;
};

/** Koordinate im Bereich ±max oder `null`, wenn sie fehlt oder ungültig ist */
const coordinate = (value: unknown, max: number): number | null =>
	typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= max ? value : null;

export const defaultClockSettings = (): ClockSettings => ({
	showSeconds: false,
	hourCycle: 'auto',
	showDate: true,
	dateStyle: 'long',
	showSun: false,
	showMoon: false,
	latitude: null,
	longitude: null
});

export function parseClockSettings(raw: unknown): ClockSettings {
	const d = defaultClockSettings();
	const r = record(raw);
	return {
		showSeconds: bool(r.showSeconds, d.showSeconds),
		hourCycle: oneOf(r.hourCycle, ['auto', '12', '24'], d.hourCycle),
		showDate: bool(r.showDate, d.showDate),
		dateStyle: oneOf(r.dateStyle, ['short', 'long'], d.dateStyle),
		showSun: bool(r.showSun, d.showSun),
		showMoon: bool(r.showMoon, d.showMoon),
		latitude: coordinate(r.latitude, 90),
		longitude: coordinate(r.longitude, 180)
	};
}
