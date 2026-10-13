import { describe, expect, it } from 'vitest';
import { defaultEngines } from '$lib/config/defaults';
import { parseBang, searchUrl } from './bangs';
import { fuzzyScore, searchLinks, type LinkCandidate } from './fuzzy';

const engines = defaultEngines();
const byId = (id: string) => engines.find((e) => e.id === id);

describe('parseBang', () => {
	it('erkennt Bangs am Anfang und am Ende', () => {
		expect(parseBang('!gh svelte', engines)).toEqual({ engine: byId('github'), query: 'svelte' });
		expect(parseBang('svelte runes !gh', engines)).toEqual({
			engine: byId('github'),
			query: 'svelte runes'
		});
	});

	it('ignoriert Groß-/Kleinschreibung und Leerraum', () => {
		expect(parseBang('  !MDN   fetch  ', engines)).toEqual({ engine: byId('mdn'), query: 'fetch' });
	});

	it('behandelt unbekannte Bangs als Suchtext', () => {
		expect(parseBang('!xyz svelte', engines)).toEqual({ engine: null, query: '!xyz svelte' });
		expect(parseBang('svelte !', engines)).toEqual({ engine: null, query: 'svelte !' });
	});

	it('erkennt Bangs nur am Anfang oder Ende', () => {
		expect(parseBang('a !gh b', engines)).toEqual({ engine: null, query: 'a !gh b' });
	});

	it('erlaubt einen Bang ohne Suchtext', () => {
		expect(parseBang('!yt', engines)).toEqual({ engine: byId('youtube'), query: '' });
	});

	it('nutzt keine Engines ohne Bang', () => {
		const custom = [{ ...engines[0], bang: '' }];
		expect(parseBang('! test', custom).engine).toBeNull();
	});
});

describe('searchUrl', () => {
	it('kodiert den Suchtext', () => {
		expect(searchUrl(byId('duckduckgo')!, 'a&b c')).toBe('https://duckduckgo.com/?q=a%26b%20c');
	});

	it('öffnet ohne Suchtext die Startseite der Engine', () => {
		expect(searchUrl(byId('youtube')!, '  ')).toBe('https://www.youtube.com');
	});
});

describe('fuzzyScore', () => {
	it('bewertet Präfixe höher als Teilstrings und Teilstrings höher als Teilfolgen', () => {
		const prefix = fuzzyScore('git', 'GitHub')!;
		const inner = fuzzyScore('hub', 'GitHub')!;
		const subsequence = fuzzyScore('gthb', 'GitHub')!;
		expect(prefix).toBeGreaterThan(inner);
		expect(inner).toBeGreaterThan(subsequence);
	});

	it('findet nichts, wenn Buchstaben fehlen oder zu verstreut sind', () => {
		expect(fuzzyScore('xyz', 'GitHub')).toBeNull();
		expect(fuzzyScore('gb', 'a long string without the letters g and b close')).toBeNull();
	});

	it('ignoriert Akzente', () => {
		expect(fuzzyScore('cafe', 'Café Central')).not.toBeNull();
	});
});

describe('searchLinks', () => {
	const links: LinkCandidate[] = [
		{ id: '1', label: 'GitHub', url: 'https://github.com', host: 'github.com' },
		{ id: '2', label: 'GitLab', url: 'https://gitlab.com', host: 'gitlab.com' },
		{ id: '3', label: 'Arbeit', url: 'https://intranet.firma.de', host: 'intranet.firma.de' },
		{ id: '4', label: 'MDN', url: 'https://developer.mozilla.org', host: 'developer.mozilla.org' },
		{ id: '5', label: 'GitHub (Kopie)', url: 'https://github.com', host: 'github.com' }
	];

	it('findet über Label und Host', () => {
		expect(searchLinks('mozilla', links, {}).map((l) => l.id)).toEqual(['4']);
		expect(searchLinks('firma', links, {}).map((l) => l.id)).toEqual(['3']);
	});

	it('zeigt gleiche URLs nur einmal', () => {
		expect(searchLinks('github', links, {}).map((l) => l.id)).toEqual(['1']);
	});

	it('gewichtet mit der Klick-Statistik', () => {
		expect(searchLinks('git', links, {}).map((l) => l.id)).toEqual(['1', '2']);
		const stats = { 'https://gitlab.com': { count: 30, lastOpened: 0 } };
		expect(searchLinks('git', links, stats).map((l) => l.id)).toEqual(['2', '1']);
	});

	it('verlangt, dass alle Wörter passen', () => {
		expect(searchLinks('git lab', links, {}).map((l) => l.id)).toEqual(['2']);
	});

	it('begrenzt die Anzahl und liefert für leere Eingaben nichts', () => {
		const many = Array.from({ length: 20 }, (_, i) => ({
			id: String(i),
			label: `Link ${i}`,
			url: `https://l${i}.de`,
			host: `l${i}.de`
		}));
		expect(searchLinks('link', many, {})).toHaveLength(5);
		expect(searchLinks('   ', many, {})).toEqual([]);
	});
});
