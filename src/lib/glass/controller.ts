import { prefersReducedMotion } from '$lib/dnd/spring';
import type { Rgb } from '$lib/theme/phase';
import { AutoQuality, type AutoLevel } from './auto-quality';
import { glassLayer } from './layer';
import { FLOATS_PER_SURFACE, MAX_SURFACES, packSurfaces } from './pack';
import { glassParams, QUALITY_PRESETS, type QualityPreset } from './params.svelte';
import { GlassRenderer, type SceneInput, type SceneSource } from './renderer';

/** Der Himmelsverlauf bewegt sich so langsam, dass ~15 fps reichen (§7.4) */
const SKY_INTERVAL = 1000 / 15;
/** Dauer, in der der Scrim hinter Dialogen ein- bzw. ausblendet */
const SCRIM_MS = 260;
/** Zeitkonstanten der Glättung: Mauslicht folgt weich, Hover/Press etwas direkter */
const POINTER_TAU = 90;
const LIFT_TAU = 70;
/** Messung beim allerersten Start mit „Automatisch“: kurz warten, dann ~2 s durchgehend zeichnen */
const PROBE_DELAY = 500;
const PROBE_MS = 2200;

/** Elemente, deren Drücken nicht die ganze Glasfläche eindrückt */
const INTERACTIVE = 'a, button, input, select, textarea, label, [role="button"], [contenteditable]';

export type GlassInputs = {
	scene: Omit<SceneInput, 'time'>;
	frost: number;
	tint: Rgb;
	tone: number;
	light: [number, number];
	shadow: Rgb;
	/** Lichtreflex folgt der Maus (Einstellung) */
	pointerLight: boolean;
};

type Callbacks = {
	/** Erster Frame ist gezeichnet, das Canvas kann die Static-Darstellung ablösen */
	onready: () => void;
	onfps: (fps: number) => void;
	/** Automatik hat heruntergestuft */
	ondowngrade: (level: AutoLevel) => void;
	/** Messung über ein ganzes Fenster ohne Herunterstufen: diese Stufe ist stabil */
	onstable: (frameMs: number) => void;
	onmeasure: (frameMs: number) => void;
};

/** Exponentielle Annäherung an `target` über die Zeit `dt` mit Zeitkonstante `tau` */
const approach = (value: number, target: number, dt: number, tau: number) =>
	target + (value - target) * Math.exp(-dt / tau);

/**
 * Render-Schleife: zeichnet nur, wenn sich etwas ändert (Rects, Eingaben, Video-Frame,
 * Überblendung, Animation, Mauslicht). Der Himmel tickt mit ~15 fps, im unsichtbaren Tab steht
 * alles. Mit „Automatisch“ wird die Frame-Zeit gemessen und bei Bedarf heruntergestuft.
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

	// Mauslicht und Hover/Press
	#pointerTarget = { x: 0, y: 0, inside: false };
	#pointer = { x: 0, y: 0, amount: 0 };
	#hovered: Element | null = null;
	#pressed: Element | null = null;
	#lifts = new Map<unknown, number>();

	// Automatische Qualität
	#auto: AutoQuality | null = null;
	/** Der nächste Frame folgt direkt auf den vorigen; nur dann ist sein Abstand eine Messung */
	#chained = false;
	#probeUntil = 0;

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
		const onPointerMove = (event: PointerEvent) => {
			this.#pointerTarget = { x: event.clientX, y: event.clientY, inside: true };
			const hovered = (event.target as Element | null)?.closest?.('[data-glass]') ?? null;
			if (hovered !== this.#hovered) this.#hovered = hovered;
			this.requestFrame();
		};
		const onPointerLeave = () => {
			this.#pointerTarget.inside = false;
			this.#hovered = null;
			this.requestFrame();
		};
		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Element | null;
			if (!target?.closest || target.closest(INTERACTIVE)) return;
			this.#pressed = target.closest('[data-glass]');
			this.requestFrame();
		};
		const onPointerUp = () => {
			this.#pressed = null;
			this.requestFrame();
		};
		// Reduced Motion kann sich zur Laufzeit ändern (Systemeinstellung)
		const motion = matchMedia('(prefers-reduced-motion: reduce)');
		const onMotion = () => {
			this.#playVideo();
			this.markScene();
		};

		document.addEventListener('visibilitychange', onVisibility);
		window.addEventListener('pointermove', onPointerMove, { passive: true });
		document.documentElement.addEventListener('pointerleave', onPointerLeave);
		window.addEventListener('pointerdown', onPointerDown, { passive: true });
		window.addEventListener('pointerup', onPointerUp, { passive: true });
		window.addEventListener('pointercancel', onPointerUp, { passive: true });
		motion.addEventListener('change', onMotion);
		this.#cleanup.push(() => {
			document.removeEventListener('visibilitychange', onVisibility);
			window.removeEventListener('pointermove', onPointerMove);
			document.documentElement.removeEventListener('pointerleave', onPointerLeave);
			window.removeEventListener('pointerdown', onPointerDown);
			window.removeEventListener('pointerup', onPointerUp);
			window.removeEventListener('pointercancel', onPointerUp);
			motion.removeEventListener('change', onMotion);
		});
		this.requestFrame();
	}

	/**
	 * Schaltet die Automatik ein (mit der aktuellen Stufe) oder aus. `probe` misst nach dem
	 * Start einmal ~2 s durchgehend, sonst wird nur gemessen, wenn ohnehin fortlaufend
	 * gezeichnet wird (Animationen, Mauslicht).
	 */
	setAuto(level: AutoLevel | null, probe: boolean) {
		if (!level) {
			this.#auto = null;
			this.#probeUntil = 0;
			return;
		}
		if (this.#auto) this.#auto.reset(level);
		else this.#auto = new AutoQuality(level);
		if (probe) {
			this.#probeUntil = performance.now() + PROBE_DELAY + PROBE_MS;
			setTimeout(() => this.requestFrame(), PROBE_DELAY);
		}
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

	/** Liest die Helligkeit des gezeichneten Bildes an einer Stelle (CSS-Pixel), für den Kontrast-Check */
	readPixel(x: number, y: number): [number, number, number] | null {
		const gl = this.renderer.gl;
		const scale = this.#canvas.width / Math.max(1, this.#canvas.clientWidth);
		const pixel = new Uint8Array(4);
		const px = Math.round(x * scale);
		const py = this.#canvas.height - 1 - Math.round(y * scale);
		if (px < 0 || py < 0 || px >= this.#canvas.width || py >= this.#canvas.height) return null;
		gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
		return [pixel[0], pixel[1], pixel[2]];
	}

	/** Zeichnet sofort neu und ruft danach `read` auf (der Zeichenpuffer ist nur bis dahin gültig) */
	renderAndRead<T>(read: () => T): T {
		this.#compositeDirty = true;
		cancelAnimationFrame(this.#raf);
		this.#raf = 0;
		this.#frame(performance.now());
		return read();
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
		const chained = this.#chained;
		this.#chained = false;
		const inputs = this.inputs;
		if (!inputs || document.hidden || this.renderer.gl.isContextLost()) return;
		const reducedMotion = prefersReducedMotion();
		const dt = Math.min(100, now - (this.#lastFrame || now - 16));

		// Frame-Zeit messen, wenn dieser Frame direkt auf den vorigen folgen sollte
		if (chained && this.#auto) this.#measure(dt, now);
		const probing = this.#auto !== null && now < this.#probeUntil;

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

		// Szene nur bei Bedarf: Änderung, Video-Frame, Überblendung, Himmels-Takt oder Messung
		const fading = this.renderer.isFading(now);
		const skyDue =
			this.renderer.showsSky && !reducedMotion && now - this.#lastSky >= SKY_INTERVAL - 4;
		if (this.#videoDirty) {
			this.renderer.uploadVideoFrames();
			this.#videoDirty = false;
			this.#sceneDirty = true;
		}
		let composite = this.#compositeDirty;
		if (this.#sceneDirty || skyDue || fading || probing) {
			const time = reducedMotion ? 0 : (now / 1000) * glassParams.skySpeed;
			this.renderer.renderScene({ ...inputs.scene, time }, now);
			if (this.renderer.showsSky) this.#lastSky = now;
			this.#sceneDirty = false;
			composite = true;
		}

		// Scrim hinter Dialogen weich ein- und ausblenden
		if (this.#scrim !== this.scrimTarget) {
			const step = reducedMotion ? 1 : dt / SCRIM_MS;
			this.#scrim =
				this.scrimTarget > this.#scrim
					? Math.min(this.scrimTarget, this.#scrim + step)
					: Math.max(this.scrimTarget, this.#scrim - step);
			composite = true;
		}

		// Mauslicht folgt dem Zeiger weich; aus bei Reduced Motion, niedriger Stufe oder Einstellung
		const pointerOn =
			inputs.pointerLight &&
			this.quality.pointerLight &&
			!reducedMotion &&
			this.#pointerTarget.inside &&
			this.scrimTarget === 0;
		const pointer = this.#pointer;
		const target = this.#pointerTarget;
		const before = { ...pointer };
		if (pointer.amount === 0 && pointerOn) {
			// Erstes Erscheinen: an der Zeigerposition beginnen, nicht von oben links hereinziehen
			pointer.x = target.x;
			pointer.y = target.y;
		}
		pointer.x = approach(pointer.x, target.x, dt, POINTER_TAU);
		pointer.y = approach(pointer.y, target.y, dt, POINTER_TAU);
		pointer.amount = approach(pointer.amount, pointerOn ? 1 : 0, dt, POINTER_TAU * 2);
		if (Math.abs(pointer.amount - (pointerOn ? 1 : 0)) < 0.01) pointer.amount = pointerOn ? 1 : 0;
		const pointerMoving =
			Math.hypot(pointer.x - target.x, pointer.y - target.y) > 0.5 &&
			(pointer.amount > 0 || pointerOn);
		const pointerChanged =
			pointer.amount > 0 &&
			(Math.abs(pointer.x - before.x) > 0.1 ||
				Math.abs(pointer.y - before.y) > 0.1 ||
				pointer.amount !== before.amount);
		if (pointerChanged || before.amount !== pointer.amount) composite = true;

		const { surfaces, changed } = glassLayer.sync();
		if (changed) composite = true;

		// Hover hebt an, Drücken drückt ein; ohne Bewegung (Reduced Motion) sofort
		let liftsMoving = false;
		for (const surface of surfaces) {
			const element = surface.key as Element;
			const goal =
				element === this.#pressed
					? -1
					: element === this.#hovered && this.scrimTarget === 0
						? 1
						: 0;
			const current = this.#lifts.get(element) ?? 0;
			let next = reducedMotion ? goal : approach(current, goal, dt, LIFT_TAU);
			if (Math.abs(next - goal) < 0.005) next = goal;
			if (next !== current) {
				composite = true;
				if (next !== goal) liftsMoving = true;
			}
			if (next === 0) this.#lifts.delete(element);
			else this.#lifts.set(element, next);
			surface.lift = next;
		}

		if (composite) {
			const scale = width / Math.max(1, this.#canvas.clientWidth);
			const margin = (glassParams.shadowBlur + glassParams.shadowOffset) * 2;
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
				params: glassParams,
				pointer: { x: pointer.x * scale, y: pointer.y * scale, amount: pointer.amount }
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
		const continuous =
			glassLayer.animating ||
			this.renderer.isFading(now) ||
			this.#scrim !== this.scrimTarget ||
			pointerMoving ||
			pointer.amount !== (pointerOn ? 1 : 0) ||
			liftsMoving ||
			probing;
		if (continuous) {
			this.#chained = true;
			this.requestFrame();
		} else if (this.renderer.showsSky && !reducedMotion) {
			const delay = Math.max(0, this.#lastSky + SKY_INTERVAL - performance.now());
			this.#timer = setTimeout(() => this.requestFrame(), delay);
		}
		if (this.#auto && this.#probeUntil && !probing) this.#finishProbe();

		// Ohne weitere Frames fällt die Anzeige nach einer Sekunde auf „nur bei Änderungen“
		clearTimeout(this.#idleTimer);
		this.#idleTimer = setTimeout(() => this.#countFrame(performance.now(), false), 1100);
	};

	#measure(frameMs: number, now: number) {
		const auto = this.#auto;
		if (!auto) return;
		const changed = auto.record(frameMs, now);
		if (auto.average !== null) this.#callbacks.onmeasure(auto.average);
		if (changed) {
			// Bei einer Messung beim Start: auf der neuen Stufe weitermessen
			if (this.#probeUntil) this.#probeUntil = now + PROBE_MS;
			this.#callbacks.ondowngrade(changed);
		}
	}

	#finishProbe() {
		this.#probeUntil = 0;
		const average = this.#auto?.average;
		if (average != null) this.#callbacks.onstable(average);
	}

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
