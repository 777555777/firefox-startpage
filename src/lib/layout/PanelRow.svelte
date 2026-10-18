<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { LayoutRow } from '$lib/config/types';
	import { t } from '$lib/i18n/index.svelte';
	import {
		draggedRowHeight,
		GRID_UNITS,
		MIN_ITEM_SPAN,
		ROW_HEIGHT_MAX,
		ROW_HEIGHT_MIN,
		steppedRowHeight
	} from './operations';

	/**
	 * Eine Zeile einer Spalte: 1 bis 3 Widgets nebeneinander. Im Edit-Modus lassen sich die
	 * Breiten über Trenner im 24er-Raster ändern (Ziehen, Pfeiltasten, mit Umschalt symmetrisch,
	 * Doppelklick gleichmäßig). Passt die Zeile nicht in die Spalte, stehen die Widgets untereinander.
	 * Ein Griff an der Unterkante setzt die Höchsthöhe der Zeile (Doppelklick: „Automatisch“).
	 */
	let {
		row,
		stacked,
		editing,
		panel,
		onresize,
		onequalize,
		onheight
	}: {
		row: LayoutRow;
		stacked: boolean;
		editing: boolean;
		panel: Snippet<[string]>;
		onresize: (index: number, left: number, mirror: boolean) => void;
		onequalize: () => void;
		/** Neue Höchsthöhe in rem; `undefined` = „Automatisch“ */
		onheight: (value: number | undefined) => void;
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

	// --- Höhe ----------------------------------------------------------------------------------

	let heightResizing = $state(false);
	let heightActive = $state(false);
	/** Beim Ziehen ist die Zeile genau so hoch wie gezogen, auch wenn der Inhalt kleiner ist */
	let previewHeight = $state<number | null>(null);
	const showHeight = $derived(editing && (heightResizing || heightActive));

	const remPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

	/** Gezeigte Höhe in rem: das höchste Panel (untereinander zählt jedes einzeln) */
	function shownHeight(): number {
		const panels = element.querySelectorAll(':scope > .cell > *');
		const px = Math.max(0, ...[...panels].map((panel) => panel.getBoundingClientRect().height));
		return px / remPx();
	}

	function onHeightPointerdown(event: PointerEvent) {
		if (event.button !== 0) return;
		event.preventDefault();
		const start = row.maxHeight === undefined ? shownHeight() : row.maxHeight;
		const startY = event.clientY;
		const handle = event.currentTarget as HTMLElement;
		handle.setPointerCapture(event.pointerId);
		heightResizing = true;

		const onmove = (move: PointerEvent) => {
			const value = draggedRowHeight(start, move.clientY - startY, remPx());
			previewHeight = value ?? null;
			if (value !== row.maxHeight) onheight(value);
		};
		const onup = () => {
			heightResizing = false;
			previewHeight = null;
			handle.removeEventListener('pointermove', onmove);
			handle.removeEventListener('pointerup', onup);
			handle.removeEventListener('pointercancel', onup);
		};
		handle.addEventListener('pointermove', onmove);
		handle.addEventListener('pointerup', onup);
		handle.addEventListener('pointercancel', onup);
	}

	function onHeightKeydown(event: KeyboardEvent) {
		let value: number | undefined;
		if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
			value = steppedRowHeight(row.maxHeight, shownHeight(), event.key === 'ArrowUp' ? -1 : 1);
		} else if (event.key === 'Home') {
			value = ROW_HEIGHT_MIN;
		} else if (event.key === 'End' || event.key === 'Delete' || event.key === 'Backspace') {
			value = undefined;
		} else {
			return;
		}
		event.preventDefault();
		if (value !== row.maxHeight) onheight(value);
	}

	const heightText = (value: number | undefined) =>
		value === undefined ? t('edit.rowHeightAuto') : t('edit.rowHeightValue', { value });

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
	class:height-resizing={heightResizing}
	style:grid-template-columns={template}
	style:--row-height={previewHeight === null ? undefined : `${previewHeight}rem`}
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
					title={t('edit.resizeRowHint')}
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

	{#if editing}
		<!-- Fokussierbarer Separator mit Wert ist das ARIA-Muster „Window Splitter“ -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
		<div
			class="height-gutter"
			class:active={heightResizing}
			role="separator"
			aria-orientation="horizontal"
			aria-label={t('edit.rowHeight')}
			aria-valuemin={ROW_HEIGHT_MIN}
			aria-valuemax={ROW_HEIGHT_MAX}
			aria-valuenow={row.maxHeight ?? ROW_HEIGHT_MAX}
			aria-valuetext={heightText(row.maxHeight)}
			tabindex="0"
			title={t('edit.rowHeightHint')}
			onpointerdown={onHeightPointerdown}
			onkeydown={onHeightKeydown}
			ondblclick={() => onheight(undefined)}
			onpointerenter={() => (heightActive = true)}
			onpointerleave={() => (heightActive = false)}
			onfocus={() => (heightActive = true)}
			onblur={() => (heightActive = false)}
		>
			<span class="handle"></span>
			{#if showHeight}
				<span class="height-label" aria-hidden="true">{heightText(row.maxHeight)}</span>
			{/if}
		</div>
	{/if}
</div>

<style>
	.row {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: var(--gap);
		min-width: 0;

		/* Vorschau beim Ziehen der Höhe; sonst bestimmt der Inhalt (bis zur Höchsthöhe) */
		& > .cell > :global(*) {
			height: var(--row-height, auto);
		}
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

	/* Griff für die Höhe: liegt im Abstand unter der Zeile und nimmt keinen Platz ein */
	.height-gutter {
		position: absolute;
		z-index: 3;
		left: 0;
		right: 0;
		bottom: calc(var(--gap) / -2 - 8px);
		display: grid;
		place-items: center;
		height: 16px;
		cursor: row-resize;
		touch-action: none;

		&:focus-visible {
			box-shadow: none;

			.handle {
				box-shadow: var(--focus-ring);
			}
		}

		.handle {
			width: 40px;
			height: 6px;
			transition:
				width var(--duration) var(--ease-out),
				background-color var(--duration-fast) ease;
		}

		&:hover .handle,
		&.active .handle {
			width: 72px;
			height: 6px;
			background: #fff;
		}
	}

	.height-resizing {
		cursor: row-resize;
		user-select: none;
	}

	.height-label {
		position: absolute;
		top: calc(100% + var(--space-1));
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-full);
		background: rgb(var(--shade) / 0.6);
		backdrop-filter: blur(8px);
		color: #fff;
		font-size: var(--text-sm);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		pointer-events: none;
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
