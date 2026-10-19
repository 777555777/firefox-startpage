<script lang="ts">
	import { t } from '$lib/i18n/index.svelte';
	import { announcer } from '$lib/ui/announcer.svelte';
	import Icon from '$lib/ui/Icon.svelte';

	/**
	 * „Weitere anzeigen“ unter einer Liste, die bis zum Fensterende gekürzt ist. Ausgeklappt
	 * scrollt die Page bewusst; beim nächsten Öffnen ist die Liste wieder gekürzt.
	 */
	let {
		hidden,
		expanded = $bindable(false),
		controls
	}: {
		/** Einträge, die gekürzt nicht zu sehen sind */
		hidden: number;
		expanded: boolean;
		/** ID der Liste */
		controls: string;
	} = $props();

	function toggle() {
		if (expanded) {
			expanded = false;
			announcer.say(t('fit.collapsed'));
		} else {
			// Vorher lesen: Ausgeklappt ist nichts mehr verborgen
			const count = hidden;
			expanded = true;
			announcer.say(t('fit.expanded', { count }));
		}
	}
</script>

<!-- `data-fit-more` (MORE_ATTRIBUTE): zählt beim Messen nicht zum Platz unter der Liste -->
<button
	type="button"
	class="fit-more"
	aria-expanded={expanded}
	aria-controls={controls}
	data-fit-more
	onclick={toggle}
>
	<span class="chevron" class:up={expanded}><Icon name="chevronDown" size={14} /></span>
	{expanded ? t('fit.showLess') : t('fit.showMore', { count: hidden })}
</button>

<style>
	.fit-more {
		display: inline-flex;
		flex: none;
		align-items: center;
		/* Mittig, im Flex- wie im Grid-Container */
		align-self: center;
		justify-self: center;
		gap: var(--space-1);
		min-height: 28px;
		padding: 0 var(--space-3);
		border: none;
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--text-secondary);
		font-size: var(--text-xs);
		font-weight: 650;
		transition:
			background-color var(--duration-fast) ease,
			color var(--duration-fast) ease;

		&:hover {
			background: var(--fill);
			color: var(--text);
		}

		&:focus-visible {
			box-shadow: var(--focus-ring);
		}
	}

	.chevron {
		display: inline-grid;
		transition: transform var(--duration) var(--ease-out);

		&.up {
			transform: rotate(180deg);
		}
	}
</style>
