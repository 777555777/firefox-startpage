<script lang="ts" module>
	import type { IconName } from './icons';

	export type MenuItem =
		| {
				label: string;
				icon?: IconName;
				disabled?: boolean;
				danger?: boolean;
				hint?: string;
				onselect: () => void;
		  }
		| 'separator';

	/** Position am Mauszeiger oder an einem Element (unterhalb, linksbündig) */
	export type MenuAnchor = { x: number; y: number } | HTMLElement;
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import Icon from './Icon.svelte';

	let {
		anchor = $bindable(null),
		label,
		items
	}: { anchor?: MenuAnchor | null; label: string; items: MenuItem[] } = $props();

	let menu: HTMLDivElement;
	let returnFocus: HTMLElement | null = null;

	const buttons = () => [
		...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
	];

	$effect(() => {
		if (!anchor) return;
		returnFocus = document.activeElement as HTMLElement | null;
		// Popover liegt im Top-Layer und ist damit unabhängig von Glas-Containern. „manual“,
		// weil das automatische Light-Dismiss ein per Rechtsklick geöffnetes Menü beim
		// Loslassen der Maustaste sofort wieder schließen würde.
		menu.showPopover();
		void place(anchor).then(() => buttons()[0]?.focus());

		const onpointerdown = (event: PointerEvent) => {
			if (!menu.contains(event.target as Node)) close(false);
		};
		const dismiss = () => close(false);
		window.addEventListener('pointerdown', onpointerdown, true);
		window.addEventListener('blur', dismiss);
		window.addEventListener('resize', dismiss);
		return () => {
			window.removeEventListener('pointerdown', onpointerdown, true);
			window.removeEventListener('blur', dismiss);
			window.removeEventListener('resize', dismiss);
		};
	});

	async function place(target: MenuAnchor) {
		await tick();
		const rect = menu.getBoundingClientRect();
		let x: number;
		let y: number;
		if (target instanceof HTMLElement) {
			const anchorRect = target.getBoundingClientRect();
			x = anchorRect.left;
			y = anchorRect.bottom + 6;
			if (y + rect.height > innerHeight - 8) y = anchorRect.top - rect.height - 6;
		} else {
			({ x, y } = target);
			if (y + rect.height > innerHeight - 8) y = y - rect.height;
		}
		x = Math.max(8, Math.min(x, innerWidth - rect.width - 8));
		y = Math.max(8, Math.min(y, innerHeight - rect.height - 8));
		menu.style.left = `${x}px`;
		menu.style.top = `${y}px`;
	}

	function close(restoreFocus = true) {
		if (menu.matches(':popover-open')) menu.hidePopover();
		anchor = null;
		if (restoreFocus) returnFocus?.focus();
	}

	function onkeydown(event: KeyboardEvent) {
		const list = buttons();
		const index = list.indexOf(document.activeElement as HTMLButtonElement);
		const focus = (i: number) => list[(i + list.length) % list.length]?.focus();
		switch (event.key) {
			case 'ArrowDown':
				focus(index + 1);
				break;
			case 'ArrowUp':
				focus(index - 1);
				break;
			case 'Home':
				focus(0);
				break;
			case 'End':
				focus(list.length - 1);
				break;
			case 'Escape':
				close();
				break;
			case 'Tab':
				close(false);
				return;
			default:
				return;
		}
		event.preventDefault();
		event.stopPropagation();
	}
</script>

<div
	bind:this={menu}
	class="menu glass"
	popover="manual"
	role="menu"
	aria-label={label}
	tabindex="-1"
	{onkeydown}
	ontoggle={(event) => {
		if ((event as ToggleEvent).newState === 'closed') anchor = null;
	}}
>
	{#each items as item, i (i)}
		{#if item === 'separator'}
			<div class="separator" role="separator"></div>
		{:else}
			<button
				type="button"
				role="menuitem"
				class="item"
				class:danger={item.danger}
				disabled={item.disabled}
				onclick={() => {
					close();
					item.onselect();
				}}
			>
				{#if item.icon}<Icon name={item.icon} size={16} />{/if}
				<span class="label">{item.label}</span>
				{#if item.hint}<span class="hint">{item.hint}</span>{/if}
			</button>
		{/if}
	{/each}
</div>

<style>
	.menu {
		position: fixed;
		inset: auto;
		margin: 0;
		min-width: 200px;
		max-width: 320px;
		padding: var(--space-1);
		border: none;
		border-radius: var(--radius-md);
		color: var(--text);
		--glass-alpha: 0.78;
		--glass-blur: 30px;
		box-shadow:
			inset 0 1px 0 var(--glass-edge),
			inset 0 0 0 1px var(--glass-rim),
			var(--glass-shadow-raised);

		&:popover-open {
			display: grid;
			animation: menu-in var(--duration) var(--ease-out);
		}
	}

	.item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		min-height: 34px;
		padding: 0 var(--space-3);
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		font-size: var(--text-sm);
		font-weight: 500;
		text-align: start;
		color: inherit;

		&:hover:not(:disabled),
		&:focus-visible {
			background: var(--accent);
			color: var(--on-accent);
			box-shadow: none;
		}

		&:disabled {
			opacity: 0.45;
			cursor: default;
		}

		&.danger:not(:hover, :focus-visible) {
			color: var(--danger);
		}
	}

	.label {
		flex: 1;
	}

	.hint {
		font-size: var(--text-xs);
		opacity: 0.7;
	}

	.separator {
		height: 1px;
		margin: var(--space-1) var(--space-2);
		background: var(--line);
	}

	@keyframes menu-in {
		from {
			opacity: 0;
			transform: translateY(-4px) scale(0.98);
		}
	}
</style>
