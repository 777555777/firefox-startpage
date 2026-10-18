import { tick } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import { layoutRect, playFlip, prefersReducedMotion, snapshot } from './spring';

/**
 * Eigenes Drag & Drop mit Pointer Events. Eine Instanz verwaltet eine Gruppe von Listen
 * (z. B. alle Spalten oder alle Links eines Tabs). Während des Ziehens wird der Zustand live
 * umsortiert (`onmove`), die übrigen Elemente weichen per FLIP-Feder aus.
 */

export type ListAxis = 'vertical' | 'horizontal' | 'grid';

export type ItemOptions = {
	id: string;
	list: string;
	/** CSS-Selektor des Griffs; ohne Angabe ist das ganze Element ziehbar */
	handle?: string;
	disabled?: boolean;
};

export type ListOptions = { id: string; axis: ListAxis };

export type TargetOptions = {
	id: string;
	/** Ablegen auf diesem Ziel, z. B. einem Tab-Reiter */
	ondrop: (itemId: string) => void;
	accepts?: (itemId: string) => boolean;
};

export type SortableOptions = {
	group: string;
	/** Live-Umsortierung während des Ziehens */
	onmove: (id: string, toList: string, toIndex: number) => void;
	/** Abschluss an der aktuellen Position */
	ondrop?: (id: string, list: string, index: number) => void;
	/** Wird nach dem Zurücksetzen bei Abbruch gerufen */
	oncancel?: (id: string) => void;
	/** Darf das Element in diese Liste? */
	accepts?: (id: string, list: string) => boolean;
	/** Mindestbewegung in px, bevor ein Ziehen beginnt (verhindert versehentliches Ziehen) */
	threshold?: number;
	/** Langes Drücken startet das Ziehen ebenfalls (ms); false = aus */
	longPress?: number | false;
	/**
	 * Eigene Platzierung statt Listen-Index, z. B. für Zeilen mit Widgets nebeneinander.
	 * Liefert die Änderung für die Zeigerposition oder null, wenn sich nichts ändern soll.
	 */
	resolve?: (id: string, point: Point, hit: Element | null) => (() => void) | null;
	/** Merkt sich beim Start den Zustand; die gelieferte Funktion stellt ihn bei Abbruch wieder her */
	snapshot?: () => () => void;
};

type Pending = {
	id: string;
	element: HTMLElement;
	pointerId: number;
	startX: number;
	startY: number;
	timer?: ReturnType<typeof setTimeout>;
};

type Session = {
	id: string;
	origin: { list: string; index: number };
	ghost: HTMLElement;
	offsetX: number;
	offsetY: number;
	x: number;
	y: number;
	busy: boolean;
	scrollFrame: number;
	restore?: () => void;
};

export type Point = { x: number; y: number };

/**
 * Index, an dem ein Element bei Zeigerposition `p` zwischen den übrigen Elementen landet.
 * Gezählt werden alle Elemente, deren Mitte „vor“ dem Zeiger liegt (Lesereihenfolge).
 */
export function insertionIndex(rects: DOMRect[], p: Point, axis: ListAxis): number {
	let index = 0;
	for (const rect of rects) {
		const cx = rect.left + rect.width / 2;
		const cy = rect.top + rect.height / 2;
		let before: boolean;
		if (axis === 'vertical') before = cy < p.y;
		else if (axis === 'horizontal') before = cx < p.x;
		else {
			// Raster: Zeilen oberhalb zählen ganz, in der eigenen Zeile nach x
			const sameRow = p.y >= rect.top && p.y <= rect.bottom;
			before = rect.bottom < p.y || (sameRow && cx < p.x);
		}
		if (before) index++;
	}
	return index;
}

const sortByDomOrder = (a: HTMLElement, b: HTMLElement) =>
	a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;

export class Sortable {
	/** Gerade gezogenes Element; Komponenten markieren damit den Platzhalter */
	active = $state<{ id: string; list: string } | null>(null);
	/** ID des Ablageziels unter dem Zeiger (z. B. Tab-Reiter) */
	overTarget = $state<string | null>(null);

	#options: SortableOptions;
	// Reine Buchführung über DOM-Elemente, wird nie angezeigt
	/* eslint-disable svelte/prefer-svelte-reactivity */
	#items = new Map<HTMLElement, { id: string; list: string }>();
	#lists = new Map<string, { element: HTMLElement; axis: ListAxis }>();
	#targets = new Map<HTMLElement, TargetOptions>();
	/* eslint-enable svelte/prefer-svelte-reactivity */
	#pending: Pending | null = null;
	#session: Session | null = null;

	constructor(options: SortableOptions) {
		this.#options = options;
	}

	get group() {
		return this.#options.group;
	}

	isDragging(id: string) {
		return this.active?.id === id;
	}

	// --- Attachments --------------------------------------------------------------------

	item = (options: ItemOptions): Attachment<HTMLElement> => {
		return (element) => {
			this.#items.set(element, { id: options.id, list: options.list });
			element.dataset.dndItem = options.id;
			// Native HTML5-Drags (Links, Bilder) würden die Pointer-Events abbrechen
			const draggables = [element, ...element.querySelectorAll<HTMLElement>('a, img')];
			for (const el of draggables) el.draggable = false;
			const ondragstart = (event: DragEvent) => event.preventDefault();

			const onpointerdown = (event: PointerEvent) => {
				if (options.disabled || event.button !== 0 || !event.isPrimary || this.#session) return;
				const target = event.target as Element;
				if (options.handle && !target.closest(options.handle)) return;
				this.#begin(options.id, element, event);
			};

			element.addEventListener('pointerdown', onpointerdown);
			element.addEventListener('dragstart', ondragstart);
			return () => {
				element.removeEventListener('pointerdown', onpointerdown);
				element.removeEventListener('dragstart', ondragstart);
				this.#items.delete(element);
			};
		};
	};

	list = (options: ListOptions): Attachment<HTMLElement> => {
		return (element) => {
			this.#lists.set(options.id, { element, axis: options.axis });
			element.dataset.dndGroup = this.group;
			element.dataset.dndList = options.id;
			return () => {
				if (this.#lists.get(options.id)?.element === element) this.#lists.delete(options.id);
			};
		};
	};

	target = (options: TargetOptions): Attachment<HTMLElement> => {
		return (element) => {
			this.#targets.set(element, options);
			element.dataset.dndTarget = this.group;
			return () => this.#targets.delete(element);
		};
	};

	// --- Programmatische Änderungen mit Animation -----------------------------------------

	/** Führt eine Änderung aus und animiert alle Elemente der Gruppe an ihre neue Position */
	async animate(change: () => void) {
		const before = snapshot(this.#entries());
		change();
		await tick();
		playFlip(before, this.#entries());
	}

	// --- Intern ----------------------------------------------------------------------------

	#entries(): [string, HTMLElement][] {
		return [...this.#items].map(([element, { id }]) => [id, element]);
	}

	#elementsOf(list: string): HTMLElement[] {
		return [...this.#items]
			.filter(([element, item]) => item.list === list && element.isConnected)
			.map(([element]) => element)
			.sort(sortByDomOrder);
	}

	#elementFor(id: string): HTMLElement | undefined {
		for (const [element, item] of this.#items)
			if (item.id === id && element.isConnected) return element;
	}

	#positionOf(id: string): { list: string; index: number } | null {
		for (const [element, item] of this.#items) {
			if (item.id === id && element.isConnected) {
				return { list: item.list, index: this.#elementsOf(item.list).indexOf(element) };
			}
		}
		return null;
	}

	#begin(id: string, element: HTMLElement, event: PointerEvent) {
		const pending: Pending = {
			id,
			element,
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY
		};
		const longPress = this.#options.longPress ?? false;
		if (longPress) {
			pending.timer = setTimeout(() => {
				if (this.#pending === pending) this.#start(pending.startX, pending.startY);
			}, longPress);
		}
		this.#pending = pending;
		window.addEventListener('pointermove', this.#onpointermove, true);
		window.addEventListener('pointerup', this.#onpointerup, true);
		window.addEventListener('pointercancel', this.#onpointercancel, true);
		window.addEventListener('keydown', this.#onkeydown, true);
	}

	#onpointermove = (event: PointerEvent) => {
		const pending = this.#pending;
		if (pending && event.pointerId === pending.pointerId && !this.#session) {
			const distance = Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY);
			if (distance < (this.#options.threshold ?? 5)) return;
			this.#start(event.clientX, event.clientY);
		}
		const session = this.#session;
		if (!session) return;
		event.preventDefault();
		session.x = event.clientX;
		session.y = event.clientY;
		this.#moveGhost(session);
		void this.#hitTest(session);
	};

	#onpointerup = (event: PointerEvent) => {
		if (this.#pending && event.pointerId !== this.#pending.pointerId) return;
		if (this.#session) this.#finish(false);
		else this.#reset();
	};

	#onpointercancel = () => {
		if (this.#session) this.#finish(true);
		else this.#reset();
	};

	#onkeydown = (event: KeyboardEvent) => {
		if (event.key !== 'Escape' || !this.#session) return;
		event.preventDefault();
		event.stopPropagation();
		this.#finish(true);
	};

	#start(x: number, y: number) {
		const pending = this.#pending;
		if (!pending) return;
		clearTimeout(pending.timer);
		const origin = this.#positionOf(pending.id);
		if (!origin) return this.#reset();

		const rect = pending.element.getBoundingClientRect();
		const ghost = pending.element.cloneNode(true) as HTMLElement;
		ghost.removeAttribute('id');
		for (const el of ghost.querySelectorAll('[id]')) el.removeAttribute('id');
		ghost.classList.add('dnd-ghost');
		// Der Klon zeichnet sein Glas selbst (CSS), nicht über den WebGL-Layer
		delete ghost.dataset.glass;
		ghost.setAttribute('aria-hidden', 'true');
		Object.assign(ghost.style, {
			position: 'fixed',
			left: `${rect.left}px`,
			top: `${rect.top}px`,
			width: `${rect.width}px`,
			height: `${rect.height}px`,
			margin: '0',
			transform: ''
		});
		document.body.append(ghost);

		this.#session = {
			id: pending.id,
			origin,
			ghost,
			offsetX: pending.startX - rect.left,
			offsetY: pending.startY - rect.top,
			x,
			y,
			busy: false,
			scrollFrame: requestAnimationFrame(this.#autoScroll),
			restore: this.#options.snapshot?.()
		};
		this.active = { id: pending.id, list: origin.list };
		document.documentElement.classList.add('dnd-dragging');
		window.getSelection()?.removeAllRanges();
		this.#moveGhost(this.#session);
	}

	#moveGhost(session: Session) {
		const rect = session.ghost.style;
		const left = parseFloat(rect.left);
		const top = parseFloat(rect.top);
		const dx = session.x - session.offsetX - left;
		const dy = session.y - session.offsetY - top;
		session.ghost.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.03)`;
	}

	async #hitTest(session: Session) {
		if (session.busy) return;
		const hit = document.elementFromPoint(session.x, session.y);
		const group = CSS.escape(this.group);

		const targetElement = hit?.closest<HTMLElement>(`[data-dnd-target="${group}"]`);
		const target = targetElement ? this.#targets.get(targetElement) : undefined;
		if (target && (target.accepts?.(session.id) ?? true)) {
			this.overTarget = target.id;
			return;
		}
		this.overTarget = null;

		if (this.#options.resolve) {
			const change = this.#options.resolve(session.id, session, hit);
			if (!change) return;
			session.busy = true;
			await this.animate(change);
			session.busy = false;
			return;
		}

		const listElement = hit?.closest<HTMLElement>(`[data-dnd-group="${group}"][data-dnd-list]`);
		const listId = listElement?.dataset.dndList;
		const list = listId ? this.#lists.get(listId) : undefined;
		if (!listId || !list) return;
		if (this.#options.accepts && !this.#options.accepts(session.id, listId)) return;

		const others = this.#elementsOf(listId).filter((el) => this.#items.get(el)?.id !== session.id);
		const index = insertionIndex(others.map(layoutRect), session, list.axis);
		const current = this.#positionOf(session.id);
		if (current && current.list === listId && current.index === index) return;

		session.busy = true;
		await this.animate(() => this.#options.onmove(session.id, listId, index));
		if (this.active) this.active = { id: session.id, list: listId };
		session.busy = false;
	}

	/**
	 * Scrollt den Container unter dem Zeiger, wenn er nahe an dessen Rand ist. Ohne eigenen
	 * Scroll-Container (z. B. bei Panels) scrollt die ganze Page am Fensterrand.
	 */
	#autoScroll = () => {
		const session = this.#session;
		if (!session) return;
		const hit = document.elementFromPoint(session.x, session.y);
		let scroller = hit instanceof HTMLElement ? hit : null;
		while (
			scroller &&
			!(
				scroller.scrollHeight > scroller.clientHeight &&
				/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)
			)
		) {
			scroller = scroller.parentElement;
		}
		const target = scroller ?? document.scrollingElement;
		if (target) {
			const { top, bottom } = scroller
				? scroller.getBoundingClientRect()
				: { top: 0, bottom: window.innerHeight };
			const edge = 56;
			const speed = (distance: number) => Math.round(((edge - distance) / edge) * 14);
			if (session.y < top + edge) target.scrollTop -= speed(session.y - top);
			else if (session.y > bottom - edge) target.scrollTop += speed(bottom - session.y);
		}
		session.scrollFrame = requestAnimationFrame(this.#autoScroll);
	};

	async #finish(cancelled: boolean) {
		const session = this.#session;
		if (!session) return;
		cancelAnimationFrame(session.scrollFrame);
		const targetId = this.overTarget;
		const target = [...this.#targets.values()].find((t) => t.id === targetId);

		if (cancelled) {
			const { list, index } = session.origin;
			const restore = session.restore;
			await this.animate(restore ?? (() => this.#options.onmove(session.id, list, index)));
			this.#options.oncancel?.(session.id);
		} else if (target) {
			await this.animate(() => target.ondrop(session.id));
		} else {
			const position = this.#positionOf(session.id);
			if (position) this.#options.ondrop?.(session.id, position.list, position.index);
		}

		// Klick nach dem Loslassen darf den Link nicht öffnen
		const swallow = (event: MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();
		};
		window.addEventListener('click', swallow, { capture: true, once: true });
		setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);

		this.#settleGhost(session, target ? undefined : this.#elementFor(session.id));
		this.#session = null;
		this.active = null;
		this.overTarget = null;
		document.documentElement.classList.remove('dnd-dragging');
		this.#reset();
	}

	/** Der Geist gleitet an die Endposition und verschwindet dann */
	#settleGhost(session: Session, element: HTMLElement | undefined) {
		const ghost = session.ghost;
		if (!element || prefersReducedMotion()) {
			ghost.remove();
			return;
		}
		const to = element.getBoundingClientRect();
		const dx = to.left - parseFloat(ghost.style.left);
		const dy = to.top - parseFloat(ghost.style.top);
		ghost.style.transition = 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease';
		ghost.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
		ghost.style.opacity = '0.6';
		setTimeout(() => ghost.remove(), 190);
	}

	#reset() {
		if (this.#pending) clearTimeout(this.#pending.timer);
		this.#pending = null;
		window.removeEventListener('pointermove', this.#onpointermove, true);
		window.removeEventListener('pointerup', this.#onpointerup, true);
		window.removeEventListener('pointercancel', this.#onpointercancel, true);
		window.removeEventListener('keydown', this.#onkeydown, true);
	}
}
