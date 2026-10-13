<script lang="ts">
	import { t } from '$lib/i18n/index.svelte';
	import Segmented from '$lib/ui/Segmented.svelte';
	import Switch from '$lib/ui/Switch.svelte';
	import type { WidgetSettingsProps } from '../types';
	import type { ClockSettings } from './settings';

	let { settings, update }: WidgetSettingsProps<ClockSettings> = $props();
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
</div>

<style>
	.form {
		display: grid;
		gap: var(--space-4);
	}

	.row {
		display: grid;
		gap: var(--space-2);
		justify-items: start;
	}
</style>
