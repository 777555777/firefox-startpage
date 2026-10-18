import { imageUrl, parseHtml } from './text';

/**
 * Titelbild eines Eintrags. Es wird beim Parsen immer ermittelt (nur die URL), damit das
 * Einschalten der Bilder im Widget sofort wirkt. Geladen wird es erst in der Oberfläche.
 */

export const MEDIA_NS = 'http://search.yahoo.com/mrss/';
export const ITUNES_NS = 'http://www.itunes.com/dtds/podcast-1.0.dtd';

/** Ab dieser Breite ist ein Bild scharf genug für die Vorschau (72 px bei doppelter Dichte) */
const PREFERRED_WIDTH = 144;

type Candidate = { url: string; width: number | null };

/**
 * Wählt aus mehreren Größen: die kleinste mit mindestens `PREFERRED_WIDTH`, sonst die größte.
 * Ohne Größenangaben gewinnt die erste.
 */
export function pickBySize(candidates: Candidate[]): string | null {
	const sized = candidates.filter((c): c is { url: string; width: number } => c.width !== null);
	const large = sized.filter((c) => c.width >= PREFERRED_WIDTH).sort((a, b) => a.width - b.width);
	if (large.length > 0) return large[0].url;
	if (sized.length > 0) return sized.sort((a, b) => b.width - a.width)[0].url;
	return candidates[0]?.url ?? null;
}

const width = (element: Element): number | null => {
	const value = Number(element.getAttribute('width'));
	return Number.isFinite(value) && value > 0 ? value : null;
};

const isImageType = (type: string | null) => !!type && /^image\//i.test(type.trim());

/** Erstes brauchbares `<img>` aus HTML-Inhalt; winzige Bilder sind meist Zählpixel */
export function firstHtmlImage(html: string | null, base: string): string | null {
	if (!html || !/<img/i.test(html)) return null;
	for (const img of parseHtml(html).querySelectorAll('img')) {
		const tiny = ['width', 'height'].some((name) => {
			const value = img.getAttribute(name);
			return value !== null && Number.parseFloat(value) <= 2;
		});
		if (tiny) continue;
		const url = imageUrl(img.getAttribute('src'), base);
		if (url) return url;
	}
	return null;
}

/**
 * Bild eines Eintrags in RSS oder Atom, in dieser Reihenfolge: `media:thumbnail`, Bilder in
 * `media:content`, Bild-Enclosure (RSS `enclosure` bzw. Atom `link rel="enclosure"`),
 * `itunes:image`, zuletzt das erste `<img>` aus dem HTML-Inhalt.
 */
export function itemImage(item: Element, base: string, html: (string | null)[]): string | null {
	const resolve = (candidates: Candidate[]) =>
		pickBySize(
			candidates
				.map((c) => ({ ...c, url: imageUrl(c.url, base) }))
				.filter((c): c is Candidate => c.url !== null)
		);

	const thumbnails = [...item.getElementsByTagNameNS(MEDIA_NS, 'thumbnail')].map((element) => ({
		url: element.getAttribute('url') ?? '',
		width: width(element)
	}));
	const thumbnail = resolve(thumbnails);
	if (thumbnail) return thumbnail;

	const contents = [...item.getElementsByTagNameNS(MEDIA_NS, 'content')]
		.filter(
			(element) =>
				element.getAttribute('medium') === 'image' || isImageType(element.getAttribute('type'))
		)
		.map((element) => ({ url: element.getAttribute('url') ?? '', width: width(element) }));
	const content = resolve(contents);
	if (content) return content;

	for (const element of item.children) {
		const name = element.localName;
		const enclosure =
			(name === 'enclosure' && element.getAttribute('url')) ||
			(name === 'link' &&
				element.getAttribute('rel') === 'enclosure' &&
				element.getAttribute('href'));
		if (enclosure && isImageType(element.getAttribute('type'))) {
			const url = imageUrl(enclosure, base);
			if (url) return url;
		}
	}

	const itunes = item.getElementsByTagNameNS(ITUNES_NS, 'image')[0];
	const podcast = imageUrl(itunes?.getAttribute('href'), base);
	if (podcast) return podcast;

	for (const value of html) {
		const url = firstHtmlImage(value, base);
		if (url) return url;
	}
	return null;
}
