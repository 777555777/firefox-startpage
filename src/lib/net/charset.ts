/**
 * Zeichensatz von Feeds und Webseiten. `Response.text()` dekodiert immer als UTF-8; ältere
 * Feeds in ISO-8859-1 oder Windows-1252 kämen so mit kaputten Umlauten an. Deshalb wird der
 * Zeichensatz selbst bestimmt: Byte-Order-Mark, dann `Content-Type`, dann die Angabe im Dokument
 * (XML-Deklaration bzw. `<meta charset>`), sonst UTF-8.
 */

/** So viele Bytes am Anfang werden nach einer Angabe im Dokument durchsucht */
const SNIFF_BYTES = 1024;

function bomCharset(bytes: Uint8Array): string | null {
	if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8';
	if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
	if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';
	return null;
}

function headerCharset(contentType: string | null): string | null {
	const match = contentType?.match(/charset\s*=\s*["']?([\w.:-]+)/i);
	return match ? match[1] : null;
}

function documentCharset(bytes: Uint8Array): string | null {
	// Angaben im Kopf stehen in ASCII; latin1 dekodiert jedes Byte, ohne zu scheitern
	const head = new TextDecoder('latin1').decode(bytes.subarray(0, SNIFF_BYTES));
	const xml = head.match(/^\s*<\?xml[^>]*\bencoding\s*=\s*["']([\w.:-]+)["']/i);
	if (xml) return xml[1];
	const meta = head.match(/<meta[^>]+charset\s*=\s*["']?([\w.:-]+)/i);
	return meta ? meta[1] : null;
}

/** Ob der Browser den Namen als Zeichensatz kennt; liefert dann dessen Normalform */
function known(label: string | null): string | null {
	if (!label) return null;
	try {
		return new TextDecoder(label).encoding;
	} catch {
		return null;
	}
}

export function detectCharset(contentType: string | null, bytes: Uint8Array): string {
	return (
		bomCharset(bytes) ??
		known(headerCharset(contentType)) ??
		known(documentCharset(bytes)) ??
		'utf-8'
	);
}

/** Dekodiert den Inhalt mit dem erkannten Zeichensatz; ungültige Bytes werden zu U+FFFD */
export function decodeBody(bytes: Uint8Array, contentType: string | null): string {
	return new TextDecoder(detectCharset(contentType, bytes)).decode(bytes);
}
