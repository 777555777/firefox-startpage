<script lang="ts">
	import { favicons } from './favicons.svelte';
	import { initialOf } from './link-utils';

	let {
		url,
		label,
		icon = null,
		size = 20
	}: { url: string; label: string; icon?: string | null; size?: number } = $props();

	/** Fehlgeschlagenes eigenes Bild; dann gilt das Favicon */
	let customFailed = $state(false);
	const custom = $derived(icon && !customFailed ? icon : null);
	// Mit eigenem Bild wird gar nicht erst nach einem Favicon gesucht
	const favicon = $derived(custom ? null : favicons.get(url));
	const src = $derived(custom ?? favicon?.src ?? null);
	/**
	 * Kleine Favicons (16 px) nicht auf die volle Größe aufblasen, sonst wirken sie verpixelt:
	 * höchstens auf ihre eigene Größe, aber mindestens 60 % der Fläche.
	 */
	const shown = $derived(
		custom || !favicon || favicon.size >= size
			? size
			: Math.max(Math.round(size * 0.6), Math.min(size, favicon.size))
	);

	function onerror() {
		if (custom) customFailed = true;
		else favicons.failed(url);
	}
</script>

<span class="link-icon" style:--size="{size}px" aria-hidden="true">
	{#if src}
		<img
			{src}
			alt=""
			width={shown}
			height={shown}
			style:width="{shown}px"
			style:height="{shown}px"
			referrerpolicy="no-referrer"
			draggable="false"
			{onerror}
		/>
	{:else if favicon === null}
		<span class="initial">{initialOf(label)}</span>
	{/if}
</span>

<style>
	.link-icon {
		flex: none;
		display: inline-grid;
		place-items: center;
		width: var(--size);
		height: var(--size);
	}

	img {
		object-fit: contain;
		border-radius: calc(var(--size) * 0.2);
	}

	.initial {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		border-radius: calc(var(--size) * 0.28);
		background: linear-gradient(
			160deg,
			color-mix(in srgb, var(--accent-hover) 75%, white),
			var(--accent)
		);
		color: var(--on-accent);
		font-size: calc(var(--size) * 0.55);
		font-weight: 700;
		line-height: 1;
		box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.4);
	}
</style>
