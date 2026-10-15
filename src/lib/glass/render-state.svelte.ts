import { AUTO_LEVELS, type AutoLevel } from './auto-quality';
import type { RenderLevel } from './params.svelte';

/** Zuletzt stabile automatische Stufe; pro Rechner, deshalb nicht in der (exportierbaren) Config */
const AUTO_KEY = 'startpage:quality';

function loadAutoLevel(): AutoLevel | null {
	try {
		const value = localStorage.getItem(AUTO_KEY);
		return AUTO_LEVELS.includes(value as AutoLevel) ? (value as AutoLevel) : null;
	} catch {
		return null;
	}
}

/** Was gerade tatsächlich gezeichnet wird; für Root-Attribut, Einstellungen und Debug-Panel */
class RenderState {
	/** `webgl` erst, wenn der erste Frame gezeichnet ist; bis dahin bleibt die Static-Darstellung */
	mode = $state<'webgl' | 'static'>('static');
	/** Das Canvas ist fertig eingeblendet; erst dann verschwindet die Static-Darstellung darunter */
	canvasShown = $state(false);
	/**
	 * Warum trotz gewünschtem WebGL statisch gezeichnet wird: kein WebGL2, Kontext gerade
	 * verloren, oder so oft verloren, dass es in dieser Sitzung bei Static bleibt
	 */
	failure = $state<'unavailable' | 'lost' | 'unstable' | null>(null);
	level = $state<RenderLevel | null>(null);
	/** Bilder pro Sekunde, solange fortlaufend gezeichnet wird; 0 = nur bei Änderungen */
	fps = $state(0);
	/** Mittlere Frame-Zeit der letzten Messung in ms */
	frameMs = $state<number | null>(null);

	/** Stufe für „Automatisch“; null = noch nie gemessen (dann wird beim Start kurz gemessen) */
	autoLevel = $state<AutoLevel | null>(loadAutoLevel());

	setAutoLevel(level: AutoLevel | null) {
		this.autoLevel = level;
		try {
			if (level) localStorage.setItem(AUTO_KEY, level);
			else localStorage.removeItem(AUTO_KEY);
		} catch {
			// ohne localStorage wird eben bei jedem Öffnen neu gemessen
		}
	}
}

export const renderState = new RenderState();
