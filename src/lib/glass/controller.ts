import { prefersReducedMotion } from '$lib/dnd/spring';
import type { Rgb } from '$lib/theme/phase';
import { glassLayer } from './layer';
import { FLOATS_PER_SURFACE, MAX_SURFACES, packSurfaces } from './pack';
import { glassParams, QUALITY_PRESETS, type QualityPreset } from './params.svelte';
import { GlassRenderer, type SceneInput, type SceneSource } from './renderer';

/** Der Himmelsverlauf bewegt sich so langsam, dass ~15 fps reichen (§7.4) */
const SKY_INTERVAL = 1000 / 15;
/** Dauer, in der der Scrim hinter Dialogen ein- bzw. ausblendet */
const SCRIM_MS = 260;

export type GlassInputs = {
	scene: Omit<SceneInput, 'time'>;
	frost: number;
	tint: Rgb;
	tone: number;
	light: [number, number];
	shadow: Rgb;
};

type Callbacks = {
	/** Erster Frame ist gezeichnet, das Canvas kann die Static-Darstellung ablösen */
	onready: () => void;
	onfps: (fps: number) => void;
};

/**
 * Render-Schleife: zeichnet nur, wenn sich etwas ändert (Rects, Eingaben, Video-Frame,
 * Überblendung, Animation). Der Himmel tickt mit ~15 fps, im unsichtbaren Tab steht alles.
 */
export class GlassController {
	readonly renderer: GlassRenderer;
	inputs: GlassInputs | null = null;
	quality: QualityPreset = QUALITY_PRESETS.high;
	scrimTarget = 0;

	#canvas: HTMLCanvasElement;
	#callbacks: Callbacks;
	#raf = 0;
	#timer: ReturnType<typeof setTimeout> | undefined;
	#idleTimer: ReturnType<typeof setTimeout> | undefined;
	#sceneDirty = true;
	#compositeDirty = true;
	#videoDirty = false;
	#lastSky = -Infinity;
	#lastVideo = 0;
	#lastFrame = 0;
	#scrim = 0;
	#ready = false;
	#video: HTMLVideoElement | null = null;
	#videoCallback = 0;
	#frames: number[] = [];
	#fps = 0;
	#surfaceData = new Float32Array(MAX_SURFACES * FLOATS_PER_SURFACE);
	#cleanup: (() => void)[] = [];

	constructor(canvas: HTMLCanvasElement, callbacks: Callbacks) {
		this.#canvas = canvas;
		this.#callbacks = callbacks;
		this.renderer = new GlassRenderer(canvas);
		this.#cleanup.push(glassLayer.subscribe(() => this.requestFrame()));
		const onVisibility = () => {
			if (document.hidden) {
				this.#video?.pause();
				return;
			}
			this.#playVideo();
			this.#sceneDirty = true;
			this.requestFrame();
		};
		document.addEventListener('visibilitychange', onVisibility);
		this.#cleanup.push(() => document.removeEventListener('visibilitychange', onVisibility));
		this.requestFrame();
	}

	/** Eingaben für die Szene haben sich geändert */
	markScene() {
		this.#sceneDirty = true;
		this.requestFrame();
	}

	/** Glas-Parameter haben sich geändert */
	invalidate() {
		this.#compositeDirty = true;
		this.requestFrame();
	}

	setSource(source: SceneSource, fadeMs: number) {
		this.renderer.setSource(source, fadeMs, performance.now());
		this.#watchVideo(source.kind === 'video' ? (source.element as HTMLVideoElement) : null);
		this.markScene();
	}

	requestFrame() {
		if (this.#raf || document.hidden) return;
		clearTimeout(this.#timer);
		this.#timer = undefined;
		this.#raf = requestAnimationFrame(this.#frame);
	}

	dispose() {
		cancelAnimationFrame(this.#raf);
		clearTimeout(this.#timer);
		clearTimeout(this.#idleTimer);
		this.#watchVideo(null);
		for (const cleanup of this.#cleanup) cleanup();
		this.renderer.dispose();
	}

	#frame = (now: number) => {
		this.#raf = 0;
		const inputs = this.inputs;
		if (!inputs || document.hidden || this.renderer.gl.isContextLost()) return;
		const reducedMotion = prefersReducedMotion();

		// Größe in Gerätepixeln, begrenzt durch die Qualitätsstufe
		const dpr = Math.min(devicePixelRatio || 1, this.quality.maxDpr);
		const width = Math.max(1, Math.round(this.#canvas.clientWidth * dpr));
		const height = Math.max(1, Math.round(this.#canvas.clientHeight * dpr));
		if (this.#canvas.width !== width || this.#canvas.height !== height) {
			this.#canvas.width = width;
			this.#canvas.height = height;
			this.#sceneDirty = true;
		}
		this.renderer.configure(width, height, this.quality);

		// Szene nur bei Bedarf: Änderung, Video-Frame, Überblendung oder Himmels-Takt
		const fading = this.renderer.isFading(now);
		const skyDue =
			this.renderer.showsSky && !reducedMotion && now - this.#lastSky >= SKY_INTERVAL - 4;
		if (this.#videoDirty) {
			this.renderer.uploadVideoFrames();
			this.#videoDirty = false;
			this.#sceneDirty = true;
		}
		let composite = this.#compositeDirty;
		if (this.#sceneDirty || skyDue || fading) {
			const time = reducedMotion ? 0 : (now / 1000) * glassParams.skySpeed;
			this.renderer.renderScene({ ...inputs.scene, time }, now);
			if (this.renderer.showsSky) this.#lastSky = now;
			this.#sceneDirty = false;
			composite = true;
		}

		// Scrim hinter Dialogen weich ein- und ausblenden
		if (this.#scrim !== this.scrimTarget) {
			const step = reducedMotion ? 1 : (now - (this.#lastFrame || now - 16)) / SCRIM_MS;
			this.#scrim =
				this.scrimTarget > this.#scrim
					? Math.min(this.scrimTarget, this.#scrim + step)
					: Math.max(this.scrimTarget, this.#scrim - step);
			composite = true;
		}

		const { surfaces, changed } = glassLayer.sync();
		if (changed) composite = true;

		if (composite) {
			const scale = width / Math.max(1, this.#canvas.clientWidth);
			const margin = (glassParams.shadowBlur + glassParams.shadowOffset) * 1.6;
			const packed = packSurfaces(
				surfaces,
				{ width: this.#canvas.clientWidth, height: this.#canvas.clientHeight },
				scale,
				margin,
				this.#surfaceData
			);
			this.renderer.composite({
				surfaces: packed.data,
				count: packed.count,
				margin: margin * scale,
				dpr: scale,
				frost: inputs.frost,
				tint: inputs.tint,
				tone: inputs.tone,
				light: inputs.light,
				shadow: inputs.shadow,
				scrim: this.#scrim,
				params: glassParams
			});
			this.#compositeDirty = false;
			this.#countFrame(now);
			if (!this.#ready) {
				this.#ready = true;
				this.#callbacks.onready();
			}
		}
		this.#lastFrame = now;

		// Weiter: jeden Frame bei Bewegung, sonst im Takt des Himmels, sonst gar nicht
		if (glassLayer.animating || this.renderer.isFading(now) || this.#scrim !== this.scrimTarget) {
			this.requestFrame();
		} else if (this.renderer.showsSky && !reducedMotion) {
			const delay = Math.max(0, this.#lastSky + SKY_INTERVAL - performance.now());
			this.#timer = setTimeout(() => this.requestFrame(), delay);
		}
		// Ohne weitere Frames fällt die Anzeige nach einer Sekunde auf „nur bei Änderungen“
		clearTimeout(this.#idleTimer);
		this.#idleTimer = setTimeout(() => this.#countFrame(performance.now(), false), 1100);
	};

	/** Bildrate über die letzte Sekunde; ohne fortlaufendes Zeichnen 0 */
	#countFrame(now: number, drawn = true) {
		if (drawn) this.#frames.push(now);
		while (this.#frames.length > 0 && this.#frames[0] < now - 1000) this.#frames.shift();
		const fps = this.#frames.length > 2 ? this.#frames.length : 0;
		if (fps !== this.#fps) {
			this.#fps = fps;
			this.#callbacks.onfps(fps);
		}
	}

	#watchVideo(video: HTMLVideoElement | null) {
		if (this.#video === video) return;
		if (this.#video && this.#videoCallback) {
			this.#video.cancelVideoFrameCallback(this.#videoCallback);
		}
		this.#video = video;
		this.#videoCallback = 0;
		if (!video) return;
		const onFrame = (now: number) => {
			if (this.#video !== video) return;
			const fps = this.quality.videoFps;
			if (!fps || now - this.#lastVideo >= 1000 / fps - 2) {
				this.#lastVideo = now;
				this.#videoDirty = true;
				this.requestFrame();
			}
			this.#videoCallback = video.requestVideoFrameCallback(onFrame);
		};
		this.#videoCallback = video.requestVideoFrameCallback(onFrame);
		this.#playVideo();
	}

	#playVideo() {
		const video = this.#video;
		if (!video || document.hidden) return;
		if (prefersReducedMotion()) {
			// Standbild statt Wiedergabe
			video.pause();
			this.#videoDirty = true;
			return;
		}
		void video.play().catch(() => {});
	}
}
