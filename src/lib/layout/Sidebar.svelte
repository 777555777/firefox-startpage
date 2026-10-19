<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Sortable } from '$lib/dnd/sortable.svelte';
	import { glass, glassLayer } from '$lib/glass/layer';
	import { t } from '$lib/i18n/index.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import type { IconName } from '$lib/ui/icons';
	import { isOverlayOpen } from '$lib/utils/keyboard';
	import type { SidebarArrangement } from './arrangement';
	import { EDGE_TAB_CLEARANCE_PX, EDGE_TAB_PX, LAYOUT_AREAS, type Side } from './operations';

	export type TabInfo = { icon: IconName; label: string };

	let {
		arrangement,
		open,
		tabs,
		segment,
		sortable,
		editing,
		ontoggle,
		onclose,
		onclosed,
		ondroptab,
		onspring
	}: {
		/** Lage und Inhalt; `arrangement.open` ist die Seite, für die die Mitte Platz macht */
		arrangement: SidebarArrangement;
		/** Gewünschte Seite; null = die Sidebar ist zu oder fährt gerade hinaus */
		open: Side | null;
		/** Icon und Name pro Tab */
		tabs: Record<Side, TabInfo>;
		/** Ein Bereich mit seinen Zeilen (aus dem Board, dort hängen DnD und Glas) */
		segment: Snippet<[number]>;
		/** DnD der Panels: Tabs sind Ablageziele */
		sortable: Sortable;
		/** Im Edit-Modus braucht die Edit-Leiste unten Platz */
		editing: boolean;
		ontoggle: (side: Side) => void;
		/** `Esc` in der Sidebar oder auf einem Tab */
		onclose: () => void;
		/** Die Sidebar ist fertig hinausgefahren; erst jetzt darf die Mitte breiter werden */
		onclosed: () => void;
		/** Ein Panel wurde auf einem Tab losgelassen */
		ondroptab: (side: Side, id: string) => void;
		/** Ein gezogenes Panel verweilt über einem Tab: dessen Seite öffnen */
		onspring: (side: Side) => void;
	} = $props();

	/** So lange muss ein gezogenes Panel über einem Tab verweilen, bis sich die Seite öffnet */
	const SPRING_MS = 400;
	const TARGET_PREFIX = 'sidebar:';

	/** Dauer der Fahrt in ms; bei Reduced Motion blendet der Inhalt in 150 ms aus */
	const SLIDE_MS = 260;

	const sideOf = (area: number) => LAYOUT_AREAS[area] as Side;
	/** Gezeigter Inhalt: beim Hinausfahren bleibt die zuletzt offene Seite stehen */
	const content = $derived(open ?? arrangement.open);

	let rail: HTMLElement;
	let drawer: HTMLElement;
	/** Transitionen erst nach dem ersten Frame, damit beim Laden nichts fährt */
	let ready = $state(false);

	$effect(() => {
		const frame = requestAnimationFrame(() => (ready = true));
		return () => cancelAnimationFrame(frame);
	});

	// Während der Fahrt liest der Glas-Layer die Rechtecke in jedem Frame
	$effect(() => {
		void open;
		if (ready) glassLayer.animateFor(SLIDE_MS + 100);
	});

	// Schließt die Sidebar mit dem Fokus darin, geht er vorher auf den Tab der Seite. Mit `inert`
	// fiele er sonst auf <body>.
	$effect.pre(() => {
		if (open || !arrangement.open) return;
		if (!drawer?.contains(document.activeElement)) return;
		rail.querySelector<HTMLElement>(`[data-sidebar-tab="${arrangement.open}"]`)?.focus();
	});

	// Verweilt ein gezogenes Panel über einem Tab, öffnet sich dessen Seite
	$effect(() => {
		const over = sortable.overTarget;
		if (!over?.startsWith(TARGET_PREFIX)) return;
		const side = over.slice(TARGET_PREFIX.length) as Side;
		if (side === open) return;
		const timer = setTimeout(() => onspring(side), SPRING_MS);
		return () => clearTimeout(timer);
	});

	function onkeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || event.defaultPrevented || !open || isOverlayOpen()) return;
		// Vor dem Edit-Modus: das erste `Esc` schließt nur die Sidebar
		event.preventDefault();
		event.stopPropagation();
		onclose();
	}

	// Hinausfahren abwarten, dann darf die Mitte springen; das Zeitlimit greift, wenn keine
	// Transition läuft (Laden, verborgener Tab)
	$effect(() => {
		if (open || !arrangement.open) return;
		const done = () => onclosed();
		const ontransitionend = (event: TransitionEvent) => {
			if (event.target === drawer) done();
		};
		drawer.addEventListener('transitionend', ontransitionend);
		const timer = setTimeout(done, ready ? SLIDE_MS + 140 : 0);
		return () => {
			drawer.removeEventListener('transitionend', ontransitionend);
			clearTimeout(timer);
		};
	});
</script>

<!-- Fängt `Esc` aus Tabs und Inhalt ab, bevor es den Edit-Modus beendet -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="sidebar"
	class:open={open !== null}
	class:ready
	class:closed={!content}
	class:editing
	style:--sidebar-width="{arrangement.width}px"
	style:--slide="{SLIDE_MS}ms"
	style:--rail-width="{EDGE_TAB_PX}px"
	style:--rail-offset="{EDGE_TAB_CLEARANCE_PX}px"
	{onkeydown}
>
	<!--
		Eine Glas-Leiste für alle Tabs, im selben WebGL-Glas wie die Panels. Sie überlappt keinen
		DOM-Inhalt, deshalb scheint nichts durch.
	-->
	<div
		class="rail glass"
		role="group"
		aria-label={t('sidebar.tabs')}
		bind:this={rail}
		{@attach glass({ radius: EDGE_TAB_PX / 2, depth: 0.6, variant: 'button' })}
	>
		{#each arrangement.tabs as side (side)}
			{@const info = tabs[side]}
			<button
				type="button"
				class="tab"
				class:active={open === side}
				class:over={sortable.overTarget === TARGET_PREFIX + side}
				aria-expanded={open === side}
				aria-controls="sidebar-content"
				aria-label={info.label}
				title={`${info.label}\n${t('sidebar.hint')}`}
				data-sidebar-tab={side}
				onclick={() => ontoggle(side)}
				{@attach sortable.target({
					id: TARGET_PREFIX + side,
					ondrop: (id) => ondroptab(side, id)
				})}
			>
				<Icon name={info.icon} size={18} />
			</button>
		{/each}
	</div>

	<aside
		id="sidebar-content"
		class="drawer"
		aria-label={content ? t(`area.${content}`) : undefined}
		inert={open === null}
		bind:this={drawer}
	>
		{#each arrangement.areas as area (area)}
			<div class="side" data-sidebar-side={sideOf(area)} hidden={sideOf(area) !== content}>
				{@render segment(area)}
			</div>
		{/each}
	</aside>
</div>

<style>
	/* Nur Träger für Zustand und Variablen; Leiste und Inhalt liegen unabhängig voneinander */
	.sidebar {
		display: contents;
	}

	/*
	 * Der Inhalt liegt im Fluss der Page (am Rahmen des Boards) und scrollt mit ihr, ohne eigene
	 * Scrollleiste. Ist er höher als die Mitte, wird die Page entsprechend länger. Geschlossen
	 * liegt er links außerhalb des Fensters.
	 */
	.drawer {
		position: absolute;
		z-index: 5;
		top: 0;
		left: 0;
		width: var(--sidebar-width);
		/* Unten nur der Seitenrand: Der Bearbeiten-Knopf steht rechts, nicht über der Sidebar */
		padding-bottom: var(--page-pad-block);
		transform: translateX(calc(-100% - var(--page-pad-inline)));
	}

	.editing .drawer {
		padding-bottom: 96px;
	}

	.open .drawer {
		transform: none;
	}

	/*
	 * Die Leiste steht fest am Fensterrand, damit sie auch auf einer gescrollten Page erreichbar
	 * bleibt, und fährt im Gleichtakt mit dem Inhalt: geschlossen schwebt sie am Rand, offen mit
	 * etwas Abstand neben der Sidebar.
	 */
	.rail {
		position: fixed;
		z-index: 5;
		top: var(--page-pad-block);
		left: var(--rail-offset);
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		width: var(--rail-width);
		padding: var(--space-1);
		border-radius: var(--radius-full);
		--glass-alpha: 0.32;
	}

	.open .rail {
		transform: translateX(calc(var(--page-pad-inline) + var(--sidebar-width)));
	}

	.ready :is(.drawer, .rail) {
		transition: transform var(--slide) var(--ease-out);
	}

	/* Wie die Reiter im Link-Board: aktiv ist eine erhabene Fläche */
	.tab {
		display: grid;
		place-items: center;
		width: 100%;
		aspect-ratio: 1;
		padding: 0;
		border: none;
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--text-secondary);
		transition:
			background-color var(--duration-fast) ease,
			color var(--duration-fast) ease,
			box-shadow var(--duration-fast) ease;

		&:hover {
			background: var(--fill);
			color: var(--text);
		}

		&.active {
			background: var(--raised);
			color: var(--text);
			box-shadow:
				0 1px 3px rgb(var(--shade) / 0.16),
				inset 0 1px 0 var(--highlight);
		}

		&.over {
			background: var(--accent);
			color: var(--on-accent);
			box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 30%, transparent);
		}

		&:focus-visible {
			box-shadow: var(--focus-ring);
		}
	}

	/* Ganz zu: Panels zählen nicht mehr fürs Glas und verlängern die Page nicht */
	.closed .drawer {
		display: none;
	}

	/* Wechsel der Seite bei offener Sidebar: kein Fahren, der neue Inhalt blendet kurz ein */
	.ready .side {
		transition: opacity 150ms ease;
	}

	@starting-style {
		.ready .side {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		/* Statt zu fahren blendet der Inhalt; die Lage springt erst nach dem Ausblenden */
		.ready :is(.drawer, .rail) {
			transition:
				transform 0s linear 150ms,
				opacity 150ms ease;
		}

		.ready.open :is(.drawer, .rail) {
			transition: opacity 150ms ease;
		}

		.sidebar:not(.open) .drawer {
			opacity: 0;
		}
	}
</style>
