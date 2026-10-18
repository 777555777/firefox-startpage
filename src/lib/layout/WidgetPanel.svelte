<script lang="ts">
	import type { WidgetInstance } from '$lib/config/types';
	import type { Sortable } from '$lib/dnd/sortable.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { getApp } from '$lib/state/context';
	import { glass } from '$lib/glass/layer';
	import Icon from '$lib/ui/Icon.svelte';
	import { ScrollArea } from '$lib/ui/scroll-area.svelte';
	import { definitionOf } from '$lib/widgets/registry';

	let {
		instance,
		column,
		maxHeight,
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
		/** Höchsthöhe der Zeile in rem; ohne Wert so hoch wie der Inhalt */
		maxHeight?: number;
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
	const limited = $derived(maxHeight !== undefined);
	/** Das Panel scrollt selbst, wenn die Höhe begrenzt ist und das Widget das nicht übernimmt */
	const scrolls = $derived(limited && !definition.scrollsSelf);
	const area = new ScrollArea();

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
	class:limited
	style:max-height={limited ? `${maxHeight}rem` : undefined}
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

	<!--
		Gescrollt wird erst, wenn der Inhalt wirklich überläuft. Sonst würde der Scroll-Container
		Aufklappendes wie die Suchvorschläge abschneiden.
	-->
	<div
		class="content"
		class:scrolling={scrolls && area.overflowing}
		class:fade-top={area.fadeTop}
		class:fade-bottom={area.fadeBottom}
		{@attach scrolls ? area.attach : undefined}
	>
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

	/* Mit Höchsthöhe darf der Inhalt kleiner werden als er ist; er scrollt oder das Widget selbst */
	.limited .content {
		min-height: 0;
	}

	.content.scrolling {
		--fade: 12px;
		overflow-y: auto;
		/* Platz für Fokusringe, die sonst am Rand des Scroll-Containers abgeschnitten würden */
		margin: -4px;
		padding: 4px;
		scroll-padding-block: var(--space-3);

		&.fade-top {
			mask-image: linear-gradient(transparent, #000 var(--fade));
		}

		&.fade-bottom {
			mask-image: linear-gradient(#000 calc(100% - var(--fade)), transparent);
		}

		&.fade-top.fade-bottom {
			mask-image: linear-gradient(
				transparent,
				#000 var(--fade),
				#000 calc(100% - var(--fade)),
				transparent
			);
		}
	}

	.crashed {
		display: grid;
		justify-items: start;
		gap: var(--space-3);
		color: var(--text-secondary);
	}
</style>
