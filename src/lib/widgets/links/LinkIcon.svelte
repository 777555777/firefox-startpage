<script lang="ts">
	import { faviconUrl, initialOf } from './link-utils';

	let {
		url,
		label,
		icon = null,
		size = 20
	}: { url: string; label: string; icon?: string | null; size?: number } = $props();

	const favicon = $derived(faviconUrl(url));
	let failed = $state<string | null>(null);
	const src = $derived(
		icon && failed !== icon ? icon : favicon && failed !== favicon ? favicon : null
	);
</script>

<span class="link-icon" style:--size="{size}px" aria-hidden="true">
	{#if src}
		<img
			{src}
			alt=""
			width={size}
			height={size}
			loading="lazy"
			decoding="async"
			referrerpolicy="no-referrer"
			draggable="false"
			onerror={() => (failed = src)}
		/>
	{:else}
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
		width: 100%;
		height: 100%;
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
