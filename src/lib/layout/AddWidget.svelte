<script lang="ts">
	import type { WidgetType } from '$lib/config/types';
	import { t } from '$lib/i18n/index.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import Menu, { type MenuAnchor, type MenuItem } from '$lib/ui/Menu.svelte';
	import { registry } from '$lib/widgets/registry';

	let {
		column,
		used,
		onadd
	}: { column: number; used: Set<WidgetType>; onadd: (type: WidgetType) => void } = $props();

	let anchor = $state<MenuAnchor | null>(null);

	const items = $derived<MenuItem[]>(
		Object.values(registry).map((definition) => {
			const taken = Boolean(definition.singleton && used.has(definition.type));
			return {
				label: t(definition.name),
				icon: definition.icon,
				disabled: taken,
				hint: taken ? t('edit.singletonUsed') : undefined,
				onselect: () => onadd(definition.type)
			};
		})
	);
</script>

<button
	type="button"
	class="add"
	aria-haspopup="menu"
	aria-expanded={anchor !== null}
	aria-label={t('edit.addWidgetTo', { column: column + 1 })}
	onclick={(event) => (anchor = event.currentTarget)}
>
	<Icon name="plus" size={16} />
	<span>{t('edit.addWidget')}</span>
</button>

<Menu bind:anchor label={t('edit.addWidget')} {items} />

<style>
	.add {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		width: 100%;
		min-height: 52px;
		border: 1.5px dashed rgb(255 255 255 / 0.75);
		border-radius: var(--radius-panel);
		background: rgb(255 255 255 / 0.12);
		color: #fff;
		font-weight: 600;
		text-shadow: 0 1px 2px rgb(var(--shade) / 0.35);
		transition: background-color var(--duration-fast) ease;

		&:hover {
			background: rgb(255 255 255 / 0.24);
		}
	}
</style>
