/**
 * FLIP-Animationen mit einer gedämpften Feder. Elemente werden per `transform` von ihrer alten
 * an die neue Position geführt. Eine laufende Animation wird bei erneuter Bewegung mit ihrer
 * aktuellen Geschwindigkeit fortgesetzt, damit nichts springt.
 */

type Motion = { x: number; y: number; vx: number; vy: number };

const STIFFNESS = 520;
/** Leicht unterkritisch gedämpft: ruhig, mit kaum sichtbarem Nachschwingen */
const DAMPING = 2 * Math.sqrt(STIFFNESS) * 0.82;
const REST_DISTANCE = 0.25;
const REST_VELOCITY = 4;

const motions = new Map<HTMLElement, Motion>();
const listeners = new Set<(animating: boolean) => void>();
let frame = 0;
let lastTime = 0;

export function prefersReducedMotion(): boolean {
	return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Aktueller Versatz durch eine laufende Animation (für Layout-Messungen ohne Transform) */
export function currentOffset(element: HTMLElement): { x: number; y: number } {
	const motion = motions.get(element);
	return motion ? { x: motion.x, y: motion.y } : { x: 0, y: 0 };
}

/** Rechteck ohne den Animationsversatz, also die eigentliche Layout-Position */
export function layoutRect(element: HTMLElement): DOMRect {
	const rect = element.getBoundingClientRect();
	const offset = currentOffset(element);
	return new DOMRect(rect.x - offset.x, rect.y - offset.y, rect.width, rect.height);
}

export function isAnimating(): boolean {
	return motions.size > 0;
}

/** Meldet Beginn und Ende von Animationen, z. B. für die Rect-Synchronisation des Glas-Layers */
export function onAnimatingChange(listener: (animating: boolean) => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

function apply(element: HTMLElement, motion: Motion) {
	element.style.transform = `translate3d(${motion.x}px, ${motion.y}px, 0)`;
}

function step(time: number) {
	const dt = Math.min(0.032, (time - lastTime) / 1000 || 0.016);
	lastTime = time;
	// Mehrere kleine Schritte halten die Integration stabil
	const substeps = 4;
	const h = dt / substeps;
	for (const [element, motion] of motions) {
		for (let i = 0; i < substeps; i++) {
			motion.vx += (-STIFFNESS * motion.x - DAMPING * motion.vx) * h;
			motion.vy += (-STIFFNESS * motion.y - DAMPING * motion.vy) * h;
			motion.x += motion.vx * h;
			motion.y += motion.vy * h;
		}
		const resting =
			Math.abs(motion.x) < REST_DISTANCE &&
			Math.abs(motion.y) < REST_DISTANCE &&
			Math.hypot(motion.vx, motion.vy) < REST_VELOCITY;
		if (resting || !element.isConnected) {
			element.style.transform = '';
			motions.delete(element);
		} else apply(element, motion);
	}
	if (motions.size > 0) frame = requestAnimationFrame(step);
	else {
		frame = 0;
		for (const listener of listeners) listener(false);
	}
}

/** Startet bzw. setzt die Feder fort: das Element erscheint um (dx, dy) versetzt und federt zurück */
export function springFrom(element: HTMLElement, dx: number, dy: number) {
	if (prefersReducedMotion() || (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && !motions.has(element)))
		return;
	const motion = motions.get(element) ?? { x: 0, y: 0, vx: 0, vy: 0 };
	motion.x = dx;
	motion.y = dy;
	motions.set(element, motion);
	apply(element, motion);
	if (!frame) {
		lastTime = performance.now();
		frame = requestAnimationFrame(step);
		for (const listener of listeners) listener(true);
	}
}

/**
 * FLIP für eine Gruppe von Elementen: vorher Positionen merken, ändern, nachher messen und
 * die Differenz per Feder ausgleichen. `key` ordnet alte und neue Elemente einander zu, auch
 * wenn Svelte ein Element beim Wechsel der Liste neu erzeugt hat.
 */
export function snapshot(elements: Iterable<[string, HTMLElement]>): Map<string, DOMRect> {
	const rects = new Map<string, DOMRect>();
	for (const [key, element] of elements) rects.set(key, element.getBoundingClientRect());
	return rects;
}

export function playFlip(before: Map<string, DOMRect>, after: Iterable<[string, HTMLElement]>) {
	for (const [key, element] of after) {
		const old = before.get(key);
		if (!old) continue;
		const now = layoutRect(element);
		springFrom(element, old.left - now.left, old.top - now.top);
	}
}
