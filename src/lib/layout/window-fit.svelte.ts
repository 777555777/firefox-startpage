import { getContext, setContext } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import { fitCount, listSpace } from './window-fit';

/**
 * Messen für „Bis Fensterende“. Gemessen wird nur bei Anlässen: Größenänderung des Fensters,
 * der Liste, des Panels oder seiner Spalte (Layout, Dichte, Sidebar, neue Einträge) und nach dem
 * Laden der Schrift. Im Leerlauf wird nichts gelesen (wie beim Glas, SPEC §7.1).
 */

const KEY = Symbol('window-fit');

type FitContext = { readonly allowed: boolean };

/** Das Board sagt, ob „Bis Fensterende“ gerade gilt (nicht in der schmalen Stufe) */
export function setWindowFitContext(context: FitContext) {
	setContext(KEY, context);
}

/** Außerhalb des Boards (z. B. in Tests) gilt immer „Nach Inhalt“ */
export function windowFitContext(): FitContext {
	return getContext<FitContext | undefined>(KEY) ?? { allowed: false };
}

/** Platz für „Weitere anzeigen“ samt Abstand, solange der Knopf noch nicht da ist */
const MORE_RESERVE_PX = 40;

/** Kennzeichnet den Knopf „Weitere anzeigen“; er zählt nicht zum Platz unter der Liste */
export const MORE_ATTRIBUTE = 'data-fit-more';

/**
 * Höhe dessen, was im Panel unter der Liste steht: folgende Geschwister samt Abstand und die
 * unteren Innenabstände bis zum Panel. Absichtlich nicht `Panel-Unterkante − Liste`, weil ein
 * höherer Nachbar in der Zeile das Panel streckt.
 */
function chromeBelow(list: HTMLElement, panel: HTMLElement): number {
	let below = 0;
	let node: HTMLElement = list;
	while (node !== panel && node.parentElement) {
		const parent = node.parentElement;
		const parentStyle = getComputedStyle(parent);
		const gap = parseFloat(parentStyle.rowGap) || 0;
		for (let sibling = node.nextElementSibling; sibling; sibling = sibling.nextElementSibling) {
			if (!(sibling instanceof HTMLElement) || sibling.hasAttribute(MORE_ATTRIBUTE)) continue;
			const style = getComputedStyle(sibling);
			if (style.display === 'none' || style.position === 'absolute' || style.position === 'fixed') {
				continue;
			}
			below += sibling.getBoundingClientRect().height + gap;
		}
		below += parseFloat(parentStyle.paddingBottom) || 0;
		node = parent;
	}
	return below;
}

export class WindowFit {
	/** Anzahl ganzer Einträge; null = nicht begrenzt */
	count = $state<number | null>(null);
	/** Höhe der gekürzten Liste in px; null = nicht gekürzt */
	height = $state<number | null>(null);

	/** Misst die Liste, solange `enabled` gilt; ihre direkten Kinder sind die Einträge */
	attach = (enabled: boolean): Attachment<HTMLElement> => {
		return (list) => {
			// Abgeschaltet oder ausgeklappt: Der letzte Wert bleibt stehen, damit die Liste beim
			// Einklappen nicht für einen Frame ganz zu sehen ist; wer liest, prüft `enabled` selbst
			if (!enabled) return;
			let frame = 0;
			const schedule = () => {
				cancelAnimationFrame(frame);
				frame = requestAnimationFrame(() => this.#measure(list));
			};
			const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
			const panel = list.closest<HTMLElement>('[data-widget]');
			const column = list.closest<HTMLElement>('[data-dnd-list]');
			for (const element of [list, panel, column]) if (element) observer?.observe(element);
			window.addEventListener('resize', schedule);
			void document.fonts?.ready.then(schedule);
			schedule();
			return () => {
				cancelAnimationFrame(frame);
				observer?.disconnect();
				window.removeEventListener('resize', schedule);
			};
		};
	};

	#measure(list: HTMLElement) {
		const panel = list.closest<HTMLElement>('[data-widget]');
		const entries = [...list.children].filter(
			(child): child is HTMLElement => child instanceof HTMLElement
		);
		// Verborgen (z. B. geschlossene Sidebar): nichts ändern, beim Zeigen wird neu gemessen
		if (!panel || entries.length === 0 || list.offsetParent === null) return;
		const listStyle = getComputedStyle(list);
		const padBottom = parseFloat(listStyle.paddingBottom) || 0;
		const bottoms = entries.map((entry) => entry.offsetTop + entry.offsetHeight);
		const more = panel.querySelector<HTMLElement>(`[${MORE_ATTRIBUTE}]`);
		const moreHeight = more
			? more.getBoundingClientRect().height +
				(parseFloat(getComputedStyle(more.parentElement ?? more).rowGap) || 0)
			: MORE_RESERVE_PX;
		const page = list.closest('main') ?? document.body;
		const space =
			listSpace({
				viewport: innerHeight,
				listTop: list.getBoundingClientRect().top + scrollY,
				below: chromeBelow(list, panel),
				bottomPad: parseFloat(getComputedStyle(page).paddingTop) || 0
			}) - padBottom;
		const count = fitCount(bottoms, space, moreHeight);
		const height = count >= entries.length ? null : bottoms[count - 1] + padBottom;
		if (count !== this.count) this.count = count;
		if (height !== this.height) this.height = height;
	}
}
