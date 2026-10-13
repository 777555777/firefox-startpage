import { describe, expect, it } from 'vitest';
import { getMonthGrid, getWeekdayNames, isoWeek } from './month-grid';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe('getMonthGrid', () => {
	it('liefert immer 6 Wochen à 7 Tage', () => {
		for (let month = 0; month < 24; month++) {
			const grid = getMonthGrid(2025, month, day(2025, 1, 1));
			expect(grid).toHaveLength(6);
			for (const week of grid) expect(week.days).toHaveLength(7);
		}
	});

	it('beginnt mit Montag und füllt mit dem Vormonat auf', () => {
		// 1. Oktober 2025 ist ein Mittwoch
		const grid = getMonthGrid(2025, 9, day(2025, 10, 13));
		expect(grid[0].days[0].date).toEqual(day(2025, 9, 29));
		expect(grid[0].days[0].inMonth).toBe(false);
		expect(grid[0].days[2].date).toEqual(day(2025, 10, 1));
		expect(grid[0].days[2].inMonth).toBe(true);
		expect(grid[5].days[6].date).toEqual(day(2025, 11, 9));
	});

	it('kann mit Sonntag beginnen', () => {
		const grid = getMonthGrid(2025, 9, day(2025, 10, 13), 0);
		expect(grid[0].days[0].date).toEqual(day(2025, 9, 28));
		expect(grid[0].days[0].date.getDay()).toBe(0);
	});

	it('markiert heute', () => {
		const grid = getMonthGrid(2025, 9, day(2025, 10, 13));
		const today = grid.flatMap((w) => w.days).filter((d) => d.isToday);
		expect(today).toHaveLength(1);
		expect(today[0].date).toEqual(day(2025, 10, 13));
	});

	it('beginnt mit einer vollen Vorwoche, wenn der Monat am Wochenstart beginnt', () => {
		// 1. September 2025 ist ein Montag → erste Zeile ist komplett September
		const grid = getMonthGrid(2025, 8, day(2025, 9, 1));
		expect(grid[0].days[0].date).toEqual(day(2025, 9, 1));
	});

	it('lässt Monatsüberlauf zu', () => {
		const grid = getMonthGrid(2025, 12, day(2026, 1, 1));
		expect(grid.flatMap((w) => w.days).find((d) => d.inMonth)?.date).toEqual(day(2026, 1, 1));
	});

	it('nummeriert die Zeilen mit ISO-Kalenderwochen', () => {
		expect(getMonthGrid(2025, 9, day(2025, 10, 1)).map((w) => w.week)).toEqual([
			40, 41, 42, 43, 44, 45
		]);
		// Jahreswechsel: 29.12.2025 gehört zu KW 1/2026
		expect(getMonthGrid(2025, 11, day(2025, 12, 1)).map((w) => w.week)).toEqual([
			49, 50, 51, 52, 1, 2
		]);
		// Bei Wochenstart Sonntag zählt der Montag der Zeile
		expect(getMonthGrid(2025, 9, day(2025, 10, 1), 0)[0].week).toBe(40);
	});
});

describe('isoWeek', () => {
	it.each([
		[day(2025, 1, 1), 1],
		[day(2024, 12, 30), 1],
		[day(2021, 1, 3), 53],
		[day(2020, 12, 31), 53],
		[day(2026, 1, 1), 1],
		[day(2027, 1, 1), 53],
		[day(2027, 1, 4), 1],
		[day(2025, 10, 13), 42],
		[day(2023, 1, 1), 52]
	])('%s → KW %i', (date, week) => {
		expect(isoWeek(date)).toBe(week);
	});
});

describe('getWeekdayNames', () => {
	it('liefert lokalisierte Namen in Anzeigereihenfolge', () => {
		expect(getWeekdayNames('de', 1).map((d) => d.short)).toEqual([
			'Mo',
			'Di',
			'Mi',
			'Do',
			'Fr',
			'Sa',
			'So'
		]);
		expect(getWeekdayNames('en', 0)[0].long).toBe('Sunday');
	});
});
