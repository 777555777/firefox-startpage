import { describe, expect, it } from 'vitest';
import { createManifest } from '../../scripts/manifest.ts';

describe('createManifest', () => {
	it('übernimmt die Version und setzt die feste Gecko-ID', () => {
		const manifest = createManifest('1.2.3');
		expect(manifest.version).toBe('1.2.3');
		expect(manifest.manifest_version).toBe(3);
		expect(manifest.browser_specific_settings.gecko.id).toBe('firefox-startpage@stampf');
	});

	it('ersetzt neuen Tab und Startseite durch dieselbe Seite', () => {
		const manifest = createManifest('1.0.0');
		expect(manifest.chrome_url_overrides.newtab).toBe('newtab.html');
		expect(manifest.chrome_settings_overrides.homepage).toBe('newtab.html');
	});

	it('fordert Host-Rechte nur optional an', () => {
		const manifest = createManifest('1.0.0');
		expect(manifest.permissions).toEqual(['storage', 'unlimitedStorage']);
		expect(manifest).not.toHaveProperty('host_permissions');
		expect(manifest.optional_host_permissions).toEqual(['https://*/*']);
	});

	it('erklärt, dass keine Daten gesammelt werden', () => {
		const manifest = createManifest('1.0.0');
		expect(manifest.browser_specific_settings.gecko.data_collection_permissions).toEqual({
			required: ['none']
		});
	});
});
