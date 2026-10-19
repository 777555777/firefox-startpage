<script lang="ts">
	import { tick } from 'svelte';
	import { createId } from '$lib/config/parse';
	import type { WidgetInstance, WidgetType } from '$lib/config/types';
	import { Sortable, type Point } from '$lib/dnd/sortable.svelte';
	import { layoutRect, prefersReducedMotion } from '$lib/dnd/spring';
	import { i18n, t } from '$lib/i18n/index.svelte';
	import { getApp } from '$lib/state/context';
	import { toasts } from '$lib/state/toasts.svelte';
	import { density } from '$lib/state/density.svelte';
	import { ui } from '$lib/state/ui.svelte';
	import { announcer } from '$lib/ui/announcer.svelte';
	import Dialog from '$lib/ui/Dialog.svelte';
	import { definitionOf } from '$lib/widgets/registry';
	import AddWidget from './AddWidget.svelte';
	import { arrange, areaPx, EDGE_RESERVE_PX, layoutStage, sidebarTabs } from './arrangement';
	import {
		areaWidths,
		canJoin,
		CENTER,
		centerSpanRange,
		clampCenterSpan,
		DEFAULT_CENTER_SPAN,
		enabledAreas,
		equalizeRow,
		equalSpans,
		findWidget,
		fitRows,
		fitsSideBySide,
		GRID_UNITS,
		LAYOUT_AREAS,
		LEFT,
		placeWidget,
		removeWidget,
		resizeRowPair,
		restorePlacement,
		RIGHT,
		rowFits,
		rowIndexWithout,
		setRowHeight,
		sideSpan,
		stepPlacement,
		type Placement,
		type Rows,
		type Side
	} from './operations';
	import PanelRow from './PanelRow.svelte';
	import Sidebar, { type TabInfo } from './Sidebar.svelte';
	import { sidebar } from './sidebar-store.svelte';
	import { effectiveSide } from './sidebar-state';
	import { setWindowFitContext } from './window-fit.svelte';
	import WidgetPanel from './WidgetPanel.svelte';

	const app = getApp();
	const config = $derived(app.config.value);
	const layout = $derived(config.layout);

	/**
	 * Verfügbare Breite der Page ohne Sidebar; die Breite des Boards hängt von Maximalbreite und
	 * Seiten ab. Vor der ersten Messung geschätzt (Fenster abzüglich Seitenrand der Page).
	 */
	let available = $state(
		typeof innerWidth === 'number'
			? innerWidth - 2 * Math.min(56, Math.max(16, innerWidth * 0.04))
			: 1280
	);
	const remPx =
		typeof document === 'undefined'
			? 16
			: parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

	// --- Sidebar in der mittleren Stufe -----------------------------------------------------
	// Die Stufe hängt nur von `available` ab, nie davon, ob die Sidebar offen ist.

	let frame: HTMLElement;
	/** Seitenrand der Page links; reicht er nicht für die Tab-Leiste, rückt die Mitte ein */
	let frameLeft = $state(56);
	$effect(() => {
		void available;
		frameLeft = frame.getBoundingClientRect().left;
	});

	const stage = $derived(layoutStage(layout, available, remPx));

	// „Bis Fensterende“ gilt nicht in der schmalen Stufe: Dort scrollt die Page ohnehin
	setWindowFitContext({
		get allowed() {
			return stage !== 'stacked';
		}
	});

	/** Reicht das Widget gerade bis zum Fensterende? Dann gilt die Höchsthöhe der Zeile nicht */
	function fillsWindow(id: string): boolean {
		const instance = config.widgets[id];
		if (!instance || stage === 'stacked') return false;
		return definitionOf(instance.type).fillsWindow?.(instance.settings) ?? false;
	}
	const tabs = $derived(stage === 'sidebar' ? sidebarTabs(layout, ui.editing) : []);
	$effect.pre(() => {
		sidebar.tabs = tabs;
	});
	/** Seite, die die Sidebar zeigen soll */
	const wanted = $derived(effectiveSide(sidebar.state, tabs));
	/**
	 * Seite, für die die Mitte Platz macht. Beim Öffnen sofort, beim Schließen erst, wenn die
	 * Sidebar hinausgefahren ist, sonst wüchse die Mitte unter die noch sichtbare Sidebar.
	 */
	let lastOpen = $state<Side | null>(null);
	$effect.pre(() => {
		if (wanted) lastOpen = wanted;
		else if (stage !== 'sidebar') lastOpen = null;
	});
	const shownSide = $derived(wanted ?? lastOpen);
	/** Die hinausfahrende Seite behält ihren Tab, auch wenn sie inzwischen keinen mehr hätte */
	const layoutTabs = $derived(
		shownSide && !tabs.includes(shownSide)
			? (['left', 'right'] as const).filter((s) => s === shownSide || tabs.includes(s))
			: tabs
	);

	const arrangement = $derived(
		arrange(layout, available, remPx, {
			tabs: layoutTabs,
			open: shownSide,
			edgePx: Math.max(0, EDGE_RESERVE_PX - frameLeft)
		})
	);
	const { sideBySide, width, offset, columns, template, order } = $derived(arrangement);

	/** Abstand zwischen Panels; in kompakter Dichte ein Drittel kleiner */
	const panelGap = $derived(
		density.compact ? Math.round((layout.panelGap * 2) / 3) : layout.panelGap
	);

	const listFormat = $derived(new Intl.ListFormat(i18n.lang, { type: 'conjunction' }));

	/** Icon des ersten Widgets und Name der Seite samt ihrer Widgets */
	const tabInfo = $derived.by(() => {
		const info = (area: number): TabInfo => {
			const ids = layout.columnRows[area].flatMap((row) => row.items);
			const first = ids.length ? config.widgets[ids[0]] : undefined;
			return {
				icon: first ? definitionOf(first.type).icon : 'plus',
				label: ids.length
					? t('sidebar.contents', {
							area: areaName(area),
							widgets: listFormat.format(ids.map(nameOf))
						})
					: t('sidebar.empty', { area: areaName(area) })
			};
		};
		return { left: info(LEFT), right: info(RIGHT) };
	});
	const widths = $derived(areaWidths(layout.centerSpan, layout.sides));
	const side = $derived(sideSpan(layout.centerSpan));
	const used = $derived(new Set(Object.values(config.widgets).map((w) => w.type)));

	/** Breite eines Bereichs in px, für das Untereinanderstellen von Zeilen */
	const columnPx = (area: number, areaSpans = widths) =>
		areaPx(arrangement, areaSpans, area, layout.columnGap);

	const liveWidths = () => {
		const live = app.config.value.layout;
		return areaWidths(live.centerSpan, live.sides);
	};

	const nameOf = (id: string) => {
		const instance = config.widgets[id];
		return instance ? t(definitionOf(instance.type).name) : id;
	};

	const areaName = (area: number) => t(`area.${LAYOUT_AREAS[area]}`);
	const sideOfArea = (area: number): Side | null =>
		area === LEFT ? 'left' : area === RIGHT ? 'right' : null;

	/** Position als Ansage, z. B. „Mitte, Zeile 2, Platz 1 von 2“ */
	function positionText(id: string): string {
		const position = findWidget(app.config.value.layout.columnRows, id);
		if (!position) return '';
		const row = app.config.value.layout.columnRows[position.column][position.row];
		const base = { area: areaName(position.column), row: position.row + 1 };
		return row.items.length > 1
			? t('dnd.positionShared', { ...base, slot: position.index + 1, count: row.items.length })
			: t('dnd.position', base);
	}

	function setRows(next: Rows) {
		app.config.value.layout.columnRows = next;
	}

	/** Breiten in einer Zeile ändern, aber nie so schmal, dass sie untereinander rutschen müsste */
	function resizeRow(column: number, row: number, index: number, left: number, mirror: boolean) {
		const live = app.config.value.layout;
		const next = resizeRowPair(live.columnRows, column, row, index, left, mirror);
		if (next === live.columnRows) return;
		if (!rowFits(next[column][row].spans, columnPx(column), live.panelGap, remPx)) return;
		setRows(next);
	}

	/** Ob `id` neben `target` passt, ohne dass die Zeile bei dieser Breite untereinander rutscht */
	function fitsBeside(id: string, target: string): boolean {
		const live = app.config.value.layout;
		const current = liveWidths();
		if (!canJoin(live.columnRows, id, target, current)) return false;
		const position = findWidget(live.columnRows, target);
		if (!position) return false;
		const row = live.columnRows[position.column][position.row];
		const count = row.items.length + (row.items.includes(id) ? 0 : 1);
		const spans = equalSpans(count, current[position.column]);
		return rowFits(spans, columnPx(position.column), live.panelGap, remPx);
	}

	// --- Ziehen mit der Maus: daneben (Rand eines Panels) oder als eigene Zeile ---------------

	/** Anteil der Panelbreite links und rechts, der „daneben ablegen“ bedeutet */
	const SIDE_ZONE = 0.28;
	const SIDE_ZONE_MAX = 120;

	function placementAt(id: string, point: Point, hit: Element | null): Placement | null {
		if (!hit || !frame.contains(hit)) return null;
		const live = app.config.value.layout;
		// Nur Panels zählen, nicht die Links in einem Link-Board (eigene DnD-Gruppe)
		const panel = hit.closest<HTMLElement>('[data-widget][data-dnd-item]');
		const target = panel?.dataset.dndItem;
		if (panel && target) {
			if (target === id) return null;
			const rect = layoutRect(panel);
			const zone = Math.min(rect.width * SIDE_ZONE, SIDE_ZONE_MAX);
			if (fitsBeside(id, target)) {
				if (point.x < rect.left + zone) return { kind: 'beside', target, side: 'before' };
				if (point.x > rect.right - zone) return { kind: 'beside', target, side: 'after' };
			}
			const position = findWidget(live.columnRows, target);
			if (!position) return null;
			const index = position.row + (point.y > rect.top + rect.height / 2 ? 1 : 0);
			return {
				kind: 'row',
				column: position.column,
				index: rowIndexWithout(live.columnRows, id, position.column, index)
			};
		}
		// Zwischen den Panels einer Zeile (Abstand, Trenner) ändert sich nichts
		if (hit.closest('[data-row]')) return null;

		const segment = hit.closest<HTMLElement>('[data-dnd-list]');
		if (!segment || !frame.contains(segment)) return null;
		const column = Number(segment.dataset.dndList);
		const rows = [...segment.querySelectorAll<HTMLElement>(':scope > [data-row]')];
		const index = rows.filter((row) => {
			const rect = row.getBoundingClientRect();
			return rect.top + rect.height / 2 < point.y;
		}).length;
		return { kind: 'row', column, index: rowIndexWithout(live.columnRows, id, column, index) };
	}

	const sortable = new Sortable({
		group: 'panels',
		// Wird nur für den Abbruch ohne `snapshot` genutzt
		onmove: () => {},
		resolve: (id, point, hit) => {
			const placement = placementAt(id, point, hit);
			if (!placement) return null;
			const live = app.config.value.layout;
			const next = placeWidget(live.columnRows, id, placement, liveWidths());
			if (JSON.stringify(next) === JSON.stringify(live.columnRows)) return null;
			return () => setRows(next);
		},
		snapshot: () => {
			const before = $state.snapshot(app.config.value.layout.columnRows) as Rows;
			return () => setRows(before);
		},
		ondrop: (id) => {
			announcer.say(t('dnd.dropped', { name: nameOf(id), position: positionText(id) }));
		}
	});

	// --- Tastatur: Leertaste greift, Pfeile verschieben, Leertaste legt ab, Esc bricht ab ----

	let grabbed = $state<{ id: string; origin: Rows } | null>(null);
	let keyboardMoving = false;

	function focusGrip(id: string) {
		document.querySelector<HTMLElement>(`[data-grip="${CSS.escape(id)}"]`)?.focus();
	}

	async function moveTo(id: string, next: Rows) {
		keyboardMoving = true;
		await sortable.animate(() => setRows(next));
		// Wandert das Widget in eine Seite der Sidebar, die gerade nicht offen ist, öffnet sie sich
		if (revealArea(id)) await tick();
		focusGrip(id);
		keyboardMoving = false;
	}

	/** Öffnet die Seite der Sidebar, in der das Widget steht; true, wenn sich etwas ändert */
	function revealArea(id: string): boolean {
		const position = findWidget(app.config.value.layout.columnRows, id);
		const side = position ? sideOfArea(position.column) : null;
		if (!side || sidebar.open === side || !sidebar.tabs.includes(side)) return false;
		sidebar.show(side);
		return true;
	}

	/** Panel auf einem Tab losgelassen: als eigene Zeile ans Ende dieser Seite */
	function dropOnTab(side: Side, id: string) {
		const live = app.config.value.layout;
		const area = side === 'left' ? LEFT : RIGHT;
		const index = rowIndexWithout(live.columnRows, id, area, live.columnRows[area].length);
		setRows(placeWidget(live.columnRows, id, { kind: 'row', column: area, index }, liveWidths()));
		sidebar.show(side);
		announcer.say(t('dnd.dropped', { name: nameOf(id), position: positionText(id) }));
	}

	const DIRECTIONS = {
		ArrowUp: 'up',
		ArrowDown: 'down',
		ArrowLeft: 'left',
		ArrowRight: 'right'
	} as const;

	async function onGripKeydown(event: KeyboardEvent, id: string) {
		if (event.key === ' ' || event.key === 'Enter') {
			event.preventDefault();
			if (grabbed?.id === id) {
				grabbed = null;
				announcer.say(t('dnd.dropped', { name: nameOf(id), position: positionText(id) }));
			} else {
				grabbed = { id, origin: $state.snapshot(layout.columnRows) as Rows };
				announcer.say(t('dnd.grabbed', { name: nameOf(id) }));
			}
			return;
		}
		if (grabbed?.id !== id) return;

		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			const origin = grabbed.origin;
			grabbed = null;
			await moveTo(id, origin);
			announcer.say(t('dnd.cancelled'));
			return;
		}
		const direction = DIRECTIONS[event.key as keyof typeof DIRECTIONS];
		if (!direction) return;
		event.preventDefault();
		const live = app.config.value.layout;
		const placement = stepPlacement(
			live.columnRows,
			id,
			direction,
			liveWidths(),
			event.shiftKey,
			order
		);
		if (!placement) return;
		if (placement.kind === 'beside' && !fitsBeside(id, placement.target)) return;
		const next = placeWidget(live.columnRows, id, placement, liveWidths());
		if (next === live.columnRows) return;
		await moveTo(id, next);
		announcer.say(positionText(id));
	}

	function onGripBlur(id: string) {
		// Fokuswechsel nach außen legt ab; beim Zeilenwechsel wird das Element neu erzeugt
		if (keyboardMoving || grabbed?.id !== id) return;
		grabbed = null;
	}

	// --- Hinzufügen, Entfernen, Einstellungen ------------------------------------------------

	async function addWidget(type: WidgetType, column: number) {
		const id = createId();
		const definition = definitionOf(type);
		const live = app.config.value;
		live.widgets[id] = { id, type, settings: definition.defaultSettings() } as WidgetInstance;
		await sortable.animate(() => {
			const { columnRows } = live.layout;
			setRows(
				placeWidget(
					columnRows,
					id,
					{ kind: 'row', column, index: columnRows[column].length },
					liveWidths()
				)
			);
		});
		const panel = document.querySelector(`[data-grip="${CSS.escape(id)}"]`);
		panel?.scrollIntoView({
			block: 'nearest',
			behavior: prefersReducedMotion() ? 'auto' : 'smooth'
		});
		focusGrip(id);
	}

	async function remove(id: string) {
		const live = app.config.value;
		const position = findWidget(live.layout.columnRows, id);
		const placement = restorePlacement(live.layout.columnRows, id);
		const instance = live.widgets[id];
		if (!position || !placement || !instance) return;
		const backup = $state.snapshot(instance) as WidgetInstance;
		const name = nameOf(id);
		await sortable.animate(() => {
			setRows(removeWidget(live.layout.columnRows, id));
			delete live.widgets[id];
		});
		toasts.show(t('edit.removed', { name }), {
			action: {
				label: t('common.undo'),
				run: () =>
					void sortable.animate(() => {
						const current = app.config.value;
						current.widgets[id] = backup;
						const { columnRows, sides } = current.layout;
						const columnWidths = liveWidths();
						let next = placeWidget(columnRows, id, placement, columnWidths);
						// Der alte Nachbar ist weg, die Zeile ist voll oder die Seite ausgeschaltet:
						// als eigene Zeile zurück, notfalls in die Mitte
						if (next === columnRows) {
							const column = enabledAreas(sides).includes(position.column)
								? position.column
								: CENTER;
							next = placeWidget(
								columnRows,
								id,
								{
									kind: 'row',
									column,
									index: position.row,
									maxHeight: placement.kind === 'row' ? placement.maxHeight : undefined
								},
								columnWidths
							);
						}
						setRows(next);
					})
			}
		});
	}

	let settingsFor = $state<string | null>(null);
	let settingsOpen = $state(false);
	const settingsInstance = $derived(settingsFor ? config.widgets[settingsFor] : undefined);
	const settingsDefinition = $derived(
		settingsInstance ? definitionOf(settingsInstance.type) : undefined
	);

	function openSettings(id: string) {
		settingsFor = id;
		settingsOpen = true;
	}

	function updateSettings(mutate: (settings: unknown) => void) {
		const live = settingsFor ? app.config.value.widgets[settingsFor] : undefined;
		if (live) mutate(live.settings);
	}

	$effect(() => {
		if (!ui.editing) grabbed = null;
	});

	// --- Breite der Mitte: Trenner im Edit-Modus ziehen oder per Pfeiltasten verschieben -----
	// Die Mitte rastet in Schritten von 2 Einheiten ein, beide Seiten bleiben gleich breit.

	let resizing = $state<Side | null>(null);
	/** Trenner, der gerade gehovert oder fokussiert ist; zeigt die Breiten an */
	let gutterActive = $state<Side | null>(null);
	const showSpans = $derived(resizing !== null || gutterActive !== null);
	const range = $derived(centerSpanRange(layout.columnRows, layout.sides));

	/**
	 * Zeilen zu Beginn einer Breitenänderung. Alle Schritte rechnen von hier aus, sonst würde
	 * die Aufteilung der Zeilen durch wiederholtes Runden langsam wegdriften.
	 */
	let resizeBase: Rows | null = null;

	/** Ausgangszustand nur, solange dieselben Widgets in denselben Zeilen stehen */
	function currentBase(): Rows {
		const live = app.config.value.layout.columnRows;
		const shape = (rows: Rows) => JSON.stringify(rows.map((c) => c.map((r) => r.items)));
		return resizeBase && shape(resizeBase) === shape(live) ? resizeBase : live;
	}

	function setCenterSpan(value: number) {
		const live = app.config.value.layout;
		const base = currentBase();
		const [min, max] = centerSpanRange(base, live.sides);
		const next = Math.min(max, Math.max(min, clampCenterSpan(value)));
		if (next === live.centerSpan) return;
		// Nicht so breit, dass die Seiten gleich wieder unter die Mitte rutschen würden
		if (!fitsSideBySide(next, width, live.columnGap, remPx)) return;
		const nextWidths = areaWidths(next, live.sides);
		const rows = fitRows(base, nextWidths);
		// … und keine Zeile so schmal, dass ihre Widgets untereinander rutschen müssten
		const fits = rows.every((column, c) =>
			column.every((row) => rowFits(row.spans, columnPx(c, nextWidths), live.panelGap, remPx))
		);
		if (!fits) return;
		live.centerSpan = next;
		live.columnRows = rows;
	}

	/** Am linken Trenner wird die Mitte breiter, wenn er nach links wandert, am rechten umgekehrt */
	const direction = (gutter: Side) => (gutter === 'left' ? -1 : 1);

	function onGutterPointerdown(event: PointerEvent, gutter: Side) {
		if (event.button !== 0) return;
		event.preventDefault();
		const content = width - 2 * layout.columnGap;
		const start = (content * layout.centerSpan) / GRID_UNITS;
		const startX = event.clientX;
		const element = event.currentTarget as HTMLElement;
		element.setPointerCapture(event.pointerId);
		resizing = gutter;
		resizeBase = $state.snapshot(layout.columnRows) as Rows;

		const onmove = (move: PointerEvent) => {
			// Beide Seiten ändern sich gleich, die Mitte also doppelt so stark wie der Zeiger
			const px = start + 2 * direction(gutter) * (move.clientX - startX);
			setCenterSpan((px / content) * GRID_UNITS);
		};
		const onup = () => {
			resizing = null;
			resizeBase = null;
			element.removeEventListener('pointermove', onmove);
			element.removeEventListener('pointerup', onup);
			element.removeEventListener('pointercancel', onup);
		};
		element.addEventListener('pointermove', onmove);
		element.addEventListener('pointerup', onup);
		element.addEventListener('pointercancel', onup);
	}

	function onGutterKeydown(event: KeyboardEvent, gutter: Side) {
		const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
		if (!step) return;
		event.preventDefault();
		setCenterSpan(layout.centerSpan + 2 * step * direction(gutter));
	}

	/** Position des Trenners für ARIA: Einheiten links von ihm */
	const gutterValue = (gutter: Side, center: number) =>
		gutter === 'left' ? sideSpan(center) : sideSpan(center) + center;

	/** Trenner neben eingeschalteten Seiten, mit ihrer Spur im Grid */
	const gutters = $derived(
		(['left', 'right'] as const)
			.filter((gutter) => layout.sides[gutter])
			.map((gutter) => ({ side: gutter, track: gutter === 'left' ? 2 : 4 }))
	);
	/** Breitenanzeige pro sichtbarer Spalte */
	const spanLabels = $derived([
		...(layout.sides.left ? [{ track: 1, span: side }] : []),
		{ track: 3, span: layout.centerSpan },
		...(layout.sides.right ? [{ track: 5, span: side }] : [])
	]);
</script>

{#snippet segment(area: number)}
	{@const rows = layout.columnRows[area]}
	<div
		class="segment"
		class:empty={rows.length === 0}
		class:editing={ui.editing}
		data-area={LAYOUT_AREAS[area]}
		{@attach sortable.list({ id: String(area), axis: 'vertical' })}
	>
		{#each rows as row, r (row.items[0])}
			<PanelRow
				{row}
				stacked={!rowFits(row.spans, columnPx(area), layout.panelGap, remPx)}
				editing={ui.editing}
				heightLocked={row.items.every(fillsWindow)}
				onresize={(index, left, mirror) => resizeRow(area, r, index, left, mirror)}
				onequalize={() => setRows(equalizeRow(layout.columnRows, area, r))}
				onheight={(value) => setRows(setRowHeight(layout.columnRows, area, r, value))}
			>
				{#snippet panel(id)}
					{@const instance = config.widgets[id]}
					{#if instance}
						<WidgetPanel
							{instance}
							column={area}
							maxHeight={fillsWindow(id) ? undefined : row.maxHeight}
							{sortable}
							editing={ui.editing}
							grabbed={grabbed?.id === id}
							ongripkeydown={(event) => onGripKeydown(event, id)}
							ongripblur={() => onGripBlur(id)}
							onsettings={() => openSettings(id)}
							onremove={() => remove(id)}
						/>
					{/if}
				{/snippet}
			</PanelRow>
		{/each}
		{#if ui.editing}
			{#if rows.length === 0}
				<p class="empty-hint">
					{area === CENTER ? t('edit.emptyColumn') : areaName(area)}
				</p>
			{/if}
			<AddWidget label={areaName(area)} {used} onadd={(type) => addWidget(type, area)} />
		{/if}
	</div>
{/snippet}

<!-- Der Abstand gilt auch für die Seiten in der Sidebar, deshalb am Rahmen -->
<div class="frame" style:--gap="{panelGap}px" bind:clientWidth={available} bind:this={frame}>
	<div
		class="board"
		class:editing={ui.editing}
		class:resizing={resizing !== null}
		style:grid-template-columns={template}
		style:max-width={Number.isFinite(width) ? `${width}px` : undefined}
		style:margin-left={offset !== null ? `${offset}px` : undefined}
	>
		{#each columns as column (column.track)}
			<div class="column" style:grid-column={column.track}>
				{#each column.areas as area (area)}
					{@render segment(area)}
				{/each}
			</div>
		{/each}

		{#if ui.editing && sideBySide}
			{#each gutters as gutter (gutter.side)}
				<!-- Fokussierbarer Separator mit Wert ist das ARIA-Muster „Window Splitter“ -->
				<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
				<div
					class="gutter"
					style:grid-column={gutter.track}
					class:active={resizing === gutter.side}
					role="separator"
					aria-orientation="vertical"
					aria-label={t('edit.resizeCenter')}
					aria-valuemin={gutterValue(gutter.side, gutter.side === 'left' ? range[1] : range[0])}
					aria-valuemax={gutterValue(gutter.side, gutter.side === 'left' ? range[0] : range[1])}
					aria-valuenow={gutterValue(gutter.side, layout.centerSpan)}
					aria-valuetext="{side} · {layout.centerSpan} · {side}"
					tabindex="0"
					title={t('edit.resizeHint')}
					onpointerdown={(event) => onGutterPointerdown(event, gutter.side)}
					onkeydown={(event) => onGutterKeydown(event, gutter.side)}
					ondblclick={() => setCenterSpan(DEFAULT_CENTER_SPAN)}
					onpointerenter={() => (gutterActive = gutter.side)}
					onpointerleave={() => (gutterActive = null)}
					onfocus={() => {
						gutterActive = gutter.side;
						resizeBase = $state.snapshot(layout.columnRows) as Rows;
					}}
					onblur={() => {
						gutterActive = null;
						resizeBase = null;
					}}
				>
					<span class="handle"></span>
				</div>
			{/each}
			{#if showSpans}
				{#each spanLabels as label (label.track)}
					<div class="span-label" style:grid-column={label.track} aria-hidden="true">
						{label.span}<span>/{GRID_UNITS}</span>
					</div>
				{/each}
			{/if}
		{/if}
	</div>

	{#if arrangement.sidebar}
		<Sidebar
			arrangement={arrangement.sidebar}
			open={wanted}
			tabs={tabInfo}
			{segment}
			{sortable}
			editing={ui.editing}
			ontoggle={(side) => sidebar.toggle(side)}
			onclose={() => sidebar.close()}
			ondroptab={dropOnTab}
			onspring={(side) => {
				sidebar.show(side);
				announcer.say(t('sidebar.opened', { area: t(`area.${side}`) }));
			}}
			onclosed={() => {
				if (!wanted) lastOpen = null;
			}}
		/>
	{/if}
</div>

<Dialog
	bind:open={settingsOpen}
	title={settingsDefinition ? t('edit.widgetSettings', { name: t(settingsDefinition.name) }) : ''}
	size="sm"
	onclose={() => (settingsFor = null)}
>
	{#if settingsInstance && settingsDefinition?.settingsComponent}
		<settingsDefinition.settingsComponent
			id={settingsInstance.id}
			settings={settingsInstance.settings}
			update={updateSettings}
		/>
	{/if}
</Dialog>

<style>
	/* Bezugsrahmen für die Sidebar, die mit der Page scrollt */
	.frame {
		position: relative;
		width: 100%;
	}

	.board {
		display: grid;
		width: 100%;
		margin-inline: auto;
	}

	/* Leere Spalten nehmen außerhalb des Edit-Modus keinen Platz ein (auch keinen Abstand) */
	.segment.empty:not(.editing) {
		display: none;
	}

	/* Alle Elemente liegen fest in Zeile 1, sonst schiebt die Breitenanzeige Spalten nach unten */
	.column,
	.gutter {
		grid-row: 1;
	}

	/*
	 * Die Spalten scrollen nicht selbst, sondern mit der ganzen Page. Unten nur der Seitenrand;
	 * Platz für die Edit-Leiste braucht es nur im Edit-Modus, der Bearbeiten-Knopf steht im
	 * rechten Seitenrand.
	 */
	.column {
		display: flex;
		flex-direction: column;
		gap: var(--gap);
		padding-bottom: var(--page-pad-block);

		.editing & {
			padding-bottom: 96px;
		}
	}

	.segment {
		display: flex;
		flex-direction: column;
		gap: var(--gap);
	}

	/* Trenner zwischen Mitte und Seite; im Edit-Modus ziehbar */
	.gutter {
		position: relative;
		z-index: 3;
		min-width: 0;
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
		height: 56px;
		border-radius: var(--radius-full);
		background: rgb(255 255 255 / 0.7);
		box-shadow: 0 1px 4px rgb(var(--shade) / 0.3);
		transition:
			height var(--duration) var(--ease-out),
			background-color var(--duration-fast) ease;
	}

	.gutter:hover .handle,
	.gutter.active .handle {
		height: 96px;
		background: #fff;
	}

	.resizing {
		cursor: col-resize;
		user-select: none;
	}

	/* Breite der Spalte in Raster-Einheiten, sichtbar beim Ziehen bzw. Fokus auf einem Trenner */
	.span-label {
		grid-row: 1;
		z-index: 4;
		align-self: center;
		justify-self: center;
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius-full);
		background: rgb(var(--shade) / 0.55);
		backdrop-filter: blur(8px);
		color: #fff;
		font-size: var(--text-xl);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		pointer-events: none;
		animation: label-in var(--duration) var(--ease-out);

		span {
			font-size: 0.6em;
			font-weight: 500;
			opacity: 0.75;
		}
	}

	@keyframes label-in {
		from {
			opacity: 0;
			transform: scale(0.9);
		}
	}

	.segment.empty.editing {
		min-height: 120px;
		padding: var(--space-2);
		border-radius: calc(var(--radius-panel) + 8px);
		background: rgb(255 255 255 / 0.08);
	}

	.empty-hint {
		padding-top: var(--space-4);
		color: #fff;
		font-weight: 600;
		text-align: center;
		text-shadow: 0 1px 2px rgb(var(--shade) / 0.35);
	}
</style>
