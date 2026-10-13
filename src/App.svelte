<script lang="ts">
	import { i18n, t } from '$lib/i18n/index.svelte';
	import type { AppState } from '$lib/state/app.svelte';
	import { setApp } from '$lib/state/context';

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
</script>

<main class="page" aria-label={t('app.main')}></main>

<style>
	.page {
		min-height: 100vh;
	}
</style>
