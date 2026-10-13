<script lang="ts">
	import { t } from '$lib/i18n/index.svelte';
	import { getApp } from '$lib/state/context';
	import { formatMinutes, minutesOf } from '$lib/theme/phase';
	import Icon from '$lib/ui/Icon.svelte';
	import { GLASS_RANGES, glassParams, resetGlassParams, type GlassParams } from './params.svelte';
	import { renderState } from './render-state.svelte';

	/**
	 * Nur im Dev-Build mit `?debug`: Regler für alle Glas-Parameter, feste Uhrzeit zum Prüfen
	 * der Phasen und die Bildrate. Parameternamen bleiben bewusst die Bezeichner aus dem Code.
	 */
	const app = getApp();
	const timeOfDay = app.timeOfDay;
	let open = $state(true);

	const keys = Object.keys(GLASS_RANGES) as (keyof GlassParams)[];
	const realTime = $derived(timeOfDay.override === null);
</script>

<aside class="debug glass" aria-label={t('debug.title')}>
	<header>
		<button type="button" class="toggle" aria-expanded={open} onclick={() => (open = !open)}>
			<Icon name={open ? 'chevronDown' : 'chevronRight'} size={16} />
			{t('debug.title')}
		</button>
		<span class="stats">
			{renderState.mode}{renderState.level ? ` · ${renderState.level}` : ''} · {renderState.fps} fps
		</span>
	</header>

	{#if open}
		<div class="body">
			<div class="row">
				<label>
					<input
						type="checkbox"
						checked={realTime}
						onchange={(event) =>
							(timeOfDay.override = event.currentTarget.checked
								? null
								: Math.round(minutesOf(new Date())))}
					/>
					{t('debug.realTime')}
				</label>
				<span class="value">{formatMinutes(timeOfDay.minutes)} · {timeOfDay.phase}</span>
			</div>
			<input
				type="range"
				min="0"
				max="1439"
				step="5"
				aria-label={t('debug.time')}
				value={Math.round(timeOfDay.minutes)}
				oninput={(event) => (timeOfDay.override = Number(event.currentTarget.value))}
			/>

			{#each keys as key (key)}
				{@const [min, max, step] = GLASS_RANGES[key]}
				<label class="param">
					<span class="row">
						<code>{key}</code>
						<span class="value">{glassParams[key]}</span>
					</span>
					<input type="range" {min} {max} {step} bind:value={glassParams[key]} />
				</label>
			{/each}

			<button type="button" class="btn" onclick={resetGlassParams}>{t('debug.reset')}</button>
		</div>
	{/if}
</aside>

<style>
	.debug {
		position: fixed;
		top: 12px;
		left: 12px;
		z-index: 900;
		width: 280px;
		max-height: calc(100vh - 24px);
		overflow: auto;
		padding: var(--space-3);
		border-radius: var(--radius-md);
		font-size: var(--text-xs);
		--glass-alpha: 0.82;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.toggle {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 0;
		border: none;
		background: none;
		font-weight: 700;
	}

	.stats,
	.value {
		font-variant-numeric: tabular-nums;
		color: var(--text-secondary);
	}

	.body {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.param {
		display: grid;
	}

	input[type='range'] {
		width: 100%;
	}
</style>
