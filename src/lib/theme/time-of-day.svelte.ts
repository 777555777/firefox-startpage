import type { DayPhase, TimeOfDayConfig } from '$lib/config/types';
import { everyMinute } from '$lib/utils/now.svelte';
import {
	glassTintAt,
	gradeAt,
	lightDirection,
	NEUTRAL_GRADE,
	skyAt,
	toneAt,
	type Grade,
	type SkyPalette,
	type Tone
} from './palette';
import { minutesOf, phaseInfo, type PhaseInfo, type Rgb } from './phase';

/**
 * Reaktive Tageszeit: aktuelle Phase mit Übergangsgewichten und alles, was daraus folgt
 * (Himmel, Grading, Tonalität, Glasfarbe, Lichtrichtung). Aktualisiert sich jede Minute.
 */
export class TimeOfDay {
	/** Feste Uhrzeit in Minuten statt der echten Zeit (Debug-Panel) */
	override = $state<number | null>(null);

	readonly info: PhaseInfo;
	readonly phase: DayPhase;
	readonly tone: Tone;
	readonly sky: SkyPalette;
	/** Grading für eigene Hintergründe; neutral, wenn abgeschaltet */
	readonly grade: Grade;
	readonly glassTint: Rgb;
	readonly light: [number, number];

	constructor(config: () => TimeOfDayConfig) {
		this.info = $derived(phaseInfo(this.minutes, config().phaseStart));
		this.phase = $derived(this.info.phase);
		this.tone = $derived(toneAt(this.info.weights));
		this.sky = $derived(skyAt(this.info.weights));
		this.grade = $derived(config().grading ? gradeAt(this.info.weights) : NEUTRAL_GRADE);
		this.glassTint = $derived(glassTintAt(this.info.weights, this.tone));
		this.light = $derived(lightDirection(this.info.weights));
	}

	get minutes(): number {
		return this.override ?? minutesOf(everyMinute.current);
	}
}
