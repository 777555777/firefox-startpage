<script lang="ts">
	import { createId } from '$lib/config/parse';
	import type { SearchEngine } from '$lib/config/types';
	import { t } from '$lib/i18n/index.svelte';
	import { getApp } from '$lib/state/context';
	import Icon from '$lib/ui/Icon.svelte';
	import EngineRow from './EngineRow.svelte';

	const app = getApp();
	const search = $derived(app.config.value.search);
	const radioName = $props.id();

	function update(engine: SearchEngine) {
		const live = app.config.value.search;
		const index = live.engines.findIndex((e) => e.id === engine.id);
		if (index !== -1) live.engines[index] = engine;
	}

	function remove(id: string) {
		const live = app.config.value.search;
		live.engines = live.engines.filter((e) => e.id !== id);
		if (live.defaultEngineId === id) live.defaultEngineId = live.engines[0]?.id ?? '';
	}

	function add() {
		const live = app.config.value.search;
		live.engines.push({
			id: createId(),
			name: t('engine.newName'),
			url: 'https://example.org/search?q=%s',
			bang: '',
			icon: null
		});
		if (!live.defaultEngineId) live.defaultEngineId = live.engines[0].id;
	}
</script>

<div class="section">
	<div class="head">
		<h3>{t('settings.engines')}</h3>
		<p class="field-hint">{t('settings.enginesHint')}</p>
	</div>
	<ul class="engines">
		{#each search.engines as engine (engine.id)}
			<EngineRow
				{engine}
				{radioName}
				isDefault={engine.id === search.defaultEngineId}
				bangTaken={(bang) => search.engines.some((e) => e.id !== engine.id && e.bang === bang)}
				onchange={update}
				onmakedefault={() => (app.config.value.search.defaultEngineId = engine.id)}
				onremove={() => remove(engine.id)}
			/>
		{/each}
	</ul>
	<div>
		<button type="button" class="btn" onclick={add}>
			<Icon name="plus" size={16} />
			{t('engine.add')}
		</button>
	</div>
</div>

<style>
	.section {
		display: grid;
		gap: var(--space-4);
	}

	.head {
		display: grid;
		gap: var(--space-1);
	}

	h3 {
		font-size: var(--text-md);
		font-weight: 700;
	}

	.engines {
		display: grid;
		gap: var(--space-2);
	}
</style>
