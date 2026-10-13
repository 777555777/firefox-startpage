<script lang="ts">
	import { t } from '$lib/i18n/index.svelte';
	import type { WidgetProps } from '../types';
	import type { LinksSettings } from './settings';

	let { settings }: WidgetProps<LinksSettings> = $props();
</script>

<!-- Platzhalter bis M3 -->
<p class="placeholder" data-settings={Object.keys(settings).length}>{t('widget.links')}</p>

<style>
	.placeholder {
		padding: var(--space-6);
		color: var(--text-secondary);
		text-align: center;
	}
</style>
