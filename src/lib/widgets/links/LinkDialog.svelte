<script lang="ts">
	import { t } from '$lib/i18n/index.svelte';
	import Dialog from '$lib/ui/Dialog.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import Segmented from '$lib/ui/Segmented.svelte';
	import LinkIcon from './LinkIcon.svelte';
	import { imageToDataUrl } from './link-utils';
	import { normalizeLinkUrl, type Link, type LinkTarget } from './settings';

	let {
		open = $bindable(false),
		link,
		onsave
	}: {
		open?: boolean;
		/** Zu bearbeitender Link; null = neuer Link */
		link: Link | null;
		onsave: (data: Omit<Link, 'id'>) => void;
	} = $props();

	let label = $state('');
	let url = $state('');
	let target = $state<LinkTarget>('self');
	let icon = $state<string | null>(null);
	let submitted = $state(false);
	let iconError = $state(false);
	let fileInput: HTMLInputElement;
	const id = $props.id();

	// Felder beim Öffnen aus dem Link füllen
	$effect.pre(() => {
		if (!open) return;
		label = link?.label ?? '';
		url = link?.url ?? '';
		target = link?.target ?? 'self';
		icon = link?.icon ?? null;
		submitted = false;
		iconError = false;
	});

	const normalized = $derived(normalizeLinkUrl(url));
	const urlInvalid = $derived(submitted && !normalized);

	async function onFile(event: Event & { currentTarget: HTMLInputElement }) {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = '';
		if (!file) return;
		const dataUrl = await imageToDataUrl(file);
		iconError = !dataUrl;
		if (dataUrl) icon = dataUrl;
	}

	function save(event: SubmitEvent) {
		event.preventDefault();
		submitted = true;
		if (!normalized) return;
		onsave({ label: label.trim(), url: normalized, target, icon });
		open = false;
	}
</script>

<Dialog bind:open title={link ? t('links.editLink') : t('links.newLink')} size="sm">
	<form class="form" id="{id}-form" onsubmit={save} novalidate>
		<div class="field">
			<label class="field-label" for="{id}-url">{t('links.fieldUrl')}</label>
			<input
				id="{id}-url"
				class="input"
				type="text"
				inputmode="url"
				autocomplete="off"
				spellcheck="false"
				placeholder="https://"
				aria-invalid={urlInvalid}
				aria-describedby={urlInvalid ? `${id}-url-error` : undefined}
				bind:value={url}
			/>
			{#if urlInvalid}
				<p class="field-error" id="{id}-url-error">{t('links.invalidUrl')}</p>
			{/if}
		</div>
		<div class="field">
			<label class="field-label" for="{id}-label">{t('links.fieldLabel')}</label>
			<input id="{id}-label" class="input" type="text" autocomplete="off" bind:value={label} />
		</div>
		<div class="field">
			<span class="field-label">{t('links.fieldTarget')}</span>
			<Segmented
				label={t('links.fieldTarget')}
				bind:value={target}
				options={[
					{ value: 'self', label: t('links.targetSelf') },
					{ value: 'blank', label: t('links.targetBlank') }
				]}
			/>
		</div>
		<div class="field">
			<span class="field-label">{t('links.fieldIcon')}</span>
			<div class="icon-row">
				<span class="preview">
					<LinkIcon url={normalized ?? ''} label={label || url} {icon} size={32} />
				</span>
				<button type="button" class="btn" onclick={() => fileInput.click()}>
					<Icon name="upload" size={16} />
					{t('links.iconUpload')}
				</button>
				{#if icon}
					<button type="button" class="btn" onclick={() => (icon = null)}>
						{t('links.iconRemove')}
					</button>
				{:else}
					<span class="field-hint">{t('links.iconAuto')}</span>
				{/if}
				<input bind:this={fileInput} type="file" accept="image/*" hidden onchange={onFile} />
			</div>
			{#if iconError}
				<p class="field-error">{t('links.iconTooLarge')}</p>
			{/if}
		</div>
	</form>
	{#snippet footer()}
		<button type="button" class="btn" onclick={() => (open = false)}>{t('common.cancel')}</button>
		<button type="submit" class="btn btn-primary" form="{id}-form">{t('common.save')}</button>
	{/snippet}
</Dialog>

<style>
	.form {
		display: grid;
		gap: var(--space-4);
	}

	.icon-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}

	.preview {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: var(--radius-sm);
		background: var(--fill);
	}
</style>
