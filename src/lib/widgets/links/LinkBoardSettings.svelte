<script lang="ts">
	import { t } from '$lib/i18n/index.svelte';
	import Switch from '$lib/ui/Switch.svelte';
	import type { WidgetSettingsProps } from '../types';
	import type { LinksSettings } from './settings';

	let { settings, update }: WidgetSettingsProps<LinksSettings> = $props();
</script>

<Switch
	label={t('links.showStats')}
	checked={settings.showStats}
	onchange={(value) => update((s) => (s.showStats = value))}
/>
