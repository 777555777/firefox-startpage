<script lang="ts">
	import type { ColumnCount } from '$lib/config/types';
	import { t } from '$lib/i18n/index.svelte';
	import { getApp } from '$lib/state/context';
	import { ui } from '$lib/state/ui.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import Segmented from '$lib/ui/Segmented.svelte';
	import {
		COLUMN_COUNTS,
		COLUMN_GAP_MAX,
		COLUMN_GAP_MIN,
		equalSpans,
		equalWidths,
		fitRows,
		MAX_WIDTH_MAX,
		MAX_WIDTH_MIN,
		MAX_WIDTH_STEP,
		PANEL_GAP_MAX,
		PANEL_GAP_MIN,
		setColumnCount
	} from './operations';

	const app = getApp();
	const layout = $derived(app.config.value.layout);

	function setColumns(count: ColumnCount) {
		const live = app.config.value.layout;
		const next = setColumnCount(live.columnRows, count);
		live.columnRows = next.columnRows;
		live.columnWidths = next.columnWidths;
		live.columns = count;
	}

	function equalize() {
		const live = app.config.value.layout;
		live.columnWidths = equalSpans(live.columns);
		live.columnRows = fitRows(live.columnRows, live.columnWidths);
	}

	const id = $props.id();

	/** Ganz rechts auf dem Regler bedeutet „volle Breite“ (kein Maximum) */
	const FULL = MAX_WIDTH_MAX + MAX_WIDTH_STEP;
	const maxWidthValue = $derived(layout.maxWidth ?? FULL);

	function setMaxWidth(value: number) {
		const live = app.config.value.layout;
		if (value >= FULL) delete live.maxWidth;
		else live.maxWidth = value;
	}
</script>

{#if ui.editing}
	<div class="edit-bar glass" role="toolbar" aria-label={t('edit.toolbar')}>
		<span class="label" aria-hidden="true"><Icon name="columns" size={16} /></span>
		<Segmented
			label={t('edit.columns')}
			value={layout.columns}
			options={COLUMN_COUNTS.map((count) => ({ value: count, label: String(count) }))}
			onchange={setColumns}
		/>
		{#if !equalWidths(layout.columnWidths)}
			<button type="button" class="btn" onclick={equalize}>
				{t('edit.equalWidths')}
			</button>
		{/if}
		<span class="divider"></span>
		<label class="gap" for="{id}-column-gap" title={t('edit.columnGap')}>
			<Icon name="gap" size={16} />
			<span class="visually-hidden">{t('edit.columnGap')}</span>
		</label>
		<input
			id="{id}-column-gap"
			class="gap-range"
			type="range"
			min={COLUMN_GAP_MIN}
			max={COLUMN_GAP_MAX}
			step="4"
			bind:value={app.config.value.layout.columnGap}
			aria-valuetext="{layout.columnGap} px"
		/>
		<output class="value short" for="{id}-column-gap">{layout.columnGap}</output>
		<label class="gap" for="{id}-panel-gap" title={t('edit.panelGap')}>
			<Icon name="gapVertical" size={16} />
			<span class="visually-hidden">{t('edit.panelGap')}</span>
		</label>
		<input
			id="{id}-panel-gap"
			class="gap-range"
			type="range"
			min={PANEL_GAP_MIN}
			max={PANEL_GAP_MAX}
			step="4"
			bind:value={app.config.value.layout.panelGap}
			aria-valuetext="{layout.panelGap} px"
		/>
		<output class="value short" for="{id}-panel-gap">{layout.panelGap}</output>
		<span class="divider"></span>
		<label class="gap" for="{id}-width" title={t('edit.maxWidth')}>
			<Icon name="maxWidth" size={16} />
			<span class="visually-hidden">{t('edit.maxWidth')}</span>
		</label>
		<input
			id="{id}-width"
			class="gap-range"
			type="range"
			min={MAX_WIDTH_MIN}
			max={FULL}
			step={MAX_WIDTH_STEP}
			value={maxWidthValue}
			oninput={(event) => setMaxWidth(Number(event.currentTarget.value))}
			aria-valuetext={layout.maxWidth ? `${layout.maxWidth} rem` : t('edit.fullWidth')}
		/>
		<output class="value" for="{id}-width">
			{layout.maxWidth ? `${layout.maxWidth * 16} px` : t('edit.fullWidth')}
		</output>
		<span class="divider"></span>
		<button type="button" class="btn" onclick={() => ui.openSettings()}>
			<Icon name="sliders" size={16} />
			{t('edit.settings')}
		</button>
		<button type="button" class="btn btn-primary" onclick={() => (ui.editing = false)}>
			<Icon name="check" size={16} />
			{t('edit.done')}
		</button>
	</div>
{:else}
	<button
		type="button"
		class="edit-toggle glass"
		aria-pressed="false"
		aria-keyshortcuts="E"
		onclick={() => (ui.editing = true)}
	>
		<Icon name="pencil" size={16} />
		<span>{t('edit.enter')}</span>
	</button>
{/if}

<style>
	.edit-toggle {
		position: fixed;
		right: var(--space-5);
		bottom: var(--space-5);
		z-index: 20;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		height: 40px;
		padding: 0 var(--space-4);
		border: none;
		border-radius: var(--radius-full);
		color: var(--text);
		font-size: var(--text-sm);
		font-weight: 600;
		--glass-alpha: 0.32;
		opacity: 0.72;
		transition:
			opacity var(--duration) ease,
			box-shadow var(--duration) ease;

		&:hover,
		&:focus-visible {
			opacity: 1;
		}

		&:focus-visible {
			box-shadow: var(--focus-ring), var(--glass-shadow);
		}
	}

	.edit-bar {
		position: fixed;
		left: 50%;
		bottom: var(--space-5);
		z-index: 20;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
		border-radius: var(--radius-full);
		--glass-alpha: 0.6;
		box-shadow:
			inset 0 1px 0 var(--glass-edge),
			inset 0 0 0 1px var(--glass-rim),
			var(--glass-shadow-raised);
		transform: translateX(-50%);
		animation: bar-in var(--duration-slow) var(--ease-spring);
	}

	.label,
	.gap {
		display: inline-flex;
		color: var(--text-secondary);
	}

	.gap-range {
		width: 88px;
	}

	.value {
		min-width: 4.5em;
		white-space: nowrap;
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--text-secondary);
		font-variant-numeric: tabular-nums;

		&.short {
			min-width: 2em;
		}
	}

	.divider {
		width: 1px;
		height: 24px;
		margin: 0 var(--space-1);
		background: var(--line);
	}

	@keyframes bar-in {
		from {
			opacity: 0;
			transform: translate(-50%, 12px);
		}
	}
</style>
