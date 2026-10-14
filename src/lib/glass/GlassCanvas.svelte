<script lang="ts">
	import { untrack } from 'svelte';
	import { mediaLibrary } from '$lib/background/media-library.svelte';
	import { activeRef } from '$lib/background/media-utils';
	import { capturePoster } from '$lib/background/poster';
	import { getApp } from '$lib/state/context';
	import { ui } from '$lib/state/ui.svelte';
	import { GlassController } from './controller';
	import { glassDebug } from './debug';
	import { glassLayer } from './layer';
	import { glassParams, QUALITY_PRESETS, type RenderLevel } from './params.svelte';
	import { renderState } from './render-state.svelte';
	import { loadSceneSource, SKY_SOURCE } from './scene-source';

	/**
	 * Vollflächiges WebGL-Canvas hinter dem DOM (§7.1). Fällt WebGL aus oder geht der Kontext
	 * verloren, übernimmt die Static-Darstellung, bis er wiederhergestellt ist.
	 */
	let { level, auto }: { level: RenderLevel; auto: boolean } = $props();

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
				onfps: (fps) => (renderState.fps = fps),
				onmeasure: (ms) => (renderState.frameMs = ms),
				ondowngrade: (next) => renderState.setAutoLevel(next),
				onstable: (ms) => {
					renderState.frameMs = ms;
					if (renderState.level) renderState.setAutoLevel(renderState.level);
				}
			});
		} catch (error) {
			console.warn('WebGL-Glas nicht verfügbar, nutze Static-Stufe', error);
			renderState.failure = 'unavailable';
			renderState.mode = 'static';
			return;
		}
		controller = instance;
		if (import.meta.env.DEV) glassDebug.controller = instance;
		return () => {
			instance.dispose();
			controller = null;
			if (import.meta.env.DEV) glassDebug.controller = null;
			renderState.mode = 'static';
			renderState.fps = 0;
		};
	});

	/** Nach so vielen Verlusten in einer Sitzung bleibt es bei Static */
	const MAX_LOSSES = 3;
	let losses = 0;

	// Kontextverlust: statisch weiter, bei Wiederherstellung neu aufbauen
	$effect(() => {
		const onLost = (event: Event) => {
			event.preventDefault();
			losses++;
			renderState.mode = 'static';
			renderState.failure = losses >= MAX_LOSSES ? 'unstable' : 'lost';
		};
		const onRestored = () => {
			if (losses < MAX_LOSSES) generation++;
		};
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

	// Automatik: beim allerersten Mal (oder nach „Neu messen“) kurz durchgehend messen
	$effect(() => {
		if (!controller) return;
		const probe = renderState.autoLevel === null;
		controller.setAuto(auto ? level : null, auto && probe);
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
			// Standbild für den ersten Paint des nächsten Tabs (Bild bzw. erster Video-Frame)
			if (source && source.kind !== 'sky') {
				capturePoster(source.element, source.width, source.height, {
					grade: untrack(() => timeOfDay.grade),
					fit: untrack(() => appearance.background.fit),
					focus: untrack(() => appearance.background.focus)
				});
			}
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
		/* Bis der erste Frame steht, bleibt die Static-Darstellung bzw. das Standbild sichtbar */
		opacity: 0;
		transition: opacity 250ms ease;

		&.visible {
			opacity: 1;
		}
	}
</style>
