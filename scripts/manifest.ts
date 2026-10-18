/**
 * Erzeugt das `manifest.json` der Extension. Die Version kommt aus `package.json`,
 * damit es nur eine Quelle dafür gibt.
 */
export function createManifest(version: string) {
	// Firefox erlaubt nur bis zu vier Zahlen, keine Vorabversionen wie `1.1.0-beta.1`
	if (!/^\d+(\.\d+){0,3}$/.test(version)) {
		throw new Error(`Ungültige Extension-Version „${version}“ in package.json`);
	}
	return {
		manifest_version: 3,
		name: '__MSG_extName__',
		description: '__MSG_extDescription__',
		version,
		default_locale: 'en',
		icons: {
			48: 'icons/icon.svg',
			96: 'icons/icon.svg'
		},
		permissions: ['storage', 'unlimitedStorage'],
		// Host-Rechte nur zur Laufzeit pro Feed-Origin (RSS); nur https, weil die Standard-CSP
		// von MV3 http-Anfragen ohnehin auf https hebt
		optional_host_permissions: ['https://*/*'],
		chrome_url_overrides: {
			newtab: 'newtab.html'
		},
		chrome_settings_overrides: {
			homepage: 'newtab.html'
		},
		browser_specific_settings: {
			gecko: {
				id: 'firefox-startpage@stampf',
				strict_min_version: '140.0',
				data_collection_permissions: {
					required: ['none']
				}
			},
			// Android wird nicht unterstützt; die Angabe vermeidet nur eine Lint-Warnung
			gecko_android: {
				strict_min_version: '142.0'
			}
		}
	};
}
