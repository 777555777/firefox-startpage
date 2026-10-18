import { describe, expect, it } from 'vitest';
import { CIVIL_ZENITH, dayLength, dayProgress, parseCoordinate, sunDay, sunTimes } from './sun';

const BERLIN = [52.52, 13.405] as const;

/** Lokaler Mittag, damit der Kalendertag unabhängig von der Zeitzone des Testrechners ist */
const day = (year: number, month: number, date: number) => new Date(year, month - 1, date, 12);

/** Erwartet einen Zeitpunkt (UTC) mit höchstens zwei Minuten Abweichung */
function expectNear(actual: Date, isoUtc: string) {
	const diffMinutes = Math.abs(actual.getTime() - Date.parse(isoUtc)) / 60_000;
	expect(diffMinutes, `${actual.toISOString()} statt ${isoUtc}`).toBeLessThanOrEqual(2);
}

function normal(result: ReturnType<typeof sunTimes>) {
	if (result.kind !== 'normal') throw new Error(`erwartet normal, war ${result.kind}`);
	return result;
}

describe('sunTimes', () => {
	it('Berlin zur Sommersonnenwende (04:43 / 21:33 MESZ)', () => {
		const { sunrise, sunset } = normal(sunTimes(day(2025, 6, 21), ...BERLIN));
		expectNear(sunrise, '2025-06-21T02:43Z');
		expectNear(sunset, '2025-06-21T19:33Z');
	});

	it('Berlin zur Wintersonnenwende (08:15 / 15:54 MEZ)', () => {
		const { sunrise, sunset } = normal(sunTimes(day(2025, 12, 21), ...BERLIN));
		expectNear(sunrise, '2025-12-21T07:15Z');
		expectNear(sunset, '2025-12-21T14:54Z');
	});

	it('westliche Länge: New York zur Sommersonnenwende (05:25 / 20:31 EDT)', () => {
		const { sunrise, sunset } = normal(sunTimes(day(2025, 6, 21), 40.7128, -74.006));
		expectNear(sunrise, '2025-06-21T09:25Z');
		// Untergang liegt in UTC schon am nächsten Tag
		expectNear(sunset, '2025-06-22T00:31Z');
	});

	it('Südhalbkugel: Sydney im Dezember (05:41 / 20:05 AEDT)', () => {
		const { sunrise, sunset } = normal(sunTimes(day(2025, 12, 21), -33.8688, 151.2093));
		// Aufgang liegt in UTC noch am Vortag
		expectNear(sunrise, '2025-12-20T18:41Z');
		expectNear(sunset, '2025-12-21T09:05Z');
	});

	it('erkennt Polartag und Polarnacht in Tromsø', () => {
		expect(sunTimes(day(2025, 6, 21), 69.65, 18.96).kind).toBe('polarDay');
		expect(sunTimes(day(2025, 12, 21), 69.65, 18.96).kind).toBe('polarNight');
	});

	it('kehrt Polartag und Polarnacht auf der Südhalbkugel um', () => {
		expect(sunTimes(day(2025, 6, 21), -75, 0).kind).toBe('polarNight');
		expect(sunTimes(day(2025, 12, 21), -75, 0).kind).toBe('polarDay');
	});

	it('Pole zur Tagundnachtgleiche liefern gültige Zeiten oder Polarzeit, nie NaN', () => {
		for (const latitude of [90, -90, 89.99, -89.99]) {
			for (let month = 1; month <= 12; month++) {
				const result = sunTimes(day(2025, month, 20), latitude, 0);
				expect(['normal', 'polarDay', 'polarNight']).toContain(result.kind);
				if (result.kind === 'normal') {
					expect(Number.isFinite(result.sunrise.getTime())).toBe(true);
					expect(Number.isFinite(result.sunset.getTime())).toBe(true);
				}
			}
		}
	});

	it('Aufgang liegt immer vor dem Untergang', () => {
		for (let month = 1; month <= 12; month++) {
			const { sunrise, sunset } = normal(sunTimes(day(2025, month, 1), ...BERLIN));
			expect(sunrise.getTime()).toBeLessThan(sunset.getTime());
		}
	});

	it('Äquator: Tag dauert das ganze Jahr etwa 12 Stunden', () => {
		for (let month = 1; month <= 12; month++) {
			const { sunrise, sunset } = normal(sunTimes(day(2025, month, 15), 0, 0));
			const hours = (sunset.getTime() - sunrise.getTime()) / 3_600_000;
			expect(hours).toBeGreaterThan(12);
			expect(hours).toBeLessThan(12.2);
		}
	});
});

describe('Dämmerung, Tageslänge und Fortschritt', () => {
	const minutesBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 60_000;

	it('bürgerliche Dämmerung liegt in Berlin 30–80 Minuten vor Aufgang und nach Untergang', () => {
		for (const month of [3, 6, 9, 12]) {
			const sun = normal(sunTimes(day(2025, month, 21), ...BERLIN));
			const civil = normal(sunTimes(day(2025, month, 21), ...BERLIN, CIVIL_ZENITH));
			for (const minutes of [
				minutesBetween(civil.sunrise, sun.sunrise),
				minutesBetween(sun.sunset, civil.sunset)
			]) {
				expect(minutes).toBeGreaterThan(30);
				expect(minutes).toBeLessThan(80);
			}
		}
	});

	it('am Äquator dauert die Dämmerung nur gut 20 Minuten', () => {
		const sun = normal(sunTimes(day(2025, 3, 20), 0, 0));
		const civil = normal(sunTimes(day(2025, 3, 20), 0, 0, CIVIL_ZENITH));
		const minutes = minutesBetween(civil.sunrise, sun.sunrise);
		expect(minutes).toBeGreaterThan(19);
		expect(minutes).toBeLessThan(26);
	});

	it('Tromsø: Polarnacht hat Dämmerung, Mittsommer wird nie dunkel', () => {
		expect(sunTimes(day(2025, 12, 21), 69.65, 18.96, CIVIL_ZENITH).kind).toBe('normal');
		expect(sunTimes(day(2025, 6, 21), 69.65, 18.96, CIVIL_ZENITH).kind).toBe('polarDay');
	});

	it('Tageslänge: Berlin zur Sonnenwende 16 h 50 min bzw. 7 h 39 min', () => {
		expect(dayLength(sunTimes(day(2025, 6, 21), ...BERLIN))).toBeCloseTo(16 * 60 + 50, -1);
		expect(dayLength(sunTimes(day(2025, 12, 21), ...BERLIN))).toBeCloseTo(7 * 60 + 39, -1);
		expect(dayLength({ kind: 'polarDay' })).toBe(24 * 60);
		expect(dayLength({ kind: 'polarNight' })).toBe(0);
	});

	it('Fortschritt zwischen Auf- und Untergang', () => {
		const rise = new Date(2025, 5, 21, 6);
		const set = new Date(2025, 5, 21, 18);
		expect(dayProgress(new Date(2025, 5, 21, 12), rise, set)).toBeCloseTo(0.5);
		expect(dayProgress(rise, rise, set)).toBe(0);
		expect(dayProgress(set, rise, set)).toBe(1);
		expect(dayProgress(new Date(2025, 5, 21, 5), rise, set)).toBeNull();
		expect(dayProgress(new Date(2025, 5, 21, 19), rise, set)).toBeNull();
	});
});

describe('sunDay', () => {
	it('erkennt Tag und Nacht unabhängig von der Zeitzone des Rechners', () => {
		// 13:00 und 23:00 in Berlin; in Auckland ist dann schon der nächste Kalendertag
		expect(sunDay(new Date('2026-10-18T11:00Z'), ...BERLIN).up).toBe(true);
		expect(sunDay(new Date('2026-10-18T21:00Z'), ...BERLIN).up).toBe(false);
		const { times } = sunDay(new Date('2026-10-18T11:00Z'), ...BERLIN);
		if (times.kind !== 'normal') throw new Error('erwartet normal');
		expect(times.sunrise.getTime()).toBeLessThan(Date.parse('2026-10-18T11:00Z'));
		expect(times.sunset.getTime()).toBeGreaterThan(Date.parse('2026-10-18T11:00Z'));
	});

	it('Polartag zählt als Tag, Polarnacht als Nacht', () => {
		expect(sunDay(new Date('2025-06-21T11:00Z'), 69.65, 18.96).up).toBe(true);
		expect(sunDay(new Date('2025-12-21T11:00Z'), 69.65, 18.96).up).toBe(false);
	});
});

describe('parseCoordinate', () => {
	it('liest Punkt und Komma', () => {
		expect(parseCoordinate('52.52', 90)).toBe(52.52);
		expect(parseCoordinate(' 13,405 ', 180)).toBe(13.405);
		expect(parseCoordinate('-74', 180)).toBe(-74);
		expect(parseCoordinate('+.5', 90)).toBe(0.5);
		expect(parseCoordinate('\u221233,87', 90)).toBe(-33.87);
	});

	it('leere Eingabe ist null', () => {
		expect(parseCoordinate('', 90)).toBeNull();
		expect(parseCoordinate('   ', 90)).toBeNull();
	});

	it('ungültige oder zu große Werte sind undefined', () => {
		expect(parseCoordinate('abc', 90)).toBeUndefined();
		expect(parseCoordinate('1e3', 180)).toBeUndefined();
		expect(parseCoordinate('52.5.1', 90)).toBeUndefined();
		expect(parseCoordinate('91', 90)).toBeUndefined();
		expect(parseCoordinate('-180.5', 180)).toBeUndefined();
	});
});
