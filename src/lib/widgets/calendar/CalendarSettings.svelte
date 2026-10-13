<script lang="ts">
	import { t } from '$lib/i18n/index.svelte';
	import Segmented from '$lib/ui/Segmented.svelte';
	import Switch from '$lib/ui/Switch.svelte';
	import type { WidgetSettingsProps } from '../types';
	import { GERMAN_STATES } from './holidays';
	import type { CalendarSettings } from './settings';

	let { settings, update }: WidgetSettingsProps<CalendarSettings> = $props();
	const id = $props.id();
</script>

<div class="form">
	<div class="row">
		<span class="field-label">{t('calendar.weekStart')}</span>
		<Segmented
			label={t('calendar.weekStart')}
			value={settings.weekStart}
			options={[
				{ value: 'monday', label: t('calendar.monday') },
				{ value: 'sunday', label: t('calendar.sunday') }
			]}
			onchange={(value) => update((s) => (s.weekStart = value))}
		/>
	</div>
	<Switch
		label={t('calendar.weekNumbers')}
		checked={settings.weekNumbers}
		onchange={(value) => update((s) => (s.weekNumbers = value))}
	/>
	<Switch
		label={t('calendar.holidays')}
		checked={settings.holidays}
		onchange={(value) => update((s) => (s.holidays = value))}
	/>
	{#if settings.holidays}
		<div class="field">
			<label class="field-label" for="{id}-region">{t('calendar.region')}</label>
			<select
				id="{id}-region"
				class="select"
				value={settings.region}
				onchange={(event) =>
					update((s) => (s.region = event.currentTarget.value as CalendarSettings['region']))}
			>
				<option value="none">{t('region.none')}</option>
				{#each GERMAN_STATES as state (state)}
					<option value={state}>{t(`region.${state}`)}</option>
				{/each}
			</select>
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
