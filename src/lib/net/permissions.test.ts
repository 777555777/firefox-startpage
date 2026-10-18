import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeFeedUrl } from './feed-url';
import {
	missingAccess,
	originPattern,
	patternsFor,
	releaseUnusedAccess,
	requestAccess,
	unusedPatterns
} from './permissions';

describe('Feed-Adressen', () => {
	it('ergänzt https und hebt http an', () => {
		expect(normalizeFeedUrl(' heise.de/rss ')).toEqual({
			url: 'https://heise.de/rss',
			upgraded: false
		});
		expect(normalizeFeedUrl('http://example.org/feed.xml#x')).toEqual({
			url: 'https://example.org/feed.xml',
			upgraded: true
		});
	});

	it('lehnt nicht abrufbare Adressen ab', () => {
		expect(normalizeFeedUrl('')).toBeNull();
		expect(normalizeFeedUrl('javascript:alert(1)')).toBeNull();
		expect(normalizeFeedUrl('ftp://example.org/feed')).toBeNull();
		expect(normalizeFeedUrl('https://user:pass@example.org/feed')).toBeNull();
		expect(normalizeFeedUrl('https://')).toBeNull();
	});
});

describe('Muster für Host-Rechte', () => {
	it('deckt die Domain samt Subdomains ab und entfernt www', () => {
		expect(originPattern('https://www.heise.de/rss/heise.rdf')).toBe('https://*.heise.de/*');
		expect(originPattern('https://feeds.example.org/a')).toBe('https://*.feeds.example.org/*');
		expect(originPattern('https://example.org:8443/a')).toBe('https://*.example.org/*');
		// „www.com“ ist selbst die Domain
		expect(originPattern('https://www.com/feed')).toBe('https://*.www.com/*');
	});

	it('nutzt für IP-Adressen und lokale Namen kein Platzhalter-Muster', () => {
		expect(originPattern('https://192.168.1.5/feed')).toBe('https://192.168.1.5/*');
		expect(originPattern('https://[::1]/feed')).toBe('https://[::1]/*');
		expect(originPattern('https://localhost:8080/feed')).toBe('https://localhost/*');
	});

	it('kennt nur https', () => {
		expect(originPattern('http://example.org/')).toBeNull();
		expect(originPattern('kaputt')).toBeNull();
	});

	it('fasst Muster zusammen und findet nicht mehr gebrauchte', () => {
		const needed = patternsFor([
			'https://www.heise.de/a',
			'https://heise.de/b',
			'https://golem.de/rss'
		]);
		expect(needed).toEqual(['https://*.golem.de/*', 'https://*.heise.de/*']);
		expect(unusedPatterns(['https://*.heise.de/*', 'https://*.alt.de/*'], needed)).toEqual([
			'https://*.alt.de/*'
		]);
	});
});

describe('Host-Rechte in der Extension', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function stubBrowser(granted: string[]) {
		const permissions = {
			contains: vi.fn(async ({ origins }: { origins: string[] }) =>
				origins.every((origin) => granted.includes(origin))
			),
			request: vi.fn(async () => true),
			getAll: vi.fn(async () => ({ origins: [...granted] })),
			remove: vi.fn(async () => true)
		};
		vi.stubGlobal('browser', { runtime: { id: 'test' }, permissions });
		return permissions;
	}

	it('gilt außerhalb der Extension als erlaubt', async () => {
		expect(await missingAccess(['https://*.example.org/*'])).toEqual([]);
		expect(await requestAccess(['https://*.example.org/*'])).toBe(true);
		expect(await releaseUnusedAccess([])).toEqual([]);
	});

	it('meldet fehlende Rechte und fragt sie synchron an', async () => {
		const permissions = stubBrowser(['https://*.a.de/*']);
		expect(await missingAccess(['https://*.a.de/*', 'https://*.b.de/*'])).toEqual([
			'https://*.b.de/*'
		]);
		const pending = requestAccess(['https://*.b.de/*']);
		// Der API-Aufruf passiert, bevor die Funktion etwas abwartet
		expect(permissions.request).toHaveBeenCalledWith({ origins: ['https://*.b.de/*'] });
		expect(await pending).toBe(true);
	});

	it('gibt nur nicht mehr gebrauchte Rechte ab', async () => {
		const permissions = stubBrowser(['https://*.a.de/*', 'https://*.b.de/*']);
		expect(await releaseUnusedAccess(['https://*.a.de/*'])).toEqual(['https://*.b.de/*']);
		expect(permissions.remove).toHaveBeenCalledWith({ origins: ['https://*.b.de/*'] });
	});
});
