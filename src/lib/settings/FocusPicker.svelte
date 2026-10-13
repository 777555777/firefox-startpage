<script lang="ts">
	import { mediaLibrary } from '$lib/background/media-library.svelte';
	import type { BackgroundConfig, MediaRef } from '$lib/config/types';
	import { t } from '$lib/i18n/index.svelte';

	/**
	 * Fokuspunkt auf einer Vorschau des Mediums setzen: Klick, Ziehen oder Pfeiltasten
	 * (mit Umschalt in größeren Schritten). Das ganze Bild ist sichtbar, der Punkt markiert
	 * die Stelle, die beim Zuschneiden erhalten bleibt.
	 */
	let {
		media,
		focus = $bindable(),
		labelledby
	}: { media: MediaRef; focus: BackgroundConfig['focus']; labelledby: string } = $props();

	let ratio = $state(16 / 9);
	let frame: HTMLDivElement;

	$effect(() => mediaLibrary.retain(media.id));
	const url = $derived(mediaLibrary.url(media.id));

	const round = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 100) / 100;

	function setFrom(event: PointerEvent) {
		const rect = frame.getBoundingClientRect();
		focus = {
			x: round((event.clientX - rect.left) / rect.width),
			y: round((event.clientY - rect.top) / rect.height)
		};
	}

	function onpointerdown(event: PointerEvent) {
		if (event.button !== 0) return;
		event.preventDefault();
		frame.focus();
		frame.setPointerCapture(event.pointerId);
		setFrom(event);
	}

	function onpointermove(event: PointerEvent) {
		if (frame.hasPointerCapture(event.pointerId)) setFrom(event);
	}

	function onkeydown(event: KeyboardEvent) {
		const step = event.shiftKey ? 0.1 : 0.02;
		const delta: Record<string, [number, number]> = {
			ArrowLeft: [-step, 0],
			ArrowRight: [step, 0],
			ArrowUp: [0, -step],
			ArrowDown: [0, step]
		};
		if (event.key === 'Home') {
			event.preventDefault();
			focus = { x: 0.5, y: 0.5 };
			return;
		}
		const [dx, dy] = delta[event.key] ?? [0, 0];
		if (!dx && !dy) return;
		event.preventDefault();
		focus = { x: round(focus.x + dx), y: round(focus.y + dy) };
	}
</script>

<div class="picker">
	<!-- Zweidimensionaler Regler: Wert als Text, Pfeiltasten in beide Richtungen -->
	<div
		bind:this={frame}
		class="frame"
		style:--ratio={ratio}
		role="slider"
		tabindex="0"
		aria-labelledby={labelledby}
		aria-valuemin={0}
		aria-valuemax={100}
		aria-valuenow={Math.round(focus.x * 100)}
		aria-valuetext={t('background.focusValue', {
			x: Math.round(focus.x * 100),
			y: Math.round(focus.y * 100)
		})}
		{onpointerdown}
		{onpointermove}
		{onkeydown}
	>
		{#if url && media.kind === 'image'}
			<img
				src={url}
				alt=""
				draggable="false"
				onload={(event) => {
					const image = event.currentTarget as HTMLImageElement;
					if (image.naturalHeight) ratio = image.naturalWidth / image.naturalHeight;
				}}
			/>
		{:else if url}
			<video
				src={url}
				muted
				preload="metadata"
				onloadedmetadata={(event) => {
					const video = event.currentTarget as HTMLVideoElement;
					if (video.videoHeight) ratio = video.videoWidth / video.videoHeight;
				}}
			></video>
		{/if}
		<span class="point" style:left="{focus.x * 100}%" style:top="{focus.y * 100}%"></span>
	</div>
</div>

<style>
	.picker {
		display: flex;
		justify-content: center;
		padding: var(--space-2);
		border-radius: var(--radius-md);
		background: var(--track);
	}

	.frame {
		position: relative;
		/* Höchstens 220 px hoch, Seitenverhältnis des Mediums */
		width: min(100%, calc(220px * var(--ratio)));
		aspect-ratio: var(--ratio);
		overflow: hidden;
		border-radius: var(--radius-sm);
		cursor: crosshair;
		touch-action: none;

		img,
		video {
			display: block;
			width: 100%;
			height: 100%;
			max-width: none;
			object-fit: fill;
			pointer-events: none;
			user-select: none;
		}
	}

	.point {
		position: absolute;
		width: 22px;
		height: 22px;
		border: 2px solid #fff;
		border-radius: 50%;
		background: color-mix(in srgb, var(--accent) 55%, transparent);
		box-shadow:
			0 0 0 1px rgb(0 0 0 / 0.35),
			0 2px 8px rgb(0 0 0 / 0.4);
		transform: translate(-50%, -50%);
		pointer-events: none;
	}
</style>
