import { fireEvent, render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import type { Component } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '$lib/i18n/index.svelte';
import { createMemoryAppState } from '$lib/state/app.svelte';
import Harness from '$lib/test/Harness.svelte';
import type { WidgetProps } from '../types';
import { emptyFeedState, type CachedItem, type FeedCache, type FeedReads } from './cache';
import RssFeed from './RssFeed.svelte';
import { parseRssSettings, type RssSettings } from './settings';

const A = 'https://a.example.org/feed';
const B = 'https://b.example.org/feed';
const NOW = Date.now();
const MIN = 60_000;

const item = (id: string, minutesAgo: number, extra: Partial<CachedItem> = {}): CachedItem => ({
	id,
	title: `Eintrag ${id}`,
	url: `https://a.example.org/${id}`,
	published: NOW - minutesAgo * MIN,
	summary: `Text ${id}`,
	image: null,
	firstSeen: NOW,
	...extra
});

const defaultCache = (): FeedCache => ({
	[A]: {
		...emptyFeedState(),
		title: 'Feed A',
		fetchedAt: NOW,
		items: [item('a1', 1), item('a2', 30)]
	},
	[B]: {
		...emptyFeedState(),
		title: 'Feed B',
		fetchedAt: NOW,
		items: [
			item('b1', 10, { url: 'https://b.example.org/1', image: 'https://b.example.org/1.jpg' })
		]
	}
});

async function setup(
	options: {
		settings?: Partial<RssSettings>;
		cache?: FeedCache;
		reads?: FeedReads;
		opensettings?: () => void;
	} = {}
) {
	const app = createMemoryAppState({
		feeds: options.cache ?? defaultCache(),
		feedReads: options.reads ?? {}
	});
	// Ohne `init`, damit der Dienst nichts abruft
	await Promise.all([app.config.load(), app.feeds.load(), app.feedReads.load()]);
	const settings = $state(
		parseRssSettings({ feeds: [{ url: A }, { url: B }], ...options.settings })
	);
	render(Harness, {
		props: {
			app,
			component: RssFeed as unknown as Component<Record<string, unknown>>,
			props: {
				id: 'rss',
				settings,
				editing: false,
				update: (mutate: (s: RssSettings) => void) => mutate(settings),
				opensettings: options.opensettings
			} satisfies WidgetProps<RssSettings>
		}
	});
	return { app, settings, user: userEvent.setup() };
}

const items = () => screen.getAllByRole('listitem').map((li) => within(li).getByRole('link'));
const titles = () => items().map((link) => link.querySelector('.text')?.textContent);

describe('RSS-Widget', () => {
	// jsdom kann nicht navigieren; Klicks auf Links sollen nur den Gelesen-Status ändern
	const stopNavigation = (event: Event) => event.preventDefault();
	beforeEach(() => document.addEventListener('click', stopNavigation));
	afterEach(() => {
		document.removeEventListener('click', stopNavigation);
		vi.unstubAllGlobals();
	});

	it('mischt die Einträge aller Feeds, neueste zuerst, mit Quelle', async () => {
		await setup();
		expect(titles()).toEqual(['Eintrag a1', 'Eintrag b1', 'Eintrag a2']);
		expect(items()[1]).toHaveTextContent('Feed B');
		expect(items()[0]).toHaveAttribute('href', 'https://a.example.org/a1');
		expect(items()[0]).toHaveAttribute('rel', 'noopener noreferrer');
		// Ungelesen auch für Screenreader
		expect(items()[0]).toHaveTextContent(`${t('rss.unread')}:`);
	});

	it('markiert beim Öffnen als gelesen', async () => {
		const { app, user } = await setup();
		await user.click(items()[0]);
		expect(app.feedReads.value).toEqual({ [A]: ['a1'] });
		expect(items()[0]).not.toHaveTextContent(`${t('rss.unread')}:`);
	});

	it('hat einen Tab-Stopp, Pfeiltasten wählen, M schaltet gelesen um', async () => {
		const { app, user } = await setup();
		expect(items().filter((link) => link.tabIndex === 0)).toHaveLength(1);
		items()[0].focus();
		await user.keyboard('{ArrowDown}');
		expect(document.activeElement).toBe(items()[1]);
		await user.keyboard('{End}');
		expect(document.activeElement).toBe(items()[2]);
		expect(items()[2].tabIndex).toBe(0);
		await user.keyboard('m');
		expect(app.feedReads.value).toEqual({ [A]: ['a2'] });
		await user.keyboard('m');
		expect(app.feedReads.value).toEqual({});
		await user.keyboard('{Home}');
		expect(document.activeElement).toBe(items()[0]);
	});

	it('öffnet mit Strg/Cmd+Enter in einem neuen Tab', async () => {
		const open = vi.fn();
		vi.stubGlobal('open', open);
		const { user } = await setup();
		items()[1].focus();
		await user.keyboard('{Control>}{Enter}{/Control}');
		expect(open).toHaveBeenCalledWith('https://b.example.org/1', '_blank', 'noopener,noreferrer');
	});

	it('markiert alle als gelesen und blendet Gelesenes auf Wunsch aus', async () => {
		const { app, settings, user } = await setup();
		await user.click(screen.getByRole('button', { name: t('rss.markAllRead') }));
		expect(app.feedReads.value).toEqual({ [A]: ['a1', 'a2'], [B]: ['b1'] });
		expect(screen.getByRole('button', { name: t('rss.markAllRead') })).toBeDisabled();
		settings.hideRead = true;
		await vi.waitFor(() => expect(screen.getByText(t('rss.allRead'))).toBeInTheDocument());
	});

	it('zeigt ohne Feeds einen Hinweis und den Weg in die Einstellungen', async () => {
		const opensettings = vi.fn();
		const { user } = await setup({ settings: { feeds: [] }, opensettings });
		expect(screen.getByText(t('rss.noFeeds'))).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: t('rss.addFeed') }));
		expect(opensettings).toHaveBeenCalled();
	});

	it('meldet Probleme der Feeds und bietet an, den Zugriff zu erlauben', async () => {
		const cache = defaultCache();
		cache[B] = { ...cache[B], error: { code: 'http', status: 503, at: NOW, attempts: 1 } };
		const { app } = await setup({ cache });
		app.rss.missing = ['https://*.a.example.org/*'];
		await vi.waitFor(() =>
			expect(screen.getByText(t('rss.problems', { count: 2 }))).toBeInTheDocument()
		);
		expect(
			screen.getByText(t('rss.error.http', { status: 503 }), { exact: false })
		).toBeInTheDocument();
		expect(screen.getByRole('button', { name: t('rss.allowAccess') })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: t('rss.retry') })).toBeInTheDocument();
	});

	it('zeigt HTML aus Feeds nur als Text', async () => {
		const cache = defaultCache();
		cache[A].items[0].title = '<img src=x onerror="alert(1)"><b>fett</b>';
		await setup({ cache });
		expect(items()[0].querySelector('img:not(.thumb), b')).toBeNull();
		expect(items()[0]).toHaveTextContent('<img src=x onerror="alert(1)"><b>fett</b>');
	});

	it('lädt keine Titelbilder, solange sie ausgeschaltet sind', async () => {
		await setup();
		expect(document.querySelector('.thumb')).toBeNull();
	});

	it('zeigt eingeschaltete Titelbilder ohne Referrer und entfernt sie bei Fehlern', async () => {
		await setup({ settings: { showImages: true } });
		const image = document.querySelector<HTMLImageElement>('.thumb')!;
		expect(image).toHaveAttribute('src', 'https://b.example.org/1.jpg');
		expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
		expect(image).toHaveAttribute('loading', 'lazy');
		expect(image).toHaveAttribute('alt', '');
		await fireEvent.error(image);
		expect(document.querySelector('.thumb')).toBeNull();
	});
});

describe('Sicherheit', () => {
	it('nutzt in den RSS-Komponenten kein {@html}', () => {
		const sources = import.meta.glob('./*.svelte', {
			query: '?raw',
			import: 'default',
			eager: true
		});
		expect(Object.keys(sources).length).toBeGreaterThan(0);
		for (const [file, source] of Object.entries(sources)) {
			expect(source, file).not.toMatch(/\{@html/);
		}
	});
});
