import type { LinkStats } from '$lib/config/types';

export type LinkCandidate = {
	id: string;
	label: string;
	url: string;
	host: string;
};

/** Kleinbuchstaben ohne Akzente, damit „cafe“ auch „Café“ findet */
export function normalize(text: string): string {
	return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

const isWordStart = (text: string, index: number) =>
	index === 0 || /[\s\-_./:]/.test(text[index - 1]);

/**
 * Bewertet, wie gut `term` auf `text` passt; null = kein Treffer.
 * Teilstrings zählen am meisten, besonders am Wortanfang. Sonst wird eine Teilfolge der
 * Buchstaben gesucht, mit Bonus für zusammenhängende Treffer und Wortanfänge.
 */
export function fuzzyScore(term: string, text: string): number | null {
	const t = normalize(term);
	const s = normalize(text);
	if (!t) return 0;

	const index = s.indexOf(t);
	if (index !== -1) {
		let score = 100 + t.length * 4;
		if (index === 0) score += 40;
		else if (isWordStart(s, index)) score += 25;
		score -= index * 0.5;
		score -= (s.length - t.length) * 0.2;
		return score;
	}

	let score = 0;
	let position = 0;
	let previous = -2;
	for (const char of t) {
		const found = s.indexOf(char, position);
		if (found === -1) return null;
		score += 1;
		if (found === previous + 1) score += 5;
		if (isWordStart(s, found)) score += 8;
		score -= (found - position) * 0.3;
		previous = found;
		position = found + 1;
	}
	// Teilfolgen nur akzeptieren, wenn sie nicht völlig zerstreut sind
	return score > t.length * 2 ? score : null;
}

const DAY = 86_400_000;

/**
 * Bis zu `limit` passende Links für den Suchtext, gewichtet mit der Klick-Statistik.
 * Mehrere Wörter müssen alle passen (in Label oder Host). Gleiche URLs erscheinen nur einmal.
 */
export function searchLinks<T extends LinkCandidate>(
	query: string,
	candidates: T[],
	stats: LinkStats,
	limit = 5,
	now = Date.now()
): T[] {
	const terms = query.trim().split(/\s+/).filter(Boolean);
	if (terms.length === 0) return [];

	const scored: { candidate: T; score: number }[] = [];
	const seen = new Set<string>();
	for (const candidate of candidates) {
		if (seen.has(candidate.url)) continue;
		let total = 0;
		let matched = true;
		for (const term of terms) {
			const label = fuzzyScore(term, candidate.label);
			const host = fuzzyScore(term, candidate.host);
			const best = Math.max(label ?? -Infinity, host === null ? -Infinity : host * 0.9);
			if (best === -Infinity) {
				matched = false;
				break;
			}
			total += best;
		}
		if (!matched) continue;
		const stat = stats[candidate.url];
		if (stat) {
			total += Math.log2(1 + stat.count) * 8;
			if (now - stat.lastOpened < 7 * DAY) total += 6;
		}
		seen.add(candidate.url);
		scored.push({ candidate, score: total });
	}

	return scored
		.sort((a, b) => b.score - a.score || a.candidate.label.localeCompare(b.candidate.label))
		.slice(0, limit)
		.map((entry) => entry.candidate);
}
