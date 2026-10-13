<script lang="ts" generics="P extends Record<string, unknown>">
	import type { Component } from 'svelte';
	import type { AppState } from '$lib/state/app.svelte';
	import { setApp } from '$lib/state/context';

	/** Rendert eine Komponente mit App-Kontext, nur für Komponententests */
	let {
		app,
		component: Inner,
		props
	}: { app: AppState; component: Component<P>; props: P } = $props();

	// svelte-ignore state_referenced_locally
	setApp(app);
</script>

<Inner {...props} />
