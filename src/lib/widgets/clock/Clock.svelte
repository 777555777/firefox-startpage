<script lang="ts">
	import { i18n, t } from '$lib/i18n/index.svelte';
	import { everyMinute, everySecond } from '$lib/utils/now.svelte';
	import type { WidgetProps } from '../types';
	import type { ClockSettings } from './settings';
	import SkyBand from './SkyBand.svelte';

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

	/** Sonne und Mond brauchen Koordinaten; ohne sie bleibt der Bereich leer */
	const location = $derived(
		(settings.showSun || settings.showMoon) &&
			settings.latitude !== null &&
			settings.longitude !== null
			? { latitude: settings.latitude, longitude: settings.longitude }
			: null
	);

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
	<div class="top">
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
	</div>
	{#if location}
		<SkyBand
			now={everyMinute.current}
			{...location}
			showSun={settings.showSun}
			showMoon={settings.showMoon}
			timeFormat={sunFormat}
		/>
	{/if}
</div>

<style>
	/*
	 * Schriftgröße folgt der Breite des Panels, nicht des Fensters. Wird das Panel von einem
	 * höheren Nachbarn gestreckt, füllt die Uhr die Höhe: Zeit oben, Sonne mittig, Mond unten
	 * (Verteilung in SkyBand).
	 */
	.clock {
		container-type: inline-size;
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: var(--space-2) var(--space-1);
	}

	.top {
		display: grid;
		gap: var(--space-1);
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

	/* Kompakt: weniger Luft und eine etwas kleinere Uhrzeit, das Datum bleibt gleich groß */
	:global(:root[data-density='compact']) {
		.clock {
			padding-block: 0;
		}

		.time {
			font-size: clamp(1.75rem, calc(100cqi / var(--width-em)), 3.75rem);
		}
	}
</style>
