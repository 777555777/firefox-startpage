/**
 * Erzeugt das `manifest.json` der Extension. Die Version kommt aus `package.json`,
 * damit es nur eine Quelle dafür gibt.
 */
export function createManifest(version: string) {
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
