import type { Side } from './operations';
import {
	effectiveSide,
	loadSidebarState,
	saveSidebarState,
	switchSide,
	toggleLast,
	toggleSide,
	type SidebarState
} from './sidebar-state';

/**
 * Zustand der Sidebar für die ganze Page. Das Board meldet, welche Seiten gerade einen Tab haben
 * (leer außerhalb der mittleren Stufe); Tabs und Tastenkürzel ändern den Zustand nur über diese
 * Methoden, damit er immer gespeichert wird.
 */
class SidebarStore {
	state = $state<SidebarState>(loadSidebarState());
	/** Seiten mit Tab, solange die Sidebar zu sehen ist; sonst leer */
	tabs = $state<Side[]>([]);

	/** Gezeigte Seite; null = zu oder gerade keine Sidebar */
	get open(): Side | null {
		return effectiveSide(this.state, this.tabs);
	}

	get available(): boolean {
		return this.tabs.length > 0;
	}

	/** Klick auf einen Tab */
	toggle(side: Side) {
		this.#set(toggleSide(this.state, this.tabs, side));
	}

	/** `S` */
	toggleLast() {
		this.#set(toggleLast(this.state, this.tabs));
	}

	/** `Umschalt+S` */
	switchSide() {
		this.#set(switchSide(this.state, this.tabs));
	}

	/** Öffnet eine bestimmte Seite, z. B. beim Ziehen auf ihren Tab */
	show(side: Side) {
		if (this.tabs.includes(side) && this.open !== side) this.#set({ open: side, last: side });
	}

	close() {
		const open = this.open;
		if (open) this.#set({ open: null, last: open });
	}

	#set(next: SidebarState) {
		if (next === this.state) return;
		this.state = next;
		saveSidebarState(next);
	}
}

export const sidebar = new SidebarStore();
