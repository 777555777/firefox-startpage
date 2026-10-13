type Box = Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>;

export type NavKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

/**
 * Nächster Fokus-Index bei Pfeiltasten (Roving Tabindex). Links/rechts folgen der
 * Lesereihenfolge, hoch/runter suchen das nächstgelegene Element in der Zeile darüber bzw.
 * darunter. So funktioniert es für Raster, umbrechende Kapseln und Listen gleichermaßen.
 */
export function nextIndex(boxes: Box[], current: number, key: NavKey): number {
	const last = boxes.length - 1;
	if (last < 0) return -1;
	switch (key) {
		case 'Home':
			return 0;
		case 'End':
			return last;
		case 'ArrowLeft':
			return Math.max(0, current - 1);
		case 'ArrowRight':
			return Math.min(last, current + 1);
	}

	const from = boxes[current];
	if (!from) return 0;
	const cx = from.left + from.width / 2;
	const down = key === 'ArrowDown';
	let best = current;
	let bestScore = Infinity;
	boxes.forEach((box, index) => {
		if (index === current) return;
		// Nur Elemente in einer anderen Zeile in der gewünschten Richtung
		const inDirection = down ? box.top >= from.bottom - 2 : box.bottom <= from.top + 2;
		if (!inDirection) return;
		const dy = Math.abs(box.top - from.top);
		const dx = Math.abs(box.left + box.width / 2 - cx);
		// Die nächste Zeile hat Vorrang, innerhalb der Zeile zählt der waagerechte Abstand
		const score = dy * 10_000 + dx;
		if (score < bestScore) {
			bestScore = score;
			best = index;
		}
	});
	return best;
}

/** Ziffer 1–9 aus einem Tastendruck (Hauptreihe oder Ziffernblock), sonst null */
export function digitOf(event: Pick<KeyboardEvent, 'code' | 'key'>): number | null {
	const match = /^(?:Digit|Numpad)([1-9])$/.exec(event.code) ?? /^([1-9])$/.exec(event.key);
	return match ? Number(match[1]) : null;
}
