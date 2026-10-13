<script lang="ts">
	import { createId } from '$lib/config/parse';
	import type { WidgetInstance, WidgetType } from '$lib/config/types';
	import { Sortable } from '$lib/dnd/sortable.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { getApp } from '$lib/state/context';
	import { toasts } from '$lib/state/toasts.svelte';
	import { ui } from '$lib/state/ui.svelte';
	import { announcer } from '$lib/ui/announcer.svelte';
	import Dialog from '$lib/ui/Dialog.svelte';
	import { definitionOf } from '$lib/widgets/registry';
	import AddWidget from './AddWidget.svelte';
	import {
		collapseColumns,
		findWidget,
		insertWidget,
		moveWidget,
		removeWidget,
		stepPosition,
		visibleColumnCount,
		type Position
	} from './operations';
	import WidgetPanel from './WidgetPanel.svelte';

	const COLUMN_GAP = 24;

	const app = getApp();
	const config = $derived(app.config.value);
	const layout = $derived(config.layout);

	let width = $state(typeof innerWidth === 'number' ? innerWidth : 1280);
	const remPx =
		typeof document === 'undefined'
			? 16
			: parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
	const visible = $derived(visibleColumnCount(layout.columns, width, remPx, COLUMN_GAP));
	const groups = $derived(collapseColumns(layout.columns, visible));
	const used = $derived(new Set(Object.values(config.widgets).map((w) => w.type)));

	const nameOf = (id: string) => {
		const instance = config.widgets[id];
		return instance ? t(definitionOf(instance.type).name) : id;
	};

	const sortable = new Sortable({
		group: 'panels',
		onmove: (id, list, index) => {
			const live = app.config.value.layout;
			live.columnItems = moveWidget(live.columnItems, id, { column: Number(list), index });
		},
		ondrop: (id, list, index) => {
			announcer.say(
				t('dnd.dropped', { name: nameOf(id), column: Number(list) + 1, position: index + 1 })
			);
		}
	});

	// --- Tastatur: Leertaste greift, Pfeile verschieben, Leertaste legt ab, Esc bricht ab ----

	let grabbed = $state<{ id: string; origin: Position } | null>(null);
	let keyboardMoving = false;

	function focusGrip(id: string) {
		document.querySelector<HTMLElement>(`[data-grip="${CSS.escape(id)}"]`)?.focus();
	}

	async function moveTo(id: string, position: Position) {
		keyboardMoving = true;
		await sortable.animate(() => {
			const live = app.config.value.layout;
			live.columnItems = moveWidget(live.columnItems, id, position);
		});
		focusGrip(id);
		keyboardMoving = false;
	}

	const DIRECTIONS = {
		ArrowUp: 'up',
		ArrowDown: 'down',
		ArrowLeft: 'left',
		ArrowRight: 'right'
	} as const;

	async function onGripKeydown(event: KeyboardEvent, id: string) {
		const position = findWidget(layout.columnItems, id);
		if (!position) return;
		const say = (key: 'dnd.position' | 'dnd.dropped', at: Position) =>
			announcer.say(t(key, { name: nameOf(id), column: at.column + 1, position: at.index + 1 }));

		if (event.key === ' ' || event.key === 'Enter') {
			event.preventDefault();
			if (grabbed?.id === id) {
				grabbed = null;
				say('dnd.dropped', position);
			} else {
				grabbed = { id, origin: position };
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
		const next = stepPosition(layout.columnItems, position, direction);
		if (!next) return;
		await moveTo(id, next);
		say('dnd.position', next);
	}

	function onGripBlur(id: string) {
		// Fokuswechsel nach außen legt ab; beim Spaltenwechsel wird das Element neu erzeugt
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
			live.layout.columnItems = insertWidget(live.layout.columnItems, id, {
				column,
				index: live.layout.columnItems[column].length
			});
		});
		const panel = document.querySelector(`[data-grip="${CSS.escape(id)}"]`);
		panel?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		focusGrip(id);
	}

	async function remove(id: string) {
		const live = app.config.value;
		const position = findWidget(live.layout.columnItems, id);
		const instance = live.widgets[id];
		if (!position || !instance) return;
		const backup = $state.snapshot(instance) as WidgetInstance;
		const name = nameOf(id);
		await sortable.animate(() => {
			live.layout.columnItems = removeWidget(live.layout.columnItems, id);
			delete live.widgets[id];
		});
		toasts.show(t('edit.removed', { name }), {
			action: {
				label: t('common.undo'),
				run: () =>
					void sortable.animate(() => {
						const current = app.config.value;
						current.widgets[id] = backup;
						current.layout.columnItems = insertWidget(current.layout.columnItems, id, position);
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
</script>

<div
	class="board"
	class:editing={ui.editing}
	style:--columns={visible}
	style:max-width={layout.maxWidth ? `${layout.maxWidth}rem` : undefined}
	bind:clientWidth={width}
>
	{#each groups as group, g (g)}
		<div class="column">
			{#each group as column (column)}
				<div
					class="segment"
					class:empty={layout.columnItems[column].length === 0}
					{@attach sortable.list({ id: String(column), axis: 'vertical' })}
				>
					{#each layout.columnItems[column] as id (id)}
						{@const instance = config.widgets[id]}
						{#if instance}
							<WidgetPanel
								{instance}
								{column}
								{sortable}
								editing={ui.editing}
								grabbed={grabbed?.id === id}
								ongripkeydown={(event) => onGripKeydown(event, id)}
								ongripblur={() => onGripBlur(id)}
								onsettings={() => openSettings(id)}
								onremove={() => remove(id)}
							/>
						{/if}
					{/each}
					{#if ui.editing}
						{#if layout.columnItems[column].length === 0}
							<p class="empty-hint">{t('edit.emptyColumn')}</p>
						{/if}
						<AddWidget {column} {used} onadd={(type) => addWidget(type, column)} />
					{/if}
				</div>
			{/each}
		</div>
	{/each}
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
	.board {
		display: grid;
		grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
		gap: 24px;
		width: 100%;
		height: 100%;
		margin-inline: auto;
	}

	/* Jede Spalte scrollt für sich, die Page selbst nicht */
	.column {
		display: flex;
		flex-direction: column;
		gap: 24px;
		min-height: 0;
		/* Platz für Fokusringe und Schatten, die sonst abgeschnitten würden */
		margin: -12px;
		padding: 12px 12px 96px;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.segment {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.editing .segment.empty {
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
		text-shadow: 0 1px 2px rgb(8 34 66 / 0.35);
	}
</style>
