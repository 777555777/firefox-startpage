import { describe, expect, it } from 'vitest';
import { dateKey, easterSunday, getHolidays, holidayMap, repentanceDay } from './holidays';

const keys = (year: number, region: Parameters<typeof getHolidays>[1]) =>
	getHolidays(year, region).map((h) => `${dateKey(h.date)} ${h.id}`);

describe('Osterdatum', () => {
	it.each([
		[2000, '2000-04-23'],
		[2008, '2008-03-23'],
		[2011, '2011-04-24'],
		[2019, '2019-04-21'],
		[2024, '2024-03-31'],
		[2025, '2025-04-20'],
		[2026, '2026-04-05'],
		[2027, '2027-03-28'],
		[2038, '2038-04-25']
	])('%i → %s', (year, expected) => {
		expect(dateKey(easterSunday(year))).toBe(expected);
	});
});

describe('Buß- und Bettag', () => {
	it.each([
		[2023, '2023-11-22'],
		[2024, '2024-11-20'],
		[2025, '2025-11-19'],
		[2026, '2026-11-18'],
		[2027, '2027-11-17']
	])('%i → %s', (year, expected) => {
		expect(dateKey(repentanceDay(year))).toBe(expected);
	});
});

describe('Feiertage', () => {
	it('kennt die bundesweiten Feiertage 2025', () => {
		expect(keys(2025, 'none')).toEqual([
			'2025-01-01 newYear',
			'2025-04-18 goodFriday',
			'2025-04-21 easterMonday',
			'2025-05-01 labourDay',
			'2025-05-29 ascension',
			'2025-06-09 whitMonday',
			'2025-10-03 germanUnity',
			'2025-12-25 christmas',
			'2025-12-26 boxingDay'
		]);
	});

	it('kennt Bayern 2025 (inkl. Mariä Himmelfahrt landesweit)', () => {
		expect(keys(2025, 'BY')).toEqual([
			'2025-01-01 newYear',
			'2025-01-06 epiphany',
			'2025-04-18 goodFriday',
			'2025-04-21 easterMonday',
			'2025-05-01 labourDay',
			'2025-05-29 ascension',
			'2025-06-09 whitMonday',
			'2025-06-19 corpusChristi',
			'2025-08-15 assumption',
			'2025-10-03 germanUnity',
			'2025-11-01 allSaints',
			'2025-12-25 christmas',
			'2025-12-26 boxingDay'
		]);
	});

	it('kennt Sachsen 2024 mit Reformationstag und Buß- und Bettag', () => {
		const sn = keys(2024, 'SN');
		expect(sn).toContain('2024-10-31 reformation');
		expect(sn).toContain('2024-11-20 repentance');
		expect(sn).not.toContain('2024-11-01 allSaints');
		expect(sn).toHaveLength(11);
	});

	it('kennt Berlin mit Frauentag und dem einmaligen Tag der Befreiung', () => {
		expect(keys(2025, 'BE')).toContain('2025-03-08 womensDay');
		expect(keys(2025, 'BE')).toContain('2025-05-08 liberationDay');
		expect(keys(2020, 'BE')).toContain('2020-05-08 liberationDay');
		expect(keys(2024, 'BE')).not.toContain('2024-05-08 liberationDay');
		// Frauentag erst seit 2019
		expect(keys(2018, 'BE').some((k) => k.endsWith('womensDay'))).toBe(false);
	});

	it('kennt den Frauentag in Mecklenburg-Vorpommern erst ab 2023', () => {
		expect(keys(2022, 'MV').some((k) => k.endsWith('womensDay'))).toBe(false);
		expect(keys(2023, 'MV')).toContain('2023-03-08 womensDay');
	});

	it('kennt den Weltkindertag in Thüringen ab 2019', () => {
		expect(keys(2018, 'TH').some((k) => k.endsWith('childrensDay'))).toBe(false);
		expect(keys(2026, 'TH')).toContain('2026-09-20 childrensDay');
		expect(keys(2026, 'SN').some((k) => k.endsWith('childrensDay'))).toBe(false);
	});

	it('kennt Ostersonntag und Pfingstsonntag in Brandenburg', () => {
		expect(keys(2026, 'BB')).toContain('2026-04-05 easterSunday');
		expect(keys(2026, 'BB')).toContain('2026-05-24 whitSunday');
		expect(keys(2026, 'BE').some((k) => k.endsWith('easterSunday'))).toBe(false);
	});

	it('kennt Fronleichnam nur in den katholisch geprägten Ländern', () => {
		for (const region of ['BW', 'BY', 'HE', 'NW', 'RP', 'SL'] as const) {
			expect(keys(2026, region)).toContain('2026-06-04 corpusChristi');
		}
		for (const region of ['BE', 'SN', 'HH', 'TH'] as const) {
			expect(keys(2026, region).some((k) => k.endsWith('corpusChristi'))).toBe(false);
		}
	});

	it('kennt den Reformationstag im Norden erst ab 2018 und 2017 bundesweit', () => {
		expect(keys(2016, 'HH').some((k) => k.endsWith('reformation'))).toBe(false);
		expect(keys(2017, 'BW')).toContain('2017-10-31 reformation');
		expect(keys(2017, 'none')).toContain('2017-10-31 reformation');
		expect(keys(2018, 'HH')).toContain('2018-10-31 reformation');
		expect(keys(2018, 'BW').some((k) => k.endsWith('reformation'))).toBe(false);
	});

	it('kennt Allerheiligen im Saarland und Mariä Himmelfahrt dort ebenfalls', () => {
		const sl = keys(2027, 'SL');
		expect(sl).toContain('2027-11-01 allSaints');
		expect(sl).toContain('2027-08-15 assumption');
	});

	it('baut eine Nachschlagetabelle über mehrere Jahre', () => {
		const map = holidayMap([2025, 2026, 2026], 'none');
		expect(map.get('2025-12-25')?.id).toBe('christmas');
		expect(map.get('2026-01-01')?.id).toBe('newYear');
		expect(map.size).toBe(18);
	});
});
