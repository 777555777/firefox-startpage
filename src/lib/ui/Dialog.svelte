<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { ui } from '$lib/state/ui.svelte';
	import Icon from './Icon.svelte';

	let {
		open = $bindable(false),
		title,
		size = 'md',
		fixedHeight = false,
		onclose,
		children,
		footer
	}: {
		open?: boolean;
		title: string;
		size?: 'sm' | 'md' | 'lg';
		/**
		 * Feste Höhe, z. B. für Dialoge mit Abschnitten unterschiedlicher Länge. Der Inhalt füllt
		 * dann den Körper (Flex-Spalte) und scrollt selbst, statt den Dialog wachsen zu lassen.
		 */
		fixedHeight?: boolean;
		onclose?: () => void;
		children: Snippet;
		footer?: Snippet;
	} = $props();

	let dialog: HTMLDialogElement;
	const titleId = $props.id();
	/** Nur schließen, wenn der Klick auch auf dem Scrim begonnen hat (kein Text-Markieren) */
	let pressedOnBackdrop = false;

	$effect(() => {
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	$effect(() => {
		if (!open) return;
		untrack(() => ui.modals++);
		return () => untrack(() => ui.modals--);
	});
</script>

<dialog
	bind:this={dialog}
	class="dialog glass size-{size}"
	class:fixed-height={fixedHeight}
	aria-labelledby={titleId}
	onclose={() => {
		open = false;
		onclose?.();
	}}
	onpointerdown={(event) => (pressedOnBackdrop = event.target === dialog)}
	onclick={(event) => {
		if (event.target === dialog && pressedOnBackdrop) open = false;
	}}
>
	{#if open}
		<div class="frame">
			<header class="header">
				<h2 id={titleId} class="title">{title}</h2>
				<button
					type="button"
					class="icon-btn"
					aria-label={t('common.close')}
					onclick={() => (open = false)}
				>
					<Icon name="close" />
				</button>
			</header>
			<div class="body">
				{@render children()}
			</div>
			{#if footer}
				<footer class="footer">
					{@render footer()}
				</footer>
			{/if}
		</div>
	{/if}
</dialog>

<style>
	.dialog {
		width: min(100% - 32px, var(--dialog-width));
		max-height: min(100% - 48px, 760px);
		padding: 0;
		border: none;
		color: var(--text);
		/* Dialoge sind milchiger als Panels, damit Formulare gut lesbar bleiben */
		--glass-alpha: 0.72;
		--glass-blur: 40px;
		box-shadow:
			inset 0 1px 0 var(--glass-edge),
			inset 0 0 0 1px var(--glass-rim),
			var(--glass-shadow-raised);
		overflow: hidden;

		&[open] {
			display: flex;
			flex-direction: column;
			animation: dialog-in var(--duration-slow) var(--ease-spring);
		}

		&.fixed-height {
			height: min(100% - 48px, 680px);
		}

		&::backdrop {
			background: rgb(8 30 60 / 0.28);
			backdrop-filter: blur(3px) saturate(0.9);
		}
	}

	.size-sm {
		--dialog-width: 420px;
	}

	.size-md {
		--dialog-width: 560px;
	}

	.size-lg {
		--dialog-width: 840px;
	}

	.frame {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-5) var(--space-5) var(--space-3) var(--space-6);
	}

	.title {
		font-size: var(--text-lg);
		font-weight: 700;
		letter-spacing: -0.01em;
	}

	.body {
		flex: 1;
		min-height: 0;
		padding: var(--space-2) var(--space-6) var(--space-6);
		overflow: auto;
	}

	.fixed-height .body {
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.footer {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
		padding: var(--space-4) var(--space-6) var(--space-5);
		border-top: 1px solid var(--line);
	}

	@keyframes dialog-in {
		from {
			opacity: 0;
			transform: translateY(8px) scale(0.98);
		}
	}
</style>
