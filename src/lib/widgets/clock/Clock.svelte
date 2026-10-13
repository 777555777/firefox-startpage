<script lang="ts">
	import { t } from '$lib/i18n/index.svelte';
	import type { WidgetProps } from '../types';
	import type { ClockSettings } from './settings';

	let { settings }: WidgetProps<ClockSettings> = $props();
</script>

<!-- Platzhalter bis M3 -->
<p class="placeholder" data-settings={Object.keys(settings).length}>{t('widget.clock')}</p>

<style>
	.placeholder {
		padding: var(--space-6);
		color: var(--text-secondary);
		text-align: center;
	}
</style>
