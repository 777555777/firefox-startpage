import { describe, expect, it } from 'vitest';
import {
	defaultLinksSettings,
	parseLinksSettings,
	snapTileSize,
	TILE_SIZE,
	tileMetrics
} from './settings';

describe('Kachelgröße', () => {
	it('ist ohne Angabe der bisherige Standard', () => {
		expect(defaultLinksSettings().tileSize).toBe(56);
		expect(parseLinksSettings({}).tileSize).toBe(TILE_SIZE.default);
		expect(parseLinksSettings({ tileSize: 'groß' }).tileSize).toBe(TILE_SIZE.default);
	});

	it('wird auf den Bereich begrenzt und rastet auf die Schrittweite ein', () => {
		expect(parseLinksSettings({ tileSize: 72 }).tileSize).toBe(72);
		expect(parseLinksSettings({ tileSize: 10 }).tileSize).toBe(TILE_SIZE.min);
		expect(parseLinksSettings({ tileSize: 500 }).tileSize).toBe(TILE_SIZE.max);
		expect(snapTileSize(61)).toBe(60);
		expect(snapTileSize(63)).toBe(64);
		expect(snapTileSize(TILE_SIZE.max)).toBe(TILE_SIZE.max);
	});

	it('leitet beim Standard die bisher festen Maße ab', () => {
		expect(tileMetrics(56)).toEqual({ icon: 36, plus: 22, radius: 16, column: 104 });
	});

	it('wächst gleichmäßig mit', () => {
		const small = tileMetrics(TILE_SIZE.min);
		const large = tileMetrics(TILE_SIZE.max);
		expect(small.icon).toBeLessThan(large.icon);
		expect(small.column).toBeLessThan(large.column);
		// Das Icon bleibt immer kleiner als seine Fläche
		expect(large.icon).toBeLessThan(TILE_SIZE.max);
	});
});
