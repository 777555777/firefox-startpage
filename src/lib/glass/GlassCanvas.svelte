<script lang="ts">
	import { mediaLibrary } from '$lib/background/media-library.svelte';
	import { activeRef } from '$lib/background/media-utils';
	import { getApp } from '$lib/state/context';
	import { ui } from '$lib/state/ui.svelte';
	import { GlassController } from './controller';
	import { glassLayer } from './layer';
	import { glassParams, QUALITY_PRESETS, type RenderLevel } from './params.svelte';
	import { renderState } from './render-state.svelte';
	import { loadSceneSource, SKY_SOURCE } from './scene-source';

	/**
	 * Vollflächiges WebGL-Canvas hinter dem DOM (§7.1). Fällt WebGL aus oder geht der Kontext
	 * verloren, übernimmt die Static-Darstellung, bis er wiederhergestellt ist.
	 */
	let { level }: { level: RenderLevel } = $props();

	const app = getApp();
	const timeOfDay = app.timeOfDay;
	const appearance = $derived(app.config.value.appearance);
	const ref = $derived(activeRef(appearance.background, timeOfDay.phase));

	let canvas: HTMLCanvasElement;
	let controller = $state.raw<GlassController | null>(null);
	/** Erhöht sich nach einem wiederhergestellten Kontextverlust und baut alles neu auf */
	let generation = $state(0);
	const mountedAt = performance.now();

	/** Beim Öffnen der Seite kurz einblenden, beim Phasenwechsel weich (~2 s) überblenden */
	const fadeMs = () => (performance.now() - mountedAt < 1500 ? 250 : 2000);

	$effect(() => {
		void generation;
		let instance: GlassController;
		try {
			instance = new GlassController(canvas, {
				onready: () => {
					renderState.mode = 'webgl';
					renderState.failure = null;
				},
				onfps: (fps) => (renderState.fps = fps)
			});
		} catch (error) {
			console.warn('WebGL-Glas nicht verfügbar, nutze Static-Stufe', error);
			renderState.failure = 'unavailable';
			renderState.mode = 'static';
			return;
		}
		controller = instance;
		return () => {
			instance.dispose();
			controller = null;
			renderState.mode = 'static';
			renderState.fps = 0;
		};
	});

	// Kontextverlust: statisch weiter, bei Wiederherstellung neu aufbauen
	$effect(() => {
		const onLost = (event: Event) => {
			event.preventDefault();
			renderState.failure = 'lost';
			renderState.mode = 'static';
		};
		const onRestored = () => generation++;
		canvas.addEventListener('webglcontextlost', onLost);
		canvas.addEventListener('webglcontextrestored', onRestored);
		return () => {
			canvas.removeEventListener('webglcontextlost', onLost);
			canvas.removeEventListener('webglcontextrestored', onRestored);
		};
	});

	$effect(() => {
		renderState.level = level;
		if (controller) {
			controller.quality = QUALITY_PRESETS[level];
			controller.markScene();
		}
	});

	// Eingaben für Szene und Glas
	$effect(() => {
		if (!controller) return;
		const tone = timeOfDay.tone;
		controller.inputs = {
			scene: {
				sky: timeOfDay.sky,
				grade: timeOfDay.grade,
				fit: appearance.background.fit,
				focus: { ...appearance.background.focus }
			},
			frost: appearance.glass.frost,
			tint: timeOfDay.glassTint,
			tone: tone === 'dark' ? 1 : 0,
			light: timeOfDay.light,
			// Wie `--shade` im CSS
			shadow: tone === 'dark' ? [0, 4, 16] : [8, 34, 66]
		};
		controller.markScene();
	});

	$effect(() => {
		if (!controller) return;
		controller.scrimTarget = ui.modals > 0 ? 1 : 0;
		controller.requestFrame();
	});

	// Parameter aus dem Debug-Panel
	$effect(() => {
		void $state.snapshot(glassParams);
		controller?.invalidate();
	});

	// Layout-Änderungen verschieben Panels, ohne dass sich ihre Größe ändern muss
	$effect(() => {
		void JSON.stringify(app.config.value.layout);
		void ui.editing;
		glassLayer.invalidate();
	});

	$effect(() => {
		if (ref) return mediaLibrary.retain(ref.id);
	});

	// Szene: eigenes Medium der aktuellen Phase oder Himmelsverlauf
	$effect(() => {
		const current = controller;
		if (!current) return;
		if (!ref || mediaLibrary.status(ref.id) === 'missing') {
			current.setSource(SKY_SOURCE, fadeMs());
			return;
		}
		const blob = mediaLibrary.blob(ref.id);
		if (!blob) return;
		let cancelled = false;
		const media = ref;
		void loadSceneSource(media, blob, current.renderer.maxTextureSize).then((source) => {
			if (cancelled) {
				if (source?.kind !== 'sky') source?.release?.();
				return;
			}
			current.setSource(source ?? SKY_SOURCE, fadeMs());
		});
		return () => (cancelled = true);
	});
</script>

<canvas
	bind:this={canvas}
	class="glass-canvas"
	class:visible={renderState.mode === 'webgl'}
	aria-hidden="true"
></canvas>

<style>
	.glass-canvas {
		position: fixed;
		inset: 0;
		z-index: 0;
		display: block;
		width: 100vw;
		height: 100vh;
		pointer-events: none;
		/* Bis der erste Frame steht, bleibt die Static-Darstellung sichtbar */
		opacity: 0;

		&.visible {
			opacity: 1;
		}
	}
</style>
