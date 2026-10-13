import { createSubscriber } from 'svelte/reactivity';

/**
 * Gemeinsame Zeitquelle, die genau auf die Sekunden- bzw. Minutengrenze tickt. Pro Takt gibt
 * es nur einen Timer, und er läuft nur, solange etwas `current` reaktiv liest.
 */
class Ticker {
	#subscribe: () => void;

	constructor(interval: number) {
		this.#subscribe = createSubscriber((update) => {
			let timer: ReturnType<typeof setTimeout>;
			const schedule = () => {
				// Ein paar ms nach der Grenze, damit sicher schon die neue Zeit gilt
				const delay = interval - (Date.now() % interval) + 5;
				timer = setTimeout(() => {
					update();
					schedule();
				}, delay);
			};
			// Hintergrund-Tabs drosseln Timer; beim Zurückkehren sofort aktualisieren
			const onVisibility = () => {
				if (document.visibilityState !== 'visible') return;
				clearTimeout(timer);
				update();
				schedule();
			};
			schedule();
			document.addEventListener('visibilitychange', onVisibility);
			return () => {
				clearTimeout(timer);
				document.removeEventListener('visibilitychange', onVisibility);
			};
		});
	}

	get current(): Date {
		this.#subscribe();
		return new Date();
	}
}

export const everySecond = new Ticker(1000);
export const everyMinute = new Ticker(60_000);
