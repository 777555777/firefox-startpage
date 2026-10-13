<script lang="ts">
	import { t } from '$lib/i18n/index.svelte';
	import type { WidgetProps } from '../types';
	import type { SearchSettings } from './settings';

	let { settings }: WidgetProps<SearchSettings> = $props();
</script>

<!-- Platzhalter bis M3 -->
<p class="placeholder" data-settings={Object.keys(settings).length}>{t('widget.search')}</p>

<style>
	.placeholder {
		padding: var(--space-6);
		color: var(--text-secondary);
		text-align: center;
	}
</style>
