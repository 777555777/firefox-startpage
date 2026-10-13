<script lang="ts">
	import type { Quality } from '$lib/config/types';
	import { renderState } from '$lib/glass/render-state.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { getApp } from '$lib/state/context';

	const app = getApp();
	const id = $props.id();
	const qualities: Quality[] = ['auto', 'high', 'medium', 'low', 'static'];
	const quality = $derived(app.config.value.appearance.quality);
</script>

<div class="section">
	<div class="field">
		<label class="field-label" for="{id}-quality">{t('settings.quality')}</label>
		<select id="{id}-quality" class="select" bind:value={app.config.value.appearance.quality}>
			{#each qualities as option (option)}
				<option value={option}>{t(`quality.${option}`)}</option>
			{/each}
		</select>
		{#if quality === 'auto'}
			<p class="field-hint">{t('settings.qualityAuto')}</p>
		{/if}
	</div>

	<div class="field">
		<span class="field-label">{t('render.current')}</span>
		<p class="status" aria-live="polite">
			{#if renderState.mode === 'webgl' && renderState.level}
				{t('render.webgl', { level: t(`quality.${renderState.level}`) })}
				<span class="detail">
					{renderState.fps > 0 ? t('render.fps', { fps: renderState.fps }) : t('render.onDemand')}
				</span>
			{:else}
				{t('render.static')}
			{/if}
		</p>
		{#if quality !== 'static' && renderState.failure}
			<p class="field-hint warning">
				{t(renderState.failure === 'lost' ? 'render.lost' : 'render.unavailable')}
			</p>
		{/if}
	</div>
</div>

<style>
	.section {
		display: grid;
		gap: var(--space-5);
		max-width: 400px;
	}

	.status {
		display: grid;
		gap: 2px;
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-md);
		background: var(--fill);
		box-shadow: inset 0 0 0 1px var(--line);
		font-weight: 600;
	}

	.detail {
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--text-secondary);
		font-variant-numeric: tabular-nums;
	}

	.warning {
		color: var(--danger);
		font-weight: 600;
	}
</style>
