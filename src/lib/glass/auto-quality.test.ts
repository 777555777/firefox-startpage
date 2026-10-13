import { describe, expect, it } from 'vitest';
import { AutoQuality, lowerLevel } from './auto-quality';

/** Simuliert `seconds` Sekunden mit konstanter Frame-Zeit; liefert alle Stufenwechsel */
function run(auto: AutoQuality, frameMs: number, seconds: number, start = 0) {
	const changes: string[] = [];
	for (let now = start; now < start + seconds * 1000; now += frameMs) {
		const changed = auto.record(frameMs, now);
		if (changed) changes.push(changed);
	}
	return changes;
}

describe('Automatische Qualitätsstufe', () => {
	it('bleibt bei flüssigen Frames auf der Stufe', () => {
		const auto = new AutoQuality('high');
		expect(run(auto, 16.7, 5)).toEqual([]);
		expect(auto.level).toBe('high');
		expect(auto.average).toBeCloseTo(16.7);
	});

	it('stuft bei dauerhaft langsamen Frames eine Stufe herunter', () => {
		const auto = new AutoQuality('high');
		expect(run(auto, 30, 2.5)).toEqual(['medium']);
	});

	it('stuft weiter herunter, wenn es langsam bleibt, bis Static', () => {
		const auto = new AutoQuality('high');
		expect(run(auto, 40, 10)).toEqual(['medium', 'low', 'static']);
		// Static misst nicht mehr
		expect(auto.record(100, 20_000)).toBeNull();
	});

	it('entscheidet erst, wenn die Messungen ~1,5 s abdecken', () => {
		const auto = new AutoQuality('high');
		for (let now = 0; now < 1500; now += 50) expect(auto.record(50, now)).toBeNull();
		expect(auto.record(50, 1500)).toBe('medium');
	});

	it('erkennt auch sehr langsame Rechner (100 ms pro Frame)', () => {
		const auto = new AutoQuality('high');
		for (let now = 0; now < 1500; now += 100) expect(auto.record(100, now)).toBeNull();
		expect(auto.record(100, 1500)).toBe('medium');
	});

	it('braucht genug Messungen', () => {
		const auto = new AutoQuality('high', { minSamples: 12 });
		// nur zwei Frames im Abstand von 1,5 s
		expect(auto.record(200, 0)).toBeNull();
		expect(auto.record(200, 1600)).toBeNull();
	});

	it('bleibt auf der niedrigeren Stufe, wenn sie flüssig läuft', () => {
		const auto = new AutoQuality('high');
		const changes: string[] = [];
		for (let now = 0; now < 8000;) {
			// Hoch ist zu langsam, ab Mittel ist es flüssig
			const ms = auto.level === 'high' ? 30 : 15;
			const changed = auto.record(ms, now);
			if (changed) changes.push(changed);
			now += ms;
		}
		expect(changes).toEqual(['medium']);
	});

	it('übersteht einzelne Ausreißer', () => {
		const auto = new AutoQuality('high');
		const changes: string[] = [];
		for (let i = 0; i < 300; i++) {
			// jeder 20. Frame ruckelt (z. B. Garbage Collection)
			const ms = i % 20 === 0 ? 120 : 16;
			const changed = auto.record(ms, i * 16);
			if (changed) changes.push(changed);
		}
		expect(changes).toEqual([]);
	});

	it('ignoriert Pausen und vergisst alte Messungen', () => {
		const auto = new AutoQuality('high');
		// lange Pause zählt nicht
		expect(auto.record(5000, 0)).toBeNull();
		expect(auto.samples).toBe(0);
		// kurz langsam, danach lange flüssig: das Fenster vergisst den Anfang
		run(auto, 30, 0.3, 0);
		expect(run(auto, 16, 3, 400)).toEqual([]);
		expect(auto.level).toBe('high');
	});

	it('stuft nie hoch und kennt die Reihenfolge', () => {
		expect(lowerLevel('high')).toBe('medium');
		expect(lowerLevel('low')).toBe('static');
		expect(lowerLevel('static')).toBe('static');
		const auto = new AutoQuality('low');
		run(auto, 8, 5);
		expect(auto.level).toBe('low');
	});
});
