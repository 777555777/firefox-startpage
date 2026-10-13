import type { RenderLevel } from './params.svelte';

/** Was gerade tatsächlich gezeichnet wird; für Root-Attribut, Einstellungen und Debug-Panel */
class RenderState {
	/** `webgl` erst, wenn der erste Frame gezeichnet ist; bis dahin bleibt die Static-Darstellung */
	mode = $state<'webgl' | 'static'>('static');
	/** Warum trotz gewünschtem WebGL statisch gezeichnet wird */
	failure = $state<'unavailable' | 'lost' | null>(null);
	level = $state<RenderLevel | null>(null);
	/** Bilder pro Sekunde, solange fortlaufend gezeichnet wird; 0 = nur bei Änderungen */
	fps = $state(0);
}

export const renderState = new RenderState();
