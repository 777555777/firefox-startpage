<script lang="ts">
	import { i18n, t } from '$lib/i18n/index.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import { litPath, moonPhase, moonTimes, nextMajorPhase } from './moon';
	import { CIVIL_ZENITH, dayLength, dayProgress, sunDay, sunTimes } from './sun';

	let {
		now,
		latitude,
		longitude,
		showSun,
		showMoon,
		timeFormat
	}: {
		now: Date;
		latitude: number;
		longitude: number;
		showSun: boolean;
		showMoon: boolean;
		/** Format der Uhr ohne Sekunden */
		timeFormat: Intl.DateTimeFormat;
	} = $props();

	/** Ändert sich nur beim Tageswechsel, damit Mondauf- und -untergang nicht jede Minute laufen */
	const today = $derived(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime());

	/** Der Sonnentag, zu dem `now` gehört (bei stark abweichender Zeitzone nicht immer heute) */
	const current = $derived(sunDay(now, latitude, longitude));
	const sun = $derived(current.times);
	const sunDate = $derived(current.date.getTime());
	const civil = $derived(sunTimes(new Date(sunDate), latitude, longitude, CIVIL_ZENITH));
	const length = $derived(dayLength(sun));
	const change = $derived.by(() => {
		const day = new Date(sunDate);
		const yesterday = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1);
		return length - dayLength(sunTimes(yesterday, latitude, longitude));
	});

	const moon = $derived(showMoon ? moonTimes(new Date(today), latitude, longitude) : null);
	const phase = $derived(moonPhase(now));
	const next = $derived(nextMajorPhase(now));

	// --- Sonnenbogen ------------------------------------------------------------------------

	/** Zeichenfläche: Horizont unten, Aufgang links, Untergang rechts */
	const W = 300;
	const HORIZON = 54;
	const LEFT = 26;
	const RIGHT = W - 26;
	const PEAK = 44;

	const point = (p: number) => ({
		x: LEFT + (RIGHT - LEFT) * p,
		y: HORIZON - PEAK * Math.sin(Math.PI * p)
	});
	/** Bogen von 0 bis `to` als Polylinie (genügend fein für eine glatte Kurve) */
	const arc = (to: number) =>
		Array.from({ length: 49 }, (_, i) => point((to * i) / 48))
			.map(({ x, y }, i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`)
			.join('');

	const progress = $derived(
		sun.kind === 'normal' ? dayProgress(now, sun.sunrise, sun.sunset) : null
	);
	/** Dämmerung als Strecken auf dem Horizont, im selben Zeitmaßstab wie der Bogen */
	const twilight = $derived.by(() => {
		if (sun.kind !== 'normal' || civil.kind !== 'normal') return null;
		const scale = (RIGHT - LEFT) / (sun.sunset.getTime() - sun.sunrise.getTime());
		return {
			dawn: Math.max(4, LEFT - (sun.sunrise.getTime() - civil.sunrise.getTime()) * scale),
			dusk: Math.min(W - 4, RIGHT + (civil.sunset.getTime() - sun.sunset.getTime()) * scale)
		};
	});

	const duration = (minutes: number) =>
		t('clock.duration', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
	const signed = (minutes: number) =>
		`${minutes > 0 ? '+' : minutes < 0 ? '−' : '±'}${Math.abs(minutes)}`;

	// --- Mond -------------------------------------------------------------------------------

	const nextFormat = $derived(
		new Intl.DateTimeFormat(i18n.lang, { weekday: 'short', day: 'numeric', month: 'short' })
	);
	const percent = $derived(
		new Intl.NumberFormat(i18n.lang, { style: 'percent' }).format(phase.illumination)
	);
	const MOON_R = 20;
</script>

<section class="sky" aria-label={t('clock.sky')}>
	{#if showSun}
		<div class="sun-part">
			{#if sun.kind === 'normal'}
				<svg class="arc" viewBox="0 0 {W} {HORIZON + 4}" aria-hidden="true">
					<line class="horizon" x1="4" x2={W - 4} y1={HORIZON} y2={HORIZON} />
					{#if twilight}
						<line class="twilight" x1={twilight.dawn} x2={LEFT} y1={HORIZON} y2={HORIZON} />
						<line class="twilight" x1={RIGHT} x2={twilight.dusk} y1={HORIZON} y2={HORIZON} />
					{/if}
					<path class="path" class:night={progress === null} d={arc(1)} />
					{#if progress !== null}
						{@const at = point(progress)}
						<path class="travelled" d={arc(progress)} />
						<circle class="glow" cx={at.x} cy={at.y} r="10" />
						<circle class="sun" cx={at.x} cy={at.y} r="5.5" />
					{/if}
				</svg>
				<div class="sun-row">
					<span class="event" title={t('clock.sunrise')}>
						<span class="visually-hidden">{t('clock.sunrise')}</span>
						<time datetime={sun.sunrise.toISOString()}>{timeFormat.format(sun.sunrise)}</time>
					</span>
					<span class="length" title={t('clock.dayLengthChange', { delta: signed(change) })}>
						<span class="visually-hidden">{t('clock.dayLength')}</span>
						{duration(length)}
						<span class="change" aria-hidden="true">{signed(change)}</span>
						<span class="visually-hidden">
							{t('clock.dayLengthChange', { delta: signed(change) })}
						</span>
					</span>
					<span class="event" title={t('clock.sunset')}>
						<span class="visually-hidden">{t('clock.sunset')}</span>
						<time datetime={sun.sunset.toISOString()}>{timeFormat.format(sun.sunset)}</time>
					</span>
				</div>
			{:else}
				<p class="polar">
					<Icon name={sun.kind === 'polarDay' ? 'sunrise' : 'sunset'} size={18} />
					{t(sun.kind === 'polarDay' ? 'clock.polarDay' : 'clock.polarNight')}
				</p>
			{/if}
		</div>
	{/if}

	{#if showMoon && moon}
		<div class="moon">
			<svg
				class="disc"
				viewBox="{-MOON_R - 1} {-MOON_R - 1} {2 * MOON_R + 2} {2 * MOON_R + 2}"
				aria-hidden="true"
			>
				<circle class="dark" r={MOON_R} />
				<!-- Auf der Südhalbkugel steht die Sichel seitenverkehrt -->
				<path
					class="lit"
					d={litPath(phase.phase, MOON_R)}
					transform={latitude < 0 ? 'scale(-1 1)' : undefined}
				/>
			</svg>
			<div class="moon-text">
				<p class="moon-name">{t(`moon.${phase.name}`)}</p>
				<p class="moon-times">
					{#if moon.alwaysUp || moon.alwaysDown}
						{t(moon.alwaysUp ? 'clock.moonAlwaysUp' : 'clock.moonAlwaysDown')}
					{:else}
						{#each [{ icon: 'rise', label: 'clock.moonrise', none: 'clock.noMoonrise', at: moon.rise }, { icon: 'set', label: 'clock.moonset', none: 'clock.noMoonset', at: moon.set }] as const as event (event.icon)}
							<span class="event" title={t(event.label)}>
								<Icon name={event.icon} size={15} />
								<span class="visually-hidden">{t(event.label)}</span>
								{#if event.at}
									<time datetime={event.at.toISOString()}>{timeFormat.format(event.at)}</time>
								{:else}
									<span title={t(event.none)}>–</span>
									<span class="visually-hidden">{t(event.none)}</span>
								{/if}
							</span>
						{/each}
					{/if}
				</p>
				<p class="meta">
					{t('clock.illumination', { percent })} ·
					{t(next.kind === 'full' ? 'clock.nextFull' : 'clock.nextNew', {
						date: nextFormat.format(next.at)
					})}
				</p>
			</div>
		</div>
	{/if}
</section>

<style>
	/*
	 * Sonne und Mond untereinander, jeweils einzeln abschaltbar. Feste Höchstbreite: Der Bogen hat
	 * ein festes Seitenverhältnis, die Zeiten stehen an seinen Enden.
	 */
	.sky {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		max-width: 22rem;
		/* Gleich wie `gap`, damit sich zusätzliche Höhe exakt gleichmäßig verteilt */
		margin-top: var(--space-3);
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--text-secondary);
		font-variant-numeric: tabular-nums;
	}

	/* Bei zusätzlicher Höhe gleich viel Luft über und unter der Sonne, der Mond rückt nach unten */
	.sun-part {
		display: grid;
		gap: var(--space-1);
		margin-block: auto;
	}

	/* --- Sonne --- */

	.arc {
		display: block;
		width: 100%;
		overflow: visible;
		fill: none;
		stroke-linecap: round;
	}

	.horizon {
		stroke: var(--line);
		stroke-width: 1.5;
	}

	.twilight {
		stroke: var(--sun-dim);
		stroke-width: 3;
	}

	.path {
		stroke: var(--text-tertiary);
		stroke-width: 1.5;
		stroke-dasharray: 2 4;

		&.night {
			opacity: 0.6;
		}
	}

	.travelled {
		stroke: var(--sun);
		stroke-width: 2.5;
	}

	.glow {
		fill: var(--sun-dim);
	}

	.sun {
		fill: var(--sun);
		stroke: rgb(255 255 255 / 0.8);
		stroke-width: 1.5;
	}

	.sun-row {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: var(--space-2);

		.event:last-child {
			justify-self: end;
		}
	}

	.event {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	.length {
		font-size: var(--text-xs);
		color: var(--text-secondary);
	}

	.change {
		margin-left: 2px;
		color: var(--text-tertiary);
	}

	.polar {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	/* --- Mond --- */

	/* Ohne Sonne rückt der Mond allein nach unten; mit Sonne teilen sich deren Ränder den Platz */
	.moon {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: var(--space-3);
		margin-top: auto;

		.sun-part + & {
			margin-top: 0;
		}
	}

	.disc {
		width: 52px;
		height: 52px;
	}

	.dark {
		fill: var(--track-strong);
		stroke: var(--text-tertiary);
		stroke-width: 1;
	}

	.lit {
		fill: var(--moon-lit);
	}

	.moon-text {
		display: grid;
		gap: 2px;
		min-width: 0;
	}

	.moon-name {
		color: var(--text);
		font-weight: 600;
	}

	.moon-times {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--space-3);
	}

	.meta {
		font-size: var(--text-xs);
		font-weight: 500;
		color: var(--text-secondary);
	}
</style>
