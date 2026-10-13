/** Bietet JSON-Daten als Datei zum Speichern an */
export function downloadJson(data: unknown, filename: string) {
	const blob = new Blob([JSON.stringify(data, null, '\t')], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
