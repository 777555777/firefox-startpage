import type { Attachment } from 'svelte/attachments';
import { onAnimatingChange } from '$lib/dnd/spring';
import type { Box, GlassVariant, SurfaceSnapshot } from './pack';

/**
 * Register der Glasflächen. Panels melden sich per Attachment an
 * (`<section {@attach glass({ depth: 1 })}>`); der Layer kennt so Rechteck, Radius, Tiefe,
 * Variante und Reihenfolge jeder Fläche.
 *
 * Rechtecke werden nur bei Bedarf gelesen: im Ruhezustand nach ResizeObserver, Scrollen,
 * Fenstergröße oder ausdrücklicher Invalidierung; während Animationen und Drag in jedem Frame.
 */

export type GlassOptions = {
	/** Eckenradius in CSS-Pixeln; ohne Angabe aus `border-radius` gelesen */
	radius?: number;
	/** 0 = flach, 1 = volle Wölbung und Schatten */
	depth?: number;
	variant?: GlassVariant;
	/** Deckkraft der Fläche, z. B. beim Ziehen */
	opacity?: number;
	/** Zeichenreihenfolge; höhere Werte liegen oben */
	z?: number;
};

type Surface = {
	element: HTMLElement;
	options: GlassOptions;
	radius: number;
	scrollParent: HTMLElement | null;
	snapshot: SurfaceSnapshot | null;
};

const NO_CLIP: Box = {
	left: -Infinity,
	top: -Infinity,
	right: Infinity,
	bottom: Infinity
};

function findScrollParent(element: HTMLElement): HTMLElement | null {
	for (let node = element.parentElement; node; node = node.parentElement) {
		const { overflowX, overflowY } = getComputedStyle(node);
		if (/(auto|scroll|hidden|clip)/.test(overflowX + overflowY)) return node;
	}
	return null;
}

/** Innenbereich eines Scroll-Containers ohne Rahmen und Scrollleiste */
function clipBoxOf(element: HTMLElement | null): Box {
	if (!element) return NO_CLIP;
	const rect = element.getBoundingClientRect();
	const left = rect.left + element.clientLeft;
	const top = rect.top + element.clientTop;
	return { left, top, right: left + element.clientWidth, bottom: top + element.clientHeight };
}

const toBox = (rect: DOMRect): Box => ({
	left: rect.left,
	top: rect.top,
	right: rect.right,
	bottom: rect.bottom
});

class GlassLayer {
	#surfaces = new Map<HTMLElement, Surface>();
	#ordered: Surface[] = [];
	#orderDirty = false;
	#rectsDirty = true;
	#animatingUntil = 0;
	#springs = false;
	#observer: ResizeObserver | null = null;
	#listeners = new Set<() => void>();
	#cleanup: (() => void) | null = null;

	/** Wird aufgerufen, wenn sich etwas geändert hat und neu gezeichnet werden sollte */
	subscribe(listener: () => void): () => void {
		this.#listeners.add(listener);
		if (this.#listeners.size === 1) this.#start();
		return () => {
			this.#listeners.delete(listener);
			if (this.#listeners.size === 0) this.#stop();
		};
	}

	register(element: HTMLElement, options: GlassOptions): () => void {
		const radius =
			options.radius ?? (parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0);
		const surface: Surface = {
			element,
			options,
			radius,
			scrollParent: findScrollParent(element),
			snapshot: null
		};
		this.#surfaces.set(element, surface);
		this.#observer?.observe(element);
		this.#orderDirty = true;
		this.invalidate();
		return () => {
			this.#surfaces.delete(element);
			this.#observer?.unobserve(element);
			this.#orderDirty = true;
			this.invalidate();
		};
	}

	/** Rechtecke beim nächsten Frame neu lesen */
	invalidate() {
		this.#rectsDirty = true;
		this.#notify();
	}

	/** Für eine Weile in jedem Frame lesen, z. B. während einer CSS-Transition */
	animateFor(ms: number) {
		this.#animatingUntil = Math.max(this.#animatingUntil, performance.now() + ms);
		this.#notify();
	}

	get animating(): boolean {
		return this.#springs || performance.now() < this.#animatingUntil;
	}

	/**
	 * Liefert die aktuellen Flächen in Zeichenreihenfolge. Liest die Rechtecke nur, wenn sich
	 * etwas geändert haben kann; `changed` sagt, ob neu gezeichnet werden muss.
	 */
	sync(): { surfaces: SurfaceSnapshot[]; changed: boolean } {
		if (this.#orderDirty) {
			this.#ordered = [...this.#surfaces.values()].sort(
				(a, b) =>
					(a.options.z ?? 0) - (b.options.z ?? 0) ||
					(a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)
			);
			this.#orderDirty = false;
			this.#rectsDirty = true;
		}
		const changed = this.#rectsDirty || this.animating;
		if (changed) {
			// Erst alles lesen, dann nichts schreiben: kein Layout-Thrashing
			for (const surface of this.#ordered) {
				const { options } = surface;
				surface.snapshot = {
					rect: toBox(surface.element.getBoundingClientRect()),
					clip: clipBoxOf(surface.scrollParent),
					radius: surface.radius,
					depth: options.depth ?? 1,
					opacity: options.opacity ?? 1,
					variant: options.variant ?? 'panel'
				};
			}
			this.#rectsDirty = false;
		}
		return {
			surfaces: this.#ordered.flatMap((s) => (s.snapshot ? [s.snapshot] : [])),
			changed
		};
	}

	#notify() {
		for (const listener of this.#listeners) listener();
	}

	#start() {
		this.#observer = new ResizeObserver(() => this.invalidate());
		for (const element of this.#surfaces.keys()) this.#observer.observe(element);
		const invalidate = () => this.invalidate();
		const transition = () => this.animateFor(600);
		const options = { capture: true, passive: true };
		document.addEventListener('scroll', invalidate, options);
		window.addEventListener('resize', invalidate);
		document.addEventListener('transitionrun', transition, options);
		document.addEventListener('animationstart', transition, options);
		void document.fonts?.ready.then(invalidate);
		const stopSprings = onAnimatingChange((animating) => {
			this.#springs = animating;
			// Nach dem Ende einmal die Ruhelage lesen
			this.invalidate();
		});
		this.#cleanup = () => {
			document.removeEventListener('scroll', invalidate, options);
			window.removeEventListener('resize', invalidate);
			document.removeEventListener('transitionrun', transition, options);
			document.removeEventListener('animationstart', transition, options);
			stopSprings();
		};
	}

	#stop() {
		this.#observer?.disconnect();
		this.#observer = null;
		this.#cleanup?.();
		this.#cleanup = null;
	}
}

export const glassLayer = new GlassLayer();

/**
 * Meldet ein Element als Glasfläche an. Im WebGL-Modus zeichnet das Element selbst keinen
 * Hintergrund mehr (CSS-Regel auf `[data-glass]`), das übernimmt der Canvas-Layer.
 */
export function glass(options: GlassOptions = {}): Attachment<HTMLElement> {
	return (element) => {
		element.dataset.glass = options.variant ?? 'panel';
		const unregister = glassLayer.register(element, options);
		return () => {
			unregister();
			delete element.dataset.glass;
		};
	};
}
