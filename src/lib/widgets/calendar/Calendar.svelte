<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { createId } from '$lib/config/parse';
	import { i18n, t } from '$lib/i18n/index.svelte';
	import { getApp } from '$lib/state/context';
	import { toasts } from '$lib/state/toasts.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import { everyMinute } from '$lib/utils/now.svelte';
	import type { WidgetProps } from '../types';
	import {
		addDays,
		addMonths,
		bandEdges,
		classifyDay,
		eventsByDay,
		offDayMap,
		offDaysOn,
		parseDateKey,
		type CalendarEvent,
		type OffDayRange
	} from './agenda';
	import EventDialog from './EventDialog.svelte';
	import { dateKey, holidayMap, type Holiday } from './holidays';
	import { getMonthGrid, getWeekdayNames } from './month-grid';
	import OffDayDialog from './OffDayDialog.svelte';
	import type { CalendarSettings } from './settings';

	let { settings }: WidgetProps<CalendarSettings> = $props();

	const app = getApp();
	const agenda = $derived(app.config.value.agenda);

	const today = $derived(everyMinute.current);
	const todayKey = $derived(dateKey(today));
	/** Gewählter Tag; null = heute (folgt dem Datum auch über Mitternacht) */
	let picked = $state<string | null>(null);
	const selected = $derived(picked ?? todayKey);
	/** Angezeigter Monat; null = der aktuelle */
	let month = $state<{ year: number; month: number } | null>(null);

	const weekStartsOn = $derived(settings.weekStart === 'sunday' ? 0 : 1);
	const shown = $derived(
		month
			? new Date(month.year, month.month, 1)
			: new Date(today.getFullYear(), today.getMonth(), 1)
	);
	const weeks = $derived(getMonthGrid(shown.getFullYear(), shown.getMonth(), today, weekStartsOn));
	const firstKey = $derived(dateKey(weeks[0].days[0].date));
	const lastKey = $derived(dateKey(weeks[weeks.length - 1].days[6].date));
	const weekdays = $derived(getWeekdayNames(i18n.lang, weekStartsOn));
	const holidays = $derived(
		settings.holidays
			? holidayMap(
					[...new Set([firstKey, lastKey, selected].map((key) => Number(key.slice(0, 4))))],
					settings.region
				)
			: new Map<string, Holiday>()
	);
	const eventMap = $derived(eventsByDay(agenda.events));
	const offMap = $derived(offDayMap(agenda.offDays, firstKey, lastKey));

	/** Zeilen des Rasters mit allem, was ein Tag zur Darstellung braucht */
	const rows = $derived(
		weeks.map((week) => {
			const days = week.days.map((day) => {
				const key = dateKey(day.date);
				const holiday = holidays.get(key);
				const off = offMap.get(key);
				return {
					...day,
					key,
					holiday,
					off,
					events: eventMap.get(key) ?? [],
					kinds: classifyDay(day.date, { holiday: !!holiday, off: !!off })
				};
			});
			const edges = bandEdges(days.map((day) => day.kinds.off));
			return { week: week.week, days: days.map((day, i) => ({ ...day, ...edges[i] })) };
		})
	);
	const visible = $derived(selected >= firstKey && selected <= lastKey);
	/** Der eine Tag im Raster, der per Tab erreichbar ist (Roving Tabindex) */
	const focusKey = $derived(visible ? selected : dateKey(shown));

	const fmt = $derived({
		month: new Intl.DateTimeFormat(i18n.lang, { month: 'long', year: 'numeric' }),
		day: new Intl.DateTimeFormat(i18n.lang, { weekday: 'long', day: 'numeric', month: 'long' }),
		dayWithYear: new Intl.DateTimeFormat(i18n.lang, {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		}),
		short: new Intl.DateTimeFormat(i18n.lang, { day: 'numeric', month: 'short' }),
		weekdayShort: new Intl.DateTimeFormat(i18n.lang, {
			weekday: 'short',
			day: 'numeric',
			month: 'short'
		}),
		weekdayShortWithYear: new Intl.DateTimeFormat(i18n.lang, {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		}),
		time: new Intl.DateTimeFormat(i18n.lang, { hour: 'numeric', minute: '2-digit' })
	});
	const monthTitle = $derived(fmt.month.format(shown));

	function formatTime(time: string) {
		const [hours, minutes] = time.split(':').map(Number);
		return fmt.time.format(new Date(2000, 0, 1, hours, minutes));
	}

	function formatRange(range: OffDayRange) {
		const start = parseDateKey(range.start);
		const end = parseDateKey(range.end);
		if (!start || !end) return '';
		return range.start === range.end ? fmt.short.format(start) : fmt.short.formatRange(start, end);
	}

	const offName = (range: OffDayRange) => range.label || t('calendar.off');

	/** Kurzbeschreibung eines Tags für Screenreader und Tooltip */
	function describe(day: (typeof rows)[number]['days'][number]) {
		const parts: string[] = [];
		if (day.holiday) parts.push(t(`holiday.${day.holiday.id}`));
		if (day.off) parts.push(offName(day.off));
		if (day.events.length) parts.push(t('calendar.events', { count: day.events.length }));
		return parts;
	}

	function tooltip(day: (typeof rows)[number]['days'][number]) {
		const lines: string[] = [];
		if (day.holiday) lines.push(t(`holiday.${day.holiday.id}`));
		if (day.off) lines.push(offName(day.off));
		for (const event of day.events) {
			lines.push(event.time ? `${formatTime(event.time)} ${event.title}` : event.title);
		}
		return lines.join('\n') || undefined;
	}

	// --- Auswahl und Tastatur -----------------------------------------------------------------

	let grid: HTMLTableElement;

	function showMonthOf(key: string) {
		const date = parseDateKey(key);
		if (!date) return;
		const current =
			date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
		month = current ? null : { year: date.getFullYear(), month: date.getMonth() };
	}

	async function select(key: string, focus = false) {
		picked = key === todayKey ? null : key;
		showMonthOf(key);
		if (!focus) return;
		await tick();
		grid.querySelector<HTMLElement>(`[data-day="${key}"]`)?.focus();
	}

	function page(delta: number) {
		const next = new Date(shown.getFullYear(), shown.getMonth() + delta, 1);
		month = { year: next.getFullYear(), month: next.getMonth() };
		if (next.getFullYear() === today.getFullYear() && next.getMonth() === today.getMonth()) {
			month = null;
		}
	}

	function goToday() {
		picked = null;
		month = null;
	}

	function onGridKeydown(event: KeyboardEvent) {
		if (event.altKey || event.ctrlKey || event.metaKey) return;
		// Ausgangspunkt ist der fokussierte Tag (er kann vom gewählten abweichen, z. B. nach Blättern)
		const from = (event.target as HTMLElement).dataset.day ?? focusKey;
		const column = ((parseDateKey(from)?.getDay() ?? 0) - weekStartsOn + 7) % 7;
		const years = event.shiftKey ? 12 : 1;
		const target: Record<string, () => string> = {
			ArrowLeft: () => addDays(from, -1),
			ArrowRight: () => addDays(from, 1),
			ArrowUp: () => addDays(from, -7),
			ArrowDown: () => addDays(from, 7),
			Home: () => addDays(from, -column),
			End: () => addDays(from, 6 - column),
			PageUp: () => addMonths(from, -years),
			PageDown: () => addMonths(from, years)
		};
		if (event.key in target) {
			event.preventDefault();
			void select(target[event.key](), true);
		} else if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			// Der Tag hat schon den Fokus; ihn erneut zu setzen, würde dem Dialog den Fokus nehmen
			void select(from);
			if (event.key === 'Enter') newEvent(from);
		}
	}

	// --- Bearbeiten ---------------------------------------------------------------------------

	let eventDialog = $state(false);
	let editingEvent = $state<CalendarEvent | null>(null);
	let offDialog = $state(false);
	let editingOff = $state<OffDayRange | null>(null);
	/** Vorgabe-Tag für neue Einträge */
	let dialogDate = $state('');

	function newEvent(key = selected) {
		editingEvent = null;
		dialogDate = key;
		eventDialog = true;
	}

	function editEvent(event: CalendarEvent) {
		editingEvent = event;
		dialogDate = event.date;
		eventDialog = true;
	}

	function saveEvent(data: Omit<CalendarEvent, 'id'>) {
		const existing = editingEvent && agenda.events.find((e) => e.id === editingEvent?.id);
		if (existing) Object.assign(existing, data);
		else agenda.events.push({ id: createId(), ...data });
		void select(data.date);
	}

	function deleteEvent(event: CalendarEvent) {
		const index = agenda.events.findIndex((e) => e.id === event.id);
		if (index < 0) return;
		const [removed] = agenda.events.splice(index, 1);
		toasts.show(t('calendar.eventDeleted', { name: removed.title }), {
			action: {
				label: t('common.undo'),
				run: () => app.config.value.agenda.events.splice(index, 0, removed)
			}
		});
	}

	function newOff(key = selected) {
		editingOff = null;
		dialogDate = key;
		offDialog = true;
	}

	function editOff(range: OffDayRange) {
		editingOff = range;
		dialogDate = range.start;
		offDialog = true;
	}

	function saveOff(data: Omit<OffDayRange, 'id'>) {
		const existing = editingOff && agenda.offDays.find((r) => r.id === editingOff?.id);
		if (existing) Object.assign(existing, data);
		else agenda.offDays.push({ id: createId(), ...data });
		// Bleibt der gewählte Tag nicht im Zeitraum, springt die Auswahl auf dessen Anfang
		if (selected < data.start || selected > data.end) void select(data.start);
	}

	function deleteOff(range: OffDayRange) {
		const index = agenda.offDays.findIndex((r) => r.id === range.id);
		if (index < 0) return;
		const [removed] = agenda.offDays.splice(index, 1);
		toasts.show(t('calendar.offDeleted', { name: offName(removed) }), {
			action: {
				label: t('common.undo'),
				run: () => app.config.value.agenda.offDays.splice(index, 0, removed)
			}
		});
	}

	// --- Tagesansicht -------------------------------------------------------------------------

	const selectedDate = $derived(parseDateKey(selected) ?? today);
	const sameYear = $derived(selectedDate.getFullYear() === today.getFullYear());
	/** Kurz für die Zeile neben der Legende, lang für Screenreader */
	const selectedShort = $derived(
		(sameYear ? fmt.weekdayShort : fmt.weekdayShortWithYear).format(selectedDate)
	);
	const selectedLong = $derived((sameYear ? fmt.day : fmt.dayWithYear).format(selectedDate));
	const selectedHoliday = $derived(holidays.get(selected));
	const selectedOff = $derived(offDaysOn(agenda.offDays, selected));
	const selectedEvents = $derived(eventMap.get(selected) ?? []);

	/** Weiche Kanten oben/unten, solange die Liste in diese Richtung weiterscrollt */
	let fade = $state({ top: false, bottom: false });

	function updateFade(list: HTMLElement) {
		const top = list.scrollTop > 1;
		const bottom = list.scrollTop + list.clientHeight < list.scrollHeight - 1;
		if (top !== fade.top || bottom !== fade.bottom) fade = { top, bottom };
	}

	/** Neuer Tag: an den Anfang der Liste und Kanten neu bestimmen */
	function watchOverflow(list: HTMLElement) {
		void selected;
		void selectedEvents.length;
		void selectedOff.length;
		list.scrollTop = 0;
		// Ohne untrack hinge das Attachment an `fade` und setzte bei jedem Scrollen zurück
		untrack(() => updateFade(list));
	}

	const titleId = $props.id();
</script>

<div class="calendar">
	<header class="header">
		<h3 class="title" id="{titleId}-month" aria-live="polite">{monthTitle}</h3>
		<div class="nav">
			<button
				type="button"
				class="today-btn btn"
				disabled={month === null && picked === null}
				onclick={goToday}
			>
				{t('calendar.today')}
			</button>
			<button
				type="button"
				class="icon-btn"
				aria-label={t('calendar.previous')}
				onclick={() => page(-1)}
			>
				<Icon name="chevronLeft" />
			</button>
			<button
				type="button"
				class="icon-btn"
				aria-label={t('calendar.next')}
				onclick={() => page(1)}
			>
				<Icon name="chevronRight" />
			</button>
		</div>
	</header>

	<table
		bind:this={grid}
		class="grid"
		class:with-weeks={settings.weekNumbers}
		role="grid"
		aria-labelledby="{titleId}-month"
		aria-describedby="{titleId}-hint"
		onkeydown={onGridKeydown}
	>
		<thead>
			<tr>
				{#if settings.weekNumbers}
					<th class="week-head" scope="col"
						><abbr title={t('calendar.weekNumber')}>{t('calendar.weekShort')}</abbr></th
					>
				{/if}
				{#each weekdays as weekday, i (weekday.long)}
					{@const dayOfWeek = (weekStartsOn + i) % 7}
					<th scope="col" class:weekend={dayOfWeek === 0 || dayOfWeek === 6}>
						<abbr title={weekday.long}>{weekday.short.replace('.', '')}</abbr>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.days[0].key)}
				<tr>
					{#if settings.weekNumbers}
						<th class="week" scope="row" aria-label={t('calendar.week', { week: row.week })}>
							<span>{row.week}</span>
						</th>
					{/if}
					{#each row.days as day (day.key)}
						<td
							class="day"
							class:outside={!day.inMonth}
							class:today={day.isToday}
							class:selected={day.key === selected}
							class:weekend={day.kinds.weekend}
							class:holiday={day.kinds.holiday}
							class:off={day.kinds.off}
							class:join-start={day.joinStart}
							class:join-end={day.joinEnd}
							data-day={day.key}
							tabindex={day.key === focusKey ? 0 : -1}
							title={tooltip(day)}
							aria-label={[fmt.day.format(day.date), ...describe(day)].join(', ')}
							aria-selected={day.key === selected}
							aria-current={day.isToday ? 'date' : undefined}
							onclick={() => select(day.key)}
							ondblclick={() => newEvent(day.key)}
						>
							<span class="number" class:with-dots={day.events.length > 0}>
								{day.date.getDate()}
								{#if day.events.length}
									<span class="dots" aria-hidden="true">
										{#each day.events.slice(0, 3) as event (event.id)}<i></i>{/each}
									</span>
								{/if}
							</span>
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
	<p class="visually-hidden" id="{titleId}-hint">{t('calendar.gridHint')}</p>

	<div class="footer">
		<!-- Alle Einträge immer zeigen, damit die Zeile beim Blättern nicht umbricht -->
		<ul class="legend" aria-label={t('calendar.legend')}>
			<li><span class="swatch weekend"></span>{t('calendar.weekend')}</li>
			{#if settings.holidays}
				<li><span class="swatch holiday"></span>{t('calendar.holiday')}</li>
			{/if}
			<li><span class="swatch off"></span>{t('calendar.off')}</li>
			<li><span class="swatch event"><i></i></span>{t('calendar.event')}</li>
		</ul>
		<div class="day-head">
			<!-- Feste Breite und Kurzform, damit die Zeile nicht von der Länge des Datums abhängt -->
			<h4 class="day-title" class:is-today={selected === todayKey} id="{titleId}-day">
				<span aria-hidden="true">
					{selected === todayKey ? t('calendar.today') : selectedShort}
				</span>
				<span class="visually-hidden">{selectedLong}</span>
			</h4>
			<button
				type="button"
				class="btn add"
				aria-label={t('calendar.addEventFor', { date: selectedLong })}
				onclick={() => newEvent()}
			>
				<Icon name="plus" size={14} />{t('calendar.addEvent')}
			</button>
			<button
				type="button"
				class="btn add"
				aria-label={t('calendar.addOffFor', { date: selectedLong })}
				onclick={() => newOff()}
			>
				<Icon name="plus" size={14} />{t('calendar.addOff')}
			</button>
		</div>
	</div>

	<!-- Feste Höhe: Die Liste scrollt, statt das Panel beim Wechsel des Tags wachsen zu lassen -->
	<div class="agenda">
		{#if selectedHoliday || selectedOff.length || selectedEvents.length}
			<ul
				class="entries"
				class:fade-top={fade.top}
				class:fade-bottom={fade.bottom}
				aria-labelledby="{titleId}-day"
				{@attach watchOverflow}
				onscroll={(event) => updateFade(event.currentTarget)}
			>
				{#each selectedEvents as event (event.id)}
					<li class="entry">
						<span class="lead">
							{#if event.time}
								<time class="time" datetime="{event.date}T{event.time}">
									{formatTime(event.time)}
								</time>
							{:else}
								<span class="swatch event"><i></i></span>
							{/if}
						</span>
						<span class="what" title={event.title}>{event.title}</span>
						<span class="actions">
							<button
								type="button"
								class="icon-btn"
								aria-label={t('calendar.editNamed', { name: event.title })}
								onclick={() => editEvent(event)}
							>
								<Icon name="pencil" size={16} />
							</button>
							<button
								type="button"
								class="icon-btn"
								aria-label={t('calendar.deleteNamed', { name: event.title })}
								onclick={() => deleteEvent(event)}
							>
								<Icon name="trash" size={16} />
							</button>
						</span>
					</li>
				{/each}
				{#each selectedOff as range (range.id)}
					<li class="entry">
						<span class="lead"><span class="swatch off"></span></span>
						<span class="what" title="{offName(range)} · {formatRange(range)}">
							{offName(range)}
							<span class="meta">{formatRange(range)}</span>
						</span>
						<span class="actions">
							<button
								type="button"
								class="icon-btn"
								aria-label={t('calendar.editNamed', { name: offName(range) })}
								onclick={() => editOff(range)}
							>
								<Icon name="pencil" size={16} />
							</button>
							<button
								type="button"
								class="icon-btn"
								aria-label={t('calendar.deleteNamed', { name: offName(range) })}
								onclick={() => deleteOff(range)}
							>
								<Icon name="trash" size={16} />
							</button>
						</span>
					</li>
				{/each}
				{#if selectedHoliday}
					<li class="entry">
						<span class="lead"><span class="swatch holiday"></span></span>
						<span class="what">
							{t(`holiday.${selectedHoliday.id}`)}
							<span class="meta">{t('calendar.holiday')}</span>
						</span>
					</li>
				{/if}
			</ul>
		{:else}
			<p class="empty">{t('calendar.noEvents')}</p>
		{/if}
	</div>
</div>

<EventDialog bind:open={eventDialog} event={editingEvent} date={dialogDate} onsave={saveEvent} />
<OffDayDialog bind:open={offDialog} range={editingOff} date={dialogDate} onsave={saveOff} />

<style>
	.calendar {
		display: grid;
		gap: var(--space-2);
		--weekend-text: var(--accent-text);
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.title {
		font-size: var(--text-lg);
		font-weight: 650;
		letter-spacing: -0.01em;
	}

	.title::first-letter {
		text-transform: uppercase;
	}

	.nav {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.today-btn {
		min-height: 30px;
		margin-right: var(--space-1);
		padding: 0 var(--space-3);
		font-size: var(--text-xs);
	}

	.grid {
		width: 100%;
		border-collapse: separate;
		border-spacing: 2px;
		table-layout: fixed;
		font-variant-numeric: tabular-nums;
	}

	/* Wochentage: klar als Überschrift, Wochenende farblich abgesetzt */
	thead th {
		padding-bottom: var(--space-1);
		border-bottom: 1px solid var(--line);
		font-size: var(--text-xs);
		font-weight: 700;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;

		abbr {
			text-decoration: none;
		}

		&.weekend {
			color: var(--weekend-text);
		}
	}

	tbody tr:first-child > * {
		padding-top: var(--space-1);
	}

	/* KW-Spalte: eigene, ruhige Spalte mit Trennlinie */
	.week-head,
	.week {
		width: 2.4em;
		border-right: 1px solid var(--line);
	}

	.week-head {
		color: var(--text-tertiary);
	}

	.week {
		padding: 0 4px 0 0;

		span {
			display: inline-grid;
			place-items: center;
			min-width: 1.9em;
			height: 1.6em;
			border-radius: var(--radius-xs);
			background: var(--track);
			font-size: var(--text-xs);
			font-weight: 650;
			color: var(--text-secondary);
		}
	}

	/*
	 * Tagesarten, auch ohne Farbe unterscheidbar:
	 * Wochenende = schlichte Fläche, frei = Schraffur nach links unten, Feiertag = Schraffur nach
	 * rechts unten und fette Zahl. Zusammenhängende freie Tage bilden ein Band. Feiertag geht vor
	 * frei, frei vor Wochenende.
	 */
	.day {
		height: 2.1em;
		padding: 0;
		border-radius: var(--radius-xs);
		text-align: center;
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text);
		cursor: pointer;
		outline: none;

		&:focus-visible {
			box-shadow: var(--focus-ring);
		}

		&.weekend {
			background: var(--fill);
			color: var(--weekend-text);
		}

		&.off {
			background: repeating-linear-gradient(
				-45deg,
				var(--off-fill) 0 4px,
				var(--off-stripe) 4px 8px
			);
			color: var(--off);

			&.join-start {
				border-start-start-radius: 0;
				border-end-start-radius: 0;
			}

			&.join-end {
				border-start-end-radius: 0;
				border-end-end-radius: 0;
			}
		}

		&.holiday {
			background: repeating-linear-gradient(
				45deg,
				var(--holiday-fill) 0 4px,
				var(--holiday-stripe) 4px 8px
			);
			color: var(--holiday);

			.number {
				font-weight: 800;
			}
		}

		/* Tage aus Vor- und Folgemonat deutlich zurücknehmen */
		&.outside {
			font-weight: 400;
			opacity: 0.4;

			&:not(.weekend, .off, .holiday) {
				opacity: 0.32;
			}
		}
	}

	.number {
		position: relative;
		display: inline-grid;
		place-items: center;
		width: 1.9em;
		height: 1.9em;
		border-radius: 50%;
		transition: box-shadow var(--duration-fast) ease;
	}

	/* Gewählter Tag: Ring; heute: gefüllter Kreis */
	.day.selected .number {
		box-shadow: inset 0 0 0 2px var(--accent-text);
	}

	.day.today .number {
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--accent-hover) 80%, white),
			var(--accent)
		);
		color: var(--on-accent);
		font-weight: 800;
		box-shadow:
			inset 0 1px 0 rgb(255 255 255 / 0.45),
			0 3px 8px -3px color-mix(in srgb, var(--accent) 80%, transparent);
	}

	.day.today.selected .number {
		box-shadow:
			inset 0 1px 0 rgb(255 255 255 / 0.45),
			0 0 0 2px var(--focus-gap),
			0 0 0 3.5px var(--accent);
	}

	/* Termine: bis zu drei Punkte unter der Zahl, innerhalb von Kreis und Auswahlring */
	.number.with-dots {
		padding-bottom: 5px;
	}

	.dots {
		position: absolute;
		bottom: 4px;
		left: 50%;
		display: flex;
		gap: 2px;
		transform: translateX(-50%);

		i {
			width: 3.5px;
			height: 3.5px;
			border-radius: 50%;
			background: var(--accent-text);
		}
	}

	.day.today .dots i {
		background: var(--on-accent);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-3);
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--text-xs);
		color: var(--text-secondary);

		li {
			display: inline-flex;
			align-items: center;
			gap: 6px;
		}
	}

	/* Muster wie im Raster, im Kleinen */
	.swatch {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: 14px;
		height: 14px;
		border-radius: 4px;

		&.weekend {
			background: var(--fill);
			box-shadow: inset 0 0 0 1px var(--line);
		}

		&.holiday {
			background: repeating-linear-gradient(
				45deg,
				var(--holiday-fill) 0 2.5px,
				var(--holiday-stripe) 2.5px 5px
			);
			box-shadow: inset 0 0 0 1px var(--line);
		}

		&.off {
			background: repeating-linear-gradient(
				-45deg,
				var(--off-fill) 0 2.5px,
				var(--off-stripe) 2.5px 5px
			);
			box-shadow: inset 0 0 0 1px var(--line);
		}

		&.event i {
			width: 5px;
			height: 5px;
			border-radius: 50%;
			background: var(--accent-text);
		}
	}

	/* Legende links, gewählter Tag mit Knöpfen rechts; bricht nur bei schmalen Panels um */
	.footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2) var(--space-4);
	}

	.day-head {
		display: flex;
		flex: none;
		align-items: center;
		gap: var(--space-1);
		margin-left: auto;
	}

	.day-title {
		width: 8.5rem;
		margin-right: var(--space-1);
		overflow: hidden;
		font-size: var(--text-sm);
		font-weight: 700;
		text-align: right;
		text-overflow: ellipsis;
		white-space: nowrap;

		&.is-today span {
			padding: 1px 8px;
			border-radius: var(--radius-full);
			background: var(--accent);
			color: var(--on-accent);
			font-size: var(--text-xs);
		}
	}

	.add {
		min-height: 28px;
		padding: 0 var(--space-3) 0 var(--space-2);
		gap: var(--space-1);
		font-size: var(--text-xs);
	}

	.agenda {
		--entry-height: 32px;
		padding-top: var(--space-2);
		border-top: 1px solid var(--line);
	}

	/* Genau eine Zeile hoch; weitere Einträge per Scrollen, jeweils zeilenweise einrastend */
	.entries {
		display: grid;
		grid-template-columns: max-content 1fr auto;
		column-gap: var(--space-3);
		height: var(--entry-height);
		margin: 0;
		padding: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		scroll-snap-type: y mandatory;
		scrollbar-width: thin;
		list-style: none;
		--fade: 8px;

		&.fade-top {
			mask-image: linear-gradient(transparent, #000 var(--fade));
		}

		&.fade-bottom {
			mask-image: linear-gradient(#000 calc(100% - var(--fade)), transparent);
		}

		&.fade-top.fade-bottom {
			mask-image: linear-gradient(
				transparent,
				#000 var(--fade),
				#000 calc(100% - var(--fade)),
				transparent
			);
		}
	}

	.entry {
		display: grid;
		grid-template-columns: subgrid;
		grid-column: 1 / -1;
		align-items: center;
		height: var(--entry-height);
		scroll-snap-align: start;
		font-size: var(--text-sm);
	}

	.lead {
		display: flex;
		justify-content: flex-end;
	}

	.time {
		font-weight: 650;
		font-variant-numeric: tabular-nums;
		color: var(--text-secondary);
	}

	.what {
		min-width: 0;
		overflow: hidden;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meta {
		margin-left: var(--space-1);
		font-weight: 400;
		color: var(--text-secondary);
	}

	.actions {
		display: flex;
	}

	.empty {
		display: flex;
		align-items: center;
		height: var(--entry-height);
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}
</style>
