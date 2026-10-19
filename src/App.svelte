<script lang="ts">
	import { tick } from 'svelte';
	import { activeRef } from '$lib/background/media-utils';
	import { clearPoster } from '$lib/background/poster';
	import StaticBackground from '$lib/background/StaticBackground.svelte';
	import GlassCanvas from '$lib/glass/GlassCanvas.svelte';
	import type { RenderLevel } from '$lib/glass/params.svelte';
	import { renderState } from '$lib/glass/render-state.svelte';
	import { i18n, t } from '$lib/i18n/index.svelte';
	import Board from '$lib/layout/Board.svelte';
	import { sidebar } from '$lib/layout/sidebar-store.svelte';
	import type { Side } from '$lib/layout/operations';
	import EditControls from '$lib/layout/EditControls.svelte';
	import SettingsDialog from '$lib/settings/SettingsDialog.svelte';
	import type { AppState } from '$lib/state/app.svelte';
	import { setApp } from '$lib/state/context';
	import { ui } from '$lib/state/ui.svelte';
	import { accentPalette } from '$lib/theme/accent';
	import { rgbCss } from '$lib/theme/palette';
	import { announcer } from '$lib/ui/announcer.svelte';
	import Toasts from '$lib/ui/Toasts.svelte';
	import { isOverlayOpen, isTypingTarget } from '$lib/utils/keyboard';
	import { firstBoard } from '$lib/widgets/links/boards';
	import { digitOf } from '$lib/widgets/links/nav';

	let { app }: { app: AppState } = $props();

	// svelte-ignore state_referenced_locally
	setApp(app);

	const config = $derived(app.config.value);
	/** Debug-Panel für das Glas, nur im Dev-Build */
	const debug = import.meta.env.DEV && new URLSearchParams(location.search).has('debug');
	const auto = $derived(config.appearance.quality === 'auto');
	/**
	 * Gewünschte WebGL-Stufe, `null` = Static. „Automatisch“ beginnt mit der zuletzt stabilen
	 * Stufe dieses Rechners, beim ersten Mal mit Hoch.
	 */
	const level = $derived.by<RenderLevel | null>(() => {
		const quality = auto ? (renderState.autoLevel ?? 'high') : config.appearance.quality;
		return quality === 'static' || quality === 'auto' ? null : quality;
	});

	$effect.pre(() => {
		i18n.setting = config.language;
	});

	$effect(() => {
		document.documentElement.lang = i18n.lang;
		document.title = t('app.title');
	});

	// Design-Tokens aus der Config
	$effect(() => {
		const palette = accentPalette(config.appearance.accent);
		const style = document.documentElement.style;
		style.setProperty('--accent', palette.base);
		style.setProperty('--accent-hover', palette.hover);
		style.setProperty('--accent-pressed', palette.pressed);
		// Nachts eine durchscheinende statt einer hellen Fläche
		style.setProperty(
			'--accent-subtle',
			app.timeOfDay.tone === 'dark'
				? `color-mix(in srgb, ${palette.base} 32%, transparent)`
				: palette.subtle
		);
		style.setProperty('--on-accent', palette.onAccent);
		style.setProperty('--frost', String(config.appearance.glass.frost));
	});

	// Tageszeit: Tonalität (hell/dunkel) und Glasfarbe folgen der Phase
	$effect(() => {
		const root = document.documentElement;
		root.dataset.tone = app.timeOfDay.tone;
		root.dataset.phase = app.timeOfDay.phase;
		root.style.setProperty('--glass-tint', rgbCss(app.timeOfDay.glassTint));
	});

	$effect(() => {
		document.documentElement.dataset.renderer = renderState.mode;
	});

	/** Die Static-Darstellung bleibt, bis das Canvas vollständig eingeblendet ist */
	const staticVisible = $derived(renderState.mode === 'static' || !renderState.canvasShown);

	// Farbe für den allerersten Paint des nächsten Tabs merken (siehe public/boot.js)
	$effect(() => {
		try {
			localStorage.setItem(
				'startpage:paint',
				JSON.stringify({ tone: app.timeOfDay.tone, color: rgbCss(app.timeOfDay.sky.middle) })
			);
		} catch {
			// ohne localStorage startet die Seite eben mit der Standardfarbe
		}
	});

	// Ohne eigenen Hintergrund kein Standbild für den ersten Paint (das legt GlassCanvas an)
	$effect(() => {
		if (!activeRef(config.appearance.background, app.timeOfDay.phase)) clearPoster();
	});

	/** Liegt die Suche in einer geschlossenen Seite der Sidebar, öffnet sich diese zuerst */
	async function focusSearch(search: HTMLInputElement) {
		const side = search.closest<HTMLElement>('[data-sidebar-side]')?.dataset.sidebarSide;
		if ((side === 'left' || side === 'right') && sidebar.open !== side) {
			sidebar.show(side as Side);
			await tick();
		}
		search.focus();
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
		if (isTypingTarget(event.target) || isOverlayOpen()) return;
		if (event.key === 'e' || event.key === 'E') {
			event.preventDefault();
			ui.editing = !ui.editing;
		} else if (event.key === 'Escape' && ui.editing) {
			ui.editing = false;
		} else if (event.key === '/') {
			// Firefox fokussiert beim neuen Tab die Adressleiste; `/` holt die (erste) Suche
			const search = document.querySelector<HTMLInputElement>('[data-search-input]');
			if (search) {
				event.preventDefault();
				void focusSearch(search);
			}
		} else if ((event.key === 's' || event.key === 'S') && sidebar.available) {
			// S öffnet bzw. schließt die Sidebar, Umschalt+S wechselt die Seite
			event.preventDefault();
			if (event.shiftKey) sidebar.switchSide();
			else sidebar.toggleLast();
			const open = sidebar.open;
			announcer.say(open ? t('sidebar.opened', { area: t(`area.${open}`) }) : t('sidebar.closed'));
		} else if (!event.shiftKey) {
			// 1…9 ohne Fokus auf einem Board öffnet Links des ersten Boards
			const digit = digitOf(event);
			if (digit) {
				event.preventDefault();
				firstBoard()?.openNth(digit);
			}
		}
	}
</script>

<svelte:window {onkeydown} />

<!-- Static zuerst: Das Canvas liegt darüber und blendet über ihr ein -->
{#if staticVisible}
	<StaticBackground />
{/if}
{#if level && renderState.failure !== 'unavailable' && renderState.failure !== 'unstable'}
	<GlassCanvas {level} {auto} />
{/if}

<main class="page" aria-label={t('app.main')}>
	<Board />
</main>

<EditControls />
{#if import.meta.env.DEV && debug}
	{#await import('$lib/glass/DebugPanel.svelte') then { default: DebugPanel }}
		<DebugPanel />
	{/await}
{/if}
<SettingsDialog />
<Toasts />

<div class="visually-hidden" aria-live="assertive" aria-atomic="true">{announcer.message}</div>

<style>
	.page {
		position: relative;
		z-index: 1;
		min-height: 100vh;
		min-height: 100dvh;
		/* Seitenrand; die Sidebar richtet sich danach */
		--page-pad-block: clamp(16px, 4vh, 48px);
		--page-pad-inline: clamp(16px, 4vw, 56px);
		padding: var(--page-pad-block) var(--page-pad-inline) 0;
	}
</style>
