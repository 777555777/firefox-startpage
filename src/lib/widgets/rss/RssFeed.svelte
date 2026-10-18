<script lang="ts" module>
	import { SvelteSet } from 'svelte/reactivity';

	/** Titelbilder, die in dieser Sitzung nicht luden oder zu klein waren; nicht erneut versuchen */
	const failedImages = new SvelteSet<string>();
	/** Schmaler ist eher ein Symbol oder ein Zählpixel als ein Titelbild */
	const MIN_IMAGE_WIDTH = 40;
	/** Titel-Ersatz aus der Zusammenfassung, wenn ein Eintrag keinen Titel hat */
	const SUMMARY_AS_TITLE = 120;
</script>

<script lang="ts">
	import { Sortable } from '$lib/dnd/sortable.svelte';
	import { i18n, t } from '$lib/i18n/index.svelte';
	import { patternsFor, requestAccess } from '$lib/net/permissions';
	import { getApp } from '$lib/state/context';
	import { toasts } from '$lib/state/toasts.svelte';
	import { announcer } from '$lib/ui/announcer.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import Menu, { type MenuAnchor, type MenuItem } from '$lib/ui/Menu.svelte';
	import { ScrollArea } from '$lib/ui/scroll-area.svelte';
	import { isModKey, isOverlayOpen, isTypingTarget } from '$lib/utils/keyboard';
	import { everyMinute } from '$lib/utils/now.svelte';
	import LinkIcon from '../links/LinkIcon.svelte';
	import { openUrl } from '../links/link-utils';
	import { digitOf } from '../links/nav';
	import { insertTab, moveTab, removeTab } from '../links/operations';
	import TabDialog from '../links/TabDialog.svelte';
	import type { WidgetProps } from '../types';
	import type { FeedState } from './cache';
	import {
		feedProblems,
		fullDate,
		lastFetched,
		relativeTime,
		sourceName,
		type FeedProblem
	} from './format';
	import { listItems, type ListedItem } from './schedule';
	import {
		activeTabOf,
		createRssTab,
		MAX_TABS,
		type RssFeed,
		type RssSettings,
		type RssTab
	} from './settings';
	import { truncate } from './text';

	let { id, settings, update, opensettings }: WidgetProps<RssSettings> = $props();

	const app = getApp();
	const rss = app.rss;
	const hintId = $derived(`rss-hint-${id}`);

	const cache = $derived(app.feeds.value);
	/** Die Liste zeigt nur die Feeds des aktiven Tabs (einer Kategorie) */
	const activeTab = $derived(activeTabOf(settings));
	const tabFeeds = $derived(activeTab.feeds);
	const urls = $derived(tabFeeds.map((feed) => feed.url));
	const feedOf = $derived(Object.fromEntries(tabFeeds.map((feed) => [feed.url, feed])));
	const items = $derived(listItems(urls, cache, app.feedReads.value, settings));
	/** Gibt es überhaupt Einträge (auch gelesene, die gerade ausgeblendet sind)? */
	const hasEntries = $derived(urls.some((url) => (cache[url]?.items.length ?? 0) > 0));
	const hasUnread = $derived(
		urls.some((url) => cache[url]?.items.some((item) => !rss.isRead(url, item.id)))
	);

	const now = $derived(everyMinute.current.getTime());
	const loading = $derived(urls.some((url) => rss.loading.includes(url)));
	const fetched = $derived(lastFetched(tabFeeds, cache));
	const problems = $derived(feedProblems(tabFeeds, cache, rss.missing));
	const missingPatterns = $derived(
		patternsFor(problems.filter((p) => p.code === 'permission').map((p) => p.feed.url))
	);

	let online = $state(typeof navigator === 'undefined' ? true : navigator.onLine);
	$effect(() => {
		const update = () => (online = navigator.onLine);
		window.addEventListener('online', update);
		window.addEventListener('offline', update);
		return () => {
			window.removeEventListener('online', update);
			window.removeEventListener('offline', update);
		};
	});

	const statusText = $derived.by(() => {
		const time = fetched === null ? null : relativeTime(fetched, now, i18n.lang);
		if (!online) return time ? t('rss.offline', { time }) : t('rss.offlineNoData');
		return time ? t('rss.updated', { time }) : t('rss.notLoaded');
	});

	const source = (feedUrl: string, state?: FeedState) => {
		const feed: Pick<RssFeed, 'url' | 'name'> = feedOf[feedUrl] ?? { url: feedUrl, name: '' };
		return sourceName(feed, state);
	};

	const headline = (entry: ListedItem) =>
		entry.item.title || truncate(entry.item.summary, SUMMARY_AS_TITLE) || t('rss.untitled');

	const keyOf = (entry: ListedItem) => `${entry.feedUrl}|${entry.item.id}`;

	function errorText(problem: FeedProblem): string {
		return t(`rss.error.${problem.code}`, { status: problem.status ?? '' });
	}

	// --- Gelesen und Öffnen -----------------------------------------------------------------

	/** Gelesen sofort speichern: beim Öffnen im selben Tab verlässt die Page gleich */
	function setRead(entry: ListedItem, read: boolean) {
		rss.setRead(entry.feedUrl, [entry.item.id], read);
		void app.feedReads.save();
	}

	function open(entry: ListedItem, newTab: boolean) {
		if (!entry.item.url) return;
		setRead(entry, true);
		openUrl(entry.item.url, newTab);
	}

	function markAllRead() {
		for (const url of urls) {
			const ids = cache[url]?.items.map((item) => item.id) ?? [];
			if (ids.length > 0) rss.setRead(url, ids, true);
		}
	}

	async function refresh() {
		await rss.refresh(urls);
		const count = feedProblems(tabFeeds, app.feeds.value, rss.missing).length;
		announcer.say(count > 0 ? t('rss.problems', { count }) : t('rss.refreshed'));
	}

	function retry() {
		void rss.refresh(problems.filter((p) => p.code !== 'permission').map((p) => p.feed.url));
	}

	/** Muss direkt im Klick laufen: Firefox fragt Rechte nur während einer Nutzeraktion an */
	function allowAccess() {
		void requestAccess(missingPatterns).then(async (granted) => {
			if (!granted) {
				toasts.show(t('rss.accessDenied'), { tone: 'error' });
				return;
			}
			await rss.checkAccess();
			await rss.refresh(urls);
		});
	}

	async function copy(url: string) {
		try {
			await navigator.clipboard.writeText(url);
			toasts.show(t('rss.copied'));
		} catch {
			toasts.show(t('rss.copyFailed'), { tone: 'error' });
		}
	}

	// --- Kontextmenü --------------------------------------------------------------------------

	let menuAnchor = $state<MenuAnchor | null>(null);
	let menuEntry = $state<ListedItem | null>(null);

	function openMenu(event: MouseEvent, entry: ListedItem) {
		event.preventDefault();
		menuEntry = entry;
		// Per Tastatur (Kontextmenü-Taste, Umschalt+F10) gibt es keine sinnvolle Zeigerposition
		menuAnchor =
			event.clientX || event.clientY
				? { x: event.clientX, y: event.clientY }
				: (event.currentTarget as HTMLElement);
	}

	const menuItems = $derived.by((): MenuItem[] => {
		const entry = menuEntry;
		if (!entry) return [];
		const url = entry.item.url;
		return [
			{ label: t('rss.open'), icon: 'link', disabled: !url, onselect: () => open(entry, false) },
			{
				label: t('rss.openNewTab'),
				icon: 'external',
				disabled: !url,
				onselect: () => open(entry, true)
			},
			{
				label: entry.read ? t('rss.markUnread') : t('rss.markRead'),
				icon: 'check',
				onselect: () => setRead(entry, !entry.read)
			},
			{
				label: t('rss.copyLink'),
				icon: 'copy',
				disabled: !url,
				onselect: () => url && void copy(url)
			}
		];
	});

	// --- Tastatur: ein Tab-Stopp für die ganze Liste (Roving Tabindex) -----------------------

	let list = $state<HTMLElement>();
	let activeKey = $state<string | null>(null);
	/** Der fokussierbare Eintrag: der zuletzt gewählte, solange es ihn gibt, sonst der erste */
	const focusKey = $derived(
		items.some((entry) => keyOf(entry) === activeKey)
			? activeKey
			: items[0]
				? keyOf(items[0])
				: null
	);

	function focusIndex(index: number) {
		const entry = items[index];
		if (!entry) return;
		activeKey = keyOf(entry);
		list?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.focus();
	}

	function onListKeydown(event: KeyboardEvent) {
		if (isTypingTarget(event.target) || items.length === 0) return;
		const current = Math.max(
			0,
			items.findIndex((entry) => keyOf(entry) === focusKey)
		);
		const last = items.length - 1;
		const targets: Record<string, number> = {
			ArrowDown: Math.min(last, current + 1),
			ArrowUp: Math.max(0, current - 1),
			Home: 0,
			End: last
		};
		if (event.key in targets && !event.altKey && !isModKey(event)) {
			event.preventDefault();
			focusIndex(targets[event.key]);
		} else if (event.key === 'Enter' && isModKey(event)) {
			event.preventDefault();
			open(items[current], true);
		} else if (event.key.toLowerCase() === 'm' && !event.altKey && !isModKey(event)) {
			event.preventDefault();
			setRead(items[current], !items[current].read);
		}
	}

	function onItemClick(event: MouseEvent, entry: ListedItem) {
		if (!entry.item.url) {
			event.preventDefault();
			return;
		}
		// Öffnen übernimmt der Browser (gleicher Tab, mit Strg/Cmd bzw. Mittelklick ein neuer)
		setRead(entry, true);
	}

	function onImageLoad(event: Event, src: string) {
		if ((event.currentTarget as HTMLImageElement).naturalWidth < MIN_IMAGE_WIDTH) {
			failedImages.add(src);
		}
	}

	const area = new ScrollArea();

	// --- Kategorien (Tabs), bedient wie im Link-Board --------------------------------------------

	const uid = $props.id();
	const tabName = (tab: RssTab) => tab.label || t('rss.untitledTab');

	/** Ungelesene Einträge eines Tabs, über alle Einträge im Cache, nicht nur die sichtbaren */
	function unreadOf(tab: RssTab): number {
		let count = 0;
		for (const feed of tab.feeds) {
			for (const item of cache[feed.url]?.items ?? []) {
				if (!rss.isRead(feed.url, item.id)) count++;
			}
		}
		return count;
	}

	const tabLabel = (tab: RssTab, unread: number) =>
		unread > 0 ? t('rss.tabUnread', { name: tabName(tab), count: unread }) : tabName(tab);

	function selectTab(tabId: string, focus = false) {
		update((s) => (s.activeTabId = tabId));
		activeKey = null;
		if (focus) document.getElementById(`${uid}-tab-${tabId}`)?.focus();
	}

	function onTabKeydown(event: KeyboardEvent, index: number) {
		const count = settings.tabs.length;
		const targets: Record<string, number> = {
			ArrowRight: (index + 1) % count,
			ArrowLeft: (index - 1 + count) % count,
			Home: 0,
			End: count - 1
		};
		if (!(event.key in targets)) return;
		event.preventDefault();
		selectTab(settings.tabs[targets[event.key]].id, true);
	}

	/** Solange das Widget den Fokus hat, wechselt Alt+1…9 die Kategorie */
	function onRootKeydown(event: KeyboardEvent) {
		if (event.defaultPrevented || !event.altKey || isTypingTarget(event.target)) return;
		if (event.ctrlKey || event.metaKey || event.shiftKey || isOverlayOpen()) return;
		const digit = digitOf(event);
		const tab = digit ? settings.tabs[digit - 1] : undefined;
		if (!tab) return;
		event.preventDefault();
		selectTab(tab.id, true);
	}

	// svelte-ignore state_referenced_locally
	const tabSort = new Sortable({
		group: `rss-tabs:${id}`,
		threshold: 5,
		longPress: 450,
		onmove: (tabId, _list, index) => update((s) => moveTab(s, tabId, index))
	});

	let tabDialog = $state(false);
	let editingTab = $state<RssTab | null>(null);
	let tabMenuAnchor = $state<MenuAnchor | null>(null);
	let tabMenuTab = $state<RssTab | null>(null);

	function addTab() {
		editingTab = null;
		tabDialog = true;
	}

	function editTab(tab: RssTab) {
		editingTab = tab;
		tabDialog = true;
	}

	function saveTab(data: { label: string; icon: string }) {
		const editing = editingTab;
		if (editing) {
			update((s) => {
				const tab = s.tabs.find((tab) => tab.id === editing.id);
				if (tab) Object.assign(tab, { label: data.label, icon: data.icon });
			});
			return;
		}
		if (settings.tabs.length >= MAX_TABS) return;
		const tab: RssTab = { ...createRssTab(data.label), icon: data.icon };
		update((s) => {
			insertTab(s, tab);
			s.activeTabId = tab.id;
		});
	}

	function deleteTab(tab: RssTab) {
		let removed: ReturnType<typeof removeTab<RssTab>> = null;
		update((s) => (removed = removeTab(s, tab.id)));
		const restore = removed as ReturnType<typeof removeTab<RssTab>>;
		if (!restore) {
			toasts.show(t('rss.lastTab'), { tone: 'error' });
			return;
		}
		toasts.show(t('rss.tabDeleted', { name: tabName(tab) }), {
			action: {
				label: t('common.undo'),
				run: () =>
					update((s) => {
						insertTab(s, restore.tab, restore.index);
						s.activeTabId = restore.tab.id;
					})
			}
		});
	}

	const tabMenuItems = $derived.by((): MenuItem[] => {
		const tab = tabMenuTab;
		if (!tab) return [];
		return [
			{ label: t('rss.editTab'), icon: 'pencil', onselect: () => editTab(tab) },
			{
				label: t('rss.addTab'),
				icon: 'plus',
				disabled: settings.tabs.length >= MAX_TABS,
				onselect: addTab
			},
			'separator',
			{
				label: t('rss.deleteTab'),
				icon: 'trash',
				danger: true,
				disabled: settings.tabs.length <= 1,
				onselect: () => deleteTab(tab)
			}
		];
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="rss" onkeydown={onRootKeydown}>
	<div class="head">
		<div
			class="tablist"
			role="tablist"
			aria-label={t('rss.tabs')}
			{@attach tabSort.list({ id: 'tabs', axis: 'horizontal' })}
		>
			{#each settings.tabs as tab, index (tab.id)}
				{@const unread = unreadOf(tab)}
				{@const troubled = feedProblems(tab.feeds, cache, rss.missing).length > 0}
				<button
					type="button"
					role="tab"
					id="{uid}-tab-{tab.id}"
					class="tab"
					class:dragging={tabSort.isDragging(tab.id)}
					aria-selected={tab.id === activeTab.id}
					aria-controls="{uid}-panel"
					aria-label={tabLabel(tab, unread)}
					tabindex={tab.id === activeTab.id ? 0 : -1}
					onclick={() => selectTab(tab.id)}
					ondblclick={() => editTab(tab)}
					oncontextmenu={(event) => {
						event.preventDefault();
						tabMenuTab = tab;
						tabMenuAnchor =
							event.clientX || event.clientY
								? { x: event.clientX, y: event.clientY }
								: event.currentTarget;
					}}
					onkeydown={(event) => onTabKeydown(event, index)}
					{@attach tabSort.item({ id: tab.id, list: 'tabs' })}
				>
					{#if tab.icon}<span class="tab-icon" aria-hidden="true">{tab.icon}</span>{/if}
					<span aria-hidden="true">{tabName(tab)}</span>
					{#if troubled}
						<span class="tab-warning" title={t('rss.tabProblem')} aria-hidden="true">
							<Icon name="warning" size={12} />
						</span>
					{/if}
					{#if unread > 0}
						<span class="count" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>
					{/if}
				</button>
			{/each}
		</div>
		<button
			type="button"
			class="icon-btn add-tab"
			aria-label={t('rss.addTab')}
			title={t('rss.addTab')}
			disabled={settings.tabs.length >= MAX_TABS}
			onclick={addTab}
		>
			<Icon name="plus" size={16} />
		</button>
		<span class="spacer"></span>
		<button
			type="button"
			class="icon-btn"
			aria-label={t('rss.markAllRead')}
			title={t('rss.markAllRead')}
			disabled={!hasUnread}
			onclick={markAllRead}
		>
			<Icon name="checkAll" size={18} />
		</button>
		<button
			type="button"
			class="icon-btn"
			class:spinning={loading}
			aria-label={t('rss.refresh')}
			aria-describedby="{id}-status"
			title="{t('rss.refresh')} · {statusText}"
			disabled={urls.length === 0}
			onclick={refresh}
		>
			<Icon name="refresh" size={18} />
		</button>
		<span id="{id}-status" class="visually-hidden">{statusText}</span>
	</div>

	<div class="tabpanel" role="tabpanel" id="{uid}-panel" aria-labelledby="{uid}-tab-{activeTab.id}">
		{#if tabFeeds.length === 0}
			<div class="empty">
				<p>{t('rss.noFeeds')}</p>
				{#if opensettings}
					<button type="button" class="btn" onclick={opensettings}>
						<Icon name="plus" size={16} />
						{t('rss.addFeed')}
					</button>
				{/if}
			</div>
		{:else if items.length === 0}
			<div class="empty">
				<p>{hasEntries ? t('rss.allRead') : loading ? '' : t('rss.noItems')}</p>
			</div>
		{:else}
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<ul
				bind:this={list}
				class="list"
				class:fade-top={area.fadeTop}
				class:fade-bottom={area.fadeBottom}
				aria-label={t('rss.entries')}
				aria-describedby={hintId}
				onkeydown={onListKeydown}
				{@attach area.attach}
			>
				{#each items as entry, i (keyOf(entry))}
					{@const state = cache[entry.feedUrl]}
					{@const name = source(entry.feedUrl, state)}
					{@const image =
						settings.showImages && entry.item.image && !failedImages.has(entry.item.image)
							? entry.item.image
							: null}
					<li class="entry" class:unread={!entry.read}>
						<a
							class="item"
							href={entry.item.url ?? undefined}
							aria-disabled={entry.item.url ? undefined : 'true'}
							rel="noopener noreferrer"
							referrerpolicy="no-referrer"
							lang={state?.language ?? undefined}
							data-index={i}
							tabindex={keyOf(entry) === focusKey ? 0 : -1}
							draggable="false"
							onclick={(event) => onItemClick(event, entry)}
							onauxclick={(event) => event.button === 1 && entry.item.url && setRead(entry, true)}
							onfocus={() => (activeKey = keyOf(entry))}
							oncontextmenu={(event) => openMenu(event, entry)}
						>
							<span class="icon">
								<LinkIcon url={state?.siteUrl ?? entry.feedUrl} label={name} size={16} />
							</span>
							<span class="body">
								<span class="headline">
									{#if !entry.read}
										<span class="dot" aria-hidden="true"></span>
										<span class="visually-hidden">{t('rss.unread')}:</span>
									{/if}
									<span class="text">{headline(entry)}</span>
								</span>
								{#if settings.showSummary && entry.item.title && entry.item.summary}
									<span class="summary">{entry.item.summary}</span>
								{/if}
								<span class="meta">
									<span class="source">{name}</span>
									<span aria-hidden="true">·</span>
									<time
										datetime={new Date(entry.date).toISOString()}
										title={fullDate(entry.date, i18n.lang)}
									>
										{relativeTime(entry.date, now, i18n.lang)}
									</time>
								</span>
							</span>
							{#if image}
								<img
									class="thumb"
									src={image}
									alt=""
									loading="lazy"
									decoding="async"
									referrerpolicy="no-referrer"
									draggable="false"
									onload={(event) => onImageLoad(event, image)}
									onerror={() => failedImages.add(image)}
								/>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
			<p id={hintId} class="visually-hidden">{t('rss.listHint')}</p>
		{/if}

		{#if !online || problems.length > 0}
			<div class="foot">
				{#if !online}
					<p class="note"><Icon name="warning" size={14} /> {statusText}</p>
				{/if}
				{#if problems.length > 0}
					<details class="problems">
						<summary>
							<Icon name="warning" size={14} />
							{t('rss.problems', { count: problems.length })}
						</summary>
						<ul>
							{#each problems as problem (problem.feed.id)}
								<li>
									<strong>{source(problem.feed.url, cache[problem.feed.url])}</strong>:
									{errorText(problem)}
								</li>
							{/each}
						</ul>
					</details>
					<div class="actions">
						{#if missingPatterns.length > 0}
							<button type="button" class="btn" onclick={allowAccess}>
								{t('rss.allowAccess')}
							</button>
						{/if}
						{#if problems.some((p) => p.code !== 'permission')}
							<button type="button" class="btn" onclick={retry}>{t('rss.retry')}</button>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<Menu bind:anchor={menuAnchor} label={t('rss.entries')} items={menuItems} />
<Menu bind:anchor={tabMenuAnchor} label={t('rss.tabs')} items={tabMenuItems} />
<TabDialog
	bind:open={tabDialog}
	tab={editingTab}
	canDelete={settings.tabs.length > 1}
	showView={false}
	labels={{ edit: t('rss.editTab'), create: t('rss.newTab'), remove: t('rss.deleteTab') }}
	onsave={saveTab}
	ondelete={() => editingTab && deleteTab(editingTab)}
/>

<style>
	.rss {
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		gap: var(--space-2);
		min-height: 0;
		container-type: inline-size;
	}

	/* Wie die Tab-Leiste im Link-Board bleibt der Kopf innerhalb des Innenabstands */
	.head {
		display: flex;
		/* Mit Höchsthöhe würde der Flex-Container den Kopf sonst zusammendrücken */
		flex: none;
		align-items: center;
		gap: var(--space-1);
	}

	.spacer {
		flex: 1;
	}

	/* Der Inhalt eines Tabs füllt den Rest; mit Höchsthöhe scrollt darin nur die Liste */
	.tabpanel {
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		gap: var(--space-2);
		min-height: 0;
	}

	/* --- Kategorien, gestaltet wie die Tabs des Link-Boards --- */

	.tablist {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		min-width: 0;
	}

	.tab {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		height: 30px;
		padding: 0 var(--space-3);
		border: none;
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--text-secondary);
		font-size: var(--text-sm);
		font-weight: 650;
		white-space: nowrap;
		transition:
			background-color var(--duration-fast) ease,
			color var(--duration-fast) ease,
			box-shadow var(--duration-fast) ease;

		&:hover {
			background: var(--fill);
			color: var(--text);
		}

		&[aria-selected='true'] {
			background: var(--raised);
			color: var(--text);
			box-shadow:
				0 1px 3px rgb(var(--shade) / 0.16),
				inset 0 1px 0 var(--highlight);
		}

		&:focus-visible {
			box-shadow: var(--focus-ring);
		}

		&.dragging {
			opacity: 0.35;
		}
	}

	.tab-icon {
		font-size: 1.05em;
	}

	.tab-warning {
		display: inline-grid;
		color: var(--danger);
	}

	/* Ungelesene: kleine Pille in Akzentfarbe */
	.count {
		display: inline-grid;
		place-items: center;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		border-radius: var(--radius-full);
		background: var(--accent);
		color: var(--on-accent);
		font-size: 10px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.add-tab {
		width: 28px;
		height: 28px;
		opacity: 0.6;

		&:hover,
		&:focus-visible {
			opacity: 1;
		}
	}

	.spinning :global(svg) {
		animation: spin 1s linear infinite;
	}

	@media (prefers-reduced-motion: reduce) {
		.spinning :global(svg) {
			animation: pulse 1.2s ease-in-out infinite alternate;
		}
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes pulse {
		to {
			opacity: 0.35;
		}
	}

	.empty {
		display: grid;
		justify-items: start;
		gap: var(--space-3);
		color: var(--text-secondary);
	}

	.list {
		--fade: 12px;
		/*
		 * Bezugsrahmen für absolut positionierte Kinder (z. B. „Ungelesen:“ für Screenreader),
		 * sonst ragen sie aus weggescrollten Einträgen heraus und verlängern die Page
		 */
		position: relative;
		display: grid;
		flex: 1 1 auto;
		align-content: start;
		gap: 2px;
		min-height: 0;
		overflow-y: auto;
		/* Platz für Fokusringe am Rand des Scrollbereichs */
		margin: 0 -4px;
		padding: 4px;
		list-style: none;
		scroll-padding-block: var(--space-3);

		&.fade-top {
			mask-image: linear-gradient(transparent, #000 var(--fade));
		}

		&.fade-bottom {
			mask-image: linear-gradient(#000 calc(100% - var(--fade)), transparent);
		}

		&.fade-top.fade-bottom {
			mask-image: linear-gradient(
				transparent,
				#000 var(--fade),
				#000 calc(100% - var(--fade)),
				transparent
			);
		}
	}

	.item {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-2);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		text-decoration: none;
		transition: background-color var(--duration-fast) ease;

		&:hover {
			background: var(--fill-hover);
		}

		&[aria-disabled='true'] {
			cursor: default;
		}
	}

	.icon {
		display: grid;
		flex: none;
		/* Auf Höhe der ersten Titelzeile */
		padding-top: 2px;
	}

	.body {
		display: grid;
		flex: 1;
		gap: 2px;
		min-width: 0;
	}

	.headline {
		display: flex;
		align-items: baseline;
		gap: 6px;
		font-size: var(--text-sm);
		line-height: 1.35;
	}

	.text,
	.summary {
		display: -webkit-box;
		overflow: hidden;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		text-wrap: pretty;
		overflow-wrap: anywhere;
	}

	.unread {
		.item {
			color: var(--text);
		}

		.headline {
			font-weight: 600;
		}
	}

	.dot {
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: var(--radius-full);
		background: var(--accent);
		/* Mittig zur ersten Zeile, unabhängig von der Grundlinie */
		transform: translateY(-1px);
	}

	.summary {
		font-size: var(--text-xs);
		line-height: 1.4;
		color: var(--text-secondary);
	}

	.meta {
		display: flex;
		gap: 4px;
		min-width: 0;
		font-size: var(--text-xs);
		color: var(--text-secondary);
		white-space: nowrap;
	}

	.source {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	time {
		flex: none;
	}

	.thumb {
		flex: none;
		width: 72px;
		height: 48px;
		border-radius: var(--radius-xs);
		background: var(--field);
		object-fit: cover;
	}

	@container (width < 18rem) {
		.thumb {
			width: 56px;
			height: 40px;
		}
	}

	.foot {
		display: grid;
		gap: var(--space-2);
		padding-top: var(--space-2);
		border-top: 1px solid var(--line);
		font-size: var(--text-xs);
		color: var(--text-secondary);
	}

	.note,
	.problems summary {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.problems {
		summary {
			cursor: pointer;
			font-weight: 600;
		}

		ul {
			display: grid;
			gap: 2px;
			margin: var(--space-2) 0 0;
			padding-left: var(--space-5);
		}
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);

		&:empty {
			display: none;
		}
	}
</style>
