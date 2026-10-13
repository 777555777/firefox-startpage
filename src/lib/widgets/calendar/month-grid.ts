export type CalendarDay = {
	date: Date;
	/** false für die aufgefüllten Tage aus Vor- und Folgemonat */
	inMonth: boolean;
	isToday: boolean;
};

export type CalendarWeek = { week: number; days: CalendarDay[] };

/** Immer 6 Wochen, damit die Höhe beim Blättern stabil bleibt */
const WEEKS = 6;

export function isSameDay(a: Date, b: Date) {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

/** Kalenderwoche nach ISO 8601: Woche mit dem ersten Donnerstag des Jahres ist KW 1 */
export function isoWeek(date: Date): number {
	const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
	// Donnerstag derselben Woche bestimmt das Jahr
	const day = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - day);
	const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
	return Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

/**
 * Monatsansicht als 6 Wochen à 7 Tage, aufgefüllt mit Tagen aus Vor- und Folgemonat.
 * `month` ist 0-basiert und darf überlaufen (12 = Januar des Folgejahres).
 * `weekStartsOn`: 1 = Montag, 0 = Sonntag.
 */
export function getMonthGrid(
	year: number,
	month: number,
	today: Date,
	weekStartsOn: 0 | 1 = 1
): CalendarWeek[] {
	const first = new Date(year, month, 1);
	const y = first.getFullYear();
	const m = first.getMonth();
	const leadingDays = (first.getDay() - weekStartsOn + 7) % 7;

	return Array.from({ length: WEEKS }, (_, week) => {
		const days = Array.from({ length: 7 }, (_, weekday) => {
			const date = new Date(y, m, 1 - leadingDays + week * 7 + weekday);
			return { date, inMonth: date.getMonth() === m, isToday: isSameDay(date, today) };
		});
		// Bei Wochenstart Sonntag gehört die Zeile ISO-mäßig zur Woche des Montags
		return { week: isoWeek(days[weekStartsOn === 0 ? 1 : 0].date), days };
	});
}

/** Wochentagsnamen in Anzeigereihenfolge, z. B. Mo … So */
export function getWeekdayNames(locale: string, weekStartsOn: 0 | 1 = 1) {
	const short = new Intl.DateTimeFormat(locale, { weekday: 'short' });
	const long = new Intl.DateTimeFormat(locale, { weekday: 'long' });
	// 5. Januar 2025 war ein Sonntag
	return Array.from({ length: 7 }, (_, i) => {
		const date = new Date(2025, 0, 5 + weekStartsOn + i);
		return { short: short.format(date), long: long.format(date) };
	});
}
