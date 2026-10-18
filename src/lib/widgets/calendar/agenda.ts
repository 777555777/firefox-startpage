import { array, nonEmpty, record, str, uniqueId } from '$lib/config/parse';
import { dateKey } from './holidays';

/**
 * Termine und freie Tage (z. B. Urlaub). Sie liegen global in der Config (`agenda`), damit
 * Export und Import sie mitnehmen und mehrere Kalender dieselben Daten zeigen. Datumswerte
 * sind Schlüssel `YYYY-MM-DD` in lokaler Zeit; so vergleichen sie sich als Strings richtig.
 */

export type CalendarEvent = {
	id: string;
	/** Tag als `YYYY-MM-DD` */
	date: string;
	/** Uhrzeit `HH:MM`; null = ganztägig bzw. ohne Uhrzeit */
	time: string | null;
	title: string;
};

/** Zusammenhängender Zeitraum freier Tage, Anfang und Ende eingeschlossen */
export type OffDayRange = {
	id: string;
	start: string;
	end: string;
	/** Bezeichnung, z. B. „Urlaub“; leer = allgemein „frei“ */
	label: string;
};

export type AgendaConfig = {
	events: CalendarEvent[];
	offDays: OffDayRange[];
};

/** Obergrenzen, damit eine kaputte Import-Datei die Config nicht aufbläht */
export const MAX_EVENTS = 5000;
export const MAX_OFF_DAYS = 1000;
export const MAX_TITLE = 200;
/** Längster freier Zeitraum in Tagen; längere werden beim Validieren gekürzt */
export const MAX_RANGE_DAYS = 366;

export const defaultAgenda = (): AgendaConfig => ({ events: [], offDays: [] });

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Datum aus `YYYY-MM-DD`, nur für tatsächlich existierende Tage */
export function parseDateKey(value: unknown): Date | null {
	if (typeof value !== 'string') return null;
	const match = DATE_KEY.exec(value);
	if (!match) return null;
	const [year, month, day] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
	const date = new Date(year, month, day);
	// 2025-02-30 o. Ä. rollt über und wird verworfen
	return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
		? date
		: null;
}

export function isDateKey(value: unknown): value is string {
	return parseDateKey(value) !== null;
}

/** Uhrzeit `HH:MM`; auch `9:5`, `9.30` und `930` werden verstanden. Sonst null. */
export function normalizeTime(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	const loose = /^(\d{1,2})[:.](\d{1,2})$/.exec(trimmed) ?? /^(\d{1,2})(\d{2})$/.exec(trimmed);
	const short = /^(\d{1,2})$/.exec(trimmed);
	const [hours, minutes] = loose
		? [Number(loose[1]), Number(loose[2])]
		: short
			? [Number(short[1]), 0]
			: [NaN, NaN];
	if (!(hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59)) return null;
	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Verschiebt einen Tagesschlüssel um `days` Tage (über Monats- und Jahresgrenzen) */
export function addDays(key: string, days: number): string {
	const date = parseDateKey(key);
	if (!date) return key;
	return dateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
}

/** Verschiebt um `months` Monate; der Tag wird auf das Monatsende begrenzt (31.1. + 1 → 28.2.) */
export function addMonths(key: string, months: number): string {
	const date = parseDateKey(key);
	if (!date) return key;
	const first = new Date(date.getFullYear(), date.getMonth() + months, 1);
	const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
	return dateKey(
		new Date(first.getFullYear(), first.getMonth(), Math.min(date.getDate(), lastDay))
	);
}

/** Anzahl Tage von `from` bis `to` (negativ, wenn `to` davor liegt) */
export function daysBetween(from: string, to: string): number {
	const a = parseDateKey(from);
	const b = parseDateKey(to);
	if (!a || !b) return 0;
	// Über UTC rechnen, damit Zeitumstellungen keine halben Tage erzeugen
	const utc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
	return Math.round((utc(b) - utc(a)) / 86_400_000);
}

/** Zeitraum mit Anfang ≤ Ende; vertauschte Angaben werden getauscht */
export function orderRange(start: string, end: string): { start: string; end: string } {
	return start <= end ? { start, end } : { start: end, end: start };
}

/** Reihenfolge innerhalb eines Tags: ohne Uhrzeit zuerst, dann nach Uhrzeit, dann Titel */
export function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
	if (a.time !== b.time) {
		if (a.time === null) return -1;
		if (b.time === null) return 1;
		return a.time < b.time ? -1 : 1;
	}
	return a.title.localeCompare(b.title);
}

/** Termine pro Tag, jeweils sortiert */
export function eventsByDay(events: readonly CalendarEvent[]): Map<string, CalendarEvent[]> {
	const map = new Map<string, CalendarEvent[]>();
	for (const event of events) {
		const list = map.get(event.date);
		if (list) list.push(event);
		else map.set(event.date, [event]);
	}
	for (const list of map.values()) list.sort(compareEvents);
	return map;
}

/** Termine eines Tags, sortiert */
export function eventsOn(events: readonly CalendarEvent[], key: string): CalendarEvent[] {
	return events.filter((event) => event.date === key).sort(compareEvents);
}

/** Freie Zeiträume, die einen Tag enthalten, in der gespeicherten Reihenfolge */
export function offDaysOn(ranges: readonly OffDayRange[], key: string): OffDayRange[] {
	return ranges.filter((range) => range.start <= key && key <= range.end);
}

/**
 * Freie Tage im sichtbaren Ausschnitt `[from, to]` als Map Tag → erster passender Zeitraum.
 * Zeiträume außerhalb des Ausschnitts kosten nichts.
 */
export function offDayMap(
	ranges: readonly OffDayRange[],
	from: string,
	to: string
): Map<string, OffDayRange> {
	const map = new Map<string, OffDayRange>();
	for (const range of ranges) {
		if (range.end < from || range.start > to) continue;
		let key = range.start < from ? from : range.start;
		const last = range.end > to ? to : range.end;
		while (key <= last) {
			if (!map.has(key)) map.set(key, range);
			key = addDays(key, 1);
		}
	}
	return map;
}

/** Art eines Tags; mehrere können zugleich zutreffen (Feiertag im Urlaub, Urlaub am Samstag) */
export type DayKinds = {
	weekend: boolean;
	holiday: boolean;
	off: boolean;
};

/** Was die Fläche eines Tags bestimmt. Feiertag geht vor Urlaub, Urlaub vor Wochenende. */
export type DayKind = 'holiday' | 'off' | 'weekend' | 'workday';

export function classifyDay(
	date: Date,
	{ holiday, off }: { holiday: boolean; off: boolean }
): DayKinds {
	const day = date.getDay();
	return { weekend: day === 0 || day === 6, holiday, off };
}

export function primaryKind(kinds: DayKinds): DayKind {
	if (kinds.holiday) return 'holiday';
	if (kinds.off) return 'off';
	if (kinds.weekend) return 'weekend';
	return 'workday';
}

/** Ein Tag, an dem man nicht arbeiten muss */
export function isWorkFree(kinds: DayKinds): boolean {
	return kinds.weekend || kinds.holiday || kinds.off;
}

/**
 * Zusammenhängende Bänder in einer Wochenzeile: Für jeden markierten Tag, ob links bzw.
 * rechts ein markierter Nachbar folgt. So werden nur die Enden eines Bands gerundet.
 */
export function bandEdges(marked: readonly boolean[]): { joinStart: boolean; joinEnd: boolean }[] {
	return marked.map((isMarked, i) => ({
		joinStart: isMarked && i > 0 && marked[i - 1],
		joinEnd: isMarked && i < marked.length - 1 && marked[i + 1]
	}));
}

// --- Validierung ---------------------------------------------------------------------------

function parseEvent(raw: unknown, seen: Set<string>): CalendarEvent | null {
	const r = record(raw);
	const title = nonEmpty(r.title, '', MAX_TITLE);
	if (!title || !isDateKey(r.date)) return null;
	return { id: uniqueId(r.id, seen), date: r.date, time: normalizeTime(r.time), title };
}

function parseOffDays(raw: unknown, seen: Set<string>): OffDayRange | null {
	const r = record(raw);
	if (!isDateKey(r.start)) return null;
	const { start, end } = orderRange(r.start, isDateKey(r.end) ? r.end : r.start);
	return {
		id: uniqueId(r.id, seen),
		start,
		end: daysBetween(start, end) >= MAX_RANGE_DAYS ? addDays(start, MAX_RANGE_DAYS - 1) : end,
		label: str(r.label, '', MAX_TITLE).trim()
	};
}

/** Validiert Termine und freie Tage. Ungültige Einträge fallen weg, wirft nie. */
export function parseAgenda(raw: unknown): AgendaConfig {
	const r = record(raw);
	const seen = new Set<string>();
	const events = array(r.events)
		.slice(0, MAX_EVENTS)
		.map((event) => parseEvent(event, seen))
		.filter((event) => event !== null);
	const offDays = array(r.offDays)
		.slice(0, MAX_OFF_DAYS)
		.map((range) => parseOffDays(range, seen))
		.filter((range) => range !== null);
	return { events, offDays };
}
