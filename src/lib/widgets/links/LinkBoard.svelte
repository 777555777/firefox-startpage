<script lang="ts">
	import { createId } from '$lib/config/parse';
	import { Sortable } from '$lib/dnd/sortable.svelte';
	import { i18n, t } from '$lib/i18n/index.svelte';
	import { getApp } from '$lib/state/context';
	import { toasts } from '$lib/state/toasts.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import Menu, { type MenuAnchor, type MenuItem } from '$lib/ui/Menu.svelte';
	import { isModKey, isOverlayOpen, isTypingTarget } from '$lib/utils/keyboard';
	import type { WidgetProps } from '../types';
	import { registerBoard } from './boards';
	import LinkDialog from './LinkDialog.svelte';
	import LinkIcon from './LinkIcon.svelte';
	import { displayHost, linkTitle, openUrl } from './link-utils';
	import { digitOf, nextIndex, type NavKey } from './nav';
	import {
		findLink,
		insertLink,
		insertTab,
		moveLink,
		moveTab,
		removeLink,
		removeTab
	} from './operations';
	import TabDialog from './TabDialog.svelte';
	import { tileMetrics, type Link, type LinksSettings, type LinkTab } from './settings';

	let { id, settings, update }: WidgetProps<LinksSettings> = $props();

	const tile = $derived(tileMetrics(settings.tileSize));

	const app = getApp();
	const uid = $props.id();

	const activeTab = $derived(
		settings.tabs.find((tab) => tab.id === settings.activeTabId) ?? settings.tabs[0]
	);
	const tabName = (tab: LinkTab) => tab.label || t('links.untitledTab');
	const stats = $derived(app.stats.value);
	const lastOpenedFormat = $derived(
		new Intl.DateTimeFormat(i18n.lang, { dateStyle: 'medium', timeStyle: 'short' })
	);

	let root: HTMLElement;
	let list = $state<HTMLElement>();

	// --- Roving Tabindex --------------------------------------------------------------------

	let focusIndex = $state(0);
	const tabIndexFor = (index: number) =>
		index === Math.min(focusIndex, activeTab.links.length - 1) ? 0 : -1;

	const linkElements = () => [...(list?.querySelectorAll<HTMLElement>('[data-link]') ?? [])];

	function focusLink(index: number) {
		focusIndex = index;
		linkElements()[index]?.focus();
	}

	function selectTab(tabId: string, focus = false) {
		update((board) => (board.activeTabId = tabId));
		focusIndex = 0;
		if (focus) document.getElementById(`${uid}-tab-${tabId}`)?.focus();
	}

	// --- Öffnen -----------------------------------------------------------------------------

	function open(link: Link, newTab: boolean) {
		app.recordOpen(link.url);
		openUrl(link.url, newTab || link.target === 'blank');
	}

	function openNth(n: number) {
		const link = activeTab.links[n - 1];
		if (link) open(link, false);
	}

	$effect(() => registerBoard({ element: root, openNth }));

	// --- Tastatur -----------------------------------------------------------------------------

	function onLinkKeydown(event: KeyboardEvent, index: number, link: Link) {
		if (event.key === 'Enter' && isModKey(event)) {
			event.preventDefault();
			open(link, true);
			return;
		}
		const keys: NavKey[] = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
		if (!keys.includes(event.key as NavKey)) return;
		event.preventDefault();
		const boxes = linkElements().map((el) => el.getBoundingClientRect());
		focusLink(nextIndex(boxes, index, event.key as NavKey));
	}

	function onTabKeydown(event: KeyboardEvent, index: number) {
		const count = settings.tabs.length;
		const next =
			event.key === 'ArrowRight'
				? (index + 1) % count
				: event.key === 'ArrowLeft'
					? (index - 1 + count) % count
					: event.key === 'Home'
						? 0
						: event.key === 'End'
							? count - 1
							: null;
		if (next === null) return;
		event.preventDefault();
		selectTab(settings.tabs[next].id, true);
	}

	/** Kürzel, solange das Board den Fokus hat: 1…9 öffnet, Alt+1…9 wechselt den Tab */
	function onBoardKeydown(event: KeyboardEvent) {
		if (event.defaultPrevented || isTypingTarget(event.target) || isOverlayOpen()) return;
		if (event.ctrlKey || event.metaKey || event.shiftKey) return;
		const digit = digitOf(event);
		if (!digit) return;
		event.preventDefault();
		if (event.altKey) {
			const tab = settings.tabs[digit - 1];
			if (tab) selectTab(tab.id, true);
		} else openNth(digit);
	}

	// --- Drag & Drop ------------------------------------------------------------------------

	// svelte-ignore state_referenced_locally
	const linkSort = new Sortable({
		group: `links:${id}`,
		threshold: 5,
		longPress: 450,
		onmove: (linkId, tabId, index) => update((board) => moveLink(board, linkId, tabId, index))
	});

	// svelte-ignore state_referenced_locally
	const tabSort = new Sortable({
		group: `tabs:${id}`,
		threshold: 5,
		longPress: 450,
		onmove: (tabId, _list, index) => update((board) => moveTab(board, tabId, index))
	});

	function dropOnTab(linkId: string, tab: LinkTab) {
		const found = findLink(settings, linkId);
		if (!found || found.tab.id === tab.id) return;
		update((board) => moveLink(board, linkId, tab.id));
		toasts.show(t('links.moved', { name: linkTitle(found.link), tab: tabName(tab) }));
	}

	// --- Dialoge und Menüs ------------------------------------------------------------------

	let linkDialog = $state(false);
	let editingLink = $state<Link | null>(null);
	let tabDialog = $state(false);
	let editingTab = $state<LinkTab | null>(null);
	let linkMenu = $state<{ anchor: MenuAnchor | null; link: Link | null }>({
		anchor: null,
		link: null
	});
	let tabMenu = $state<{ anchor: MenuAnchor | null; tab: LinkTab | null }>({
		anchor: null,
		tab: null
	});

	function addLink() {
		editingLink = null;
		linkDialog = true;
	}

	function editLink(link: Link) {
		editingLink = link;
		linkDialog = true;
	}

	function saveLink(data: Omit<Link, 'id'>) {
		const editing = editingLink;
		update((board) => {
			if (editing) {
				const found = findLink(board, editing.id);
				if (found) Object.assign(found.link, data);
			} else insertLink(board, activeTab.id, { id: createId(), ...data });
		});
	}

	function deleteLink(link: Link) {
		let removed: ReturnType<typeof removeLink> = null;
		update((board) => (removed = removeLink(board, link.id)));
		const restore = removed as ReturnType<typeof removeLink>;
		if (!restore) return;
		toasts.show(t('links.linkDeleted', { name: linkTitle(link) }), {
			action: {
				label: t('common.undo'),
				run: () => update((board) => insertLink(board, restore.tabId, restore.link, restore.index))
			}
		});
	}

	async function copyUrl(link: Link) {
		try {
			await navigator.clipboard.writeText(link.url);
			toasts.show(t('links.copied'));
		} catch {
			toasts.show(t('links.copyFailed'), { tone: 'error' });
		}
	}

	function addTab() {
		editingTab = null;
		tabDialog = true;
	}

	function editTab(tab: LinkTab) {
		editingTab = tab;
		tabDialog = true;
	}

	function saveTab(data: Pick<LinkTab, 'label' | 'icon' | 'view'>) {
		const editing = editingTab;
		if (editing) {
			update((board) => {
				const tab = board.tabs.find((t) => t.id === editing.id);
				if (tab) Object.assign(tab, data);
			});
		} else {
			const tab: LinkTab = { id: createId(), links: [], ...data };
			update((board) => {
				insertTab(board, tab);
				board.activeTabId = tab.id;
			});
		}
	}

	function deleteTab(tab: LinkTab) {
		let removed: ReturnType<typeof removeTab> = null;
		update((board) => (removed = removeTab(board, tab.id)));
		const restore = removed as ReturnType<typeof removeTab>;
		if (!restore) {
			toasts.show(t('links.lastTab'), { tone: 'error' });
			return;
		}
		toasts.show(t('links.tabDeleted', { name: tabName(tab) }), {
			action: {
				label: t('common.undo'),
				run: () =>
					update((board) => {
						insertTab(board, restore.tab, restore.index);
						board.activeTabId = restore.tab.id;
					})
			}
		});
	}

	function openLinkMenu(event: MouseEvent, link: Link) {
		event.preventDefault();
		// Per Tastatur (Kontextmenü-Taste) gibt es keine sinnvolle Zeigerposition
		const anchor: MenuAnchor =
			event.clientX || event.clientY
				? { x: event.clientX, y: event.clientY }
				: (event.currentTarget as HTMLElement);
		linkMenu = { anchor, link };
	}

	const linkMenuItems = $derived.by((): MenuItem[] => {
		const link = linkMenu.link;
		if (!link) return [];
		return [
			{ label: t('links.open'), icon: 'link', onselect: () => open(link, false) },
			{ label: t('links.openNewTab'), icon: 'external', onselect: () => open(link, true) },
			{ label: t('links.copyUrl'), icon: 'copy', onselect: () => void copyUrl(link) },
			'separator',
			{ label: t('links.addLink'), icon: 'plus', onselect: addLink },
			{ label: t('common.edit'), icon: 'pencil', onselect: () => editLink(link) },
			{ label: t('common.delete'), icon: 'trash', danger: true, onselect: () => deleteLink(link) }
		];
	});

	const tabMenuItems = $derived.by((): MenuItem[] => {
		const tab = tabMenu.tab;
		if (!tab) return [];
		return [
			{ label: t('links.editTab'), icon: 'pencil', onselect: () => editTab(tab) },
			{ label: t('links.addLink'), icon: 'plus', onselect: addLink },
			{ label: t('links.addTab'), icon: 'plus', onselect: addTab },
			'separator',
			{
				label: t('links.deleteTab'),
				icon: 'trash',
				danger: true,
				disabled: settings.tabs.length <= 1,
				onselect: () => deleteTab(tab)
			}
		];
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="board" bind:this={root} data-link-board onkeydown={onBoardKeydown}>
	<div class="tabs">
		<div
			class="tablist"
			role="tablist"
			aria-label={t('links.tabs')}
			{@attach tabSort.list({ id: 'tabs', axis: 'horizontal' })}
		>
			{#each settings.tabs as tab, index (tab.id)}
				<button
					type="button"
					role="tab"
					id="{uid}-tab-{tab.id}"
					class="tab"
					class:dragging={tabSort.isDragging(tab.id)}
					class:drop-target={linkSort.overTarget === tab.id}
					aria-selected={tab.id === activeTab.id}
					aria-controls="{uid}-panel"
					tabindex={tab.id === activeTab.id ? 0 : -1}
					onclick={() => selectTab(tab.id)}
					ondblclick={() => editTab(tab)}
					oncontextmenu={(event) => {
						event.preventDefault();
						tabMenu = {
							anchor:
								event.clientX || event.clientY
									? { x: event.clientX, y: event.clientY }
									: event.currentTarget,
							tab
						};
					}}
					onkeydown={(event) => onTabKeydown(event, index)}
					{@attach tabSort.item({ id: tab.id, list: 'tabs' })}
					{@attach linkSort.target({
						id: tab.id,
						ondrop: (linkId) => dropOnTab(linkId, tab),
						accepts: () => tab.id !== activeTab.id
					})}
				>
					{#if tab.icon}<span class="tab-icon" aria-hidden="true">{tab.icon}</span>{/if}
					{tabName(tab)}
				</button>
			{/each}
		</div>
		<button type="button" class="icon-btn add-tab" aria-label={t('links.addTab')} onclick={addTab}>
			<Icon name="plus" size={16} />
		</button>
	</div>

	<div class="panel" role="tabpanel" id="{uid}-panel" aria-labelledby="{uid}-tab-{activeTab.id}">
		{#if activeTab.links.length === 0}
			<p class="empty">{t('links.empty')}</p>
		{/if}
		<ul
			bind:this={list}
			class="links {activeTab.view}"
			style:--tile="{settings.tileSize}px"
			style:--tile-radius="{tile.radius}px"
			style:--tile-column="{tile.column}px"
			{@attach linkSort.list({
				id: activeTab.id,
				axis: activeTab.view === 'list' ? 'vertical' : 'grid'
			})}
		>
			{#each activeTab.links as link, index (link.id)}
				{@const stat = stats[link.url]}
				{@const title = linkTitle(link)}
				<li class="item">
					<a
						class="link {activeTab.view}"
						class:dragging={linkSort.isDragging(link.id)}
						href={link.url}
						target={link.target === 'blank' ? '_blank' : undefined}
						rel={link.target === 'blank' ? 'noopener noreferrer' : undefined}
						data-link
						tabindex={tabIndexFor(index)}
						title={activeTab.view === 'list' ? undefined : `${title}\n${displayHost(link.url)}`}
						onfocus={() => (focusIndex = index)}
						onclick={() => app.recordOpen(link.url)}
						onauxclick={(event) => {
							if (event.button === 1) app.recordOpen(link.url);
						}}
						oncontextmenu={(event) => openLinkMenu(event, link)}
						onkeydown={(event) => onLinkKeydown(event, index, link)}
						{@attach linkSort.item({ id: link.id, list: activeTab.id })}
					>
						{#if activeTab.view === 'tiles'}
							<span class="tile-icon">
								<LinkIcon url={link.url} label={title} icon={link.icon} size={tile.icon} />
							</span>
						{:else}
							<LinkIcon url={link.url} label={title} icon={link.icon} size={20} />
						{/if}
						<span class="label">{title}</span>
						{#if activeTab.view === 'list'}
							<span class="host">{displayHost(link.url)}</span>
						{/if}
						{#if settings.showStats && stat}
							<span
								class="badge"
								title={t('links.lastOpened', { date: lastOpenedFormat.format(stat.lastOpened) })}
								aria-label={t('links.openCount', { count: stat.count })}
							>
								{stat.count}
							</span>
						{/if}
					</a>
				</li>
			{/each}
			<li class="item add-item">
				<button type="button" class="add {activeTab.view}" onclick={addLink}>
					{#if activeTab.view === 'tiles'}
						<span class="tile-icon"><Icon name="plus" size={tile.plus} /></span>
					{:else}
						<Icon name="plus" size={16} />
					{/if}
					<span class="label">{t('links.addLink')}</span>
				</button>
			</li>
		</ul>
	</div>
</div>

<Menu
	bind:anchor={linkMenu.anchor}
	label={linkMenu.link ? t('links.menu', { name: linkTitle(linkMenu.link) }) : ''}
	items={linkMenuItems}
/>
<Menu
	bind:anchor={tabMenu.anchor}
	label={tabMenu.tab ? t('links.tabMenu', { name: tabName(tabMenu.tab) }) : ''}
	items={tabMenuItems}
/>
<LinkDialog bind:open={linkDialog} link={editingLink} onsave={saveLink} />
<TabDialog
	bind:open={tabDialog}
	tab={editingTab}
	canDelete={settings.tabs.length > 1}
	onsave={saveTab}
	ondelete={() => editingTab && deleteTab(editingTab)}
/>

<style>
	.board {
		display: grid;
		gap: var(--space-3);
	}

	/* --- Tabs --- */

	.tabs {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

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

		&.drop-target {
			background: var(--accent);
			color: var(--on-accent);
			box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 30%, transparent);
		}
	}

	.tab-icon {
		font-size: 1.05em;
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

	.empty {
		margin-bottom: var(--space-2);
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	/* --- Ansichten --- */

	.links.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(var(--tile-column), 1fr));
		gap: var(--space-1);
	}

	.links.capsules {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.links.list {
		display: grid;
		gap: 2px;
	}

	.item {
		min-width: 0;
	}

	.link,
	.add {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
		border: none;
		color: var(--text);
		text-decoration: none;
		transition:
			background-color var(--duration-fast) ease,
			box-shadow var(--duration-fast) ease,
			opacity var(--duration) ease;

		&:focus-visible {
			box-shadow: var(--focus-ring);
		}

		&.dragging {
			opacity: 0.3;
		}
	}

	/*
	 * Kachel: Icon in einer festen Fläche oben, darunter der Name mit Platz für zwei Zeilen.
	 * So stehen alle Icons auf einer Höhe, egal wie lang der Name ist.
	 */
	.link.tiles,
	.add.tiles {
		flex-direction: column;
		justify-content: flex-start;
		gap: var(--space-2);
		/* Volle Spalte: Ein <button> wäre sonst nur so breit wie sein Inhalt und stünde versetzt */
		width: 100%;
		height: 100%;
		/* Seitlich etwas Luft, damit lange Namen nicht bis an den Rand der Hover-Fläche reichen;
		   die Spalte ist 48 px breiter als die Icon-Fläche, so passt „OpenStreetMap“ in eine Zeile */
		padding: var(--space-3) 6px var(--space-2);
		border-radius: var(--radius-lg);
		background: transparent;
		text-align: center;

		.label {
			display: -webkit-box;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 2;
			line-clamp: 2;
			overflow: hidden;
			width: 100%;
			min-height: calc(2lh);
			font-size: var(--text-xs);
			font-weight: 600;
			line-height: 1.3;
			/* Zwischen Wörtern umbrechen und Zeilen ausgleichen („YouTube / Music“), ohne
			   Silbentrennung; nur zu lange Einzelwörter werden notfalls geteilt */
			hyphens: manual;
			text-wrap: balance;
			overflow-wrap: anywhere;
		}

		&:hover {
			background: var(--fill-hover);
			box-shadow: inset 0 1px 0 var(--highlight);
		}
	}

	.tile-icon {
		flex: none;
		display: grid;
		place-items: center;
		width: var(--tile);
		height: var(--tile);
		border-radius: var(--tile-radius);
		background: var(--fill);
		box-shadow:
			inset 0 1px 0 var(--highlight),
			inset 0 0 0 1px var(--line);
	}

	.link.capsules,
	.add.capsules {
		height: 36px;
		padding: 0 var(--space-4) 0 var(--space-2);
		border-radius: var(--radius-full);
		background: var(--fill);
		box-shadow:
			inset 0 1px 0 var(--highlight),
			inset 0 0 0 1px var(--line);
		font-size: var(--text-sm);
		font-weight: 600;
		white-space: nowrap;

		&:hover {
			background: var(--fill-hover);
		}
	}

	.link.list,
	.add.list {
		width: 100%;
		height: 38px;
		padding: 0 var(--space-3) 0 var(--space-2);
		border-radius: var(--radius-sm);
		background: transparent;
		font-size: var(--text-sm);
		font-weight: 600;

		.label {
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		&:hover {
			background: var(--fill-hover);
		}
	}

	.host {
		flex: 1;
		min-width: 0;
		font-weight: 400;
		color: var(--text-tertiary);
		text-align: end;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.badge {
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

	.link.tiles .badge {
		position: absolute;
		top: 6px;
		right: 8px;
	}

	.add {
		color: var(--text-secondary);
		opacity: 0.55;
		cursor: pointer;

		&:hover,
		&:focus-visible {
			opacity: 1;
			color: var(--text);
		}

		&.capsules {
			background: transparent;
			box-shadow: inset 0 0 0 1.5px var(--line);
		}

		&.tiles .tile-icon {
			background: transparent;
			box-shadow: inset 0 0 0 1.5px var(--line);
		}
	}

	/* Ohne Hover-Gerät bleibt „+“ gut sichtbar */
	@media (hover: none) {
		.add {
			opacity: 1;
		}
	}
</style>
