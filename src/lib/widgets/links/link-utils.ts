import type { Config } from '$lib/config/types';
import { widgetOrder } from '$lib/layout/operations';
import type { Link, LinksSettings } from './settings';

/** Origin eines http(s)-Links, sonst null (App-Schemata haben kein Favicon) */
export function webOrigin(url: string): string | null {
	try {
		const { protocol, origin } = new URL(url);
		return protocol === 'http:' || protocol === 'https:' ? origin : null;
	} catch {
		return null;
	}
}

/** Domain für die Anzeige, z. B. `github.com`; bei App-Schemata das Schema */
export function displayHost(url: string): string {
	try {
		const { protocol, hostname } = new URL(url);
		const isWeb = protocol === 'http:' || protocol === 'https:';
		return isWeb ? hostname.replace(/^www\./, '') : protocol.replace(/:$/, '');
	} catch {
		return url;
	}
}

/** Anzeigename eines Links; ohne Label die Domain */
export function linkTitle(link: Pick<Link, 'label' | 'url'>): string {
	return link.label || displayHost(link.url);
}

/** Anfangsbuchstabe für das Ersatz-Icon */
export function initialOf(text: string): string {
	return (text.trim().match(/\p{L}|\p{N}/u)?.[0] ?? '?').toUpperCase();
}

export type FlatLink = Link & { host: string; boardId: string; tabId: string };

/** Alle Links aller Boards, z. B. für die Suche */
export function allLinks(config: Config): FlatLink[] {
	const links: FlatLink[] = [];
	for (const id of widgetOrder(config.layout.columnRows)) {
		const widget = config.widgets[id];
		if (widget?.type !== 'links') continue;
		const board = widget.settings as LinksSettings;
		for (const tab of board.tabs) {
			for (const link of tab.links) {
				links.push({ ...link, host: displayHost(link.url), boardId: id, tabId: tab.id });
			}
		}
	}
	return links;
}

/**
 * Öffnet einen Link. `newTab` erzwingt einen neuen Tab (z. B. Strg/Cmd+Enter), sonst gilt das
 * Ziel des Links.
 */
export function openUrl(url: string, newTab: boolean) {
	if (newTab) window.open(url, '_blank', 'noopener,noreferrer');
	else window.location.assign(url);
}

/** Verkleinert ein hochgeladenes Bild auf eine kleine PNG-Data-URL für die Config */
export async function imageToDataUrl(file: File, size = 64): Promise<string | null> {
	try {
		if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
			return await svgToDataUrl(file, size);
		}
		const bitmap = await createImageBitmap(file);
		const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
		const url = toPng(bitmap, bitmap.width * scale, bitmap.height * scale);
		bitmap.close();
		return url;
	} catch {
		return null;
	}
}

function toPng(source: CanvasImageSource, width: number, height: number): string {
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(width));
	canvas.height = Math.max(1, Math.round(height));
	canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height);
	return canvas.toDataURL('image/png');
}

/**
 * SVG lässt sich nicht per `createImageBitmap` dekodieren. Es bekommt deshalb feste Maße in
 * Zielgröße, wird als `<img>` geladen und direkt scharf in dieser Größe gerastert.
 */
async function svgToDataUrl(file: File, size: number): Promise<string> {
	const doc = new DOMParser().parseFromString(await file.text(), 'image/svg+xml');
	const svg = doc.documentElement;
	if (svg.localName !== 'svg') throw new Error('Kein gültiges SVG');
	const fit = fitSvg(
		{
			width: svg.getAttribute('width'),
			height: svg.getAttribute('height'),
			viewBox: svg.getAttribute('viewBox')
		},
		size
	);
	svg.setAttribute('width', String(fit.width));
	svg.setAttribute('height', String(fit.height));
	if (fit.viewBox) svg.setAttribute('viewBox', fit.viewBox);
	const image = new Image();
	image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(doc))}`;
	await image.decode();
	return toPng(image, fit.width, fit.height);
}

type SvgAttributes = { width: string | null; height: string | null; viewBox: string | null };

/**
 * Zielmaße eines SVG, eingepasst in `size` × `size`. Das Seitenverhältnis kommt aus
 * `width`/`height` oder der `viewBox`. Fehlt die `viewBox`, wird sie aus den Originalmaßen
 * ergänzt, sonst würde das Ändern von `width`/`height` den Inhalt beschneiden statt skalieren.
 */
export function fitSvg(
	attributes: SvgAttributes,
	size: number
): { width: number; height: number; viewBox?: string } {
	const width = pixelLength(attributes.width);
	const height = pixelLength(attributes.height);
	const box = attributes.viewBox
		?.trim()
		.split(/[\s,]+/)
		.map(Number);
	const viewBox = box?.length === 4 && box[2] > 0 && box[3] > 0 ? box : null;
	const ratio = width && height ? width / height : viewBox ? viewBox[2] / viewBox[3] : 1;
	const fitted =
		ratio >= 1
			? { width: size, height: Math.max(1, Math.round(size / ratio)) }
			: { width: Math.max(1, Math.round(size * ratio)), height: size };
	return !viewBox && width && height ? { ...fitted, viewBox: `0 0 ${width} ${height}` } : fitted;
}

/** Länge in px aus einem SVG-Attribut; Prozent und relative Einheiten zählen nicht */
function pixelLength(value: string | null): number | null {
	const match = value?.trim().match(/^(\d*\.?\d+)(px)?$/);
	const number = match ? Number(match[1]) : 0;
	return number > 0 ? number : null;
}
