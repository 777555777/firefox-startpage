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

/**
 * Dev-Server: Weiterleitung für Feed-Abrufe (`/__dev/feed?url=…`). Außerhalb der Extension gibt
 * es keine Host-Rechte, ohne sie blockiert CORS fast jeden Feed. Nur https, im Build fehlt sie.
 */
function devFeedProxy(): Plugin {
	return {
		name: 'startpage-dev-feed',
		apply: 'serve',
		configureServer(server) {
			server.middlewares.use('/__dev/feed', async (req, res) => {
				const target = new URL(req.url ?? '', 'http://localhost').searchParams.get('url');
				if (!target?.startsWith('https://')) {
					res.statusCode = 400;
					res.end();
					return;
				}
				try {
					const headers: Record<string, string> = {};
					for (const name of ['accept', 'if-none-match', 'if-modified-since']) {
						const value = req.headers[name];
						if (typeof value === 'string') headers[name] = value;
					}
					const response = await fetch(target, {
						headers,
						signal: AbortSignal.timeout(20_000)
					});
					res.statusCode = response.status;
					for (const name of ['content-type', 'etag', 'last-modified', 'retry-after']) {
						const value = response.headers.get(name);
						if (value) res.setHeader(name, value);
					}
					// Endgültige Adresse nach Umleitungen, wie `Response.url` in der Extension
					res.setHeader('x-feed-url', response.url);
					res.end(Buffer.from(await response.arrayBuffer()));
				} catch {
					res.statusCode = 502;
					res.end();
				}
			});
		}
	};
}

export default defineConfig({
	plugins: [svelte(), manifest(), devIndex(), devFeedProxy()],
	resolve: {
		alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) }
	},
	build: {
		outDir: 'dist',
		// Im Watch-Modus (ext:dev) dist/ nicht leeren, während web-ext daraus lädt
		emptyOutDir: !process.argv.includes('--watch'),
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
