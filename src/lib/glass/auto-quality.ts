import type { RenderLevel } from './params.svelte';

/**
 * Automatische Qualitätsstufe (§7.4): Die Frame-Zeit wird über ein rollierendes Fenster von
 * ~2 s gemittelt. Liegt der Mittelwert über ~22 ms, geht es eine Stufe nach unten. Innerhalb
 * einer Sitzung wird nie hochgestuft. Gemessen werden nur Frames, die direkt aufeinander
 * folgen sollten; Pausen (On-Demand-Rendering, 15-fps-Himmel) zählen nicht.
 */

export type AutoLevel = RenderLevel | 'static';

export const AUTO_LEVELS: readonly AutoLevel[] = ['high', 'medium', 'low', 'static'];

export function lowerLevel(level: AutoLevel): AutoLevel {
	return AUTO_LEVELS[Math.min(AUTO_LEVELS.indexOf(level) + 1, AUTO_LEVELS.length - 1)];
}

export type AutoQualityOptions = {
	/** Länge des rollierenden Fensters in ms */
	windowMs?: number;
	/** Mittlere Frame-Zeit, ab der heruntergestuft wird */
	thresholdMs?: number;
	/** Mindestzahl an Messungen im Fenster, bevor entschieden wird */
	minSamples?: number;
	/** Längere Abstände sind Pausen (z. B. Tab-Wechsel, Ruckler beim Laden), keine Messung */
	maxFrameMs?: number;
};

type Sample = { at: number; ms: number };

export class AutoQuality {
	level: AutoLevel;
	#samples: Sample[] = [];
	#options: Required<AutoQualityOptions>;

	constructor(start: AutoLevel, options: AutoQualityOptions = {}) {
		this.level = start;
		this.#options = {
			windowMs: 2000,
			thresholdMs: 22,
			minSamples: 12,
			maxFrameMs: 250,
			...options
		};
	}

	/** Mittlere Frame-Zeit im aktuellen Fenster (ohne die langsamsten 10 %), null ohne Daten */
	get average(): number | null {
		if (this.#samples.length === 0) return null;
		const sorted = this.#samples.map((s) => s.ms).sort((a, b) => a - b);
		// Einzelne Ausreißer (GC, Laden) sollen nicht gleich herunterstufen
		const kept = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.9)));
		return kept.reduce((a, b) => a + b, 0) / kept.length;
	}

	get samples(): number {
		return this.#samples.length;
	}

	/**
	 * Zeichnet eine Frame-Zeit auf. Liefert die neue Stufe, wenn heruntergestuft wurde, sonst
	 * null. Nach einem Wechsel beginnt die Messung von vorn.
	 */
	record(frameMs: number, now: number): AutoLevel | null {
		if (this.level === 'static' || !(frameMs > 0) || frameMs > this.#options.maxFrameMs) {
			return null;
		}
		this.#samples.push({ at: now, ms: frameMs });
		const from = now - this.#options.windowMs;
		while (this.#samples.length > 0 && this.#samples[0].at < from) this.#samples.shift();
		// Erst entscheiden, wenn genug Messungen einen Großteil des Fensters abdecken
		const span = now - this.#samples[0].at;
		if (this.#samples.length < this.#options.minSamples || span < this.#options.windowMs * 0.75) {
			return null;
		}
		const average = this.average ?? 0;
		if (average <= this.#options.thresholdMs) return null;
		this.level = lowerLevel(this.level);
		this.#samples = [];
		return this.level;
	}

	reset(level: AutoLevel) {
		this.level = level;
		this.#samples = [];
	}
}
