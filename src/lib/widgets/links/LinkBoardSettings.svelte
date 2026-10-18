<script lang="ts">
	import { t } from '$lib/i18n/index.svelte';
	import Switch from '$lib/ui/Switch.svelte';
	import type { WidgetSettingsProps } from '../types';
	import { snapTileSize, TILE_SIZE, type LinksSettings } from './settings';

	let { settings, update }: WidgetSettingsProps<LinksSettings> = $props();
	const id = $props.id();
</script>

<div class="form">
	<Switch
		label={t('links.showStats')}
		checked={settings.showStats}
		onchange={(value) => update((s) => (s.showStats = value))}
	/>

	<div class="field">
		<div class="label-row">
			<label class="field-label" for="{id}-tile">{t('links.tileSize')}</label>
			<button
				type="button"
				class="btn reset"
				disabled={settings.tileSize === TILE_SIZE.default}
				onclick={() => update((s) => (s.tileSize = TILE_SIZE.default))}
			>
				{t('links.tileSizeReset')}
			</button>
		</div>
		<input
			id="{id}-tile"
			type="range"
			min={TILE_SIZE.min}
			max={TILE_SIZE.max}
			step={TILE_SIZE.step}
			value={settings.tileSize}
			aria-valuetext="{settings.tileSize} px"
			aria-describedby="{id}-tile-hint"
			oninput={(event) =>
				update((s) => (s.tileSize = snapTileSize(event.currentTarget.valueAsNumber)))}
		/>
		<div class="scale" aria-hidden="true">
			<span>{t('links.tileSmall')}</span>
			<span>{t('links.tileLarge')}</span>
		</div>
		<p class="field-hint" id="{id}-tile-hint">{t('links.tileSizeHint')}</p>
	</div>
</div>

<style>
	.form {
		display: grid;
		gap: var(--space-5);
	}

	.label-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.reset {
		min-height: 28px;
		padding: 0 var(--space-3);
		font-size: var(--text-xs);
	}

	input[type='range'] {
		width: 100%;
	}

	.scale {
		display: flex;
		justify-content: space-between;
		font-size: var(--text-xs);
		color: var(--text-secondary);
	}
</style>
