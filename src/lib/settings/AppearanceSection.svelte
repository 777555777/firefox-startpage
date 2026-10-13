<script lang="ts">
	import { ACCENT_PRESETS } from '$lib/config/defaults';
	import { t } from '$lib/i18n/index.svelte';
	import { getApp } from '$lib/state/context';
	import Icon from '$lib/ui/Icon.svelte';

	const app = getApp();
	const appearance = $derived(app.config.value.appearance);
	const id = $props.id();
</script>

<div class="section">
	<fieldset class="field">
		<legend class="field-label">{t('settings.accent')}</legend>
		<div class="swatches">
			{#each ACCENT_PRESETS as preset (preset.id)}
				<label class="swatch" style:--swatch={preset.color}>
					<input
						type="radio"
						name="{id}-accent"
						value={preset.color}
						checked={appearance.accent === preset.color}
						aria-label={t('settings.accentPreset', { color: t(`accent.${preset.id}`) })}
						onchange={() => (app.config.value.appearance.accent = preset.color)}
					/>
					{#if appearance.accent === preset.color}
						<Icon name="check" size={16} />
					{/if}
				</label>
			{/each}
			<label class="custom">
				<input
					type="color"
					value={appearance.accent}
					oninput={(event) => (app.config.value.appearance.accent = event.currentTarget.value)}
				/>
				<span>{t('settings.accentCustom')}</span>
			</label>
		</div>
	</fieldset>

	<div class="field">
		<label class="field-label" for="{id}-frost">{t('settings.frost')}</label>
		<input
			id="{id}-frost"
			type="range"
			min="0"
			max="1"
			step="0.05"
			bind:value={app.config.value.appearance.glass.frost}
		/>
		<div class="scale" aria-hidden="true">
			<span>{t('settings.frostClear')}</span>
			<span>{t('settings.frostMilky')}</span>
		</div>
	</div>
</div>

<style>
	.section {
		display: grid;
		gap: var(--space-6);
		max-width: 420px;
	}

	fieldset {
		margin: 0;
		padding: 0;
		border: none;
	}

	.swatches {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}

	.swatch {
		position: relative;
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: linear-gradient(
			160deg,
			color-mix(in srgb, var(--swatch) 70%, white),
			var(--swatch)
		);
		box-shadow:
			inset 0 1px 0 rgb(255 255 255 / 0.5),
			0 2px 6px -2px rgb(var(--shade) / 0.4);
		color: #fff;
		cursor: pointer;

		&:has(input:focus-visible) {
			box-shadow: var(--focus-ring);
		}

		input {
			position: absolute;
			opacity: 0;
			pointer-events: none;
		}
	}

	.custom {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		margin-left: var(--space-2);
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text-secondary);
		cursor: pointer;

		input {
			width: 34px;
			height: 34px;
			padding: 0;
			border: none;
			border-radius: 50%;
			background: none;
			cursor: pointer;
		}
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
