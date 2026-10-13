<script lang="ts">
	import { t } from '$lib/i18n/index.svelte';
	import Dialog from '$lib/ui/Dialog.svelte';
	import Segmented from '$lib/ui/Segmented.svelte';
	import type { LinkTab, LinkView } from './settings';

	let {
		open = $bindable(false),
		tab,
		canDelete,
		onsave,
		ondelete
	}: {
		open?: boolean;
		/** Zu bearbeitender Tab; null = neuer Tab */
		tab: LinkTab | null;
		canDelete: boolean;
		onsave: (data: Pick<LinkTab, 'label' | 'icon' | 'view'>) => void;
		ondelete: () => void;
	} = $props();

	let label = $state('');
	let icon = $state('');
	let view = $state<LinkView>('tiles');
	const id = $props.id();

	$effect.pre(() => {
		if (!open) return;
		label = tab?.label ?? '';
		icon = tab?.icon ?? '';
		view = tab?.view ?? 'tiles';
	});

	function save(event: SubmitEvent) {
		event.preventDefault();
		onsave({ label: label.trim(), icon: icon.trim(), view });
		open = false;
	}
</script>

<Dialog bind:open title={tab ? t('links.editTab') : t('links.newTab')} size="sm">
	<form class="form" id="{id}-form" onsubmit={save}>
		<div class="row">
			<div class="field grow">
				<label class="field-label" for="{id}-label">{t('links.fieldTabLabel')}</label>
				<input id="{id}-label" class="input" type="text" autocomplete="off" bind:value={label} />
			</div>
			<div class="field">
				<label class="field-label" for="{id}-icon">{t('links.fieldTabIcon')}</label>
				<input id="{id}-icon" class="input emoji" type="text" maxlength="8" bind:value={icon} />
			</div>
		</div>
		<div class="field">
			<span class="field-label">{t('links.fieldView')}</span>
			<Segmented
				label={t('links.fieldView')}
				bind:value={view}
				options={[
					{ value: 'tiles', label: t('links.viewTiles') },
					{ value: 'capsules', label: t('links.viewCapsules') },
					{ value: 'list', label: t('links.viewList') }
				]}
			/>
		</div>
	</form>
	{#snippet footer()}
		{#if tab && canDelete}
			<button
				type="button"
				class="btn btn-danger delete"
				onclick={() => {
					open = false;
					ondelete();
				}}
			>
				{t('links.deleteTab')}
			</button>
		{/if}
		<button type="button" class="btn" onclick={() => (open = false)}>{t('common.cancel')}</button>
		<button type="submit" class="btn btn-primary" form="{id}-form">{t('common.save')}</button>
	{/snippet}
</Dialog>

<style>
	.form {
		display: grid;
		gap: var(--space-4);
	}

	.row {
		display: flex;
		gap: var(--space-3);
	}

	.grow {
		flex: 1;
	}

	.emoji {
		width: 120px;
	}

	.delete {
		margin-right: auto;
	}
</style>
