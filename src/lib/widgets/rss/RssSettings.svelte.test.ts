import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import type { Component } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { i18n, t } from '$lib/i18n/index.svelte';
import { createMemoryAppState } from '$lib/state/app.svelte';
import Harness from '$lib/test/Harness.svelte';
import type { WidgetSettingsProps } from '../types';
import RssSettings from './RssSettings.svelte';
import { parseRssSettings, type RssSettings as Settings } from './settings';

const RSS =
	'<rss version="2.0"><channel><title>Beispiel-Blog</title><item><title>Eins</title><guid>1</guid></item></channel></rss>';

function stubBrowser(granted: boolean) {
	const calls: string[] = [];
	const permissions = {
		request: vi.fn(async () => {
			calls.push('request');
			return granted;
		}),
		contains: vi.fn(async () => granted),
		getAll: vi.fn(async () => ({ origins: [] })),
		remove: vi.fn(async () => true),
		onAdded: { addListener() {}, removeListener() {} },
		onRemoved: { addListener() {}, removeListener() {} }
	};
	vi.stubGlobal('browser', { runtime: { id: 'test' }, permissions });
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string) => {
			calls.push(`fetch ${url}`);
			return new Response(RSS, { headers: { 'content-type': 'application/rss+xml' } });
		})
	);
	return { permissions, calls };
}

async function setup(feeds: string[] = []) {
	const app = createMemoryAppState();
	await Promise.all([app.config.load(), app.feeds.load(), app.feedReads.load()]);
	const settings = $state(parseRssSettings({ feeds: feeds.map((url) => ({ url })) }));
	render(Harness, {
		props: {
			app,
			component: RssSettings as unknown as Component<Record<string, unknown>>,
			props: {
				id: 'rss',
				settings,
				update: (mutate: (s: Settings) => void) => mutate(settings)
			} satisfies WidgetSettingsProps<Settings>
		}
	});
	return { app, settings, user: userEvent.setup() };
}

const addFeed = async (user: ReturnType<typeof userEvent.setup>, url: string) => {
	await user.type(screen.getByLabelText(t('rss.feedUrl')), `${url}{Enter}`);
};

describe('Einstellungen des RSS-Widgets', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('fragt das Recht vor dem Abruf an und übernimmt den Feed samt Einträgen', async () => {
		const { permissions, calls } = stubBrowser(true);
		const { app, settings, user } = await setup();
		await addFeed(user, 'http://www.example.org/feed');
		await vi.waitFor(() => expect(settings.feeds).toHaveLength(1));
		expect(permissions.request).toHaveBeenCalledWith({ origins: ['https://*.example.org/*'] });
		expect(calls[0]).toBe('request');
		expect(settings.feeds[0]).toMatchObject({ url: 'https://www.example.org/feed', name: '' });
		expect(app.feeds.value['https://www.example.org/feed'].items).toHaveLength(1);
		expect(screen.getByText(t('rss.add.upgraded'))).toBeInTheDocument();
		expect(screen.getByLabelText(t('rss.feedUrl'))).toHaveValue('');
	});

	it('legt ohne erlaubten Zugriff nichts an', async () => {
		stubBrowser(false);
		const { settings, user } = await setup();
		await addFeed(user, 'example.org/feed');
		await vi.waitFor(() => expect(screen.getByText(t('rss.add.denied'))).toBeInTheDocument());
		expect(settings.feeds).toHaveLength(0);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('meldet ungültige und doppelte Adressen, ohne Rechte anzufragen', async () => {
		const { permissions } = stubBrowser(true);
		const { user } = await setup(['https://example.org/feed']);
		await addFeed(user, 'ftp://example.org/');
		expect(screen.getByText(t('rss.add.invalid'))).toBeInTheDocument();
		await user.clear(screen.getByLabelText(t('rss.feedUrl')));
		await addFeed(user, 'example.org/feed');
		expect(screen.getByText(t('rss.add.duplicate'))).toBeInTheDocument();
		expect(permissions.request).not.toHaveBeenCalled();
	});

	it('entfernt Feeds mit Rückgängig im Dialog und benennt sie um', async () => {
		stubBrowser(true);
		const { settings, user } = await setup([
			'https://a.example.org/feed',
			'https://b.example.org/feed'
		]);
		await user.click(
			screen.getByRole('button', { name: t('rss.removeFeed', { name: 'a.example.org' }) })
		);
		expect(settings.feeds.map((f) => f.url)).toEqual(['https://b.example.org/feed']);
		await user.click(screen.getByRole('button', { name: t('common.undo') }));
		expect(settings.feeds.map((f) => f.url)).toEqual([
			'https://a.example.org/feed',
			'https://b.example.org/feed'
		]);
		const name = screen.getByLabelText(t('rss.feedName', { host: 'b.example.org' }));
		await user.type(name, '  Mein Feed  {Tab}');
		expect(settings.feeds[1].name).toBe('Mein Feed');
	});

	it('schaltet Optionen um', async () => {
		stubBrowser(true);
		const { settings, user } = await setup();
		await user.click(screen.getByRole('switch', { name: t('rss.showImages') }));
		expect(settings.showImages).toBe(true);
		const hour = new Intl.NumberFormat(i18n.lang, {
			style: 'unit',
			unit: 'hour',
			unitDisplay: 'short'
		}).format(1);
		await user.click(screen.getByRole('radio', { name: hour }));
		expect(settings.intervalMinutes).toBe(60);
	});
});
