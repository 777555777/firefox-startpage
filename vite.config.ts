import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vitest/config';
import { createManifest } from './scripts/manifest.ts';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
	version: string;
};

/** Schreibt beim Build das Manifest mit der Version aus package.json nach dist/ */
function manifest(): Plugin {
	return {
		name: 'startpage-manifest',
		apply: 'build',
		generateBundle() {
			this.emitFile({
				type: 'asset',
				fileName: 'manifest.json',
				source: JSON.stringify(createManifest(pkg.version), null, '\t')
			});
		}
	};
}

/** Dev-Server: `/` zeigt direkt die Newtab-Page */
function devIndex(): Plugin {
	return {
		name: 'startpage-dev-index',
		apply: 'serve',
		configureServer(server) {
			server.middlewares.use((req, _res, next) => {
				if (req.url === '/' || req.url?.startsWith('/?'))
					req.url = '/newtab.html' + req.url.slice(1);
				next();
			});
		}
	};
}

export default defineConfig({
	plugins: [svelte(), manifest(), devIndex()],
	resolve: {
		alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) }
	},
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		target: 'firefox140',
		// MV3-CSP: keine Inline-Skripte, also auch kein Preload-Polyfill
		modulePreload: { polyfill: false },
		assetsInlineLimit: 0,
		rolldownOptions: {
			input: { newtab: fileURLToPath(new URL('./newtab.html', import.meta.url)) }
		}
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: true,
				test: {
					name: 'unit',
					environment: 'node',
					include: ['src/**/*.test.ts'],
					exclude: ['src/**/*.svelte.test.ts']
				}
			},
			{
				extends: true,
				plugins: [svelteTesting()],
				test: {
					name: 'component',
					environment: 'jsdom',
					include: ['src/**/*.svelte.test.ts'],
					setupFiles: ['./src/test-setup.ts']
				}
			}
		]
	}
});
