import type { DayPhase } from '$lib/config/types';

/**
 * Tageszeit-Phasen: Welche Phase gerade gilt und wie stark benachbarte Phasen im Übergang
 * hineinspielen. Reine Funktionen, die Zeit kommt immer als Minuten nach Mitternacht.
 */

export const PHASES: readonly DayPhase[] = ['morning', 'day', 'evening', 'night'];

export const MINUTES_PER_DAY = 24 * 60;

/** Breite des Übergangs um jede Phasengrenze in Minuten (zentriert auf die Grenze) */
export const TRANSITION_MINUTES = 60;

export type PhaseWeights = Record<DayPhase, number>;

export type PhaseInfo = {
	/** Phase, deren Beginn zuletzt erreicht wurde */
	phase: DayPhase;
	/** Nächste Phase in zeitlicher Reihenfolge */
	next: DayPhase;
	/** Minuten bis zum Beginn der nächsten Phase */
	minutesToNext: number;
	/** Anteil jeder Phase, zusammen 1; im Übergang teilen sich zwei Phasen den Wert */
	weights: PhaseWeights;
};

/** Minuten im Bereich 0 … 1439, auch für negative Werte */
export function wrapMinutes(minutes: number): number {
	return ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

export function minutesOf(date: Date): number {
	return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

const smoothstep = (t: number) => {
	const x = Math.min(1, Math.max(0, t));
	return x * x * (3 - 2 * x);
};

const zeroWeights = (): PhaseWeights => ({ morning: 0, day: 0, evening: 0, night: 0 });

/**
 * Berechnet die Phase zu einer Uhrzeit. Die Startzeiten dürfen in beliebiger Reihenfolge
 * liegen; es gilt immer die Phase mit dem letzten Beginn vor der Uhrzeit (über Mitternacht
 * hinweg). Um jede Grenze herum wird über `transition` Minuten weich übergeblendet, bei
 * kurzen Phasen entsprechend kürzer.
 */
export function phaseInfo(
	minutes: number,
	starts: Record<DayPhase, number>,
	transition = TRANSITION_MINUTES
): PhaseInfo {
	const now = wrapMinutes(minutes);
	// Stabil sortiert: bei gleicher Startzeit gilt die Reihenfolge aus PHASES
	const order = [...PHASES].sort((a, b) => wrapMinutes(starts[a]) - wrapMinutes(starts[b]));
	const n = order.length;
	const startOf = (i: number) => wrapMinutes(starts[order[(i + n) % n]]);

	let index = n - 1;
	for (let i = 0; i < n; i++) if (startOf(i) <= now) index = i;

	const lengthOf = (i: number) => wrapMinutes(startOf(i + 1) - startOf(i));

	const current = order[index];
	const prev = order[(index - 1 + n) % n];
	const next = order[(index + 1) % n];
	const sinceStart = wrapMinutes(now - startOf(index));
	// Beginnen alle Phasen gleichzeitig, gilt eine davon den ganzen Tag
	const length = lengthOf(index) || MINUTES_PER_DAY;
	const untilNext = length - sinceStart;

	const halfIn = Math.min(transition / 2, lengthOf(index - 1) / 2, length / 2);
	const halfOut = Math.min(transition / 2, length / 2, lengthOf(index + 1) / 2);

	const weights = zeroWeights();
	if (halfIn > 0 && sinceStart < halfIn && prev !== current) {
		// Kurz nach der Grenze: die vorige Phase klingt aus
		const own = smoothstep(0.5 + sinceStart / (2 * halfIn));
		weights[current] = own;
		weights[prev] += 1 - own;
	} else if (halfOut > 0 && untilNext < halfOut && next !== current) {
		// Kurz vor der Grenze: die nächste Phase kündigt sich an
		const own = smoothstep(0.5 + untilNext / (2 * halfOut));
		weights[current] = own;
		weights[next] += 1 - own;
	} else {
		weights[current] = 1;
	}

	return { phase: current, next, minutesToNext: untilNext, weights };
}

/** Gewichtetes Mittel eines Zahlenwerts pro Phase */
export function mixNumber(weights: PhaseWeights, values: Record<DayPhase, number>): number {
	let sum = 0;
	for (const phase of PHASES) sum += weights[phase] * values[phase];
	return sum;
}

export type Rgb = [number, number, number];

/** Gewichtetes Mittel einer Farbe (0–255 pro Kanal) pro Phase */
export function mixRgb(weights: PhaseWeights, values: Record<DayPhase, Rgb>): Rgb {
	const out: Rgb = [0, 0, 0];
	for (const phase of PHASES) {
		for (let c = 0; c < 3; c++) out[c] += weights[phase] * values[phase][c];
	}
	return out;
}

/** `HH:MM` für `<input type="time">` */
export function formatMinutes(minutes: number): string {
	const m = Math.round(wrapMinutes(minutes));
	const pad = (v: number) => String(v).padStart(2, '0');
	return `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
}

/** Liest `HH:MM`; liefert null bei ungültiger Eingabe */
export function parseTime(value: string): number | null {
	const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
	if (!match) return null;
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	if (hours > 23 || minutes > 59) return null;
	return hours * 60 + minutes;
}
