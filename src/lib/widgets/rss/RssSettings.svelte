<script lang="ts">
	import { createId } from '$lib/config/parse';
	import { i18n, t } from '$lib/i18n/index.svelte';
	import { normalizeFeedUrl } from '$lib/net/feed-url';
	import { originPattern, requestAccess } from '$lib/net/permissions';
	import { getApp } from '$lib/state/context';
	import { toasts } from '$lib/state/toasts.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import Segmented from '$lib/ui/Segmented.svelte';
	import Switch from '$lib/ui/Switch.svelte';
	import LinkIcon from '../links/LinkIcon.svelte';
	import type { WidgetSettingsProps } from '../types';
	import { probeFeed, type ProbeResult } from './add-feed';
	import { applyFetched } from './cache';
	import type { FeedLink } from './discover';
	import { feedProblems, sourceName, type FeedProblem } from './format';
	import {
		activeTabOf,
		allFeeds,
		INTERVALS,
		MAX_FEEDS,
		MAX_ITEMS,
		NAME_MAX,
		type RssFeed,
		type RssSettings,
		type RssTab
	} from './settings';

	let { settings, update }: WidgetSettingsProps<RssSettings> = $props();
	const id = $props.id();
	const app = getApp();

	const cache = $derived(app.feeds.value);
	const problems = $derived(feedProblems(allFeeds(settings), cache, app.rss.missing));
	const tabName = (tab: RssTab) => tab.label || t('rss.untitledTab');
	const multipleTabs = $derived(settings.tabs.length > 1);

	/** Kategorie, in die ein neuer Feed kommt; Standard ist die im Widget gewählte */
	let targetTabId = $state<string | null>(null);
	const targetTab = $derived(
		settings.tabs.find((tab) => tab.id === targetTabId) ?? activeTabOf(settings)
	);
	const full = $derived(targetTab.feeds.length >= MAX_FEEDS);

	const host = (url: string) => {
		try {
			return new URL(url).hostname.replace(/^www\./, '');
		} catch {
			return url;
		}
	};

	const intervalLabel = (minutes: number) =>
		new Intl.NumberFormat(i18n.lang, {
			style: 'unit',
			unit: minutes < 60 ? 'minute' : 'hour',
			unitDisplay: 'short'
		}).format(minutes < 60 ? minutes : minutes / 60);

	// Nach Adresse, weil derselbe Feed in mehreren Kategorien stehen darf
	const problemOf = (feed: RssFeed): FeedProblem | undefined =>
		problems.find((problem) => problem.feed.url === feed.url);

	const errorText = (code: string, status?: number) =>
		code === 'notFound'
			? t('rss.add.notFound')
			: t(`rss.error.${code as FeedProblem['code']}`, { status: status ?? '' });

	// --- Feed hinzufügen ------------------------------------------------------------------------

	let input = $state('');
	let busy = $state(false);
	let message = $state<{ text: string; error: boolean } | null>(null);
	/** Mehrere Feeds auf der eingegebenen Seite */
	let choices = $state<FeedLink[]>([]);
	/** Gefundener Feed auf einer anderen Origin, die noch ein Recht braucht */
	let pendingAccess = $state<{ url: string; pattern: string } | null>(null);
	/** Die Eingabe war http; der Hinweis bleibt nach dem Hinzufügen stehen */
	let upgraded = false;

	const isAdded = (url: string) => targetTab.feeds.some((feed) => feed.url === url);

	function reset() {
		removed = null;
		message = null;
		choices = [];
		pendingAccess = null;
	}

	/**
	 * Fragt das Recht an und prüft dann die Adresse. `requestAccess` muss vor jedem `await` im
	 * Klick laufen, sonst lehnt Firefox die Anfrage ab.
	 */
	function check(url: string, pattern: string, depth = 0) {
		const access = requestAccess([pattern]);
		busy = true;
		void access
			.then((granted) =>
				granted ? probeFeed(url, {}, depth) : Promise.resolve<ProbeResult | null>(null)
			)
			.then((result) => {
				if (result === null) message = { text: t('rss.add.denied'), error: true };
				else handle(result);
			})
			.finally(() => (busy = false));
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		reset();
		const normalized = normalizeFeedUrl(input);
		const pattern = normalized && originPattern(normalized.url);
		if (!normalized || !pattern) {
			message = { text: t('rss.add.invalid'), error: true };
			return;
		}
		if (isAdded(normalized.url)) {
			message = { text: t('rss.add.duplicate'), error: true };
			return;
		}
		upgraded = normalized.upgraded;
		check(normalized.url, pattern);
	}

	function choose(link: FeedLink) {
		const pattern = originPattern(link.url);
		if (!pattern) return;
		reset();
		if (isAdded(link.url)) {
			message = { text: t('rss.add.duplicate'), error: true };
			return;
		}
		// Tiefe 1: eine ausgewählte Adresse wird nicht erneut nach Feeds durchsucht
		check(link.url, pattern, 1);
	}

	function allowPending() {
		const pending = pendingAccess;
		if (!pending) return;
		reset();
		check(pending.url, pending.pattern, 1);
	}

	function handle(result: ProbeResult) {
		switch (result.kind) {
			case 'feed':
				if (isAdded(result.url)) {
					message = { text: t('rss.add.duplicate'), error: true };
					return;
				}
				add(result);
				return;
			case 'choose':
				choices = result.links.filter((link) => !isAdded(link.url));
				if (choices.length === 0) message = { text: t('rss.add.duplicate'), error: true };
				return;
			case 'needsAccess':
				pendingAccess = { url: result.url, pattern: result.pattern };
				return;
			case 'error':
				message = { text: errorText(result.code, result.status), error: true };
		}
	}

	function add(result: Extract<ProbeResult, { kind: 'feed' }>) {
		const feed: RssFeed = { id: createId(), url: result.url, name: '' };
		const tabId = targetTab.id;
		update((s) => {
			s.tabs.find((tab) => tab.id === tabId)?.feeds.push(feed);
		});
		// Der Abruf zum Prüfen füllt gleich den Cache, damit das Widget sofort Einträge zeigt
		app.feeds.value[result.url] = applyFetched(
			app.feeds.value[result.url],
			result.feed,
			result,
			Date.now()
		);
		void app.rss.checkAccess();
		input = '';
		if (upgraded) message = { text: t('rss.add.upgraded'), error: false };
		toasts.show(t('rss.feedAdded', { name: result.feed.title || host(result.url) }));
	}

	// --- Liste der Feeds -----------------------------------------------------------------------

	function rename(feed: RssFeed, value: string) {
		update((s) => {
			const target = s.tabs.flatMap((tab) => tab.feeds).find((f) => f.id === feed.id);
			if (target) target.name = value.trim().slice(0, NAME_MAX);
		});
	}

	/** Verschiebt einen Feed in eine andere Kategorie; steht er dort schon, fällt er hier weg */
	function moveToTab(feed: RssFeed, fromId: string, toId: string) {
		reset();
		update((s) => {
			const from = s.tabs.find((tab) => tab.id === fromId);
			const to = s.tabs.find((tab) => tab.id === toId);
			if (!from || !to || from === to) return;
			const index = from.feeds.findIndex((f) => f.id === feed.id);
			if (index === -1) return;
			const [moved] = from.feeds.splice(index, 1);
			if (!to.feeds.some((f) => f.url === moved.url) && to.feeds.length < MAX_FEEDS) {
				to.feeds.push(moved);
			}
		});
	}

	/**
	 * Zuletzt entfernter Feed. Rückgängig steht im Dialog selbst und nicht als Toast: Toasts
	 * liegen unter dem modalen Dialog und wären dort nicht klickbar.
	 */
	let removed = $state<{ feed: RssFeed; tabId: string; index: number; name: string } | null>(null);

	function remove(feed: RssFeed, tab: RssTab) {
		const index = tab.feeds.findIndex((f) => f.id === feed.id);
		if (index === -1) return;
		reset();
		removed = {
			feed: $state.snapshot(feed) as RssFeed,
			tabId: tab.id,
			index,
			name: sourceName(feed, cache[feed.url])
		};
		update((s) => {
			s.tabs.find((t) => t.id === tab.id)?.feeds.splice(index, 1);
		});
	}

	function undoRemove() {
		const last = removed;
		removed = null;
		if (!last) return;
		update((s) => {
			// Gibt es die Kategorie nicht mehr, kommt der Feed in die erste
			const tab = s.tabs.find((t) => t.id === last.tabId) ?? s.tabs[0];
			if (tab.feeds.some((f) => f.url === last.feed.url) || tab.feeds.length >= MAX_FEEDS) return;
			tab.feeds.splice(Math.min(last.index, tab.feeds.length), 0, last.feed);
		});
	}
</script>

<div class="form">
	<section class="feeds" aria-labelledby="{id}-feeds">
		<h3 class="field-label" id="{id}-feeds">{t('rss.feeds')}</h3>

		{#each settings.tabs as tab (tab.id)}
			{#if multipleTabs}
				<h4 class="tab-heading">
					{#if tab.icon}<span aria-hidden="true">{tab.icon}</span>{/if}
					{tabName(tab)}
				</h4>
			{/if}
			{#if tab.feeds.length === 0 && multipleTabs}
				<p class="field-hint">{t('rss.noFeeds')}</p>
			{/if}
			<ul class="feed-list">
				{#each tab.feeds as feed (feed.id)}
					{@const state = cache[feed.url]}
					{@const problem = problemOf(feed)}
					<li class="feed">
						<LinkIcon url={state?.siteUrl ?? feed.url} label={sourceName(feed, state)} size={20} />
						<div class="feed-body">
							<input
								class="input name"
								type="text"
								maxlength={NAME_MAX}
								value={feed.name}
								placeholder={state?.title || host(feed.url)}
								aria-label={t('rss.feedName', { host: host(feed.url) })}
								onchange={(event) => rename(feed, event.currentTarget.value)}
							/>
							<span class="feed-host" title={feed.url}>{host(feed.url)}</span>
							{#if multipleTabs}
								<select
									class="select tab-select"
									aria-label={t('rss.feedTab', { name: sourceName(feed, state) })}
									value={tab.id}
									onchange={(event) => moveToTab(feed, tab.id, event.currentTarget.value)}
								>
									{#each settings.tabs as option (option.id)}
										<option value={option.id}>{option.icon} {tabName(option)}</option>
									{/each}
								</select>
							{/if}
							{#if problem}
								<span class="field-error">{errorText(problem.code, problem.status)}</span>
							{/if}
						</div>
						<button
							type="button"
							class="icon-btn"
							aria-label={t('rss.removeFeed', { name: sourceName(feed, state) })}
							onclick={() => remove(feed, tab)}
						>
							<Icon name="trash" />
						</button>
					</li>
				{/each}
			</ul>
		{/each}

		{#if removed}
			<div class="removed" role="status">
				<span>{t('rss.feedRemoved', { name: removed.name })}</span>
				<button type="button" class="btn" onclick={undoRemove}>{t('common.undo')}</button>
			</div>
		{/if}

		<form class="add" onsubmit={submit}>
			<label class="field-label" for="{id}-url">{t('rss.feedUrl')}</label>
			{#if multipleTabs}
				<div class="target">
					<label class="field-hint" for="{id}-target">{t('rss.addTo')}</label>
					<select
						id="{id}-target"
						class="select"
						value={targetTab.id}
						onchange={(event) => {
							targetTabId = event.currentTarget.value;
							reset();
						}}
					>
						{#each settings.tabs as option (option.id)}
							<option value={option.id}>{option.icon} {tabName(option)}</option>
						{/each}
					</select>
				</div>
			{/if}
			<div class="add-row">
				<input
					id="{id}-url"
					class="input"
					type="text"
					inputmode="url"
					autocomplete="off"
					spellcheck="false"
					placeholder="https://"
					disabled={full}
					aria-describedby="{id}-access-hint"
					aria-invalid={message?.error ? 'true' : undefined}
					bind:value={input}
				/>
				<button type="submit" class="btn" disabled={busy || full || !input.trim()}>
					{busy ? t('rss.checking') : t('rss.add')}
				</button>
			</div>

			{#if message}
				<p
					class={message.error ? 'field-error' : 'field-hint'}
					role={message.error ? 'alert' : 'status'}
				>
					{message.text}
				</p>
			{/if}

			{#if choices.length > 0}
				<p class="field-hint" role="status">{t('rss.add.choose')}</p>
				<ul class="choices">
					{#each choices as link (link.url)}
						<li>
							<button type="button" class="btn choice" disabled={busy} onclick={() => choose(link)}>
								<span class="choice-title">{link.title || host(link.url)}</span>
								<span class="choice-url">{link.url}</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}

			{#if pendingAccess}
				<p class="field-hint" role="status">
					{t('rss.add.needsAccess', { host: host(pendingAccess.url) })}
				</p>
				<button type="button" class="btn" disabled={busy} onclick={allowPending}>
					{t('rss.add.allowFor', { host: host(pendingAccess.url) })}
				</button>
			{/if}

			<p class="field-hint" id="{id}-access-hint">
				{full ? t('rss.maxFeeds', { count: MAX_FEEDS }) : t('rss.accessHint')}
			</p>
		</form>
	</section>

	<div class="field">
		<label class="field-label" for="{id}-items">{t('rss.maxItems')}</label>
		<div class="range">
			<input
				id="{id}-items"
				type="range"
				min={MAX_ITEMS.min}
				max={MAX_ITEMS.max}
				step="1"
				value={settings.maxItems}
				oninput={(event) => {
					const value = event.currentTarget.valueAsNumber;
					update((s) => (s.maxItems = value));
				}}
			/>
			<output for="{id}-items">{settings.maxItems}</output>
		</div>
	</div>

	<div class="row">
		<span class="field-label">{t('rss.interval')}</span>
		<Segmented
			label={t('rss.interval')}
			value={settings.intervalMinutes}
			options={INTERVALS.map((minutes) => ({ value: minutes, label: intervalLabel(minutes) }))}
			onchange={(value) => update((s) => (s.intervalMinutes = value))}
		/>
	</div>

	<div class="field">
		<span class="field-label">{t('fit.height')}</span>
		<Segmented
			label={t('fit.height')}
			value={settings.height}
			options={[
				{ value: 'window', label: t('fit.window') },
				{ value: 'content', label: t('fit.content') }
			]}
			onchange={(value) => update((s) => (s.height = value))}
		/>
		<p class="field-hint">{t('fit.hintRss')}</p>
	</div>

	<div class="switches">
		<Switch
			label={t('rss.showSummary')}
			checked={settings.showSummary}
			onchange={(value) => update((s) => (s.showSummary = value))}
		/>
		<div>
			<Switch
				label={t('rss.showImages')}
				checked={settings.showImages}
				onchange={(value) => update((s) => (s.showImages = value))}
			/>
			<p class="field-hint">{t('rss.imagesHint')}</p>
		</div>
		<Switch
			label={t('rss.hideRead')}
			checked={settings.hideRead}
			onchange={(value) => update((s) => (s.hideRead = value))}
		/>
	</div>

	<p class="field-hint">{t('rss.heightHint')}</p>
</div>

<style>
	.form {
		display: grid;
		gap: var(--space-5);
	}

	.feeds,
	.add {
		display: grid;
		gap: var(--space-2);
	}

	.feed-list {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.feed {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);

		:global(.link-icon) {
			margin-top: 8px;
		}
	}

	.feed-body {
		display: grid;
		flex: 1;
		gap: 2px;
		min-width: 0;
	}

	.tab-heading {
		display: flex;
		gap: var(--space-1);
		margin-top: var(--space-2);
		font-size: var(--text-sm);
		font-weight: 650;
	}

	.tab-select {
		/* Im Grid der Zeile nicht auf volle Breite strecken */
		justify-self: start;
		width: auto;
		max-width: 100%;
		min-height: 30px;
		margin-top: 2px;
		font-size: var(--text-xs);
	}

	.target {
		display: flex;
		align-items: center;
		gap: var(--space-2);

		.select {
			width: auto;
			min-width: 0;
			min-height: 30px;
			font-size: var(--text-sm);
		}
	}

	.feed-host {
		overflow: hidden;
		font-size: var(--text-xs);
		color: var(--text-secondary);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.removed {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.add-row {
		display: flex;
		gap: var(--space-2);

		.input {
			flex: 1;
			min-width: 0;
		}

		.btn {
			flex: none;
		}
	}

	.choices {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* Auswahl wie eine Listenzeile: linksbündig, zweizeilig, mit normalem Eckenradius */
	.choice {
		display: grid;
		justify-content: stretch;
		justify-items: start;
		gap: 2px;
		width: 100%;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-sm);
		text-align: start;
		white-space: normal;
	}

	.choice-title {
		font-weight: 600;
	}

	.choice-url {
		max-width: 100%;
		overflow: hidden;
		font-size: var(--text-xs);
		font-weight: 400;
		color: var(--text-secondary);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.range {
		display: flex;
		align-items: center;
		gap: var(--space-3);

		input {
			flex: 1;
		}

		output {
			min-width: 2ch;
			font-weight: 600;
			font-variant-numeric: tabular-nums;
			text-align: end;
		}
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.switches {
		display: grid;
		gap: var(--space-2);
	}
</style>
