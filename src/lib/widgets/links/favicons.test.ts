import { describe, expect, it } from 'vitest';
import { isFresh, pickFavicon } from './favicons.svelte';
import { webOrigin } from './link-utils';

describe('Favicons', () => {
	it('kennt nur Origins von http(s)-Links', () => {
		expect(webOrigin('https://github.com/a/b?c')).toBe('https://github.com');
		expect(webOrigin('http://homeassistant.local:8123/lovelace')).toBe(
			'http://homeassistant.local:8123'
		);
		expect(webOrigin('obsidian://open?vault=x')).toBeNull();
		expect(webOrigin('kaputt')).toBeNull();
	});

	it('nimmt das erste ausreichend große Icon, sonst das größte', () => {
		const touch = { src: '/apple-touch-icon.png', size: 180 };
		const ico = { src: '/favicon.ico', size: 16 };
		const ico32 = { src: '/favicon.ico', size: 32 };
		expect(pickFavicon([touch, null, ico])).toEqual(touch);
		expect(pickFavicon([null, null, ico32])).toEqual(ico32);
		expect(pickFavicon([{ src: '/apple-touch-icon.png', size: 20 }, null, ico])).toEqual({
			src: '/apple-touch-icon.png',
			size: 20
		});
		expect(pickFavicon([null, null, null])).toBeNull();
	});

	it('merkt sich Gefundenes länger als „keins gefunden“', () => {
		const day = 24 * 60 * 60 * 1000;
		const now = 100 * day;
		const found = { icon: { src: 'x', size: 32 }, checked: now - 10 * day };
		const missing = { icon: null, checked: now - 2 * day };
		expect(isFresh(found, now)).toBe(true);
		expect(isFresh({ ...found, checked: now - 40 * day }, now)).toBe(false);
		expect(isFresh(missing, now)).toBe(false);
		expect(isFresh({ ...missing, checked: now - day / 2 }, now)).toBe(true);
	});
});
