/**
 * GLSL-Quellen (WebGL2 / GLSL ES 3.00). Koordinaten in Pixeln laufen von oben links, Texturen
 * aus Framebuffern von unten links; `toUv` rechnet um.
 */

const HEADER = /* glsl */ `#version 300 es
precision highp float;
`;

/** Bildschirmfüllendes Dreieck ohne Vertex-Buffer */
export const FULLSCREEN_VS = /* glsl */ `#version 300 es
out vec2 vUv;
void main() {
	vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
	vUv = p;
	gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

const COMMON = /* glsl */ `
float luma(vec3 c) {
	return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

// Feste Rauschmaske gegen Banding in Verläufen (flimmert nicht, weil sie sich nicht bewegt)
float dither(vec2 p) {
	return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
}
`;

/**
 * Szene: Himmelsverlauf oder eigenes Medium, mit Grading. Zwei Ebenen (A alt, B neu) werden
 * für den Phasenwechsel überblendet.
 */
export const SCENE_FS =
	HEADER +
	COMMON +
	/* glsl */ `
in vec2 vUv;
out vec4 outColor;

uniform vec2 uResolution;
uniform float uTime;

uniform vec3 uSkyTop;
uniform vec3 uSkyMiddle;
uniform vec3 uSkyHorizon;
uniform vec3 uSkyGround;
uniform vec3 uSkyGlow;
// x, y, Stärke
uniform vec3 uGlow;

uniform sampler2D uTexA;
uniform sampler2D uTexB;
// 0 = Himmel, 1 = Textur
uniform int uKindA;
uniform int uKindB;
// Skalierung xy, Versatz zw: uv = st * scale + offset
uniform vec4 uFitA;
uniform vec4 uFitB;
uniform float uMix;

uniform vec3 uGradeTint;
uniform float uGradeAmount;
uniform float uGradeSaturation;
uniform float uGradeBrightness;
uniform float uGradeContrast;

float ellipse(vec2 st, vec2 center, vec2 radius) {
	return length((st - center) / radius);
}

vec3 sky(vec2 st) {
	vec3 c = mix(uSkyTop, uSkyMiddle, smoothstep(0.0, 0.55, st.y));
	c = mix(c, uSkyHorizon, smoothstep(0.45, 1.0, st.y));

	// Sehr langsame, weiche Lichtbänder statt Rauschen
	float aspect = uResolution.x / max(uResolution.y, 1.0);
	vec2 q = vec2(st.x * aspect, st.y);
	float t = uTime;
	float bands = sin(q.x * 1.3 + t * 0.045 + sin(q.y * 2.1 - t * 0.03) * 1.4)
		* sin(q.y * 2.6 - t * 0.035 + q.x * 0.6);
	c += bands * 0.03 * (0.4 + 0.6 * smoothstep(0.0, 0.8, st.y)) * (vec3(1.0) - c);

	// Weiches Licht unten links (Wiese bzw. Dämmerung)
	float ground = 1.0 - smoothstep(0.0, 0.75, ellipse(st, vec2(0.12, 1.05), vec2(0.9, 0.55)));
	c = mix(c, uSkyGround, ground * 0.8);

	// Sonne bzw. Mond, atmet kaum merklich
	float breathe = 1.0 + 0.04 * sin(t * 0.12);
	float glow = 1.0 - smoothstep(0.0, 0.75, ellipse(st, uGlow.xy, vec2(0.6, 0.5) * breathe));
	c = mix(c, uSkyGlow, glow * uGlow.z);
	return c;
}

vec3 softLight(vec3 b, vec3 s) {
	vec3 d = mix(sqrt(b), ((16.0 * b - 12.0) * b + 4.0) * b, step(b, vec3(0.25)));
	return mix(b - (1.0 - 2.0 * s) * b * (1.0 - b), b + (2.0 * s - 1.0) * (d - b), step(0.5, s));
}

// Gleiche Reihenfolge wie die CSS-Filter der Static-Stufe
vec3 grade(vec3 c) {
	c = mix(vec3(luma(c)), c, uGradeSaturation);
	c *= uGradeBrightness;
	c = (c - 0.5) * uGradeContrast + 0.5;
	c = clamp(c, 0.0, 1.0);
	return mix(c, softLight(c, uGradeTint), min(1.0, uGradeAmount * 2.0));
}

vec3 layer(int kind, sampler2D tex, vec4 fit, vec2 st) {
	if (kind == 0) return sky(st);
	vec2 uv = st * fit.xy + fit.zw;
	// Bei „Ganz zeigen“ liegt um das Bild der Himmel
	if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return sky(st);
	return grade(texture(tex, uv).rgb);
}

void main() {
	vec2 st = vec2(vUv.x, 1.0 - vUv.y);
	vec3 a = uMix < 1.0 ? layer(uKindA, uTexA, uFitA, st) : vec3(0.0);
	vec3 b = uMix > 0.0 ? layer(uKindB, uTexB, uFitB, st) : vec3(0.0);
	vec3 c = mix(a, b, uMix);
	c += dither(gl_FragCoord.xy) / 255.0;
	outColor = vec4(c, 1.0);
}
`;

/** Dual-Kawase: Herunterskalieren mit 5 Abtastungen */
export const DOWN_FS =
	HEADER +
	/* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uHalfPixel;
void main() {
	vec4 sum = texture(uTex, vUv) * 4.0;
	sum += texture(uTex, vUv - uHalfPixel);
	sum += texture(uTex, vUv + uHalfPixel);
	sum += texture(uTex, vUv + vec2(uHalfPixel.x, -uHalfPixel.y));
	sum += texture(uTex, vUv - vec2(uHalfPixel.x, -uHalfPixel.y));
	outColor = sum / 8.0;
}
`;

/** Dual-Kawase: Hochskalieren mit 8 Abtastungen */
export const UP_FS =
	HEADER +
	/* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uHalfPixel;
void main() {
	vec2 h = uHalfPixel;
	vec4 sum = texture(uTex, vUv + vec2(-h.x * 2.0, 0.0));
	sum += texture(uTex, vUv + vec2(-h.x, h.y)) * 2.0;
	sum += texture(uTex, vUv + vec2(0.0, h.y * 2.0));
	sum += texture(uTex, vUv + vec2(h.x, h.y)) * 2.0;
	sum += texture(uTex, vUv + vec2(h.x * 2.0, 0.0));
	sum += texture(uTex, vUv + vec2(h.x, -h.y)) * 2.0;
	sum += texture(uTex, vUv + vec2(0.0, -h.y * 2.0));
	sum += texture(uTex, vUv + vec2(-h.x, -h.y)) * 2.0;
	outColor = sum / 12.0;
}
`;

/** Hintergrund auf den Bildschirm; hinter Dialogen weichgezeichnet */
export const BACKGROUND_FS =
	HEADER +
	/* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uScene;
uniform sampler2D uBlurStrong;
uniform float uScrim;
void main() {
	vec3 c = texture(uScene, vUv).rgb;
	if (uScrim > 0.0) c = mix(c, texture(uBlurStrong, vUv).rgb, uScrim);
	outColor = vec4(c, 1.0);
}
`;

/** Abdunklung über Szene und Panels, wenn ein Dialog offen ist (vormultipliziert) */
export const SCRIM_FS =
	HEADER +
	/* glsl */ `
out vec4 outColor;
uniform vec4 uColor;
void main() {
	outColor = uColor;
}
`;

/** Eine Instanz pro Glasfläche; das Quad ist um den Schatten vergrößert */
export const SURFACE_VS = /* glsl */ `#version 300 es
layout(location = 0) in vec4 aRect;
layout(location = 1) in vec4 aClip;
layout(location = 2) in vec4 aParams;

uniform vec2 uViewport;
uniform float uMargin;

out vec2 vPos;
flat out vec4 vRect;
flat out vec4 vClip;
flat out vec4 vParams;

void main() {
	vec2 corner = vec2(gl_VertexID & 1, (gl_VertexID >> 1) & 1);
	vec2 pos = aRect.xy - uMargin + corner * (aRect.zw + 2.0 * uMargin);
	vPos = pos;
	vRect = aRect;
	vClip = aClip;
	vParams = aParams;
	vec2 clip = pos / uViewport * 2.0 - 1.0;
	gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`;

export const SURFACE_FS =
	HEADER +
	COMMON +
	/* glsl */ `
in vec2 vPos;
flat in vec4 vRect;
flat in vec4 vClip;
flat in vec4 vParams;
out vec4 outColor;

uniform sampler2D uScene;
uniform sampler2D uBlurMid;
uniform sampler2D uBlurStrong;
uniform vec2 uViewport;
uniform float uDpr;

uniform float uFrost;
uniform vec3 uTint;
// 0 = helle UI (dunkle Schrift), 1 = dunkle UI (helle Schrift)
uniform float uTone;
// Richtung zur Lichtquelle, y nach unten
uniform vec2 uLight;
uniform vec3 uShadowColor;

uniform float uBevelMin;
uniform float uBevelMax;
uniform float uRefraction;
uniform float uDispersion;
uniform float uSaturation;
uniform float uTintAmount;
uniform float uMinLuminance;
uniform float uMaxLuminance;
uniform float uAdaptive;
uniform float uLiftLimit;
uniform float uDimLimit;
uniform float uFresnel;
uniform float uSpecular;
uniform float uSpecularPower;
uniform float uEdgeLine;
uniform float uSheen;
uniform float uShadowOpacity;
uniform float uShadowBlur;
uniform float uShadowOffset;

float sdRoundRect(vec2 p, vec2 halfSize, float r) {
	vec2 q = abs(p) - halfSize + r;
	return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

vec2 toUv(vec2 p) {
	return vec2(p.x / uViewport.x, 1.0 - p.y / uViewport.y);
}

// Szene mit Frost: von scharf über leicht bis stark weichgezeichnet
vec3 frosted(vec2 p) {
	vec2 uv = clamp(toUv(p), vec2(0.0), vec2(1.0));
	vec3 sharp = texture(uScene, uv).rgb;
	vec3 mid = texture(uBlurMid, uv).rgb;
	vec3 strong = texture(uBlurStrong, uv).rgb;
	vec3 c = mix(sharp, mid, smoothstep(0.0, 0.45, uFrost));
	return mix(c, strong, smoothstep(0.35, 1.0, uFrost));
}

void main() {
	// Wie overflow des Scroll-Containers: außerhalb wird nichts gezeichnet
	if (vPos.x < vClip.x || vPos.y < vClip.y || vPos.x > vClip.z || vPos.y > vClip.w) discard;

	float radius = vParams.x;
	float depth = vParams.y;
	float opacity = vParams.z;
	vec2 halfSize = 0.5 * vRect.zw;
	vec2 p = vPos - (vRect.xy + halfSize);
	float d = sdRoundRect(p, halfSize, radius);

	// Weicher Kontaktschatten, etwas nach unten versetzt
	float blur = max(uShadowBlur * uDpr * mix(0.5, 1.0, depth), 1.0);
	vec2 shadowP = p - vec2(0.0, uShadowOffset * uDpr * mix(0.4, 1.0, depth));
	float ds = sdRoundRect(shadowP, max(halfSize - blur * 0.25, vec2(1.0)), radius);
	float shadow = uShadowOpacity * depth * (1.0 - smoothstep(-blur * 0.6, blur, ds));

	float coverage = clamp(0.5 - d, 0.0, 1.0);
	if (coverage <= 0.0) {
		if (shadow < 0.002) discard;
		outColor = vec4(uShadowColor, 1.0) * shadow * opacity;
		return;
	}

	// Höhenprofil: flache Mitte, zum Rand gewölbter Bevel
	float bevel = max(mix(uBevelMin, uBevelMax, depth) * uDpr, 1.0);
	float t = clamp(-d / bevel, 0.0, 1.0);
	float rim = (1.0 - t) * (1.0 - t);
	// Ableitung von 1 - (1 - t)^3: am Rand steil, in der Mitte flach
	float slope = 3.0 * rim;

	// Normale aus dem Gradienten des SDF, zeigt nach außen
	vec2 e = vec2(1.0, 0.0);
	vec2 grad = vec2(
		sdRoundRect(p + e.xy, halfSize, radius) - sdRoundRect(p - e.xy, halfSize, radius),
		sdRoundRect(p + e.yx, halfSize, radius) - sdRoundRect(p - e.yx, halfSize, radius)
	);
	vec2 n = dot(grad, grad) > 1e-6 ? normalize(grad) : vec2(0.0, -1.0);

	// Refraktion: am Rand zeigt das Glas die Umgebung, mit Farbsäumen (Dispersion)
	vec2 offset = n * slope * uRefraction * uDpr * mix(0.5, 1.0, depth);
	vec3 color;
	if (uDispersion > 0.0 && slope > 0.01) {
		color = vec3(
			frosted(vPos + offset * (1.0 - uDispersion)).r,
			frosted(vPos + offset).g,
			frosted(vPos + offset * (1.0 + uDispersion)).b
		);
	} else {
		color = frosted(vPos + offset);
	}

	// Satte Farben, leichte Tönung
	color = mix(vec3(luma(color)), color, uSaturation);
	color = mix(color, uTint, uTintAmount);

	// Adaptiv, damit Text Kontrast hat: gemessen wird die großflächige Helligkeit unter der
	// Fläche (stark weichgezeichnet), nicht jedes Pixel einzeln. Pro Pixel geklemmt würden
	// dunkle Stellen flach und milchig, helle Details blieben stehen (wirkt „komprimiert“).
	float ambient = luma(texture(uBlurStrong, clamp(toUv(vPos), vec2(0.0), vec2(1.0))).rgb);
	ambient = mix(ambient, luma(uTint), uTintAmount);
	float lt = luma(uTint);
	// Helle UI: erst wie eine Belichtung anheben (Farben bleiben satt), den Rest mit Glasfarbe
	float lift = clamp(log(uMinLuminance) / log(clamp(ambient, 1e-3, 0.999)), uLiftLimit, 1.0);
	lift = ambient < uMinLuminance ? mix(1.0, lift, uAdaptive) : 1.0;
	float lifted = pow(ambient, lift);
	float lighten = clamp((uMinLuminance - lifted) / max(lt - lifted, 1e-3), 0.0, 1.0) * uAdaptive;
	vec3 light = mix(pow(max(color, vec3(0.0)), vec3(lift)), uTint, lighten);
	// Dunkle UI: wie getöntes Glas abdunkeln, den Rest mit Glasfarbe
	float dim = ambient > uMaxLuminance ? max(uMaxLuminance / ambient, uDimLimit) : 1.0;
	dim = mix(1.0, dim, uAdaptive);
	float dimmed = ambient * dim;
	float darken = clamp((dimmed - uMaxLuminance) / max(dimmed - lt, 1e-3), 0.0, 1.0) * uAdaptive;
	vec3 dark = mix(color * dim, uTint, darken);
	color = mix(light, dark, uTone);
	// Nach dem Anheben wieder etwas Sättigung, sonst wirkt es ausgewaschen
	color = mix(vec3(luma(color)), color, mix(1.0 + 0.3 * (1.0 - lift), 1.0, uTone));

	// Licht: Glanz an der Kante zur Lichtquelle, schwächer gegenüber, Fresnel rundum
	float lit = dot(n, uLight);
	float glare = mix(1.0, 0.45, uTone);
	float spec = pow(max(lit, 0.0), uSpecularPower) + 0.2 * pow(max(-lit, 0.0), uSpecularPower);
	color += vec3(uSpecular * spec * rim * rim * glare);
	color += vec3(uFresnel * rim * (0.6 + 0.4 * lit) * glare);

	// Feine Lichtkante direkt am Rand
	float line = 1.0 - smoothstep(0.0, 1.5 * uDpr, -d);
	color += vec3(uEdgeLine * line * (0.5 + 0.5 * max(lit, 0.0)) * glare);

	// Weicher Schimmer im oberen Bereich
	float top = (vPos.y - vRect.y) / max(min(vRect.w, 240.0 * uDpr), 1.0);
	color += vec3(uSheen * (1.0 - smoothstep(0.0, 0.5, top)) * glare);

	color = clamp(color, 0.0, 1.0);
	vec4 glass = vec4(color, 1.0) * coverage;
	vec4 under = vec4(uShadowColor, 1.0) * shadow * (1.0 - coverage);
	outColor = (glass + under) * opacity;
}
`;
