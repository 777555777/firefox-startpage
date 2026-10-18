<script lang="ts">
	import { i18n, t } from '$lib/i18n/index.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import { everyMinute, everySecond } from '$lib/utils/now.svelte';
	import type { WidgetProps } from '../types';
	import type { ClockSettings } from './settings';
	import { sunTimes } from './sun';

	let { settings }: WidgetProps<ClockSettings> = $props();

	const now = $derived(settings.showSeconds ? everySecond.current : everyMinute.current);

	const timeFormat = $derived(
		new Intl.DateTimeFormat(i18n.lang, {
			hour: settings.hourCycle === '12' ? 'numeric' : '2-digit',
			minute: '2-digit',
			second: settings.showSeconds ? '2-digit' : undefined,
			...(settings.hourCycle !== 'auto' && {
				hourCycle: settings.hourCycle === '12' ? 'h12' : 'h23'
			})
		})
	);

	/** Wie die Uhr, aber immer ohne Sekunden */
	const sunFormat = $derived(
		new Intl.DateTimeFormat(i18n.lang, {
			hour: settings.hourCycle === '12' ? 'numeric' : '2-digit',
			minute: '2-digit',
			...(settings.hourCycle !== 'auto' && {
				hourCycle: settings.hourCycle === '12' ? 'h12' : 'h23'
			})
		})
	);

	/** Ändert sich nur beim Tageswechsel, damit nicht jede Minute neu gerechnet wird */
	const today = $derived(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime());

	const sun = $derived.by(() => {
		const { showSun, latitude, longitude } = settings;
		if (!showSun || latitude === null || longitude === null) return null;
		return sunTimes(new Date(today), latitude, longitude);
	});

	const dateFormat = $derived(
		new Intl.DateTimeFormat(
			i18n.lang,
			settings.dateStyle === 'long'
				? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
				: { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }
		)
	);

	/** Stunden/Minuten groß, Sekunden und AM/PM kleiner */
	const parts = $derived.by(() => {
		const all = timeFormat.formatToParts(now);
		const secondIndex = all.findIndex((p) => p.type === 'second');
		const main = all
			.filter((p, i) => p.type !== 'dayPeriod' && (secondIndex === -1 || i < secondIndex - 1))
			.map((p) => p.value)
			.join('')
			.trim();
		return {
			main,
			seconds: secondIndex === -1 ? '' : all[secondIndex].value,
			period: all.find((p) => p.type === 'dayPeriod')?.value ?? ''
		};
	});

	/**
	 * Ungefähre Breite der Uhrzeit in em: Ziffern sind gleich breit, Sekunden und AM/PM kleiner.
	 * Daraus ergibt sich die Schriftgröße, bei der sie gerade in das Panel passt.
	 */
	const widthEm = $derived(
		parts.main.length * 0.6 + (parts.seconds ? 0.7 : 0) + (parts.period ? 0.95 : 0)
	);
</script>

<div class="clock">
	<time
		class="time"
		style:--width-em={widthEm}
		datetime={now.toISOString()}
		aria-label={t('clock.label')}
	>
		<span class="main">{parts.main}</span>
		{#if parts.seconds}<span class="seconds">{parts.seconds}</span>{/if}
		{#if parts.period}<span class="period">{parts.period}</span>{/if}
	</time>
	{#if settings.showDate}
		<p class="date">{dateFormat.format(now)}</p>
	{/if}
	{#if sun}
		<p class="sun">
			{#if sun.kind === 'normal'}
				{#each [{ icon: 'sunrise', label: 'clock.sunrise', at: sun.sunrise }, { icon: 'sunset', label: 'clock.sunset', at: sun.sunset }] as const as event (event.icon)}
					<span class="sun-event" title={t(event.label)}>
						<Icon name={event.icon} size={18} />
						<span class="visually-hidden">{t(event.label)}</span>
						<time datetime={event.at.toISOString()}>{sunFormat.format(event.at)}</time>
					</span>
				{/each}
			{:else}
				<span class="sun-event">
					<Icon name={sun.kind === 'polarDay' ? 'sunrise' : 'sunset'} size={18} />
					{t(sun.kind === 'polarDay' ? 'clock.polarDay' : 'clock.polarNight')}
				</span>
			{/if}
		</p>
	{/if}
</div>

<style>
	/* Schriftgröße folgt der Breite des Panels, nicht des Fensters */
	.clock {
		container-type: inline-size;
		display: grid;
		gap: var(--space-1);
		padding: var(--space-2) var(--space-1);
	}

	.time {
		display: flex;
		align-items: baseline;
		gap: 0.12em;
		font-size: clamp(1.75rem, calc(100cqi / var(--width-em)), var(--text-display));
		font-weight: 300;
		line-height: 1;
		letter-spacing: -0.035em;
		font-variant-numeric: tabular-nums;
	}

	.seconds,
	.period {
		font-size: 0.38em;
		font-weight: 500;
		letter-spacing: 0;
		color: var(--text-secondary);
	}

	.period {
		margin-left: 0.2em;
		text-transform: uppercase;
	}

	.date {
		font-size: var(--text-lg);
		font-weight: 500;
		color: var(--text-secondary);
	}

	.sun {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
		font-weight: 500;
		color: var(--text-secondary);
		font-variant-numeric: tabular-nums;
	}

	.sun-event {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}
</style>
