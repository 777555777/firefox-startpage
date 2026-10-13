<script lang="ts">
	import type { SearchEngine } from '$lib/config/types';
	import { t } from '$lib/i18n/index.svelte';
	import { getApp } from '$lib/state/context';
	import Icon from '$lib/ui/Icon.svelte';
	import Menu, { type MenuAnchor } from '$lib/ui/Menu.svelte';
	import { isModKey } from '$lib/utils/keyboard';
	import LinkIcon from '../links/LinkIcon.svelte';
	import { allLinks, linkTitle, openUrl, type FlatLink } from '../links/link-utils';
	import type { WidgetProps } from '../types';
	import { parseBang, searchUrl } from './bangs';
	import { searchLinks } from './fuzzy';
	import type { SearchSettings } from './settings';

	let { settings }: WidgetProps<SearchSettings> = $props();

	const app = getApp();
	const id = $props.id();
	const listboxId = `${id}-listbox`;

	let query = $state('');
	let open = $state(false);
	/** Index der markierten Option; -1 = keine Auswahl, Enter sucht */
	let active = $state(-1);
	/** Per Umschalter gewählte Engine; gilt nur bis zum Absenden */
	let chosenId = $state<string | null>(null);
	let engineMenu = $state<MenuAnchor | null>(null);
	let input = $state<HTMLInputElement>();

	const search = $derived(app.config.value.search);
	const defaultEngine = $derived(
		search.engines.find((e) => e.id === search.defaultEngineId) ?? search.engines[0]
	);
	const chosen = $derived(search.engines.find((e) => e.id === chosenId) ?? defaultEngine);
	const parsed = $derived(parseBang(query, search.engines));
	const engine = $derived<SearchEngine | undefined>(parsed.engine ?? chosen);

	const suggestions = $derived<FlatLink[]>(
		settings.suggestLinks && query.trim() && !parsed.engine
			? searchLinks(query, allLinks(app.config.value), app.stats.value)
			: []
	);
	/** Optionen: Link-Vorschläge plus die Websuche als letzte Zeile */
	const optionCount = $derived(suggestions.length + (query.trim() && engine ? 1 : 0));
	const expanded = $derived(open && suggestions.length > 0);

	$effect(() => {
		// Neue Eingabe hebt die Auswahl auf
		void query;
		active = -1;
	});

	function reset() {
		query = '';
		chosenId = null;
		open = false;
	}

	function openLink(link: FlatLink, newTab: boolean) {
		app.recordOpen(link.url);
		openUrl(link.url, newTab || link.target === 'blank');
		if (newTab || link.target === 'blank') reset();
	}

	function submit(newTab: boolean) {
		if (!engine) return;
		const url = searchUrl(engine, parsed.query);
		openUrl(url, newTab);
		reset();
	}

	function onkeydown(event: KeyboardEvent) {
		switch (event.key) {
			case 'ArrowDown':
				if (!expanded) {
					open = true;
					break;
				}
				active = active + 1 >= optionCount ? -1 : active + 1;
				break;
			case 'ArrowUp':
				if (!expanded) return;
				active = active - 1 < -1 ? optionCount - 1 : active - 1;
				break;
			case 'Enter': {
				const newTab = isModKey(event);
				const link = active >= 0 ? suggestions[active] : undefined;
				if (link) openLink(link, newTab);
				else submit(newTab);
				break;
			}
			case 'Escape':
				if (expanded) open = false;
				else if (query) query = '';
				else input?.blur();
				break;
			default:
				return;
		}
		event.preventDefault();
		event.stopPropagation();
	}
</script>

<form
	class="search"
	class:expanded
	role="search"
	aria-label={t('search.label')}
	onsubmit={(event) => {
		event.preventDefault();
		submit(false);
	}}
>
	{#if search.engines.length === 0}
		<p class="empty">{t('search.noEngines')}</p>
	{:else}
		<div class="field">
			<button
				type="button"
				class="engine"
				aria-label={`${t('search.engine')}: ${chosen?.name ?? ''}`}
				aria-haspopup="menu"
				aria-expanded={engineMenu !== null}
				onclick={(event) => (engineMenu = event.currentTarget)}
			>
				{#if chosen}<LinkIcon
						url={chosen.url}
						label={chosen.name}
						icon={chosen.icon}
						size={18}
					/>{/if}
				<Icon name="chevronDown" size={14} />
			</button>
			<input
				bind:this={input}
				bind:value={query}
				class="input-field"
				type="text"
				role="combobox"
				autocomplete="off"
				spellcheck="false"
				data-search-input
				aria-label={t('search.label')}
				aria-autocomplete="list"
				aria-expanded={expanded}
				aria-controls={listboxId}
				aria-activedescendant={expanded && active >= 0 ? `${id}-option-${active}` : undefined}
				placeholder={t('search.placeholder', { engine: chosen?.name ?? '' })}
				oninput={() => (open = true)}
				onfocus={() => (open = true)}
				onblur={() => (open = false)}
				{onkeydown}
			/>
			{#if parsed.engine}
				<span class="chip" title={t('search.bangDetected', { engine: parsed.engine.name })}>
					<LinkIcon
						url={parsed.engine.url}
						label={parsed.engine.name}
						icon={parsed.engine.icon}
						size={14}
					/>
					{parsed.engine.name}
				</span>
			{/if}
			<button type="submit" class="icon-btn submit" aria-label={t('search.submit')}>
				<Icon name="search" />
			</button>
		</div>

		<ul
			class="suggestions"
			id={listboxId}
			role="listbox"
			aria-label={t('search.links')}
			hidden={!expanded}
		>
			<!-- Tastaturbedienung läuft über das Eingabefeld (aria-activedescendant) -->
			{#each suggestions as link, i (link.id)}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<li
					id="{id}-option-{i}"
					role="option"
					class="option"
					aria-selected={i === active}
					onpointerdown={(event) => event.preventDefault()}
					onclick={(event) => openLink(link, isModKey(event))}
				>
					<LinkIcon url={link.url} label={linkTitle(link)} icon={link.icon} size={18} />
					<span class="label">{linkTitle(link)}</span>
					<span class="host">{link.host}</span>
				</li>
			{/each}
			{#if engine && query.trim()}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<li
					id="{id}-option-{suggestions.length}"
					role="option"
					class="option web"
					aria-selected={active === suggestions.length}
					onpointerdown={(event) => event.preventDefault()}
					onclick={(event) => submit(isModKey(event))}
				>
					<Icon name="search" size={16} />
					<span class="label">{t('search.searchWith', { engine: engine.name })}</span>
					<span class="host">{parsed.query}</span>
				</li>
			{/if}
		</ul>

		<Menu
			bind:anchor={engineMenu}
			label={t('search.engine')}
			items={search.engines.map((e) => ({
				label: e.name,
				hint: e.bang ? `!${e.bang}` : undefined,
				icon: e.id === chosen?.id ? 'check' : undefined,
				onselect: () => {
					chosenId = e.id;
					input?.focus();
				}
			}))}
		/>
	{/if}
</form>

<style>
	.search {
		position: relative;
	}

	.field {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		height: 52px;
		padding: 0 var(--space-2) 0 var(--space-2);
		border-radius: var(--radius-full);
		background: rgb(255 255 255 / 0.66);
		box-shadow:
			inset 0 1px 3px rgb(8 34 66 / 0.14),
			inset 0 0 0 1px var(--line),
			0 1px 0 rgb(255 255 255 / 0.6);
		transition: box-shadow var(--duration-fast) ease;

		&:focus-within {
			box-shadow:
				inset 0 1px 3px rgb(8 34 66 / 0.14),
				0 0 0 2px var(--accent),
				0 0 0 6px color-mix(in srgb, var(--accent) 20%, transparent);
		}
	}

	.engine {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		height: 38px;
		padding: 0 var(--space-2);
		border: none;
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--text-secondary);

		&:hover {
			background: var(--fill-hover);
		}
	}

	.input-field {
		flex: 1;
		min-width: 0;
		height: 100%;
		border: none;
		background: transparent;
		font-size: var(--text-lg);
		outline: none;

		&::placeholder {
			color: var(--text-tertiary);
		}

		&:focus-visible {
			box-shadow: none;
		}
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		height: 26px;
		padding: 0 var(--space-2);
		border-radius: var(--radius-full);
		background: var(--accent);
		color: var(--on-accent);
		font-size: var(--text-xs);
		font-weight: 700;
		white-space: nowrap;
		animation: chip-in var(--duration) var(--ease-spring);
	}

	.submit {
		width: 38px;
		height: 38px;
	}

	.suggestions {
		position: absolute;
		inset: calc(100% + 8px) 0 auto;
		z-index: 10;
		display: grid;
		gap: 2px;
		padding: var(--space-1);
		border-radius: var(--radius-lg);
		background: rgb(255 255 255 / 0.9);
		backdrop-filter: blur(30px) saturate(1.6);
		box-shadow:
			inset 0 1px 0 #fff,
			inset 0 0 0 1px var(--glass-rim),
			var(--glass-shadow-raised);

		&[hidden] {
			display: none;
		}
	}

	.option {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: 40px;
		padding: 0 var(--space-3);
		border-radius: var(--radius-md);
		cursor: pointer;

		&:hover {
			background: var(--fill-hover);
		}

		&[aria-selected='true'] {
			background: var(--accent);
			color: var(--on-accent);

			.host {
				color: inherit;
				opacity: 0.8;
			}
		}

		&.web {
			color: var(--text-secondary);
		}
	}

	.label {
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.host {
		flex: 1;
		min-width: 0;
		font-size: var(--text-sm);
		color: var(--text-tertiary);
		text-align: end;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.empty {
		color: var(--text-secondary);
	}

	@keyframes chip-in {
		from {
			opacity: 0;
			transform: scale(0.8);
		}
	}
</style>
