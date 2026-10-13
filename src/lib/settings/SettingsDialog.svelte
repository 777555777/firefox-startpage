<script lang="ts">
	import type { Component } from 'svelte';
	import { t, type I18nKey } from '$lib/i18n/index.svelte';
	import { ui, type SettingsSection } from '$lib/state/ui.svelte';
	import Dialog from '$lib/ui/Dialog.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import type { IconName } from '$lib/ui/icons';
	import AppearanceSection from './AppearanceSection.svelte';
	import DataSection from './DataSection.svelte';
	import GeneralSection from './GeneralSection.svelte';
	import PerformanceSection from './PerformanceSection.svelte';

	type Section = { id: SettingsSection; label: I18nKey; icon: IconName; component: Component };

	const sections: Section[] = [
		{ id: 'general', label: 'settings.general', icon: 'language', component: GeneralSection },
		{
			id: 'appearance',
			label: 'settings.appearance',
			icon: 'palette',
			component: AppearanceSection
		},
		{
			id: 'performance',
			label: 'settings.performance',
			icon: 'gauge',
			component: PerformanceSection
		},
		{ id: 'data', label: 'settings.data', icon: 'database', component: DataSection }
	];

	const active = $derived(sections.find((s) => s.id === ui.settingsSection) ?? sections[0]);
	const baseId = $props.id();

	function onkeydown(event: KeyboardEvent) {
		const index = sections.indexOf(active);
		const next =
			event.key === 'ArrowDown' || event.key === 'ArrowRight'
				? index + 1
				: event.key === 'ArrowUp' || event.key === 'ArrowLeft'
					? index - 1
					: event.key === 'Home'
						? 0
						: event.key === 'End'
							? sections.length - 1
							: null;
		if (next === null) return;
		event.preventDefault();
		const section = sections[(next + sections.length) % sections.length];
		ui.settingsSection = section.id;
		document.getElementById(`${baseId}-tab-${section.id}`)?.focus();
	}
</script>

<Dialog bind:open={ui.settingsOpen} title={t('settings.title')} size="lg">
	<div class="layout">
		<div
			class="nav"
			role="tablist"
			aria-label={t('settings.sections')}
			aria-orientation="vertical"
			tabindex="-1"
			{onkeydown}
		>
			{#each sections as section (section.id)}
				<button
					type="button"
					role="tab"
					id="{baseId}-tab-{section.id}"
					aria-selected={section === active}
					aria-controls="{baseId}-panel"
					tabindex={section === active ? 0 : -1}
					class="tab"
					onclick={() => (ui.settingsSection = section.id)}
				>
					<Icon name={section.icon} size={17} />
					{t(section.label)}
				</button>
			{/each}
		</div>
		<div
			class="panel"
			role="tabpanel"
			id="{baseId}-panel"
			aria-labelledby="{baseId}-tab-{active.id}"
		>
			<active.component />
		</div>
	</div>
</Dialog>

<style>
	.layout {
		display: grid;
		grid-template-columns: 200px minmax(0, 1fr);
		gap: var(--space-6);
		min-height: 420px;
	}

	.nav {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.tab {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: 38px;
		padding: 0 var(--space-3);
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		font-weight: 600;
		font-size: var(--text-sm);
		color: var(--text-secondary);
		text-align: start;

		&:hover {
			background: var(--fill);
			color: var(--text);
		}

		&[aria-selected='true'] {
			background: var(--accent);
			color: var(--on-accent);
		}
	}

	.panel {
		min-width: 0;
	}

	@media (width < 720px) {
		.layout {
			grid-template-columns: 1fr;
		}

		.nav {
			flex-direction: row;
			flex-wrap: wrap;
		}
	}
</style>
