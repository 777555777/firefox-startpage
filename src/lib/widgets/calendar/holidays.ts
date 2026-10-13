/**
 * Gesetzliche Feiertage in Deutschland, offline berechnet.
 * Bewegliche Feste hängen am Osterdatum (Gauß, anonymer gregorianischer Algorithmus).
 */

export const GERMAN_STATES = [
	'BW',
	'BY',
	'BE',
	'BB',
	'HB',
	'HH',
	'HE',
	'MV',
	'NI',
	'NW',
	'RP',
	'SL',
	'SN',
	'ST',
	'SH',
	'TH'
] as const;

export type GermanState = (typeof GERMAN_STATES)[number];

export type HolidayId =
	| 'newYear'
	| 'epiphany'
	| 'womensDay'
	| 'goodFriday'
	| 'easterSunday'
	| 'easterMonday'
	| 'labourDay'
	| 'liberationDay'
	| 'ascension'
	| 'whitSunday'
	| 'whitMonday'
	| 'corpusChristi'
	| 'assumption'
	| 'childrensDay'
	| 'germanUnity'
	| 'reformation'
	| 'allSaints'
	| 'repentance'
	| 'christmas'
	| 'boxingDay';

export type Holiday = { id: HolidayId; date: Date };

/** Ostersonntag des Jahres (lokale Zeit, Mitternacht) */
export function easterSunday(year: number): Date {
	const a = year % 19;
	const b = Math.floor(year / 100);
	const c = year % 100;
	const d = Math.floor(b / 4);
	const e = b % 4;
	const f = Math.floor((b + 8) / 25);
	const g = Math.floor((b - f + 1) / 3);
	const h = (19 * a + b - d - g + 15) % 30;
	const i = Math.floor(c / 4);
	const k = c % 4;
	const l = (32 + 2 * e + 2 * i - h - k) % 7;
	const m = Math.floor((a + 11 * h + 22 * l) / 451);
	const month = Math.floor((h + l - 7 * m + 114) / 31);
	const day = ((h + l - 7 * m + 114) % 31) + 1;
	return new Date(year, month - 1, day);
}

/** Buß- und Bettag: der letzte Mittwoch vor dem 23. November */
export function repentanceDay(year: number): Date {
	const nov22 = new Date(year, 10, 22);
	const back = (nov22.getDay() - 3 + 7) % 7;
	return new Date(year, 10, 22 - back);
}

type Rule = {
	id: HolidayId;
	/** Fester Tag (Monat 1-basiert) oder Abstand zum Ostersonntag */
	date: { month: number; day: number } | { easter: number } | 'repentance';
	/** `all` = bundesweit, sonst die Länder */
	regions: 'all' | readonly GermanState[] | ((year: number) => 'all' | readonly GermanState[]);
	/** Gültigkeit, z. B. bei neu eingeführten Feiertagen */
	years?: (year: number) => boolean;
};

const RULES: Rule[] = [
	{ id: 'newYear', date: { month: 1, day: 1 }, regions: 'all' },
	{ id: 'epiphany', date: { month: 1, day: 6 }, regions: ['BW', 'BY', 'ST'] },
	{
		id: 'womensDay',
		date: { month: 3, day: 8 },
		regions: (year) => (year >= 2023 ? ['BE', 'MV'] : ['BE']),
		years: (year) => year >= 2019
	},
	{ id: 'goodFriday', date: { easter: -2 }, regions: 'all' },
	{ id: 'easterSunday', date: { easter: 0 }, regions: ['BB'] },
	{ id: 'easterMonday', date: { easter: 1 }, regions: 'all' },
	{ id: 'labourDay', date: { month: 5, day: 1 }, regions: 'all' },
	{
		// Einmalig in Berlin: 75. und 80. Jahrestag des Kriegsendes
		id: 'liberationDay',
		date: { month: 5, day: 8 },
		regions: ['BE'],
		years: (year) => year === 2020 || year === 2025
	},
	{ id: 'ascension', date: { easter: 39 }, regions: 'all' },
	{ id: 'whitSunday', date: { easter: 49 }, regions: ['BB'] },
	{ id: 'whitMonday', date: { easter: 50 }, regions: 'all' },
	{ id: 'corpusChristi', date: { easter: 60 }, regions: ['BW', 'BY', 'HE', 'NW', 'RP', 'SL'] },
	// In Bayern nur in Gemeinden mit überwiegend katholischer Bevölkerung, hier landesweit
	{ id: 'assumption', date: { month: 8, day: 15 }, regions: ['BY', 'SL'] },
	{
		id: 'childrensDay',
		date: { month: 9, day: 20 },
		regions: ['TH'],
		years: (year) => year >= 2019
	},
	{ id: 'germanUnity', date: { month: 10, day: 3 }, regions: 'all' },
	{
		id: 'reformation',
		date: { month: 10, day: 31 },
		regions: (year) => {
			if (year === 2017) return 'all'; // 500 Jahre Reformation
			const east: GermanState[] = ['BB', 'MV', 'SN', 'ST', 'TH'];
			return year >= 2018 ? [...east, 'HB', 'HH', 'NI', 'SH'] : east;
		}
	},
	{ id: 'allSaints', date: { month: 11, day: 1 }, regions: ['BW', 'BY', 'NW', 'RP', 'SL'] },
	{ id: 'repentance', date: 'repentance', regions: ['SN'] },
	{ id: 'christmas', date: { month: 12, day: 25 }, regions: 'all' },
	{ id: 'boxingDay', date: { month: 12, day: 26 }, regions: 'all' }
];

/**
 * Alle Feiertage eines Jahres, chronologisch.
 * `region: 'none'` liefert nur die bundesweiten Feiertage.
 */
export function getHolidays(year: number, region: GermanState | 'none'): Holiday[] {
	const easter = easterSunday(year);
	const holidays: Holiday[] = [];

	for (const rule of RULES) {
		if (rule.years && !rule.years(year)) continue;
		const regions = typeof rule.regions === 'function' ? rule.regions(year) : rule.regions;
		if (regions !== 'all' && (region === 'none' || !regions.includes(region))) continue;

		let date: Date;
		if (rule.date === 'repentance') date = repentanceDay(year);
		else if ('easter' in rule.date) {
			date = new Date(year, easter.getMonth(), easter.getDate() + rule.date.easter);
		} else date = new Date(year, rule.date.month - 1, rule.date.day);

		holidays.push({ id: rule.id, date });
	}

	return holidays.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Schlüssel für Nachschlagetabellen, z. B. `2025-12-25` */
export function dateKey(date: Date): string {
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${date.getFullYear()}-${m}-${d}`;
}

/** Feiertage mehrerer Jahre als Map `YYYY-MM-DD` → Feiertag */
export function holidayMap(years: number[], region: GermanState | 'none'): Map<string, Holiday> {
	const map = new Map<string, Holiday>();
	for (const year of new Set(years)) {
		for (const holiday of getHolidays(year, region)) map.set(dateKey(holiday.date), holiday);
	}
	return map;
}
