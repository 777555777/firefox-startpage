<script lang="ts">
	import { t } from '$lib/i18n/index.svelte';
	import Segmented from '$lib/ui/Segmented.svelte';
	import Switch from '$lib/ui/Switch.svelte';
	import type { WidgetSettingsProps } from '../types';
	import type { ClockSettings } from './settings';
	import { parseCoordinate } from './sun';

	let { settings, update }: WidgetSettingsProps<ClockSettings> = $props();
	const id = $props.id();

	const coordinates = [
		{ key: 'latitude', max: 90, label: 'clock.latitude', error: 'clock.latitudeError' },
		{ key: 'longitude', max: 180, label: 'clock.longitude', error: 'clock.longitudeError' }
	] as const;

	/** Ungültige Eingaben bleiben im Feld stehen, gespeichert wird nur ein gültiger Wert */
	let invalid = $state({ latitude: false, longitude: false });

	function setCoordinate(key: 'latitude' | 'longitude', max: number, text: string) {
		const value = parseCoordinate(text, max);
		invalid[key] = value === undefined;
		if (value !== undefined) update((s) => (s[key] = value));
	}
</script>

<div class="form">
	<Switch
		label={t('clock.showSeconds')}
		checked={settings.showSeconds}
		onchange={(value) => update((s) => (s.showSeconds = value))}
	/>
	<div class="row">
		<span class="field-label">{t('clock.hourCycle')}</span>
		<Segmented
			label={t('clock.hourCycle')}
			value={settings.hourCycle}
			options={[
				{ value: 'auto', label: t('clock.hourCycleAuto') },
				{ value: '24', label: t('clock.h24') },
				{ value: '12', label: t('clock.h12') }
			]}
			onchange={(value) => update((s) => (s.hourCycle = value))}
		/>
	</div>
	<Switch
		label={t('clock.showDate')}
		checked={settings.showDate}
		onchange={(value) => update((s) => (s.showDate = value))}
	/>
	{#if settings.showDate}
		<div class="row">
			<span class="field-label">{t('clock.dateStyle')}</span>
			<Segmented
				label={t('clock.dateStyle')}
				value={settings.dateStyle}
				options={[
					{ value: 'short', label: t('clock.dateShort') },
					{ value: 'long', label: t('clock.dateLong') }
				]}
				onchange={(value) => update((s) => (s.dateStyle = value))}
			/>
		</div>
	{/if}
	<Switch
		label={t('clock.sun')}
		checked={settings.showSun}
		onchange={(value) => update((s) => (s.showSun = value))}
	/>
	<div class="field">
		<Switch
			label={t('clock.moon')}
			checked={settings.showMoon}
			onchange={(value) => update((s) => (s.showMoon = value))}
		/>
		{#if settings.showSun && settings.showMoon}
			<p class="field-hint">{t('clock.skyHint')}</p>
		{/if}
	</div>
	{#if settings.showSun || settings.showMoon}
		<p class="field-hint">{t('clock.sunHint')}</p>
		<div class="coordinates">
			{#each coordinates as c (c.key)}
				<div class="field">
					<label class="field-label" for="{id}-{c.key}">{t(c.label)}</label>
					<input
						id="{id}-{c.key}"
						class="input"
						type="text"
						inputmode="decimal"
						autocomplete="off"
						spellcheck="false"
						value={settings[c.key] ?? ''}
						aria-invalid={invalid[c.key]}
						aria-describedby={invalid[c.key] ? `${id}-${c.key}-error` : undefined}
						onchange={(event) => setCoordinate(c.key, c.max, event.currentTarget.value)}
					/>
					{#if invalid[c.key]}
						<p class="field-error" id="{id}-{c.key}-error">{t(c.error)}</p>
					{/if}
				</div>
			{/each}
		</div>
		{#if settings.latitude === null || settings.longitude === null}
			<p class="field-hint">{t('clock.sunMissing')}</p>
		{/if}
	{/if}
</div>

<style>
	.form {
		display: grid;
		gap: var(--space-4);
	}

	.coordinates {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
		gap: var(--space-3);
	}

	.row {
		display: grid;
		gap: var(--space-2);
		justify-items: start;
	}
</style>
