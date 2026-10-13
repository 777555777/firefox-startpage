<script lang="ts">
	import type { Quality } from '$lib/config/types';
	import { t } from '$lib/i18n/index.svelte';
	import { getApp } from '$lib/state/context';

	const app = getApp();
	const id = $props.id();
	const qualities: Quality[] = ['auto', 'high', 'medium', 'low', 'static'];
</script>

<div class="section">
	<div class="field">
		<label class="field-label" for="{id}-quality">{t('settings.quality')}</label>
		<select id="{id}-quality" class="select" bind:value={app.config.value.appearance.quality}>
			{#each qualities as quality (quality)}
				<option value={quality}>{t(`quality.${quality}`)}</option>
			{/each}
		</select>
		<p class="field-hint">{t('settings.qualityNote')}</p>
	</div>
</div>

<style>
	.section {
		display: grid;
		gap: var(--space-5);
		max-width: 360px;
	}
</style>
