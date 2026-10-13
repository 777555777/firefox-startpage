// Gemeinsame Einstellungen für alle `web-ext`-Befehle (run, lint, build, sign)
export default {
	sourceDir: 'dist',
	artifactsDir: 'web-ext-artifacts',
	run: {
		target: ['firefox-desktop'],
		startUrl: ['about:newtab']
	},
	build: {
		overwriteDest: true
	}
};
