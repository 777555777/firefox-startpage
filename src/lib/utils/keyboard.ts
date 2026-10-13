/** Ob ein Tastendruck in einem Eingabefeld landet; dann greifen keine globalen Kürzel */
export function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;
	if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
	if (target instanceof HTMLInputElement) {
		return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(
			target.type
		);
	}
	return false;
}

/** Ob gerade ein modaler Dialog oder ein Menü offen ist */
export function isOverlayOpen(): boolean {
	return document.querySelector('dialog[open], [popover]:popover-open') !== null;
}

/** Strg (bzw. Cmd auf dem Mac) gedrückt */
export function isModKey(event: KeyboardEvent | MouseEvent): boolean {
	return event.ctrlKey || event.metaKey;
}
