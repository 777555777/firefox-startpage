<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Sortable } from '$lib/dnd/sortable.svelte';
	import { glassLayer } from '$lib/glass/layer';
	import { t } from '$lib/i18n/index.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import type { IconName } from '$lib/ui/icons';
	import { isOverlayOpen } from '$lib/utils/keyboard';
	import type { SidebarArrangement } from './arrangement';
	import { LAYOUT_AREAS, type Side } from './operations';

	export type TabInfo = { icon: IconName; label: string };

	let {
		arrangement,
		open,
		tabs,
		segment,
		sortable,
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

	let drawer: HTMLElement;
	let contentElement: HTMLElement;
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
		if (!contentElement?.contains(document.activeElement)) return;
		drawer.querySelector<HTMLElement>(`[data-sidebar-tab="${arrangement.open}"]`)?.focus();
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
	class="drawer"
	class:open={open !== null}
	class:ready
	class:closed={!content}
	style:--sidebar-width="{arrangement.width}px"
	style:--slide="{SLIDE_MS}ms"
	bind:this={drawer}
	{onkeydown}
>
	<div class="tabs" role="group" aria-label={t('sidebar.tabs')}>
		{#each arrangement.tabs as side (side)}
			{@const info = tabs[side]}
			<button
				type="button"
				class="tab glass"
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
		class="content"
		aria-label={content ? t(`area.${content}`) : undefined}
		inert={open === null}
		bind:this={contentElement}
	>
		{#each arrangement.areas as area (area)}
			<div class="side" data-sidebar-side={sideOf(area)} hidden={sideOf(area) !== content}>
				{@render segment(area)}
			</div>
		{/each}
	</aside>
</div>

<style>
	/*
	 * Fest am linken Rand, so hoch wie das Fenster: Beim Öffnen ist die Sidebar immer dort, wo man
	 * gerade ist, auch wenn die Page weit gescrollt ist. Geschlossen liegt sie links außerhalb, nur
	 * die Tabs ragen heraus.
	 */
	.drawer {
		--sidebar-pad: var(--space-4);
		position: fixed;
		z-index: 5;
		inset-block: 0;
		left: var(--page-pad-inline);
		width: var(--sidebar-width);
		transform: translateX(calc(-100% - var(--page-pad-inline)));

		&.open {
			transform: none;
		}

		&.ready {
			transition: transform var(--slide) var(--ease-out);
		}
	}

	.tabs {
		position: absolute;
		z-index: 1;
		top: var(--page-pad-block);
		left: 100%;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	/* Zur Mitte hin rund, zum Rand hin eckig, wie ein Reiter */
	.tab {
		display: grid;
		place-items: center;
		width: 36px;
		height: 44px;
		padding: 0;
		border: none;
		border-radius: 0 var(--radius-md) var(--radius-md) 0;
		color: var(--text-secondary);
		--glass-alpha: 0.32;
		transition:
			color var(--duration-fast) ease,
			box-shadow var(--duration-fast) ease;

		&:hover {
			color: var(--text);
		}

		&.active,
		&.over {
			color: var(--accent-text);
			box-shadow:
				inset -3px 0 0 var(--accent),
				var(--glass-shadow);
		}

		&:focus-visible {
			box-shadow: var(--focus-ring), var(--glass-shadow);
		}
	}

	/*
	 * Scrollt nur, wenn der Inhalt höher als das Fenster ist; das Mausrad gibt dann am Ende an die
	 * Page weiter. Der Innenabstand hält Platz für Schatten und Fokusringe, weil das Glas am
	 * Scroll-Container abgeschnitten wird.
	 */
	.content {
		position: absolute;
		inset: 0 calc(-1 * var(--sidebar-pad));
		overflow-y: auto;
		padding: var(--page-pad-block) var(--sidebar-pad) 96px;
	}

	/* Ganz zu: Panels zählen nicht mehr fürs Glas und werfen keinen Schatten an den Rand */
	.closed .content {
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
		.drawer.ready {
			transition: transform 0s linear 150ms;
		}

		.drawer.ready.open {
			transition: none;
		}

		.ready .content {
			transition: opacity 150ms ease;
		}

		.drawer:not(.open) .content {
			opacity: 0;
		}
	}
</style>
