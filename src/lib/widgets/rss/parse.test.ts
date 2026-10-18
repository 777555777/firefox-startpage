// @vitest-environment jsdom
// Der Parser nutzt `DOMParser`, den es im Browser gibt, in Node aber nicht.
import { describe, expect, it } from 'vitest';
import { findFeedLinks } from './discover';
import atom from './fixtures/atom.xml?raw';
import json from './fixtures/feed.json?raw';
import rss1 from './fixtures/rss1.rdf?raw';
import rss2 from './fixtures/rss2.xml?raw';
import { pickBySize } from './image';
import { MAX_ITEMS, parseFeed, type ParsedFeed } from './parse';
import {
	hash,
	imageUrl,
	maybeHtmlToText,
	parseFeedDate,
	safeUrl,
	toPlainText,
	truncate
} from './text';

const fixtures: Record<string, string> = {
	'rss2.xml': rss2,
	'rss1.rdf': rss1,
	'atom.xml': atom,
	'feed.json': json
};
const fixture = (name: string) => fixtures[name];

function feed(body: string, url: string): ParsedFeed {
	const result = parseFeed(body, url);
	if (result.kind !== 'feed') throw new Error(`kein Feed: ${result.kind}`);
	return result.feed;
}

const rssWith = (items: string) =>
	`<?xml version="1.0"?><rss version="2.0"><channel><title>T</title>${items}</channel></rss>`;

describe('Text aus Feeds', () => {
	it('macht aus HTML reinen Text ohne Skripte', () => {
		expect(
			toPlainText('<p>Eins</p><p>Zwei<br>Drei</p><script>x()</script><style>p{}</style>')
		).toBe('Eins Zwei Drei');
		expect(toPlainText('Fish &amp; Chips &#8211; lecker')).toBe('Fish & Chips – lecker');
		expect(toPlainText('<img src=x onerror="alert(1)">Bild')).toBe('Bild');
	});

	it('liest Titel nur als HTML, wenn sie danach aussehen', () => {
		expect(maybeHtmlToText('a < b und c > d')).toBe('a < b und c > d');
		expect(maybeHtmlToText('Das <em>neue</em> Ding')).toBe('Das neue Ding');
		expect(maybeHtmlToText('Tom &amp; Jerry')).toBe('Tom & Jerry');
	});

	it('kürzt an Wortgrenzen', () => {
		expect(truncate('kurz', 10)).toBe('kurz');
		expect(truncate('Ein ziemlich langer Satz mit vielen Wörtern', 20)).toBe(
			'Ein ziemlich langer…'
		);
		expect(truncate('Donaudampfschifffahrtsgesellschaft', 10)).toBe('Donaudamp…');
		// Emoji werden nicht zerteilt
		expect(truncate('😀😀😀😀😀', 3)).toBe('😀😀…');
	});

	it('erlaubt nur http(s)-Adressen und hebt Bilder auf https', () => {
		const base = 'https://example.org/feed/';
		expect(safeUrl('../a', base)).toBe('https://example.org/a');
		expect(safeUrl('http://example.org/x', base)).toBe('http://example.org/x');
		expect(safeUrl('javascript:alert(1)', base)).toBeNull();
		expect(safeUrl(' data:text/html,x', base)).toBeNull();
		expect(safeUrl('', base)).toBeNull();
		expect(imageUrl('http://cdn.example.org/a.jpg', base)).toBe('https://cdn.example.org/a.jpg');
		expect(imageUrl('data:image/png;base64,AAAA', base)).toBeNull();
		expect(imageUrl('//cdn.example.org/b.jpg', base)).toBe('https://cdn.example.org/b.jpg');
	});

	it('liest Datumsangaben aus RSS, Atom und Abweichungen davon', () => {
		const utc = (...args: [number, number, number, number, number]) => Date.UTC(...args);
		expect(parseFeedDate('Sun, 18 Oct 2026 14:30:00 +0200')).toBe(utc(2026, 9, 18, 12, 30));
		expect(parseFeedDate('Sun, 18 Oct 2026 14:30:00 CEST')).toBe(utc(2026, 9, 18, 12, 30));
		expect(parseFeedDate('18 Okt 2026 14:30 MESZ')).toBe(utc(2026, 9, 18, 12, 30));
		expect(parseFeedDate('Tue, 10 Jun 03 04:00:00 EST')).toBe(utc(2003, 5, 10, 9, 0));
		expect(parseFeedDate('Sun, 18 October 2026 14:30:00 GMT')).toBe(utc(2026, 9, 18, 14, 30));
		expect(parseFeedDate('Sun, 18 Oct 2026 14:30:00 +02:00')).toBe(utc(2026, 9, 18, 12, 30));
		expect(parseFeedDate('2026-10-18T12:00:00Z')).toBe(utc(2026, 9, 18, 12, 0));
		expect(parseFeedDate('2026-10-18T14:00:00+02:00')).toBe(utc(2026, 9, 18, 12, 0));
		expect(parseFeedDate('Sun, 18 Foo 2026 14:30:00 GMT')).toBeNull();
		expect(parseFeedDate('irgendwann')).toBeNull();
		expect(parseFeedDate('')).toBeNull();
		expect(parseFeedDate(null)).toBeNull();
	});

	it('hasht stabil', () => {
		expect(hash('abc')).toBe(hash('abc'));
		expect(hash('abc')).not.toBe(hash('abd'));
		expect(hash('')).toMatch(/^[\da-f]{8}$/);
	});
});

describe('Titelbilder', () => {
	it('wählt die kleinste ausreichend große Variante, sonst die größte', () => {
		const c = (url: string, width: number | null) => ({ url, width });
		expect(pickBySize([c('a', 100), c('b', 1200), c('c', 300)])).toBe('c');
		expect(pickBySize([c('a', 100), c('b', 120)])).toBe('b');
		expect(pickBySize([c('a', null), c('b', null)])).toBe('a');
		expect(pickBySize([c('a', null), c('b', 50)])).toBe('b');
		expect(pickBySize([])).toBeNull();
	});
});

describe('RSS 2.0', () => {
	const result = feed(fixture('rss2.xml'), 'https://example.org/feed.xml');

	it('liest Kanal und Sprache', () => {
		expect(result.title).toBe('Beispiel & Söhne');
		expect(result.siteUrl).toBe('https://example.org/');
		expect(result.language).toBe('de-DE');
	});

	it('liest Einträge als reinen Text mit sicheren Adressen', () => {
		expect(result.items).toHaveLength(4);
		expect(result.items[0]).toEqual({
			id: 'post-1',
			title: 'Grüße aus Köln',
			url: 'https://example.org/artikel/1',
			published: Date.UTC(2026, 9, 18, 12, 30),
			summary: 'Erster Absatz. Zweiter Absatz mit Link.',
			image: 'https://cdn.example.org/1-medium.jpg'
		});
	});

	it('nutzt eine guid als Link und content:encoded als Text', () => {
		expect(result.items[1]).toEqual({
			id: 'https://example.org/artikel/2',
			title: 'a < b ist wahr',
			url: 'https://example.org/artikel/2',
			published: Date.UTC(2026, 9, 17, 8),
			summary: 'Text',
			// Das Zählpixel wird übersprungen
			image: 'https://example.org/bilder/2.png'
		});
	});

	it('verwirft gefährliche Links und hebt Bild-Enclosures auf https', () => {
		const item = result.items[2];
		expect(item.url).toBeNull();
		expect(item.id).toMatch(/^h[\da-f]{8}$/);
		expect(item.image).toBe('https://cdn.example.org/3.jpg');
	});

	it('behält Einträge mit Text, aber ohne Titel, und verwirft ganz leere', () => {
		expect(result.items[3]).toMatchObject({ title: '', summary: 'Eintrag ohne Titel und Link' });
	});

	it('entfernt doppelte Einträge und begrenzt die Anzahl', () => {
		const items = Array.from(
			{ length: 60 },
			(_, i) => `<item><title>Nr. ${i}</title><guid>id-${i % 55}</guid></item>`
		).join('');
		const parsed = feed(rssWith(items), 'https://example.org/');
		expect(parsed.items).toHaveLength(MAX_ITEMS);
		expect(new Set(parsed.items.map((item) => item.id)).size).toBe(MAX_ITEMS);
	});

	it('kürzt sehr lange Felder', () => {
		const long = 'Wort '.repeat(200);
		const parsed = feed(
			rssWith(`<item><title>${long}</title><description>${long}</description></item>`),
			'https://example.org/'
		);
		expect(parsed.items[0].title.length).toBeLessThanOrEqual(300);
		expect(parsed.items[0].summary.length).toBeLessThanOrEqual(280);
		expect(parsed.items[0].summary.endsWith('…')).toBe(true);
	});
});

describe('RSS 1.0', () => {
	it('liest Kanal und Einträge neben dem Kanal', () => {
		const result = feed(fixture('rss1.rdf'), 'https://example.net/index.rdf');
		expect(result).toMatchObject({ title: 'RDF-Beispiel', language: 'en' });
		expect(result.items.map((item) => item.id)).toEqual([
			'https://example.net/a',
			'https://example.net/b'
		]);
		expect(result.items[0]).toMatchObject({
			url: 'https://example.net/a',
			published: Date.UTC(2026, 9, 18, 8),
			summary: 'Kurzer Text',
			image: null
		});
	});
});

describe('Atom', () => {
	const result = feed(fixture('atom.xml'), 'https://blog.example.com/atom.xml');

	it('liest Textkonstrukte, Sprache und den Link zur Seite', () => {
		expect(result.title).toBe('Blog Beispiel');
		expect(result.siteUrl).toBe('https://blog.example.com/');
		expect(result.language).toBe('en-GB');
	});

	it('löst Links über xml:base auf und nimmt Bild-Enclosures', () => {
		expect(result.items[0]).toEqual({
			id: 'tag:blog.example.com,2026:1',
			title: 'Atom-Eintrag',
			url: 'https://blog.example.com/posts/atom-1',
			published: Date.UTC(2026, 9, 18, 9),
			summary: 'Zusammenfassung',
			image: 'https://blog.example.com/img/1.png'
		});
	});

	it('liest XHTML ohne Skripte und findet Bilder darin', () => {
		expect(result.items[1]).toEqual({
			id: 'tag:blog.example.com,2026:2',
			title: 'XHTML Titel',
			url: 'https://other.example.com/sub/seite',
			published: Date.UTC(2026, 9, 16, 9),
			summary: 'Inhalt mit Bild',
			image: 'https://other.example.com/sub/bild.webp'
		});
	});
});

describe('JSON Feed', () => {
	it('liest Felder, Ersatzfelder und Bilder', () => {
		const result = feed(fixture('feed.json'), 'https://json.example.org/feed.json');
		expect(result).toMatchObject({
			title: 'JSON-Beispiel',
			siteUrl: 'https://json.example.org/',
			language: 'fr'
		});
		expect(result.items).toEqual([
			{
				id: '42',
				title: 'Erster JSON-Eintrag',
				url: 'https://json.example.org/1',
				published: Date.UTC(2026, 9, 18, 9),
				summary: 'Kurz und knapp',
				image: 'https://json.example.org/1.jpg'
			},
			{
				id: 'zwei',
				title: '',
				url: 'https://anderswo.example.org/2',
				published: Date.UTC(2026, 9, 10, 9),
				summary: 'Nur HTML',
				image: 'https://json.example.org/2.jpg'
			}
		]);
	});
});

describe('Kein Feed', () => {
	const url = 'https://example.org/';

	it('erkennt Webseiten für die Feed-Suche', () => {
		expect(parseFeed('<!DOCTYPE html><html><head><link rel=x></head></html>', url)).toEqual({
			kind: 'html'
		});
		expect(
			parseFeed('<html xmlns="http://www.w3.org/1999/xhtml"><head/><body/></html>', url)
		).toEqual({ kind: 'html' });
	});

	it('lehnt kaputtes und fremdes XML sowie anderes JSON ab, ohne zu werfen', () => {
		expect(parseFeed('<rss><channel><item></rss>', url)).toEqual({ kind: 'invalid' });
		expect(parseFeed('<?xml version="1.0"?><note>hallo</note>', url)).toEqual({ kind: 'invalid' });
		expect(parseFeed('<feed><title>ohne Namensraum</title></feed>', url)).toEqual({
			kind: 'invalid'
		});
		expect(parseFeed('{"version": "1", "items": []}', url)).toEqual({ kind: 'invalid' });
		expect(parseFeed('{kaputt', url)).toEqual({ kind: 'invalid' });
		expect(parseFeed('', url)).toEqual({ kind: 'invalid' });
	});

	it('liest leere Feeds', () => {
		expect(feed(rssWith(''), url)).toEqual({
			title: 'T',
			siteUrl: null,
			language: null,
			items: []
		});
	});
});

describe('Feed-Suche', () => {
	it('findet ausgewiesene Feeds und löst sie relativ zu <base> auf', () => {
		const html = `<!doctype html><html><head>
			<base href="https://www.example.org/blog/">
			<link rel="alternate" type="application/rss+xml" title="Beiträge" href="feed/">
			<link rel="alternate" type="application/atom+xml" href="/atom.xml">
			<link rel="ALTERNATE" type="application/feed+json; charset=utf-8" title="JSON Feed" href="feed.json">
			<link rel="alternate" type="application/json" title="REST-API" href="/wp-json/">
			<link rel="alternate" type="application/rss+xml" href="feed/">
			<link rel="stylesheet" type="text/css" href="style.css">
			<link rel="alternate" type="application/rss+xml" href="javascript:alert(1)">
		</head><body></body></html>`;
		expect(findFeedLinks(html, 'https://www.example.org/')).toEqual([
			{ url: 'https://www.example.org/blog/feed/', title: 'Beiträge', format: 'rss' },
			{ url: 'https://www.example.org/atom.xml', title: '', format: 'atom' },
			{ url: 'https://www.example.org/blog/feed.json', title: 'JSON Feed', format: 'json' }
		]);
	});

	it('liefert eine leere Liste ohne Feeds', () => {
		expect(findFeedLinks('<p>nichts</p>', 'https://example.org/')).toEqual([]);
	});
});
