<script lang="ts">
	import { t } from '$lib/i18n/index.svelte';
	import { getApp } from '$lib/state/context';
	import type { WidgetProps } from '../types';
	import { listItems } from './schedule';
	import type { RssSettings } from './settings';

	/**
	 * Vorläufige, schlichte Liste (R2): zeigt die gemischten Einträge als Links. Gestaltung,
	 * Gelesen-Markierung, Titelbilder und Tastatur folgen in R3.
	 */
	let { settings }: WidgetProps<RssSettings> = $props();

	const app = getApp();
	const items = $derived(
		listItems(
			settings.feeds.map((feed) => feed.url),
			app.feeds.value,
			app.feedReads.value,
			settings
		)
	);
</script>

<div class="rss">
	{#if settings.title}
		<h2 class="title">{settings.title}</h2>
	{/if}
	{#if settings.feeds.length === 0}
		<p class="hint">{t('rss.noFeeds')}</p>
	{:else if items.length === 0}
		<p class="hint">{t('rss.noItems')}</p>
	{:else}
		<ul class="list">
			{#each items as entry (`${entry.feedUrl}|${entry.item.id}`)}
				<li class:read={entry.read}>
					{#if entry.item.url}
						<a
							href={entry.item.url}
							rel="noopener noreferrer"
							referrerpolicy="no-referrer"
							onclick={() => app.rss.setRead(entry.feedUrl, [entry.item.id], true)}
						>
							{entry.item.title || t('rss.untitled')}
						</a>
					{:else}
						<span>{entry.item.title || t('rss.untitled')}</span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.rss {
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		gap: var(--space-2);
		min-height: 0;
	}

	.title {
		font-size: var(--text-lg);
		font-weight: 700;
	}

	.hint {
		color: var(--text-secondary);
	}

	.list {
		min-height: 0;
		overflow-y: auto;
		margin: 0;
		padding: 0;
		list-style: none;

		li {
			padding: var(--space-1) 0;
		}

		a {
			color: inherit;
			text-decoration: none;

			&:hover {
				text-decoration: underline;
			}
		}

		.read {
			color: var(--text-secondary);
		}
	}
</style>
