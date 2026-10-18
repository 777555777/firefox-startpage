import { describe, expect, it } from 'vitest';
import {
	addDays,
	addMonths,
	bandEdges,
	classifyDay,
	compareEvents,
	daysBetween,
	eventsByDay,
	eventsOn,
	isDateKey,
	isWorkFree,
	MAX_RANGE_DAYS,
	normalizeTime,
	offDayMap,
	offDaysOn,
	orderRange,
	parseAgenda,
	parseDateKey,
	primaryKind,
	type CalendarEvent,
	type OffDayRange
} from './agenda';

const event = (id: string, date: string, time: string | null, title = id): CalendarEvent => ({
	id,
	date,
	time,
	title
});
const range = (id: string, start: string, end: string, label = ''): OffDayRange => ({
	id,
	start,
	end,
	label
});

describe('Datumsschlüssel', () => {
	it('liest nur existierende Tage', () => {
		expect(parseDateKey('2026-10-18')).toEqual(new Date(2026, 9, 18));
		expect(parseDateKey('2028-02-29')).toEqual(new Date(2028, 1, 29));
		expect(parseDateKey('2026-02-29')).toBeNull();
		expect(parseDateKey('2026-13-01')).toBeNull();
		expect(parseDateKey('2026-1-1')).toBeNull();
		expect(parseDateKey(20261018)).toBeNull();
		expect(isDateKey('2026-04-31')).toBe(false);
	});

	it('rechnet Tage über Monats-, Jahres- und Zeitumstellungsgrenzen', () => {
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
		expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
		// Zeitumstellung in Deutschland am 29.3. und 25.10.2026
		expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
		expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
		expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
		expect(daysBetween('2026-01-10', '2026-01-01')).toBe(-9);
	});

	it('blättert monatsweise und begrenzt auf das Monatsende', () => {
		expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
		expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
		expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
		expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
		expect(addMonths('2026-10-18', -12)).toBe('2025-10-18');
		expect(addMonths('kaputt', 1)).toBe('kaputt');
	});

	it('ordnet vertauschte Zeiträume', () => {
		expect(orderRange('2026-08-14', '2026-08-03')).toEqual({
			start: '2026-08-03',
			end: '2026-08-14'
		});
		expect(orderRange('2026-08-03', '2026-08-03')).toEqual({
			start: '2026-08-03',
			end: '2026-08-03'
		});
	});
});

describe('Uhrzeit', () => {
	it('versteht übliche Schreibweisen', () => {
		expect(normalizeTime('09:30')).toBe('09:30');
		expect(normalizeTime('9:5')).toBe('09:05');
		expect(normalizeTime('9.30')).toBe('09:30');
		expect(normalizeTime('930')).toBe('09:30');
		expect(normalizeTime('1415')).toBe('14:15');
		expect(normalizeTime(' 7 ')).toBe('07:00');
		expect(normalizeTime('0:00')).toBe('00:00');
	});

	it('verwirft Ungültiges', () => {
		expect(normalizeTime('24:00')).toBeNull();
		expect(normalizeTime('12:60')).toBeNull();
		expect(normalizeTime('')).toBeNull();
		expect(normalizeTime('mittags')).toBeNull();
		expect(normalizeTime(930)).toBeNull();
	});
});

describe('Termine pro Tag', () => {
	const events = [
		event('c', '2026-10-21', '14:00', 'Zahnarzt'),
		event('a', '2026-10-21', null, 'Geburtstag Oma'),
		event('d', '2026-10-22', '08:00'),
		event('b', '2026-10-21', '09:30', 'Standup'),
		event('e', '2026-10-21', null, 'Abgabe')
	];

	it('sortiert: ohne Uhrzeit zuerst, dann nach Uhrzeit, dann Titel', () => {
		expect(eventsOn(events, '2026-10-21').map((e) => e.id)).toEqual(['e', 'a', 'b', 'c']);
		expect(eventsOn(events, '2026-10-23')).toEqual([]);
		expect(compareEvents(events[0], events[0])).toBe(0);
	});

	it('gruppiert nach Tagen', () => {
		const map = eventsByDay(events);
		expect([...map.keys()].sort()).toEqual(['2026-10-21', '2026-10-22']);
		expect(map.get('2026-10-21')?.map((e) => e.id)).toEqual(['e', 'a', 'b', 'c']);
		expect(map.get('2026-10-22')?.map((e) => e.id)).toEqual(['d']);
	});
});

describe('Freie Tage', () => {
	const ranges = [
		range('sommer', '2026-08-03', '2026-08-14', 'Urlaub'),
		range('brücke', '2026-08-14', '2026-08-14', 'Brückentag'),
		range('winter', '2026-12-28', '2027-01-06', 'Urlaub')
	];

	it('findet die Zeiträume eines Tags inklusive Anfang und Ende', () => {
		expect(offDaysOn(ranges, '2026-08-03').map((r) => r.id)).toEqual(['sommer']);
		expect(offDaysOn(ranges, '2026-08-14').map((r) => r.id)).toEqual(['sommer', 'brücke']);
		expect(offDaysOn(ranges, '2026-08-15')).toEqual([]);
		expect(offDaysOn(ranges, '2027-01-01').map((r) => r.id)).toEqual(['winter']);
	});

	it('liefert nur Tage im sichtbaren Ausschnitt, auch über den Jahreswechsel', () => {
		const map = offDayMap(ranges, '2026-12-28', '2027-01-03');
		expect([...map.keys()]).toEqual([
			'2026-12-28',
			'2026-12-29',
			'2026-12-30',
			'2026-12-31',
			'2027-01-01',
			'2027-01-02',
			'2027-01-03'
		]);
		expect(map.get('2027-01-01')?.id).toBe('winter');
		expect(offDayMap(ranges, '2026-09-01', '2026-09-30').size).toBe(0);
	});

	it('bei Überschneidung gewinnt der zuerst gespeicherte Zeitraum', () => {
		const map = offDayMap(ranges, '2026-08-10', '2026-08-20');
		expect(map.get('2026-08-14')?.id).toBe('sommer');
		expect(map.size).toBe(5);
	});
});

describe('Einordnung eines Tags', () => {
	// 17.10.2026 ist ein Samstag, 19.10.2026 ein Montag
	const saturday = new Date(2026, 9, 17);
	const monday = new Date(2026, 9, 19);

	it('erkennt Wochenende, Feiertag und frei', () => {
		expect(classifyDay(saturday, { holiday: false, off: false })).toEqual({
			weekend: true,
			holiday: false,
			off: false
		});
		expect(classifyDay(new Date(2026, 9, 18), { holiday: false, off: false }).weekend).toBe(true);
		expect(classifyDay(monday, { holiday: true, off: true })).toEqual({
			weekend: false,
			holiday: true,
			off: true
		});
	});

	it('Feiertag geht vor Urlaub, Urlaub vor Wochenende', () => {
		expect(primaryKind(classifyDay(saturday, { holiday: true, off: true }))).toBe('holiday');
		expect(primaryKind(classifyDay(saturday, { holiday: false, off: true }))).toBe('off');
		expect(primaryKind(classifyDay(saturday, { holiday: false, off: false }))).toBe('weekend');
		expect(primaryKind(classifyDay(monday, { holiday: false, off: false }))).toBe('workday');
	});

	it('arbeitsfrei ist jeder Tag, der nicht Werktag ist', () => {
		expect(isWorkFree(classifyDay(monday, { holiday: false, off: false }))).toBe(false);
		expect(isWorkFree(classifyDay(monday, { holiday: false, off: true }))).toBe(true);
		expect(isWorkFree(classifyDay(monday, { holiday: true, off: false }))).toBe(true);
		expect(isWorkFree(classifyDay(saturday, { holiday: false, off: false }))).toBe(true);
	});

	it('verbindet benachbarte markierte Tage zu Bändern', () => {
		expect(bandEdges([false, true, true, true, false, true, false])).toEqual([
			{ joinStart: false, joinEnd: false },
			{ joinStart: false, joinEnd: true },
			{ joinStart: true, joinEnd: true },
			{ joinStart: true, joinEnd: false },
			{ joinStart: false, joinEnd: false },
			{ joinStart: false, joinEnd: false },
			{ joinStart: false, joinEnd: false }
		]);
	});
});

describe('Validierung', () => {
	it('verwirft Ungültiges und ergänzt Fehlendes', () => {
		const agenda = parseAgenda({
			events: [
				{ id: 'a', date: '2026-10-21', time: '9:30', title: '  Zahnarzt ' },
				{ id: 'a', date: '2026-10-22', title: 'Doppelte ID' },
				{ date: '2026-10-23', time: 'später', title: 'Ohne ID' },
				{ id: 'x', date: '2026-10-24', title: '   ' },
				{ id: 'y', date: 'morgen', title: 'Kein Datum' },
				'kaputt'
			],
			offDays: [
				{ id: 'u', start: '2026-08-14', end: '2026-08-03', label: ' Urlaub ' },
				{ id: 'v', start: '2026-09-01' },
				{ id: 'w', end: '2026-09-01' }
			]
		});
		expect(agenda.events).toHaveLength(3);
		expect(agenda.events[0]).toEqual({
			id: 'a',
			date: '2026-10-21',
			time: '09:30',
			title: 'Zahnarzt'
		});
		expect(agenda.events[1].id).not.toBe('a');
		expect(agenda.events[2]).toMatchObject({ date: '2026-10-23', time: null });
		expect(agenda.offDays).toEqual([
			{ id: 'u', start: '2026-08-03', end: '2026-08-14', label: 'Urlaub' },
			{ id: 'v', start: '2026-09-01', end: '2026-09-01', label: '' }
		]);
	});

	it('liefert für Unbrauchbares leere Listen', () => {
		expect(parseAgenda(undefined)).toEqual({ events: [], offDays: [] });
		expect(parseAgenda({ events: 'x', offDays: 3 })).toEqual({ events: [], offDays: [] });
	});

	it('kürzt zu lange Zeiträume', () => {
		const { offDays } = parseAgenda({
			offDays: [{ id: 'lang', start: '2026-01-01', end: '2030-01-01' }]
		});
		expect(daysBetween(offDays[0].start, offDays[0].end)).toBe(MAX_RANGE_DAYS - 1);
	});
});
