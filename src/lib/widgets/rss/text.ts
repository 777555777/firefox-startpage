/**
 * Hilfen, um Feed-Inhalte gefahrlos darzustellen: HTML wird schon beim Parsen zu reinem Text,
 * Links und Bilder werden auf http(s) beschränkt, Daten robust gelesen. Nichts davon wirft.
 */

/** Elemente, deren Inhalt nie Text der Seite ist */
const DROPPED = 'script, style, noscript, template, iframe, object, embed, svg, math, head';
/** Elemente, nach denen ein Leerzeichen stehen muss, damit Wörter nicht zusammenkleben */
const BLOCKS =
	'p, div, br, li, ul, ol, dt, dd, tr, td, th, h1, h2, h3, h4, h5, h6, blockquote, pre, figure, figcaption, section, article, header, footer, hr, img';

/**
 * Inertes HTML-Dokument: `DOMParser` führt keine Skripte aus und lädt keine Ressourcen. Es wird
 * nur gelesen und nie in die Page eingehängt.
 */
export function parseHtml(html: string): Document {
	return new DOMParser().parseFromString(html, 'text/html');
}

/** Fasst Leerraum zusammen */
export const collapse = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Wandelt HTML in reinen Text um */
export function toPlainText(html: string): string {
	if (!/[<&]/.test(html)) return collapse(html);
	const doc = parseHtml(html);
	for (const element of doc.querySelectorAll(DROPPED)) element.remove();
	for (const element of doc.querySelectorAll(BLOCKS)) element.after(' ');
	return collapse(doc.body?.textContent ?? '');
}

/**
 * Text, der laut Format reiner Text sein sollte, in der Praxis aber oft HTML oder Entities
 * enthält (z. B. Titel in RSS). Nur dann wird er als HTML gelesen, damit ein Titel wie
 * „a < b“ erhalten bleibt.
 */
export function maybeHtmlToText(text: string): string {
	return /<\/?[a-z][^>]*>|&(#\d+|#x[\da-f]+|[a-z]+);/i.test(text)
		? toPlainText(text)
		: collapse(text);
}

/** Kürzt an einer Wortgrenze und hängt „…“ an */
export function truncate(text: string, max: number): string {
	const chars = Array.from(text);
	if (chars.length <= max) return text;
	let cut = chars.slice(0, max - 1).join('');
	const space = cut.lastIndexOf(' ');
	if (space > max * 0.6) cut = cut.slice(0, space);
	return `${cut.replace(/[\s,;:.–-]+$/, '')}…`;
}

/** Löst eine Adresse relativ auf; erlaubt sind nur http und https */
export function safeUrl(value: string | null | undefined, base: string): string | null {
	const trimmed = value?.trim();
	if (!trimmed) return null;
	try {
		const url = new URL(trimmed, base);
		return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
	} catch {
		return null;
	}
}

/** Wie `safeUrl`, aber für Bilder: http wird zu https (die CSP hebt es ohnehin an) */
export function imageUrl(value: string | null | undefined, base: string): string | null {
	const url = safeUrl(value, base);
	return url?.startsWith('http:') ? `https:${url.slice(5)}` : url;
}

const MONTHS: Record<string, number> = {
	jan: 0,
	feb: 1,
	mar: 2,
	mär: 2,
	apr: 3,
	may: 4,
	mai: 4,
	jun: 5,
	jul: 6,
	aug: 7,
	sep: 8,
	oct: 9,
	okt: 9,
	nov: 10,
	dec: 11,
	dez: 11
};

/** Zeitzonen-Namen aus RFC 822 und gängige Abweichungen, Versatz in Stunden */
const ZONES: Record<string, number> = {
	UT: 0,
	UTC: 0,
	GMT: 0,
	Z: 0,
	EST: -5,
	EDT: -4,
	CST: -6,
	CDT: -5,
	MST: -7,
	MDT: -6,
	PST: -8,
	PDT: -7,
	CET: 1,
	CEST: 2,
	MEZ: 1,
	MESZ: 2,
	BST: 1,
	WET: 0,
	WEST: 1,
	EET: 2,
	EEST: 3
};

const RFC822 =
	/^(?:[a-zäöü]{2,},?\s+)?(\d{1,2})\.?\s+([a-zäöü]{3})[a-zäöü]*\.?\s+(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([+-]\d{2}:?\d{2}|[a-z]{1,5})?$/i;

/**
 * Liest Datumsangaben aus Feeds: RFC 822 (RSS, auch mit Zeitzonen-Namen wie `CEST` und
 * deutschen Monatsnamen) und RFC 3339/ISO 8601 (Atom, JSON Feed, `dc:date`). Unlesbares ergibt
 * `null`.
 */
export function parseFeedDate(value: string | null | undefined): number | null {
	const text = value?.trim();
	if (!text) return null;
	const match = text.match(RFC822);
	if (match) {
		const [, day, monthName, yearText, hour, minute, second = '0', zone = 'GMT'] = match;
		const month = MONTHS[monthName.toLowerCase()];
		if (month === undefined) return null;
		let year = Number(yearText);
		if (yearText.length === 2) year += year < 50 ? 2000 : 1900;
		// Versatz zu UTC in Minuten
		let offset: number;
		if (/^[+-]/.test(zone)) {
			const digits = zone.replace(':', '');
			const sign = digits[0] === '-' ? -1 : 1;
			offset = sign * (Number(digits.slice(1, 3)) * 60 + Number(digits.slice(3, 5)));
		} else {
			// Unbekannte Namen (z. B. militärische Ein-Buchstaben-Zonen) gelten als UTC
			offset = (ZONES[zone.toUpperCase()] ?? 0) * 60;
		}
		const time =
			Date.UTC(year, month, Number(day), Number(hour), Number(minute), Number(second)) -
			offset * 60_000;
		return Number.isFinite(time) ? time : null;
	}
	const time = Date.parse(text);
	return Number.isFinite(time) ? time : null;
}

/** Kurzer, stabiler Hash (FNV-1a, 32 Bit) als Ersatz-ID für Einträge ohne ID und Link */
export function hash(text: string): string {
	let value = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		value ^= text.charCodeAt(i);
		value = Math.imul(value, 0x01000193);
	}
	return (value >>> 0).toString(16).padStart(8, '0');
}
