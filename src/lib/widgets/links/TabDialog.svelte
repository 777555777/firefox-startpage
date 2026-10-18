<script lang="ts">
	import { t } from '$lib/i18n/index.svelte';
	import Dialog from '$lib/ui/Dialog.svelte';
	import Segmented from '$lib/ui/Segmented.svelte';
	import type { LinkTab, LinkView } from './settings';

	let {
		open = $bindable(false),
		tab,
		canDelete,
		showView = true,
		labels,
		onsave,
		ondelete
	}: {
		open?: boolean;
		/** Zu bearbeitender Tab; null = neuer Tab */
		tab: (Pick<LinkTab, 'label' | 'icon'> & { view?: LinkView }) | null;
		canDelete: boolean;
		/** Auswahl der Ansicht; das RSS-Widget nutzt den Dialog ohne */
		showView?: boolean;
		/** Titel und Löschen-Text, z. B. „Kategorie“ statt „Gruppe“ */
		labels?: { edit: string; create: string; remove: string };
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

<Dialog
	bind:open
	title={tab ? (labels?.edit ?? t('links.editTab')) : (labels?.create ?? t('links.newTab'))}
	size="sm"
>
	<form class="form" id="{id}-form" onsubmit={save}>
		<div class="row">
			<div class="field grow">
				<label class="field-label" for="{id}-label">{t('links.fieldTabLabel')}</label>
				<!-- Fokus gleich ins Namensfeld, wie in den Kalender-Dialogen -->
				<!-- svelte-ignore a11y_autofocus -->
				<input
					id="{id}-label"
					class="input"
					type="text"
					autocomplete="off"
					autofocus
					bind:value={label}
				/>
			</div>
			<div class="field">
				<label class="field-label" for="{id}-icon">{t('links.fieldTabIcon')}</label>
				<input id="{id}-icon" class="input emoji" type="text" maxlength="8" bind:value={icon} />
			</div>
		</div>
		{#if showView}
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
		{/if}
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
				{labels?.remove ?? t('links.deleteTab')}
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
