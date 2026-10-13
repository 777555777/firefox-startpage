export type ToastAction = { label: string; run: () => void };

export type Toast = {
	id: number;
	message: string;
	action?: ToastAction;
	tone: 'info' | 'error';
};

type ShowOptions = {
	action?: ToastAction;
	tone?: Toast['tone'];
	/** Anzeigedauer in ms; Toasts mit Aktion bleiben länger */
	duration?: number;
};

const MAX_TOASTS = 4;

/** Kurze Hinweise unten auf der Seite, optional mit Aktion (z. B. Rückgängig) */
class Toasts {
	items = $state<Toast[]>([]);
	#nextId = 1;
	#timers = new Map<number, ReturnType<typeof setTimeout>>();

	show(message: string, options: ShowOptions = {}): number {
		const id = this.#nextId++;
		const toast: Toast = { id, message, action: options.action, tone: options.tone ?? 'info' };
		this.items = [...this.items, toast].slice(-MAX_TOASTS);
		const duration = options.duration ?? (options.action ? 8000 : 4000);
		this.#timers.set(
			id,
			setTimeout(() => this.dismiss(id), duration)
		);
		return id;
	}

	dismiss(id: number) {
		clearTimeout(this.#timers.get(id));
		this.#timers.delete(id);
		this.items = this.items.filter((toast) => toast.id !== id);
	}

	/** Führt die Aktion aus und schließt den Toast */
	act(id: number) {
		const toast = this.items.find((item) => item.id === id);
		this.dismiss(id);
		toast?.action?.run();
	}
}

export const toasts = new Toasts();
