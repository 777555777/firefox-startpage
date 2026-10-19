import { describe, expect, it } from 'vitest';
import { litPath, moonEvents, moonPhase, moonTimes, nextMajorPhase, nextPhase } from './moon';
import { sunTimes } from './sun';

const BERLIN = [52.52, 13.405] as const;
const TROMSO = [69.65, 18.96] as const;
const HOUR = 3_600_000;

/** Lokaler Mittag, damit der Kalendertag unabhängig von der Zeitzone des Testrechners ist */
const day = (year: number, month: number, date: number) => new Date(year, month - 1, date, 12);

const minutesOff = (actual: Date, isoUtc: string) =>
	Math.abs(actual.getTime() - Date.parse(isoUtc)) / 60_000;

describe('Mondphasen', () => {
	// Veröffentlichte Zeitpunkte (UTC), u. a. die Finsternisse 2024–2026
	const known = [
		{ at: '2024-04-08T18:21Z', target: 0 },
		{ at: '2025-03-14T06:55Z', target: 180 },
		{ at: '2025-03-29T10:58Z', target: 0 },
		{ at: '2025-09-07T18:09Z', target: 180 },
		{ at: '2025-09-21T19:54Z', target: 0 },
		{ at: '2026-08-12T17:37Z', target: 0 }
	] as const;

	it('trifft Voll- und Neumond auf wenige Minuten', () => {
		for (const { at, target } of known) {
			const found = nextPhase(new Date(Date.parse(at) - 5 * 24 * HOUR), target);
			expect(minutesOff(found, at), `${at}: ${found.toISOString()}`).toBeLessThan(15);
		}
	});

	it('beleuchteter Anteil und Name passen zur Phase', () => {
		const full = moonPhase(new Date('2025-09-07T18:09Z'));
		expect(full.illumination).toBeGreaterThan(0.99);
		expect(full.name).toBe('full');

		const fresh = moonPhase(new Date('2025-09-21T19:54Z'));
		expect(fresh.illumination).toBeLessThan(0.01);
		expect(fresh.name).toBe('new');

		// Erstes Viertel am 29.9.2025 23:54 UTC: halb beleuchtet, zunehmend
		const quarter = moonPhase(new Date('2025-09-29T23:54Z'));
		expect(quarter.illumination).toBeCloseTo(0.5, 1);
		expect(quarter).toMatchObject({ waxing: true, name: 'firstQuarter' });

		expect(moonPhase(new Date('2025-09-25T12:00Z')).name).toBe('waxingCrescent');
		expect(moonPhase(new Date('2025-10-03T12:00Z')).name).toBe('waxingGibbous');
		expect(moonPhase(new Date('2025-09-10T12:00Z'))).toMatchObject({
			waxing: false,
			name: 'waningGibbous'
		});
		expect(moonPhase(new Date('2025-09-17T12:00Z')).name).toBe('waningCrescent');
	});

	it('nennt den nächsten Voll- oder Neumond, je nachdem, was zuerst kommt', () => {
		const afterFull = nextMajorPhase(new Date('2025-09-10T12:00Z'));
		expect(afterFull.kind).toBe('new');
		expect(minutesOff(afterFull.at, '2025-09-21T19:54Z')).toBeLessThan(15);

		const afterNew = nextMajorPhase(new Date('2025-03-01T12:00Z'));
		expect(afterNew.kind).toBe('full');
		expect(minutesOff(afterNew.at, '2025-03-14T06:55Z')).toBeLessThan(15);
	});
});

describe('Mondauf- und -untergang', () => {
	/**
	 * Abstand in Minuten vom nächstgelegenen Mondaufgang zu `at`. Gesucht wird über drei lokale
	 * Kalendertage, weil der Berliner Abend je nach Zeitzone des Testrechners schon im nächsten
	 * Tag liegt.
	 */
	const nearestRise = (at: Date) =>
		Math.min(
			...[-1, 0, 1]
				.map((offset) => moonTimes(new Date(at.getTime() + offset * 24 * HOUR), ...BERLIN).rise)
				.filter((rise) => rise !== null)
				.map((rise) => Math.abs(rise.getTime() - at.getTime()) / 60_000)
		);

	it('bei Vollmond geht der Mond etwa mit der Sonne unter auf', () => {
		const sun = sunTimes(day(2025, 9, 7), ...BERLIN);
		if (sun.kind !== 'normal') throw new Error('Untergang erwartet');
		expect(nearestRise(sun.sunset)).toBeLessThan(45);
	});

	it('bei Neumond geht der Mond etwa mit der Sonne auf', () => {
		const sun = sunTimes(day(2025, 9, 21), ...BERLIN);
		if (sun.kind !== 'normal') throw new Error('Aufgang erwartet');
		expect(nearestRise(sun.sunrise)).toBeLessThan(90);
	});

	it('liegt immer im lokalen Kalendertag und geht im Mittel ~50 min später auf', () => {
		const rises: number[] = [];
		let withoutRise = 0;
		let withoutSet = 0;
		for (let date = 1; date <= 30; date++) {
			const start = new Date(2025, 8, date).getTime();
			const end = new Date(2025, 8, date + 1).getTime();
			const { rise, set, alwaysUp, alwaysDown } = moonTimes(day(2025, 9, date), ...BERLIN);
			expect(alwaysUp || alwaysDown).toBe(false);
			for (const at of [rise, set]) {
				if (!at) continue;
				expect(at.getTime()).toBeGreaterThanOrEqual(start);
				expect(at.getTime()).toBeLessThan(end);
			}
			if (rise) rises.push(rise.getTime() - start);
			else withoutRise++;
			if (!set) withoutSet++;
		}
		// Etwa einmal im Monat fällt ein Aufgang bzw. Untergang aus
		expect(withoutRise).toBeGreaterThanOrEqual(1);
		expect(withoutRise).toBeLessThanOrEqual(2);
		expect(withoutSet).toBeGreaterThanOrEqual(1);
		expect(withoutSet).toBeLessThanOrEqual(2);
		// Verspätung von Tag zu Tag (über den ausgefallenen Aufgang hinweg nicht vergleichbar)
		const delays = rises
			.slice(1)
			.map((r, i) => (r - rises[i]) / 60_000)
			.filter((d) => d > 0);
		const average = delays.reduce((a, b) => a + b, 0) / delays.length;
		expect(average).toBeGreaterThan(35);
		expect(average).toBeLessThan(65);
	});

	it('Tromsø zur großen Mondwende: Tage ganz über und ganz unter dem Horizont', () => {
		const days = Array.from({ length: 31 }, (_, i) => moonTimes(day(2025, 1, i + 1), ...TROMSO));
		expect(days.some((d) => d.alwaysUp && !d.rise && !d.set)).toBe(true);
		expect(days.some((d) => d.alwaysDown && !d.rise && !d.set)).toBe(true);
		// Nie beides zugleich
		expect(days.every((d) => !(d.alwaysUp && d.alwaysDown))).toBe(true);
	});
});

describe('Mondauf- und -untergang zur Anzeige', () => {
	it('ohne Untergang heute gilt der von morgen, ohne Aufgang der von gestern', () => {
		let shiftedSet = 0;
		let shiftedRise = 0;
		for (let date = 1; date <= 30; date++) {
			const today = day(2025, 9, date);
			const times = moonTimes(today, ...BERLIN);
			const events = moonEvents(today, ...BERLIN);
			const next = moonTimes(day(2025, 9, date + 1), ...BERLIN);
			const previous = moonTimes(day(2025, 9, date - 1), ...BERLIN);

			expect(events.rise).not.toBeNull();
			expect(events.set).not.toBeNull();
			if (times.set) expect(events.set).toEqual({ at: times.set, day: 0 });
			else {
				expect(events.set).toEqual({ at: next.set, day: 1 });
				shiftedSet++;
			}
			if (times.rise) expect(events.rise).toEqual({ at: times.rise, day: 0 });
			else {
				expect(events.rise).toEqual({ at: previous.rise, day: -1 });
				shiftedRise++;
			}
		}
		expect(shiftedSet).toBeGreaterThanOrEqual(1);
		expect(shiftedRise).toBeGreaterThanOrEqual(1);
	});

	it('zirkumpolare Tage bleiben ohne Zeiten', () => {
		const days = Array.from({ length: 31 }, (_, i) => moonEvents(day(2025, 1, i + 1), ...TROMSO));
		const circumpolar = days.filter((d) => d.alwaysUp || d.alwaysDown);
		expect(circumpolar.length).toBeGreaterThan(0);
		expect(circumpolar.every((d) => !d.rise && !d.set)).toBe(true);
	});
});

describe('Form der Mondsichel', () => {
	it('Neumond und Vollmond sind volle Kreise, Viertel eine gerade Schattengrenze', () => {
		// Schattengrenze so breit wie der Kreis: bei Neumond deckungsgleich mit dem Rand
		expect(litPath(0, 10)).toBe('M0 -10A10 10 0 0 1 0 10A10 10 0 0 0 0 -10Z');
		expect(litPath(0.5, 10)).toBe('M0 -10A10 10 0 0 0 0 10A10 10 0 0 0 0 -10Z');
		expect(litPath(0.25, 10)).toContain('A0 10');
		expect(litPath(0.75, 10)).toContain('A0 10');
	});

	it('zunehmend rechts hell, abnehmend links', () => {
		// Außenrand oben → unten im Uhrzeigersinn (rechts) bzw. dagegen (links)
		expect(litPath(0.1, 10)).toMatch(/^M0 -10A10 10 0 0 1 /);
		expect(litPath(0.9, 10)).toMatch(/^M0 -10A10 10 0 0 0 /);
	});

	it('Sichel wölbt die Schattengrenze zur hellen Seite, Dreiviertel zur dunklen', () => {
		const sweep = (path: string) => path.split('A')[2].split(' ')[4];
		expect(sweep(litPath(0.1, 10))).toBe('0');
		expect(sweep(litPath(0.4, 10))).toBe('1');
		expect(sweep(litPath(0.6, 10))).toBe('0');
		expect(sweep(litPath(0.9, 10))).toBe('1');
	});
});
