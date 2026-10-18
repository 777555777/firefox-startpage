// Erster Paint, bevor die App geladen ist. Läuft blockierend im <head> (kein Modul), damit
// der Browser nie die Standardfarbe oder den Himmelsverlauf zeigt, bevor das hier greift.
// Die Schlüssel schreibt die App: `startpage:paint` (App.svelte), `startpage:poster`
// (src/lib/background/poster.ts).
(function () {
	var root = document.documentElement;
	try {
		// Stimmung des letzten Besuchs, damit nachts nichts hell aufblitzt
		var paint = JSON.parse(localStorage.getItem('startpage:paint') || 'null');
		if (paint && typeof paint.color === 'string' && /^[\d ]+$/.test(paint.color)) {
			root.style.backgroundColor = 'rgb(' + paint.color + ')';
		}
		if (paint && paint.tone === 'dark') root.dataset.tone = 'dark';
	} catch {
		// dann eben die Standardfarbe
	}
	try {
		// Mit eigenem Hintergrund sein Standbild, bis das Medium geladen ist
		var poster = JSON.parse(localStorage.getItem('startpage:poster') || 'null');
		if (poster && typeof poster.url === 'string' && poster.url.indexOf('data:image/') === 0) {
			root.style.backgroundImage = 'url("' + poster.url + '")';
			root.style.backgroundSize = poster.size === 'contain' ? 'contain' : 'cover';
			root.style.backgroundPosition = String(poster.position || 'center');
			root.style.backgroundRepeat = 'no-repeat';
			// Steht wie das Glas-Canvas fest, während die Page scrollt
			root.style.backgroundAttachment = 'fixed';
		}
	} catch {
		// ohne Standbild startet die Seite mit der Grundfarbe
	}
})();
