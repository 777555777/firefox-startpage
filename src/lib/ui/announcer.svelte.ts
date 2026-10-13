/** Ansagen für Screenreader, z. B. beim Verschieben per Tastatur */
class Announcer {
	message = $state('');

	say(text: string) {
		// Gleicher Text hintereinander soll erneut angesagt werden
		this.message = '';
		queueMicrotask(() => (this.message = text));
	}
}

export const announcer = new Announcer();
