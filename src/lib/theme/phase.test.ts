import { describe, expect, it } from 'vitest';
import { DEFAULT_PHASE_START } from '$lib/config/defaults';
import { gradeAt, GRADES, lightDirection, skyAt, SKY, toneAt, glassTintAt } from './palette';
import {
	formatMinutes,
	mixNumber,
	parseTime,
	phaseInfo,
	PHASES,
	wrapMinutes,
	type PhaseWeights
} from './phase';

const at = (time: string) => parseTime(time)!;
const sum = (weights: PhaseWeights) => PHASES.reduce((total, p) => total + weights[p], 0);

describe('Tageszeit-Phasen', () => {
	it('liefert mitten in einer Phase nur diese Phase', () => {
		const info = phaseInfo(at('13:00'), DEFAULT_PHASE_START);
		expect(info.phase).toBe('day');
		expect(info.next).toBe('evening');
		expect(info.weights).toEqual({ morning: 0, day: 1, evening: 0, night: 0 });
		expect(info.minutesToNext).toBe(4 * 60 + 30);
	});

	it('teilt genau auf der Grenze 50 : 50', () => {
		const info = phaseInfo(at('10:00'), DEFAULT_PHASE_START);
		expect(info.phase).toBe('day');
		expect(info.weights.day).toBeCloseTo(0.5);
		expect(info.weights.morning).toBeCloseTo(0.5);
	});

	it('blendet kontinuierlich über, ohne Sprünge', () => {
		let previous = phaseInfo(at('09:00'), DEFAULT_PHASE_START).weights.day;
		for (let m = at('09:00') + 1; m <= at('11:00'); m++) {
			const { weights } = phaseInfo(m, DEFAULT_PHASE_START);
			expect(sum(weights)).toBeCloseTo(1);
			expect(weights.day).toBeGreaterThanOrEqual(previous - 1e-9);
			expect(weights.day - previous).toBeLessThan(0.05);
			previous = weights.day;
		}
		expect(previous).toBe(1);
		expect(phaseInfo(at('09:29'), DEFAULT_PHASE_START).weights.day).toBe(0);
	});

	it('rechnet über Mitternacht hinweg', () => {
		expect(phaseInfo(at('00:00'), DEFAULT_PHASE_START).phase).toBe('night');
		expect(phaseInfo(at('05:59'), DEFAULT_PHASE_START).phase).toBe('night');
		expect(phaseInfo(at('05:59'), DEFAULT_PHASE_START).next).toBe('morning');
		expect(phaseInfo(at('03:00'), DEFAULT_PHASE_START).minutesToNext).toBe(180);
		expect(phaseInfo(at('23:00'), DEFAULT_PHASE_START).weights.night).toBe(1);
		expect(phaseInfo(-60, DEFAULT_PHASE_START).phase).toBe('night');
	});

	it('kommt mit beliebig geordneten und kurzen Phasen zurecht', () => {
		const starts = {
			morning: at('05:00'),
			day: at('05:20'),
			evening: at('20:00'),
			night: at('01:00')
		};
		expect(phaseInfo(at('03:00'), starts).phase).toBe('night');
		expect(phaseInfo(at('05:10'), starts).phase).toBe('morning');
		// 20-Minuten-Phase: Übergang höchstens 10 Minuten je Seite
		const inside = phaseInfo(at('05:10'), starts).weights;
		expect(sum(inside)).toBeCloseTo(1);
		expect(phaseInfo(at('12:00'), starts).weights.day).toBe(1);
	});

	it('gilt den ganzen Tag, wenn alle Phasen gleichzeitig beginnen', () => {
		const starts = { morning: 600, day: 600, evening: 600, night: 600 };
		const info = phaseInfo(at('15:00'), starts);
		expect(info.weights[info.phase]).toBe(1);
	});

	it('formatiert und liest Uhrzeiten', () => {
		expect(formatMinutes(at('06:05'))).toBe('06:05');
		expect(formatMinutes(-30)).toBe('23:30');
		expect(parseTime('7:30')).toBe(450);
		expect(parseTime('24:00')).toBeNull();
		expect(parseTime('abc')).toBeNull();
		expect(wrapMinutes(1500)).toBe(60);
	});
});

describe('Farbstimmung', () => {
	const only = (phase: keyof PhaseWeights): PhaseWeights => ({
		morning: 0,
		day: 0,
		evening: 0,
		night: 0,
		[phase]: 1
	});

	it('nimmt in reinen Phasen genau deren Werte', () => {
		expect(skyAt(only('evening'))).toEqual(SKY.evening);
		expect(gradeAt(only('night'))).toEqual(GRADES.night);
	});

	it('mischt im Übergang zwischen zwei Phasen', () => {
		const half = { morning: 0, day: 0, evening: 0.5, night: 0.5 };
		const sky = skyAt(half);
		expect(sky.top[0]).toBeCloseTo((SKY.evening.top[0] + SKY.night.top[0]) / 2);
		expect(gradeAt(half).brightness).toBeCloseTo(
			(GRADES.evening.brightness + GRADES.night.brightness) / 2
		);
		expect(mixNumber(half, { morning: 0, day: 0, evening: 2, night: 4 })).toBe(3);
	});

	it('wechselt die Tonalität zur Mitte des Übergangs in die Nacht', () => {
		expect(toneAt(only('day'))).toBe('light');
		expect(toneAt({ morning: 0, day: 0, evening: 0.6, night: 0.4 })).toBe('light');
		expect(toneAt({ morning: 0, day: 0, evening: 0.4, night: 0.6 })).toBe('dark');
		const light = glassTintAt(only('day'), 'light');
		const dark = glassTintAt(only('night'), 'dark');
		expect(light[0]).toBeGreaterThan(200);
		expect(dark[0]).toBeLessThan(60);
	});

	it('liefert eine normierte Lichtrichtung von oben', () => {
		for (const phase of PHASES) {
			const [x, y] = lightDirection(only(phase));
			expect(Math.hypot(x, y)).toBeCloseTo(1);
			expect(y).toBeLessThan(0);
		}
		expect(lightDirection(only('morning'))[0]).toBeLessThan(0);
		expect(lightDirection(only('evening'))[0]).toBeGreaterThan(0);
	});
});
