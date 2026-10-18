import { isRecord } from '$lib/config/parse';
import { firstHtmlImage, itemImage } from './image';
import {
	collapse,
	hash,
	imageUrl,
	maybeHtmlToText,
	parseFeedDate,
	safeUrl,
	toPlainText,
	truncate
} from './text';

/**
 * Liest RSS 2.0, RSS 1.0 (RDF), Atom 1.0 (auch 0.3) und JSON Feed 1.x. Das Ergebnis enthält nur
 * noch reinen Text und geprüfte http(s)-Adressen; nichts davon ist HTML. Wirft nie.
 */

export const MAX_ITEMS = 50;
export const TITLE_MAX = 300;
export const SUMMARY_MAX = 280;
export const FEED_TITLE_MAX = 200;
const ID_MAX = 500;

export type FeedItem = {
	/** Stabil über Abrufe hinweg: guid/id, sonst Link, sonst Hash */
	id: string;
	title: string;
	/** Nur http(s); `null` = nicht klickbar */
	url: string | null;
	/** ms seit Epoche */
	published: number | null;
	summary: string;
	/** https-Adresse des Titelbilds */
	image: string | null;
};

export type ParsedFeed = {
	title: string;
	/** Website des Feeds, z. B. für das Favicon */
	siteUrl: string | null;
	language: string | null;
	/** In der Reihenfolge des Feeds, höchstens `MAX_ITEMS` */
	items: FeedItem[];
};

export type ParseResult =
	| { kind: 'feed'; feed: ParsedFeed }
	/** Eine Webseite statt eines Feeds; dann hilft die Feed-Suche */
	| { kind: 'html' }
	| { kind: 'invalid' };

const ATOM_NS = 'http://www.w3.org/2005/Atom';
const ATOM03_NS = 'http://purl.org/atom/ns#';
const RSS1_NS = 'http://purl.org/rss/1.0/';
const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const DC_NS = 'http://purl.org/dc/elements/1.1/';
const CONTENT_NS = 'http://purl.org/rss/1.0/modules/content/';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';

// --- Hilfen ------------------------------------------------------------------------------------

/** Erstes Kind mit diesem Namen; `ns` `undefined` = beliebiger Namensraum, `null` = keiner */
function child(parent: Element | null, name: string, ns?: string | null): Element | null {
	if (!parent) return null;
	for (const element of parent.children) {
		if (element.localName === name && (ns === undefined || element.namespaceURI === ns))
			return element;
	}
	return null;
}

function children(parent: Element | null, name: string, ns?: string | null): Element[] {
	if (!parent) return [];
	return [...parent.children].filter(
		(element) => element.localName === name && (ns === undefined || element.namespaceURI === ns)
	);
}

const text = (element: Element | null) => element?.textContent ?? '';

/** Basis-Adresse eines Elements: Feed-Adresse, verfeinert durch alle `xml:base` darüber */
function baseOf(element: Element, feedUrl: string): string {
	const chain: string[] = [];
	for (let node: Element | null = element; node; node = node.parentElement) {
		const base = node.getAttributeNS(XML_NS, 'base');
		if (base) chain.unshift(base);
	}
	let base = feedUrl;
	for (const value of chain) {
		try {
			base = new URL(value, base).href;
		} catch {
			// ungültige Angabe überspringen
		}
	}
	return base;
}

function language(value: string | null | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed && /^[a-z]{2,3}(-[a-z\d]{1,8})*$/i.test(trimmed) ? trimmed : null;
}

/** Nur absolute http(s)-Adressen, z. B. für eine guid, die ein Link sein kann */
const absoluteUrl = (value: string, base: string) =>
	/^https?:\/\//i.test(value.trim()) ? safeUrl(value, base) : null;

type RawItem = {
	id: string | null;
	title: string;
	url: string | null;
	published: number | null;
	summary: string;
	image: string | null;
};

function finishItem(raw: RawItem): FeedItem | null {
	const title = truncate(raw.title, TITLE_MAX);
	const summary = truncate(raw.summary, SUMMARY_MAX);
	if (!title && !raw.url && !summary) return null;
	const id = raw.id?.trim() || raw.url || `h${hash(`${title}|${raw.published ?? ''}|${summary}`)}`;
	return {
		id: id.slice(0, ID_MAX),
		title,
		url: raw.url,
		published: raw.published,
		summary,
		image: raw.image
	};
}

function finishFeed(
	title: string,
	siteUrl: string | null,
	lang: string | null,
	raws: RawItem[]
): ParsedFeed {
	const items: FeedItem[] = [];
	const seen = new Set<string>();
	for (const raw of raws) {
		const item = finishItem(raw);
		if (!item || seen.has(item.id)) continue;
		seen.add(item.id);
		items.push(item);
		if (items.length >= MAX_ITEMS) break;
	}
	return { title: truncate(title, FEED_TITLE_MAX), siteUrl, language: lang, items };
}

// --- RSS 2.0 und 1.0 ---------------------------------------------------------------------------

function parseRss(root: Element, feedUrl: string, rdf: boolean): ParsedFeed {
	// RSS 2.0 hat keinen Namensraum, RSS 1.0 seinen eigenen; Einträge stehen dort neben `channel`
	const ns = rdf ? RSS1_NS : null;
	const channel = child(root, 'channel', ns) ?? child(root, 'channel');
	const entries = rdf ? children(root, 'item', ns) : children(channel, 'item', ns);

	const raws = entries.map((item): RawItem => {
		const base = baseOf(item, feedUrl);
		const guid = child(item, 'guid', ns);
		const permalink = guid && guid.getAttribute('isPermaLink') !== 'false' ? text(guid) : '';
		const description = text(child(item, 'description', ns));
		const encoded = text(child(item, 'encoded', CONTENT_NS));
		return {
			id: rdf ? item.getAttributeNS(RDF_NS, 'about') : text(guid),
			title: maybeHtmlToText(text(child(item, 'title', ns))),
			url: safeUrl(text(child(item, 'link', ns)), base) ?? absoluteUrl(permalink, base),
			published:
				parseFeedDate(text(child(item, 'pubDate', ns))) ??
				parseFeedDate(text(child(item, 'date', DC_NS))),
			summary: toPlainText(description || encoded),
			image: itemImage(item, base, [encoded, description])
		};
	});

	return finishFeed(
		maybeHtmlToText(text(child(channel, 'title', ns))),
		safeUrl(text(child(channel, 'link', ns)), feedUrl),
		language(text(child(channel, 'language', ns)) || text(child(channel, 'language', DC_NS))),
		raws
	);
}

// --- Atom --------------------------------------------------------------------------------------

/** Ohne Skripte und Styles, deren Inhalt sonst als Text erschiene */
function xhtmlText(element: Element): string {
	const copy = element.cloneNode(true) as Element;
	for (const node of [...copy.getElementsByTagName('*')]) {
		if (node.localName === 'script' || node.localName === 'style') node.remove();
	}
	return collapse(copy.textContent ?? '');
}

/** Atom-Textkonstrukt (`type` = text, html oder xhtml) als reiner Text */
function atomText(element: Element | null): string {
	if (!element) return '';
	const type = element.getAttribute('type');
	if (type === 'html' || type === 'text/html') return toPlainText(text(element));
	if (type === 'xhtml' || type === 'application/xhtml+xml') return xhtmlText(element);
	return collapse(text(element));
}

/** Atom-Inhalt als HTML-Text, nur um darin ein Bild zu finden */
function atomHtml(element: Element | null): string | null {
	if (!element) return null;
	const type = element.getAttribute('type');
	if (type === 'html' || type === 'text/html') return text(element);
	if (type === 'xhtml' || type === 'application/xhtml+xml')
		return new XMLSerializer().serializeToString(element);
	return null;
}

/** Link zur Seite: `rel="alternate"` (oder ohne `rel`), bevorzugt HTML */
function atomLink(parent: Element, ns: string, feedUrl: string): string | null {
	const links = children(parent, 'link', ns).filter((link) => {
		const rel = link.getAttribute('rel');
		return !rel || rel === 'alternate';
	});
	const html = links.find((link) => /html/i.test(link.getAttribute('type') ?? 'text/html'));
	const link = html ?? links[0];
	return link ? safeUrl(link.getAttribute('href'), baseOf(link, feedUrl)) : null;
}

function parseAtom(root: Element, feedUrl: string): ParsedFeed {
	const ns = root.namespaceURI ?? ATOM_NS;
	const raws = children(root, 'entry', ns).map((entry): RawItem => {
		const summary = child(entry, 'summary', ns);
		const content = child(entry, 'content', ns);
		const date = ['published', 'updated', 'issued', 'modified']
			.map((name) => parseFeedDate(text(child(entry, name, ns))))
			.find((value) => value !== null);
		return {
			id: text(child(entry, 'id', ns)),
			title: atomText(child(entry, 'title', ns)),
			url: atomLink(entry, ns, feedUrl),
			published: date ?? null,
			summary: atomText(summary ?? content),
			image: itemImage(entry, baseOf(entry, feedUrl), [atomHtml(content), atomHtml(summary)])
		};
	});
	return finishFeed(
		atomText(child(root, 'title', ns)),
		atomLink(root, ns, feedUrl),
		language(root.getAttributeNS(XML_NS, 'lang')),
		raws
	);
}

// --- JSON Feed ---------------------------------------------------------------------------------

const string = (value: unknown) => (typeof value === 'string' ? value : '');

function parseJsonFeed(data: Record<string, unknown>, feedUrl: string): ParsedFeed {
	const items = Array.isArray(data.items) ? data.items : [];
	const raws = items.filter(isRecord).map((item): RawItem => {
		const html = string(item.content_html);
		const summary = string(item.summary) || string(item.content_text);
		return {
			id: typeof item.id === 'number' ? String(item.id) : string(item.id),
			title: maybeHtmlToText(string(item.title)),
			url: safeUrl(string(item.url), feedUrl) ?? safeUrl(string(item.external_url), feedUrl),
			published:
				parseFeedDate(string(item.date_published)) ?? parseFeedDate(string(item.date_modified)),
			summary: summary ? collapse(summary) : toPlainText(html),
			image:
				imageUrl(string(item.image), feedUrl) ??
				imageUrl(string(item.banner_image), feedUrl) ??
				firstHtmlImage(html, feedUrl)
		};
	});
	return finishFeed(
		collapse(string(data.title)),
		safeUrl(string(data.home_page_url), feedUrl),
		language(string(data.language)),
		raws
	);
}

// --- Einstieg ----------------------------------------------------------------------------------

const looksLikeHtml = (body: string) => /<!doctype html|<html[\s>]/i.test(body.slice(0, 2048));

/**
 * Liest einen abgerufenen Inhalt. `feedUrl` ist die endgültige Adresse und dient als Basis für
 * relative Links.
 */
export function parseFeed(body: string, feedUrl: string): ParseResult {
	try {
		const trimmed = body.trim();
		if (trimmed.startsWith('{')) {
			let data: unknown;
			try {
				data = JSON.parse(trimmed);
			} catch {
				return { kind: 'invalid' };
			}
			if (isRecord(data) && string(data.version).startsWith('https://jsonfeed.org/version/'))
				return { kind: 'feed', feed: parseJsonFeed(data, feedUrl) };
			return { kind: 'invalid' };
		}

		const doc = new DOMParser().parseFromString(trimmed, 'application/xml');
		const root = doc.documentElement;
		if (!root || doc.getElementsByTagName('parsererror').length > 0) {
			return looksLikeHtml(trimmed) ? { kind: 'html' } : { kind: 'invalid' };
		}
		switch (root.localName) {
			case 'rss':
				return { kind: 'feed', feed: parseRss(root, feedUrl, false) };
			case 'RDF':
				return { kind: 'feed', feed: parseRss(root, feedUrl, true) };
			case 'feed':
				if (root.namespaceURI === ATOM_NS || root.namespaceURI === ATOM03_NS)
					return { kind: 'feed', feed: parseAtom(root, feedUrl) };
				return { kind: 'invalid' };
			case 'html':
				return { kind: 'html' };
			default:
				return { kind: 'invalid' };
		}
	} catch (error) {
		console.warn('Feed nicht lesbar', error);
		return { kind: 'invalid' };
	}
}
