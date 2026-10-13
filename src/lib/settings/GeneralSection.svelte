<script lang="ts">
	import type { LanguageSetting } from '$lib/config/types';
	import { i18n, t } from '$lib/i18n/index.svelte';
	import { getApp } from '$lib/state/context';

	const app = getApp();
	const id = $props.id();

	const options = $derived<{ value: LanguageSetting; label: string }[]>([
		{
			value: 'auto',
			label: t('language.auto', {
				language: t(i18n.detected === 'de' ? 'language.de' : 'language.en')
			})
		},
		{ value: 'de', label: t('language.de') },
		{ value: 'en', label: t('language.en') }
	]);
</script>

<div class="section">
	<div class="field">
		<label class="field-label" for="{id}-language">{t('settings.language')}</label>
		<select id="{id}-language" class="select" bind:value={app.config.value.language}>
			{#each options as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	</div>
</div>

<style>
	.section {
		display: grid;
		gap: var(--space-5);
		max-width: 360px;
	}
</style>
