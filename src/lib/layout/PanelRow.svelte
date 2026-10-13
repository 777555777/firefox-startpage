<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { LayoutRow } from '$lib/config/types';
	import { t } from '$lib/i18n/index.svelte';
	import { GRID_UNITS, MIN_ITEM_SPAN } from './operations';

	/**
	 * Eine Zeile einer Spalte: 1 bis 3 Widgets nebeneinander. Im Edit-Modus lassen sich die
	 * Breiten über Trenner im 24er-Raster ändern (Ziehen, Pfeiltasten, mit Umschalt symmetrisch,
	 * Doppelklick gleichmäßig). Passt die Zeile nicht in die Spalte, stehen die Widgets untereinander.
	 */
	let {
		row,
		stacked,
		editing,
		panel,
		onresize,
		onequalize
	}: {
		row: LayoutRow;
		stacked: boolean;
		editing: boolean;
		panel: Snippet<[string]>;
		onresize: (index: number, left: number, mirror: boolean) => void;
		onequalize: () => void;
	} = $props();

	let element: HTMLElement;
	let resizing = $state<number | null>(null);
	let gutterActive = $state<number | null>(null);
	const split = $derived(row.items.length > 1 && !stacked);
	const showSpans = $derived(editing && split && (resizing !== null || gutterActive !== null));

	const template = $derived(
		split ? row.spans.map((span) => `minmax(0, ${span}fr)`).join(' var(--gap) ') : undefined
	);

	function onpointerdown(event: PointerEvent, index: number) {
		if (event.button !== 0) return;
		event.preventDefault();
		const cells = element.querySelectorAll(':scope > .cell');
		const left = cells[index].getBoundingClientRect().width;
		const total = left + cells[index + 1].getBoundingClientRect().width;
		const pair = row.spans[index] + row.spans[index + 1];
		const startX = event.clientX;
		const gutter = event.currentTarget as HTMLElement;
		gutter.setPointerCapture(event.pointerId);
		resizing = index;

		const onmove = (move: PointerEvent) => {
			const px = left + move.clientX - startX;
			onresize(index, (px / total) * pair, move.shiftKey);
		};
		const onup = () => {
			resizing = null;
			gutter.removeEventListener('pointermove', onmove);
			gutter.removeEventListener('pointerup', onup);
			gutter.removeEventListener('pointercancel', onup);
		};
		gutter.addEventListener('pointermove', onmove);
		gutter.addEventListener('pointerup', onup);
		gutter.addEventListener('pointercancel', onup);
	}

	function onkeydown(event: KeyboardEvent, index: number) {
		const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
		if (!step) return;
		event.preventDefault();
		onresize(index, row.spans[index] + step, event.shiftKey);
	}
</script>

<div
	bind:this={element}
	class="row"
	class:split
	class:stacked
	class:resizing={resizing !== null}
	style:grid-template-columns={template}
	data-row
>
	{#each row.items as id, i (id)}
		{#if i > 0 && split}
			{#if editing}
				<!-- Fokussierbarer Separator mit Wert ist das ARIA-Muster „Window Splitter“ -->
				<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
				<div
					class="gutter interactive"
					style:grid-column={2 * i}
					class:active={resizing === i - 1}
					role="separator"
					aria-orientation="vertical"
					aria-label={t('edit.resizeRow')}
					aria-valuemin={MIN_ITEM_SPAN}
					aria-valuemax={row.spans[i - 1] + row.spans[i] - MIN_ITEM_SPAN}
					aria-valuenow={row.spans[i - 1]}
					aria-valuetext={row.spans.join(' · ')}
					tabindex="0"
					title={t('edit.resizeHint')}
					onpointerdown={(event) => onpointerdown(event, i - 1)}
					onkeydown={(event) => onkeydown(event, i - 1)}
					ondblclick={onequalize}
					onpointerenter={() => (gutterActive = i - 1)}
					onpointerleave={() => (gutterActive = null)}
					onfocus={() => (gutterActive = i - 1)}
					onblur={() => (gutterActive = null)}
				>
					<span class="handle"></span>
				</div>
			{:else}
				<div class="gutter" style:grid-column={2 * i} aria-hidden="true"></div>
			{/if}
		{/if}
		<div class="cell" style:grid-column={split ? 2 * i + 1 : undefined}>
			{@render panel(id)}
		</div>
		{#if showSpans}
			<div class="span-label" style:grid-column={2 * i + 1} aria-hidden="true">
				{row.spans[i]}<span>/{GRID_UNITS}</span>
			</div>
		{/if}
	{/each}
</div>

<style>
	.row {
		display: flex;
		flex-direction: column;
		gap: var(--gap);
		min-width: 0;
	}

	/* Nebeneinander: Raster mit festen Spalten für Widgets und Trenner */
	.row.split {
		display: grid;
		gap: 0;
		align-items: stretch;
	}

	.cell,
	.gutter,
	.span-label {
		grid-row: 1;
	}

	/* Panels einer Zeile sind gleich hoch */
	.cell {
		display: flex;
		flex-direction: column;
		min-width: 0;

		& > :global(*) {
			flex: 1 1 auto;
		}
	}

	.gutter {
		position: relative;
		z-index: 3;
		min-width: 0;
	}

	.gutter.interactive {
		display: grid;
		place-items: center;
		cursor: col-resize;
		touch-action: none;

		/* Größere Trefferfläche, auch bei kleinem Abstand */
		&::before {
			content: '';
			position: absolute;
			inset: 0 -8px;
		}

		&:focus-visible {
			box-shadow: none;

			.handle {
				box-shadow: var(--focus-ring);
			}
		}
	}

	.handle {
		width: 6px;
		height: 40px;
		border-radius: var(--radius-full);
		background: rgb(255 255 255 / 0.7);
		box-shadow: 0 1px 4px rgb(var(--shade) / 0.3);
		transition:
			height var(--duration) var(--ease-out),
			background-color var(--duration-fast) ease;
	}

	.gutter.interactive:hover .handle,
	.gutter.active .handle {
		height: 72px;
		background: #fff;
	}

	.resizing {
		cursor: col-resize;
		user-select: none;
	}

	.span-label {
		z-index: 4;
		align-self: center;
		justify-self: center;
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-full);
		background: rgb(var(--shade) / 0.6);
		backdrop-filter: blur(8px);
		color: #fff;
		font-size: var(--text-lg);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		pointer-events: none;

		span {
			font-size: 0.65em;
			font-weight: 500;
			opacity: 0.75;
		}
	}
</style>
