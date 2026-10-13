<script lang="ts">
	import { i18n, t } from '$lib/i18n/index.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import { everyMinute } from '$lib/utils/now.svelte';
	import type { WidgetProps } from '../types';
	import { dateKey, holidayMap, type Holiday } from './holidays';
	import { getMonthGrid, getWeekdayNames } from './month-grid';
	import type { CalendarSettings } from './settings';

	let { settings }: WidgetProps<CalendarSettings> = $props();

	const today = $derived(everyMinute.current);
	/** Abstand des angezeigten Monats zum aktuellen Monat */
	let offset = $state(0);

	const weekStartsOn = $derived(settings.weekStart === 'sunday' ? 0 : 1);
	const shown = $derived(new Date(today.getFullYear(), today.getMonth() + offset, 1));
	const weeks = $derived(getMonthGrid(shown.getFullYear(), shown.getMonth(), today, weekStartsOn));
	const weekdays = $derived(getWeekdayNames(i18n.lang, weekStartsOn));
	const holidays = $derived(
		settings.holidays
			? holidayMap(
					weeks.flatMap((w) => [w.days[0].date.getFullYear(), w.days[6].date.getFullYear()]),
					settings.region
				)
			: new Map<string, Holiday>()
	);

	const monthTitle = $derived(
		new Intl.DateTimeFormat(i18n.lang, { month: 'long', year: 'numeric' }).format(shown)
	);
	const dayLabel = $derived(
		new Intl.DateTimeFormat(i18n.lang, { weekday: 'long', day: 'numeric', month: 'long' })
	);
	const titleId = $props.id();
</script>

<div class="calendar">
	<header class="header">
		<h3 class="title" id={titleId} aria-live="polite">{monthTitle}</h3>
		<div class="nav">
			<button
				type="button"
				class="today-btn btn"
				disabled={offset === 0}
				onclick={() => (offset = 0)}
			>
				{t('calendar.today')}
			</button>
			<button
				type="button"
				class="icon-btn"
				aria-label={t('calendar.previous')}
				onclick={() => offset--}
			>
				<Icon name="chevronLeft" />
			</button>
			<button
				type="button"
				class="icon-btn"
				aria-label={t('calendar.next')}
				onclick={() => offset++}
			>
				<Icon name="chevronRight" />
			</button>
		</div>
	</header>

	<table class="grid" class:with-weeks={settings.weekNumbers} aria-labelledby={titleId}>
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
			{#each weeks as week (week.days[0].date.getTime())}
				<tr>
					{#if settings.weekNumbers}
						<th class="week" scope="row" aria-label={t('calendar.week', { week: week.week })}>
							<span>{week.week}</span>
						</th>
					{/if}
					{#each week.days as day (day.date.getTime())}
						{@const holiday = holidays.get(dateKey(day.date))}
						{@const holidayName = holiday ? t(`holiday.${holiday.id}`) : ''}
						{@const weekend = day.date.getDay() === 0 || day.date.getDay() === 6}
						<td
							class="day"
							class:outside={!day.inMonth}
							class:today={day.isToday}
							class:holiday
							class:weekend
							title={holidayName || undefined}
							aria-label={holidayName
								? `${dayLabel.format(day.date)}, ${holidayName}`
								: dayLabel.format(day.date)}
							aria-current={day.isToday ? 'date' : undefined}
						>
							<span>{day.date.getDate()}</span>
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.calendar {
		display: grid;
		gap: var(--space-3);
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
		padding-bottom: var(--space-2);
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
			background: rgb(12 31 51 / 0.07);
			font-size: var(--text-xs);
			font-weight: 650;
			color: var(--text-secondary);
		}
	}

	.calendar {
		--weekend-text: color-mix(in srgb, var(--accent-pressed) 75%, var(--text));
		--holiday-text: #b4182f;
	}

	.day {
		height: 2.3em;
		padding: 0;
		text-align: center;
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text);

		span {
			position: relative;
			display: inline-grid;
			place-items: center;
			width: 2em;
			height: 2em;
			border-radius: 50%;
		}

		/* Wochenende: getönte Fläche und Akzent-Schrift */
		&.weekend {
			border-radius: var(--radius-xs);
			background: rgb(255 255 255 / 0.22);
			color: var(--weekend-text);
		}

		/* Tage aus Vor- und Folgemonat deutlich zurücknehmen */
		&.outside {
			font-weight: 400;
			color: var(--text);
			opacity: 0.32;
		}

		/* Feiertage: rot mit Punkt, wie im gedruckten Kalender */
		&.holiday {
			color: var(--holiday-text);
			cursor: help;

			span {
				font-weight: 800;
			}

			span::after {
				content: '';
				position: absolute;
				bottom: 1px;
				left: 50%;
				width: 4px;
				height: 4px;
				border-radius: 50%;
				background: currentColor;
				transform: translateX(-50%);
			}
		}

		&.today span {
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
	}
</style>
