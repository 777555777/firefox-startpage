<script lang="ts">
	import { i18n, t } from '$lib/i18n/index.svelte';
	import Board from '$lib/layout/Board.svelte';
	import EditControls from '$lib/layout/EditControls.svelte';
	import SettingsDialog from '$lib/settings/SettingsDialog.svelte';
	import type { AppState } from '$lib/state/app.svelte';
	import { setApp } from '$lib/state/context';
	import { ui } from '$lib/state/ui.svelte';
	import { accentPalette } from '$lib/theme/accent';
	import { announcer } from '$lib/ui/announcer.svelte';
	import Toasts from '$lib/ui/Toasts.svelte';
	import { isOverlayOpen, isTypingTarget } from '$lib/utils/keyboard';

	let { app }: { app: AppState } = $props();

	// svelte-ignore state_referenced_locally
	setApp(app);

	const config = $derived(app.config.value);

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
		style.setProperty('--accent-subtle', palette.subtle);
		style.setProperty('--on-accent', palette.onAccent);
		style.setProperty('--frost', String(config.appearance.glass.frost));
	});

	function onkeydown(event: KeyboardEvent) {
		if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
		if (isTypingTarget(event.target) || isOverlayOpen()) return;
		if (event.key === 'e' || event.key === 'E') {
			event.preventDefault();
			ui.editing = !ui.editing;
		} else if (event.key === 'Escape' && ui.editing) {
			ui.editing = false;
		}
	}
</script>

<svelte:window {onkeydown} />

<main class="page" aria-label={t('app.main')}>
	<Board />
</main>

<EditControls />
<SettingsDialog />
<Toasts />

<div class="visually-hidden" aria-live="assertive" aria-atomic="true">{announcer.message}</div>

<style>
	.page {
		height: 100vh;
		height: 100dvh;
		padding: clamp(16px, 4vh, 48px) clamp(16px, 4vw, 56px) 0;
	}
</style>
