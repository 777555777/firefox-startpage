import { untrack } from 'svelte';

/**
 * Beobachtet einen Bereich mit begrenzter Höhe: ob sein Inhalt überläuft und ob oben bzw. unten
 * noch etwas verborgen ist (für weiche Kanten). Gemessen wird bei Größenänderungen des Bereichs
 * und seiner direkten Kinder, beim Austausch der Kinder und beim Scrollen. Im Leerlauf passiert
 * nichts.
 */
export class ScrollArea {
	overflowing = $state(false);
	fadeTop = $state(false);
	fadeBottom = $state(false);

	/** Als Attachment verwenden: `{@attach area.attach}` */
	attach = (node: HTMLElement) => {
		const check = () => {
			const overflowing = node.scrollHeight > node.clientHeight + 1;
			const top = overflowing && node.scrollTop > 1;
			const bottom = overflowing && node.scrollTop + node.clientHeight < node.scrollHeight - 1;
			if (overflowing !== this.overflowing) this.overflowing = overflowing;
			if (top !== this.fadeTop) this.fadeTop = top;
			if (bottom !== this.fadeBottom) this.fadeBottom = bottom;
		};

		const resize = new ResizeObserver(check);
		const observe = () => {
			resize.disconnect();
			resize.observe(node);
			for (const child of node.children) resize.observe(child);
		};
		const mutation = new MutationObserver(() => {
			observe();
			check();
		});

		observe();
		mutation.observe(node, { childList: true });
		node.addEventListener('scroll', check, { passive: true });
		// Ohne untrack hinge das Attachment an den eigenen Werten und liefe bei jeder Änderung neu
		untrack(check);

		return () => {
			resize.disconnect();
			mutation.disconnect();
			node.removeEventListener('scroll', check);
			this.overflowing = this.fadeTop = this.fadeBottom = false;
		};
	};
}
