<script lang="ts">
	import { t } from '$lib/i18n/index.svelte';
	import { ui } from '$lib/state/ui.svelte';
	import Switch from '$lib/ui/Switch.svelte';
	import type { WidgetSettingsProps } from '../types';
	import type { SearchSettings } from './settings';

	let { settings, update }: WidgetSettingsProps<SearchSettings> = $props();
</script>

<div class="form">
	<Switch
		label={t('search.suggestLinks')}
		checked={settings.suggestLinks}
		onchange={(value) => update((s) => (s.suggestLinks = value))}
	/>
	<button type="button" class="btn" onclick={() => ui.openSettings('search')}>
		{t('settings.engines')} …
	</button>
</div>

<style>
	.form {
		display: grid;
		gap: var(--space-4);
		justify-items: start;
	}

	.form > :global(:first-child) {
		justify-self: stretch;
	}
</style>
