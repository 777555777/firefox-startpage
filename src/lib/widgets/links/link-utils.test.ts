import { describe, expect, it } from 'vitest';
import { fitSvg } from './link-utils';

const attrs = (width: string | null, height: string | null, viewBox: string | null) => ({
	width,
	height,
	viewBox
});

describe('fitSvg', () => {
	it('passt quadratische SVGs auf die Zielgröße an', () => {
		expect(fitSvg(attrs(null, null, '0 0 24 24'), 64)).toEqual({ width: 64, height: 64 });
		expect(fitSvg(attrs('512', '512px', '0 0 512 512'), 64)).toEqual({ width: 64, height: 64 });
	});

	it('behält das Seitenverhältnis', () => {
		expect(fitSvg(attrs(null, null, '0,0,200,100'), 64)).toEqual({ width: 64, height: 32 });
		expect(fitSvg(attrs('50', '100', null), 64)).toMatchObject({ width: 32, height: 64 });
	});

	it('ergänzt die viewBox aus den Originalmaßen, damit nichts beschnitten wird', () => {
		expect(fitSvg(attrs('300', '150', null), 64)).toEqual({
			width: 64,
			height: 32,
			viewBox: '0 0 300 150'
		});
	});

	it('nimmt ohne brauchbare Maße ein Quadrat', () => {
		expect(fitSvg(attrs('100%', '100%', null), 64)).toEqual({ width: 64, height: 64 });
		expect(fitSvg(attrs(null, null, 'kaputt'), 64)).toEqual({ width: 64, height: 64 });
		expect(fitSvg(attrs('2em', '1em', '0 0 30 10'), 64)).toEqual({ width: 64, height: 21 });
	});
});
