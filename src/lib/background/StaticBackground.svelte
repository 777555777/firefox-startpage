<script lang="ts">
	import { untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import type { MediaRef } from '$lib/config/types';
	import { getApp } from '$lib/state/context';
	import { rgbCss } from '$lib/theme/palette';
	import { mediaLibrary } from './media-library.svelte';
	import { activeRef } from './media-utils';

	/**
	 * Hintergrund der Static-Stufe ohne WebGL: Himmelsverlauf per CSS oder das eigene Bild bzw.
	 * der erste Frame des Videos. Beim Phasenwechsel wird weich übergeblendet, das Grading
	 * übernehmen CSS-Filter und eine Farbschicht.
	 */

	const app = getApp();
	const timeOfDay = app.timeOfDay;
	const background = $derived(app.config.value.appearance.background);
	const ref = $derived(activeRef(background, timeOfDay.phase));

	type Layer = { key: string; kind: MediaRef['kind'] | 'sky'; url: string | null };
	const SKY: Layer = { key: 'sky', kind: 'sky', url: null };

	/** null, solange beim Start noch ein eigenes Medium lädt: dann bleibt das Standbild stehen */
	let shown = $state<Layer | null>(null);
	/** Himmel als Untergrund; beim Start mit Medium erst nach dessen Einblenden */
	let skyBase = $state(false);
	let fadeMs = $state(250);
	const mountedAt = performance.now();

	/** Beim Öffnen der Seite nur kurz einblenden, beim Phasenwechsel weich (~2 s) überblenden */
	function show(layer: Layer) {
		if (layer.key === untrack(() => shown?.key)) return;
		fadeMs = performance.now() - mountedAt < 1500 ? 250 : 2000;
		if (layer.kind === 'sky') skyBase = true;
		else if (!untrack(() => skyBase)) setTimeout(() => (skyBase = true), fadeMs);
		shown = layer;
	}

	$effect(() => {
		if (ref) return mediaLibrary.retain(ref.id);
	});

	$effect(() => {
		if (!ref) {
			show(SKY);
			return;
		}
		const status = mediaLibrary.status(ref.id);
		const url = mediaLibrary.url(ref.id);
		// Während des Ladens bleibt das Bisherige stehen, damit nichts doppelt überblendet
		if (status === 'missing') show(SKY);
		if (status !== 'ready' || !url) return;
		const next: Layer = { key: ref.id, kind: ref.kind, url };
		if (ref.kind === 'video') {
			show(next);
			return;
		}
		// Bilder erst nach dem Dekodieren zeigen, sonst blitzt der Verlauf durch
		let cancelled = false;
		const image = new Image();
		image.src = url;
		image
			.decode()
			.catch(() => {})
			.finally(() => {
				if (!cancelled) show(next);
			});
		return () => (cancelled = true);
	});

	const sky = $derived(timeOfDay.sky);
	const skyStyle = $derived(
		[
			`radial-gradient(60% 50% at ${sky.glowX * 100}% ${sky.glowY * 100}%, rgb(${rgbCss(sky.glow)} / ${sky.glowStrength}), transparent 70%)`,
			`radial-gradient(90% 55% at 12% 105%, rgb(${rgbCss(sky.ground)} / 0.8), transparent 70%)`,
			`linear-gradient(180deg, rgb(${rgbCss(sky.top)}) 0%, rgb(${rgbCss(sky.middle)}) 50%, rgb(${rgbCss(sky.horizon)}) 100%)`
		].join(', ')
	);

	const grade = $derived(timeOfDay.grade);
	const filter = $derived(
		`saturate(${grade.saturation}) brightness(${grade.brightness}) contrast(${grade.contrast})`
	);
	const position = $derived(`${background.focus.x * 100}% ${background.focus.y * 100}%`);

	/** Video-Standbild: erster Frame, keine Wiedergabe (Static-Stufe ist ohne Animation) */
	function poster(video: HTMLVideoElement) {
		const seek = () => {
			if (video.currentTime === 0) video.currentTime = 0.001;
		};
		video.addEventListener('loadeddata', seek);
		return () => video.removeEventListener('loadeddata', seek);
	}
</script>

<div class="background" aria-hidden="true">
	{#if skyBase}
		<div class="sky" style:background={skyStyle}></div>
	{/if}
	{#key shown?.key}
		<div class="layer" transition:fade={{ duration: fadeMs }}>
			{#if shown?.kind === 'image' && shown.url}
				<img
					class="media"
					src={shown.url}
					alt=""
					style:object-fit={background.fit}
					style:object-position={position}
					style:filter
				/>
			{:else if shown?.kind === 'video' && shown.url}
				<video
					class="media"
					src={shown.url}
					muted
					playsinline
					preload="auto"
					style:object-fit={background.fit}
					style:object-position={position}
					style:filter
					{@attach poster}
				></video>
			{/if}
			{#if shown && shown.kind !== 'sky' && grade.amount > 0}
				<div
					class="tint"
					style:background="rgb({rgbCss(grade.tint)})"
					style:opacity={Math.min(1, grade.amount * 2)}
				></div>
			{/if}
		</div>
	{/key}
</div>

<style>
	.background {
		position: fixed;
		inset: 0;
		z-index: 0;
		overflow: hidden;
		pointer-events: none;
	}

	.sky,
	.layer,
	.media,
	.tint {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.media {
		display: block;
		max-width: none;
	}

	/* Einfärben wie im Shader (Soft Light) */
	.tint {
		mix-blend-mode: soft-light;
	}
</style>
