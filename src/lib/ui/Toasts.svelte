<script lang="ts">
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import { t } from '$lib/i18n/index.svelte';
	import { toasts } from '$lib/state/toasts.svelte';
	import Icon from './Icon.svelte';

	const reducedMotion =
		typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
</script>

<div class="toasts" role="status" aria-live="polite">
	{#each toasts.items as toast (toast.id)}
		<div
			class="toast glass"
			class:error={toast.tone === 'error'}
			animate:flip={{ duration: reducedMotion ? 0 : 220 }}
			transition:fly={{ y: reducedMotion ? 0 : 16, duration: reducedMotion ? 120 : 260 }}
		>
			<span class="message">{toast.message}</span>
			{#if toast.action}
				<button type="button" class="btn btn-primary action" onclick={() => toasts.act(toast.id)}>
					{toast.action.label}
				</button>
			{/if}
			<button
				type="button"
				class="icon-btn"
				aria-label={t('common.close')}
				onclick={() => toasts.dismiss(toast.id)}
			>
				<Icon name="close" size={16} />
			</button>
		</div>
	{/each}
</div>

<style>
	.toasts {
		position: fixed;
		inset: auto 0 var(--space-6);
		z-index: 50;
		display: grid;
		justify-items: center;
		gap: var(--space-2);
		pointer-events: none;
	}

	.toast {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		max-width: min(560px, calc(100vw - 32px));
		padding: var(--space-2) var(--space-2) var(--space-2) var(--space-5);
		border-radius: var(--radius-full);
		--glass-alpha: 0.8;
		box-shadow:
			inset 0 1px 0 var(--glass-edge),
			inset 0 0 0 1px var(--glass-rim),
			var(--glass-shadow-raised);
		pointer-events: auto;
		font-size: var(--text-sm);
		font-weight: 500;

		&.error {
			box-shadow:
				inset 0 1px 0 var(--glass-edge),
				inset 0 0 0 1px color-mix(in srgb, var(--danger) 45%, transparent),
				var(--glass-shadow-raised);
		}
	}

	.message {
		flex: 1;
	}

	.action {
		min-height: 30px;
	}
</style>
