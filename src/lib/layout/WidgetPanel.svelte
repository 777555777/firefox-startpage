<script lang="ts">
	import type { WidgetInstance } from '$lib/config/types';
	import type { Sortable } from '$lib/dnd/sortable.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { getApp } from '$lib/state/context';
	import { glass } from '$lib/glass/layer';
	import Icon from '$lib/ui/Icon.svelte';
	import { definitionOf } from '$lib/widgets/registry';

	let {
		instance,
		column,
		editing,
		sortable,
		grabbed,
		ongripkeydown,
		ongripblur,
		onsettings,
		onremove
	}: {
		instance: WidgetInstance;
		column: number;
		editing: boolean;
		sortable: Sortable;
		grabbed: boolean;
		ongripkeydown: (event: KeyboardEvent) => void;
		ongripblur: () => void;
		onsettings: () => void;
		onremove: () => void;
	} = $props();

	const app = getApp();
	const definition = $derived(definitionOf(instance.type));
	const name = $derived(t(definition.name));
	const dragging = $derived(sortable.isDragging(instance.id));

	/** Änderungen gehen direkt in die gespeicherte Instanz */
	function update(mutate: (settings: unknown) => void) {
		const live = app.config.value.widgets[instance.id];
		if (live) mutate(live.settings);
	}

	function resetSettings() {
		const live = app.config.value.widgets[instance.id];
		if (live) live.settings = definition.defaultSettings() as typeof live.settings;
	}
</script>

<section
	class="panel glass"
	class:editing
	class:dragging
	class:grabbed
	aria-label={name}
	data-widget={instance.type}
	{@attach sortable.item({
		id: instance.id,
		list: String(column),
		handle: '.grip',
		disabled: !editing
	})}
	{@attach glass({ depth: 1, opacity: dragging ? 0.35 : 1 })}
>
	{#if editing}
		<div class="controls">
			<button
				type="button"
				class="icon-btn grip"
				data-grip={instance.id}
				aria-label={t('edit.move', { name })}
				aria-pressed={grabbed}
				onkeydown={ongripkeydown}
				onblur={ongripblur}
			>
				<Icon name="grip" />
			</button>
			<span class="name">
				<Icon name={definition.icon} size={15} />
				{name}
			</span>
			{#if definition.settingsComponent}
				<button
					type="button"
					class="icon-btn"
					aria-label={t('edit.widgetSettings', { name })}
					onclick={onsettings}
				>
					<Icon name="sliders" />
				</button>
			{/if}
			<button
				type="button"
				class="icon-btn"
				aria-label={t('edit.remove', { name })}
				onclick={onremove}
			>
				<Icon name="trash" />
			</button>
		</div>
	{/if}

	<div class="content">
		<svelte:boundary onerror={(error) => console.error(`Widget ${instance.id} abgestürzt`, error)}>
			<definition.component id={instance.id} settings={instance.settings} {editing} {update} />

			{#snippet failed(_error, reset)}
				<div class="crashed" role="alert">
					<p>{t('widget.crashed')}</p>
					<button
						type="button"
						class="btn"
						onclick={() => {
							resetSettings();
							reset();
						}}
					>
						{t('widget.reset')}
					</button>
				</div>
			{/snippet}
		</svelte:boundary>
	</div>
</section>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		min-width: 0;
		padding: var(--space-5);
		transition:
			opacity var(--duration) ease,
			box-shadow var(--duration) ease;

		&.editing {
			padding-top: var(--space-3);
		}

		/* Aufklappendes (z. B. Suchvorschläge) liegt über den Nachbar-Panels */
		&:focus-within {
			z-index: 2;
		}

		&.dragging {
			opacity: 0.35;
		}

		/* Kontur statt Schatten, damit sie auch im WebGL-Modus sichtbar ist */
		&.grabbed {
			outline: 3px solid var(--accent);
			outline-offset: 0;
		}
	}

	.controls {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		margin: 0 calc(var(--space-2) * -1) var(--space-3);
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--line);
	}

	.grip {
		cursor: grab;
		touch-action: none;

		&[aria-pressed='true'] {
			background: var(--accent);
			color: var(--on-accent);
		}
	}

	.name {
		display: inline-flex;
		flex: 1;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text-secondary);
	}

	/*
	 * Füllt das Panel, wenn es durch einen höheren Nachbarn in der Zeile gestreckt wird. Als
	 * Flex-Spalte wachsen Widgets dabei nur, wenn sie es selbst wollen (z. B. die Uhr).
	 */
	.content {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.crashed {
		display: grid;
		justify-items: start;
		gap: var(--space-3);
		color: var(--text-secondary);
	}
</style>
