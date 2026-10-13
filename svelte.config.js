import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/vite-plugin-svelte').SvelteConfig} */
export default {
	preprocess: vitePreprocess(),
	compilerOptions: {
		// Runes-Modus für alle eigenen Komponenten erzwingen
		runes: true,
		// DOM per createElement aufbauen statt über innerHTML-Templates (AMO-Lint, CSP)
		fragments: 'tree'
	}
};
