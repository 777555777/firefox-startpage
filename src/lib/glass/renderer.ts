import { fitTransform } from '$lib/background/media-utils';
import type { BackgroundConfig } from '$lib/config/types';
import type { Grade, SkyPalette } from '$lib/theme/palette';
import type { Rgb } from '$lib/theme/phase';
import {
	createProgram,
	createTarget,
	createTexture,
	deleteTarget,
	GlError,
	rgb01,
	type Program,
	type Target
} from './gl';
import { FLOATS_PER_SURFACE, MAX_SURFACES } from './pack';
import type { GlassParams, QualityPreset } from './params.svelte';
import {
	BACKGROUND_FS,
	DOWN_FS,
	FULLSCREEN_VS,
	SCENE_FS,
	SCRIM_FS,
	SURFACE_FS,
	SURFACE_VS,
	UP_FS
} from './shaders';

/**
 * WebGL2-Renderer für Hintergrund und Glas (§7):
 * 1. Szene (Himmelsverlauf oder Medium, Grading, Überblendung) in eine Textur
 * 2. Blur-Kette (Dual-Kawase), einmal mittel und einmal stark
 * 3. Composite: Szene auf den Bildschirm, darüber jede Glasfläche als Instanz
 */

/** Was die Szene zeigt; Medien gehören dem Aufrufer und werden per `release` freigegeben */
export type SceneSource =
	| { kind: 'sky'; key: string }
	| {
			kind: 'image' | 'video';
			key: string;
			element: ImageBitmap | HTMLVideoElement;
			width: number;
			height: number;
			release?: () => void;
	  };

export type SceneInput = {
	/** Sekunden für die Animation des Himmels */
	time: number;
	sky: SkyPalette;
	grade: Grade;
	fit: BackgroundConfig['fit'];
	focus: BackgroundConfig['focus'];
};

export type CompositeInput = {
	surfaces: Float32Array;
	count: number;
	/** Platz um jede Fläche für den Schatten, in Gerätepixeln */
	margin: number;
	dpr: number;
	frost: number;
	tint: Rgb;
	tone: number;
	light: [number, number];
	shadow: Rgb;
	scrim: number;
	params: GlassParams;
	/** Mauslicht in Gerätepixeln; `amount` 0 = aus */
	pointer: { x: number; y: number; amount: number };
};

type Layer = { source: SceneSource; texture: WebGLTexture | null };

/** Stufen der Blur-Kette; die mittlere Stärke kommt von Stufe 3 */
const BLUR_LEVELS = 5;
const MID_LEVEL = 3;

export class GlassRenderer {
	readonly gl: WebGL2RenderingContext;
	#programs: Record<'scene' | 'down' | 'up' | 'background' | 'scrim' | 'surface', Program>;
	#emptyVao: WebGLVertexArrayObject;
	#surfaceVao: WebGLVertexArrayObject;
	#instanceBuffer: WebGLBuffer;
	#dummy: WebGLTexture;
	#maxTexture: number;

	#width = 1;
	#height = 1;
	#quality: QualityPreset | null = null;
	#scene: Target | null = null;
	#down: Target[] = [];
	#upStrong: Target[] = [];
	#upMid: Target[] = [];

	#a: Layer | null = null;
	#b: Layer = { source: { kind: 'sky', key: 'sky' }, texture: null };
	#fadeStart = 0;
	#fadeMs = 0;

	constructor(canvas: HTMLCanvasElement) {
		const gl = canvas.getContext('webgl2', {
			alpha: false,
			antialias: false,
			depth: false,
			stencil: false,
			premultipliedAlpha: true,
			preserveDrawingBuffer: false,
			powerPreference: 'default'
		});
		if (!gl) throw new GlError('WebGL2 nicht verfügbar');
		this.gl = gl;
		this.#maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
		this.#programs = {
			scene: createProgram(gl, FULLSCREEN_VS, SCENE_FS),
			down: createProgram(gl, FULLSCREEN_VS, DOWN_FS),
			up: createProgram(gl, FULLSCREEN_VS, UP_FS),
			background: createProgram(gl, FULLSCREEN_VS, BACKGROUND_FS),
			scrim: createProgram(gl, FULLSCREEN_VS, SCRIM_FS),
			surface: createProgram(gl, SURFACE_VS, SURFACE_FS)
		};

		this.#emptyVao = gl.createVertexArray();
		this.#surfaceVao = gl.createVertexArray();
		const buffer = gl.createBuffer();
		if (!buffer) throw new GlError('createBuffer fehlgeschlagen');
		this.#instanceBuffer = buffer;
		gl.bindVertexArray(this.#surfaceVao);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, MAX_SURFACES * FLOATS_PER_SURFACE * 4, gl.DYNAMIC_DRAW);
		for (let location = 0; location < 4; location++) {
			gl.enableVertexAttribArray(location);
			gl.vertexAttribPointer(location, 4, gl.FLOAT, false, FLOATS_PER_SURFACE * 4, location * 16);
			gl.vertexAttribDivisor(location, 1);
		}
		gl.bindVertexArray(null);

		this.#dummy = createTexture(gl);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA8,
			1,
			1,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			new Uint8Array([0, 0, 0, 255])
		);
	}

	/** Größte Kantenlänge für Medien-Texturen */
	get maxTextureSize(): number {
		return Math.min(this.#maxTexture, 4096);
	}

	/** Canvas-Größe in Gerätepixeln und Qualitätsstufe; legt Render-Targets bei Bedarf neu an */
	configure(width: number, height: number, quality: QualityPreset) {
		if (width === this.#width && height === this.#height && quality === this.#quality) return;
		this.#width = width;
		this.#height = height;
		this.#quality = quality;
		this.#disposeTargets();
		const gl = this.gl;
		const sceneWidth = Math.max(2, width * quality.sceneScale);
		const sceneHeight = Math.max(2, height * quality.sceneScale);
		this.#scene = createTarget(gl, sceneWidth, sceneHeight);
		for (let level = 1; level <= BLUR_LEVELS; level++) {
			const scale = 2 ** level;
			this.#down.push(createTarget(gl, sceneWidth / scale, sceneHeight / scale));
		}
		// Hochskalieren zurück bis Stufe 1: stark von ganz unten, mittel ab MID_LEVEL
		for (let level = BLUR_LEVELS - 1; level >= 1; level--) {
			const { width: w, height: h } = this.#down[level - 1];
			this.#upStrong.push(createTarget(gl, w, h));
			if (level < MID_LEVEL) this.#upMid.push(createTarget(gl, w, h));
		}
	}

	/** Neue Szene; mit `fadeMs` wird von der bisherigen weich übergeblendet */
	setSource(source: SceneSource, fadeMs: number, now: number) {
		if (source.key === this.#b.source.key) {
			// Schon zu sehen: das doppelt geladene Medium gleich wieder freigeben
			if (source.kind !== 'sky' && source !== this.#b.source) source.release?.();
			return;
		}
		this.#dropLayer(this.#a);
		const texture = source.kind === 'sky' ? null : createTexture(this.gl);
		const layer: Layer = { source, texture };
		if (texture) this.#upload(layer);
		if (fadeMs > 0) {
			this.#a = this.#b;
			this.#fadeStart = now;
			this.#fadeMs = fadeMs;
		} else {
			this.#dropLayer(this.#b);
			this.#a = null;
		}
		this.#b = layer;
	}

	/** Ob gerade übergeblendet wird (dann muss die Szene in jedem Frame neu gezeichnet werden) */
	isFading(now: number): boolean {
		return this.#a !== null && now - this.#fadeStart < this.#fadeMs;
	}

	/** Ob ein Video läuft, dessen Frames hochgeladen werden müssen */
	get hasVideo(): boolean {
		return this.#a?.source.kind === 'video' || this.#b.source.kind === 'video';
	}

	/** Ob der Himmelsverlauf sichtbar ist (animiert) */
	get showsSky(): boolean {
		return this.#a?.source.kind === 'sky' || this.#b.source.kind === 'sky';
	}

	/** Lädt die aktuellen Video-Frames in die Texturen */
	uploadVideoFrames() {
		for (const layer of [this.#a, this.#b]) {
			if (layer?.source.kind === 'video') this.#upload(layer);
		}
	}

	renderScene(input: SceneInput, now: number) {
		const gl = this.gl;
		const scene = this.#scene;
		if (!scene) return;
		if (this.#a && !this.isFading(now)) {
			this.#dropLayer(this.#a);
			this.#a = null;
		}
		const t = this.#a ? Math.min(1, (now - this.#fadeStart) / this.#fadeMs) : 1;
		const mix = t * t * (3 - 2 * t);

		const p = this.#programs.scene;
		gl.useProgram(p.program);
		gl.bindFramebuffer(gl.FRAMEBUFFER, scene.framebuffer);
		gl.viewport(0, 0, scene.width, scene.height);
		gl.disable(gl.BLEND);
		gl.uniform2f(p.u('uResolution'), scene.width, scene.height);
		gl.uniform1f(p.u('uTime'), input.time);
		const { sky, grade } = input;
		gl.uniform3fv(p.u('uSkyTop'), rgb01(sky.top));
		gl.uniform3fv(p.u('uSkyMiddle'), rgb01(sky.middle));
		gl.uniform3fv(p.u('uSkyHorizon'), rgb01(sky.horizon));
		gl.uniform3fv(p.u('uSkyGround'), rgb01(sky.ground));
		gl.uniform3fv(p.u('uSkyGlow'), rgb01(sky.glow));
		gl.uniform3f(p.u('uGlow'), sky.glowX, sky.glowY, sky.glowStrength);
		gl.uniform3fv(p.u('uGradeTint'), rgb01(grade.tint));
		gl.uniform1f(p.u('uGradeAmount'), grade.amount);
		gl.uniform1f(p.u('uGradeSaturation'), grade.saturation);
		gl.uniform1f(p.u('uGradeBrightness'), grade.brightness);
		gl.uniform1f(p.u('uGradeContrast'), grade.contrast);
		gl.uniform1f(p.u('uMix'), this.#a ? mix : 1);

		const bindLayer = (layer: Layer | null, unit: number, suffix: 'A' | 'B') => {
			gl.activeTexture(gl.TEXTURE0 + unit);
			gl.bindTexture(gl.TEXTURE_2D, layer?.texture ?? this.#dummy);
			gl.uniform1i(p.u(`uTex${suffix}`), unit);
			const source = layer?.source;
			gl.uniform1i(p.u(`uKind${suffix}`), source && source.kind !== 'sky' ? 1 : 0);
			const fit =
				source && source.kind !== 'sky'
					? fitTransform(
							input.fit,
							input.focus,
							{ width: source.width, height: source.height },
							{ width: scene.width, height: scene.height }
						)
					: { scale: [1, 1], offset: [0, 0] };
			gl.uniform4f(p.u(`uFit${suffix}`), fit.scale[0], fit.scale[1], fit.offset[0], fit.offset[1]);
		};
		bindLayer(this.#a, 0, 'A');
		bindLayer(this.#b, 1, 'B');

		gl.bindVertexArray(this.#emptyVao);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		this.#blur();
	}

	composite(input: CompositeInput) {
		const gl = this.gl;
		const scene = this.#scene;
		const strong = this.#upStrong.at(-1);
		const mid = this.#upMid.at(-1);
		if (!scene || !strong || !mid) return;
		const params = input.params;
		const quality = this.#quality;

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, this.#width, this.#height);
		gl.bindVertexArray(this.#emptyVao);
		gl.disable(gl.BLEND);

		const background = this.#programs.background;
		gl.useProgram(background.program);
		this.#bind(0, scene.texture, background.u('uScene'));
		this.#bind(1, strong.texture, background.u('uBlurStrong'));
		gl.uniform1f(background.u('uScrim'), input.scrim);
		gl.drawArrays(gl.TRIANGLES, 0, 3);

		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

		if (input.count > 0) {
			const p = this.#programs.surface;
			gl.useProgram(p.program);
			this.#bind(0, scene.texture, p.u('uScene'));
			this.#bind(1, mid.texture, p.u('uBlurMid'));
			this.#bind(2, strong.texture, p.u('uBlurStrong'));
			gl.uniform2f(p.u('uViewport'), this.#width, this.#height);
			gl.uniform1f(p.u('uDpr'), input.dpr);
			gl.uniform1f(p.u('uMargin'), input.margin);
			gl.uniform1f(p.u('uFrost'), input.frost);
			gl.uniform3fv(p.u('uTint'), rgb01(input.tint));
			gl.uniform1f(p.u('uTone'), input.tone);
			gl.uniform2f(p.u('uLight'), input.light[0], input.light[1]);
			gl.uniform3fv(p.u('uShadowColor'), rgb01(input.shadow));
			gl.uniform1f(p.u('uBevelMin'), params.bevelMin);
			gl.uniform1f(p.u('uBevelMax'), params.bevelMax);
			gl.uniform1f(p.u('uRefraction'), quality?.refraction ? params.refraction : 0);
			gl.uniform1f(p.u('uDispersion'), quality?.dispersion ? params.dispersion : 0);
			gl.uniform1f(p.u('uSaturation'), params.saturation);
			gl.uniform1f(p.u('uTintAmount'), params.tint);
			gl.uniform1f(p.u('uMinLuminance'), params.minLuminance);
			gl.uniform1f(p.u('uMaxLuminance'), params.maxLuminance);
			gl.uniform1f(p.u('uAdaptive'), params.adaptive);
			gl.uniform1f(p.u('uFresnel'), params.fresnel);
			gl.uniform1f(p.u('uSpecular'), params.specular);
			gl.uniform1f(p.u('uSpecularPower'), params.specularPower);
			gl.uniform1f(p.u('uEdgeLine'), params.edgeLine);
			gl.uniform1f(p.u('uSheen'), params.sheen);
			gl.uniform1f(p.u('uShadowOpacity'), params.shadowOpacity);
			gl.uniform1f(p.u('uShadowBlur'), params.shadowBlur);
			gl.uniform1f(p.u('uShadowOffset'), params.shadowOffset);
			gl.uniform2f(p.u('uPointer'), input.pointer.x, input.pointer.y);
			gl.uniform1f(p.u('uPointerAmount'), quality?.pointerLight ? input.pointer.amount : 0);
			gl.uniform1f(p.u('uPointerRadius'), params.pointerRadius);
			gl.uniform1f(p.u('uPointerInfluence'), params.pointerInfluence);
			gl.uniform1f(p.u('uPointerGlow'), params.pointerGlow);
			gl.uniform1f(p.u('uHoverLift'), params.hoverLift);
			gl.uniform1f(p.u('uPressDepth'), params.pressDepth);

			gl.bindVertexArray(this.#surfaceVao);
			gl.bindBuffer(gl.ARRAY_BUFFER, this.#instanceBuffer);
			gl.bufferSubData(gl.ARRAY_BUFFER, 0, input.surfaces, 0, input.count * FLOATS_PER_SURFACE);
			gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, input.count);
		}

		if (input.scrim > 0) {
			const scrim = this.#programs.scrim;
			gl.useProgram(scrim.program);
			gl.bindVertexArray(this.#emptyVao);
			const alpha = params.scrim * input.scrim;
			const [r, g, b] = rgb01(input.shadow);
			gl.uniform4f(scrim.u('uColor'), r * alpha, g * alpha, b * alpha, alpha);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
		}
		gl.bindVertexArray(null);
	}

	dispose() {
		this.#disposeTargets();
		this.#dropLayer(this.#a);
		this.#dropLayer(this.#b);
		const gl = this.gl;
		for (const program of Object.values(this.#programs)) gl.deleteProgram(program.program);
		gl.deleteBuffer(this.#instanceBuffer);
		gl.deleteVertexArray(this.#emptyVao);
		gl.deleteVertexArray(this.#surfaceVao);
		gl.deleteTexture(this.#dummy);
	}

	#bind(unit: number, texture: WebGLTexture, location: WebGLUniformLocation | null) {
		const gl = this.gl;
		gl.activeTexture(gl.TEXTURE0 + unit);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.uniform1i(location, unit);
	}

	#pass(program: Program, source: Target, target: Target, halfPixel: [number, number]) {
		const gl = this.gl;
		gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
		gl.viewport(0, 0, target.width, target.height);
		this.#bind(0, source.texture, program.u('uTex'));
		gl.uniform2f(program.u('uHalfPixel'), halfPixel[0], halfPixel[1]);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}

	#blur() {
		const gl = this.gl;
		const scene = this.#scene;
		if (!scene) return;
		gl.bindVertexArray(this.#emptyVao);

		const down = this.#programs.down;
		gl.useProgram(down.program);
		let source = scene;
		for (const target of this.#down) {
			this.#pass(down, source, target, [0.5 / target.width, 0.5 / target.height]);
			source = target;
		}

		const up = this.#programs.up;
		gl.useProgram(up.program);
		source = this.#down[BLUR_LEVELS - 1];
		for (const target of this.#upStrong) {
			this.#pass(up, source, target, [0.5 / source.width, 0.5 / source.height]);
			source = target;
		}
		source = this.#down[MID_LEVEL - 1];
		for (const target of this.#upMid) {
			this.#pass(up, source, target, [0.5 / source.width, 0.5 / source.height]);
			source = target;
		}
	}

	#upload(layer: Layer) {
		const gl = this.gl;
		const { source, texture } = layer;
		if (!texture || source.kind === 'sky') return;
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
		try {
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source.element);
		} catch (error) {
			console.warn('Medium konnte nicht hochgeladen werden', error);
		}
	}

	#dropLayer(layer: Layer | null) {
		if (!layer) return;
		if (layer.texture) this.gl.deleteTexture(layer.texture);
		layer.texture = null;
		if (layer.source.kind !== 'sky') layer.source.release?.();
	}

	#disposeTargets() {
		const gl = this.gl;
		for (const target of [this.#scene, ...this.#down, ...this.#upStrong, ...this.#upMid]) {
			if (target) deleteTarget(gl, target);
		}
		this.#scene = null;
		this.#down = [];
		this.#upStrong = [];
		this.#upMid = [];
	}
}
