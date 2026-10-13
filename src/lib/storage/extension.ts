import type Browser from 'webextension-polyfill';

export type ExtensionApi = Browser.Browser;

/**
 * Liefert die WebExtension-API, wenn die Page als Extension läuft, sonst `undefined`
 * (z. B. auf dem Vite-Dev-Server). Firefox stellt `browser` nativ bereit. Für einen späteren
 * Chrome-Port würde hier `webextension-polyfill` geladen.
 */
export function extensionApi(): ExtensionApi | undefined {
	const api = (globalThis as { browser?: ExtensionApi }).browser;
	return api?.runtime?.id ? api : undefined;
}
