<script lang="ts">
	import { mediaLibrary } from '$lib/background/media-library.svelte';
	import { ACCEPTED_TYPES } from '$lib/background/media-utils';
	import type { MediaRef } from '$lib/config/types';
	import { t } from '$lib/i18n/index.svelte';
	import Icon from '$lib/ui/Icon.svelte';

	let {
		label,
		ref,
		emptyLabel,
		onfile,
		onremove
	}: {
		label: string;
		ref: MediaRef | null;
		/** Was ohne eigene Datei gilt, z. B. „Himmelsverlauf“ */
		emptyLabel: string;
		onfile: (file: File) => void;
		onremove: () => void;
	} = $props();

	let input: HTMLInputElement;
	let dragOver = $state(false);

	$effect(() => {
		if (ref) return mediaLibrary.retain(ref.id);
	});

	const status = $derived(ref ? mediaLibrary.status(ref.id) : null);
	const url = $derived(ref ? mediaLibrary.url(ref.id) : null);

	function take(files: FileList | null | undefined) {
		const file = files?.[0];
		if (file) onfile(file);
	}

	function ondrop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		dragOver = false;
		take(event.dataTransfer?.files);
	}

	function ondragover(event: DragEvent) {
		if (!event.dataTransfer?.types.includes('Files')) return;
		event.preventDefault();
		event.dataTransfer.dropEffect = 'copy';
		dragOver = true;
	}
</script>

<div
	class="slot"
	class:drag-over={dragOver}
	class:missing={status === 'missing'}
	role="group"
	aria-label={label}
	{ondrop}
	{ondragover}
	ondragleave={() => (dragOver = false)}
>
	<div class="preview">
		{#if ref && url && ref.kind === 'image'}
			<img src={url} alt="" />
		{:else if ref && url && ref.kind === 'video'}
			<video src={url} muted preload="metadata"></video>
			<span class="badge"><Icon name="video" size={14} /></span>
		{:else if status === 'missing'}
			<Icon name="warning" size={22} />
		{:else}
			<Icon name="image" size={22} />
		{/if}
	</div>

	<div class="info">
		<span class="label">{label}</span>
		{#if !ref}
			<span class="detail">{emptyLabel}</span>
		{:else if status === 'missing'}
			<span class="detail warning">{t('background.missing')}</span>
		{:else}
			<span class="detail" title={ref.name}>
				{t(ref.kind === 'video' ? 'background.video' : 'background.image')} · {ref.name}
			</span>
		{/if}
	</div>

	<div class="actions">
		<button type="button" class="btn" onclick={() => input.click()}>
			<Icon name="upload" size={16} />
			{t(ref ? 'background.replace' : 'background.choose')}
		</button>
		{#if ref}
			<button
				type="button"
				class="icon-btn"
				aria-label="{t('background.remove')}: {label}"
				title={t('background.remove')}
				onclick={onremove}
			>
				<Icon name="trash" />
			</button>
		{/if}
	</div>

	<input
		bind:this={input}
		type="file"
		accept={ACCEPTED_TYPES.join(',')}
		hidden
		onchange={(event) => {
			take(event.currentTarget.files);
			event.currentTarget.value = '';
		}}
	/>
</div>

<style>
	.slot {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2);
		border-radius: var(--radius-md);
		background: var(--fill);
		box-shadow: inset 0 0 0 1px var(--line);
		transition:
			background-color var(--duration-fast) ease,
			box-shadow var(--duration-fast) ease;

		&.drag-over {
			background: var(--accent-subtle);
			box-shadow: inset 0 0 0 2px var(--accent);
		}
	}

	.preview {
		position: relative;
		display: grid;
		place-items: center;
		width: 88px;
		aspect-ratio: 16 / 10;
		overflow: hidden;
		border-radius: var(--radius-sm);
		background: var(--track);
		color: var(--text-tertiary);

		img,
		video {
			width: 100%;
			height: 100%;
			max-width: none;
			object-fit: cover;
		}

		.missing & {
			color: var(--danger);
		}
	}

	.badge {
		position: absolute;
		right: 4px;
		bottom: 4px;
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: rgb(0 0 0 / 0.55);
		color: #fff;
	}

	.info {
		display: grid;
		min-width: 0;
	}

	.label {
		font-size: var(--text-sm);
		font-weight: 650;
	}

	.detail {
		overflow: hidden;
		font-size: var(--text-xs);
		color: var(--text-secondary);
		white-space: nowrap;
		text-overflow: ellipsis;

		&.warning {
			color: var(--danger);
			font-weight: 600;
			white-space: normal;
		}
	}

	.actions {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
</style>
