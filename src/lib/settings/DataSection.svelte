<script lang="ts">
	import {
		createExport,
		exportFileName,
		ImportError,
		type Backup,
		type ImportResult
	} from '$lib/config/transfer';
	import type { Config } from '$lib/config/types';
	import { i18n, t } from '$lib/i18n/index.svelte';
	import { getApp } from '$lib/state/context';
	import { toasts } from '$lib/state/toasts.svelte';
	import Dialog from '$lib/ui/Dialog.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import { downloadJson } from '$lib/utils/download';

	const app = getApp();

	let includeStats = $state(false);
	let fileInput: HTMLInputElement;
	let pendingImport = $state<ImportResult | null>(null);
	let confirmImport = $state(false);
	let confirmReset = $state(false);
	let backups = $state<Backup[]>([]);

	const dateFormat = $derived(
		new Intl.DateTimeFormat(i18n.lang, { dateStyle: 'medium', timeStyle: 'short' })
	);

	async function refreshBackups() {
		backups = await app.loadBackups();
	}

	$effect(() => {
		void refreshBackups();
	});

	function exportConfig() {
		const config = $state.snapshot(app.config.value) as Config;
		const stats = includeStats ? $state.snapshot(app.stats.value) : null;
		downloadJson(createExport(config, stats), exportFileName());
	}

	async function onFile(event: Event & { currentTarget: HTMLInputElement }) {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = '';
		if (!file) return;
		try {
			pendingImport = app.readImport(await file.text());
			confirmImport = true;
		} catch (error) {
			const reason =
				error instanceof ImportError
					? t(error.code === 'json' ? 'data.errorJson' : 'data.errorFormat')
					: String(error);
			toasts.show(t('data.importFailed', { reason }), { tone: 'error' });
		}
	}

	async function applyImport() {
		if (!pendingImport) return;
		const result = pendingImport;
		confirmImport = false;
		pendingImport = null;
		const missing = await app.applyImport(result);
		toasts.show(t('data.importDone'));
		if (missing.length > 0) {
			toasts.show(
				t('data.importMissingMedia', { count: missing.length, names: missing.join(', ') }),
				{ tone: 'error', duration: 10000 }
			);
		}
		await refreshBackups();
	}

	async function restore(backup: Backup) {
		if (await app.restoreBackup(backup.id)) toasts.show(t('data.backupRestored'));
		await refreshBackups();
	}

	async function reset() {
		confirmReset = false;
		await app.resetAll();
		toasts.show(t('data.resetDone'));
		await refreshBackups();
	}
</script>

<div class="section">
	<section class="group">
		<h3>{t('data.export')}</h3>
		<p class="field-hint">{t('data.exportHint')}</p>
		<label class="check">
			<input type="checkbox" bind:checked={includeStats} />
			{t('data.exportStats')}
		</label>
		<div class="actions">
			<button type="button" class="btn" onclick={exportConfig}>
				<Icon name="download" size={16} />
				{t('data.export')}
			</button>
			<button type="button" class="btn" onclick={() => fileInput.click()}>
				<Icon name="upload" size={16} />
				{t('data.import')}
			</button>
			<input
				bind:this={fileInput}
				type="file"
				accept="application/json,.json"
				hidden
				onchange={onFile}
			/>
		</div>
	</section>

	<section class="group">
		<h3>{t('data.backups')}</h3>
		<p class="field-hint">{t('data.backupsHint')}</p>
		{#if backups.length === 0}
			<p class="empty">{t('data.backupsEmpty')}</p>
		{:else}
			<ul class="backups">
				{#each backups as backup (backup.id)}
					<li>
						<Icon name="history" size={16} />
						<span class="when">
							{dateFormat.format(backup.createdAt)}
							<span class="reason">{t(`data.backupReason.${backup.reason}`)}</span>
						</span>
						<button type="button" class="btn" onclick={() => restore(backup)}>
							{t('data.backupRestore')}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="group">
		<div class="actions">
			<button type="button" class="btn btn-danger" onclick={() => (confirmReset = true)}>
				{t('data.reset')}
			</button>
		</div>
	</section>
</div>

<Dialog
	bind:open={confirmImport}
	title={t('data.importConfirmTitle')}
	size="sm"
	onclose={() => (pendingImport = null)}
>
	<p>{t('data.importConfirm')}</p>
	{#snippet footer()}
		<button type="button" class="btn" onclick={() => (confirmImport = false)}>
			{t('common.cancel')}
		</button>
		<button type="button" class="btn btn-primary" onclick={applyImport}>
			{t('data.import')}
		</button>
	{/snippet}
</Dialog>

<Dialog bind:open={confirmReset} title={t('data.resetConfirmTitle')} size="sm">
	<p>{t('data.resetConfirm')}</p>
	{#snippet footer()}
		<button type="button" class="btn" onclick={() => (confirmReset = false)}>
			{t('common.cancel')}
		</button>
		<button type="button" class="btn btn-primary" onclick={reset}>
			{t('data.reset')}
		</button>
	{/snippet}
</Dialog>

<style>
	.section {
		display: grid;
		gap: var(--space-6);
	}

	.group {
		display: grid;
		gap: var(--space-2);
	}

	h3 {
		font-size: var(--text-md);
		font-weight: 700;
	}

	.check {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-sm);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-1);
	}

	.empty {
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.backups {
		display: grid;
		gap: var(--space-1);

		li {
			display: flex;
			align-items: center;
			gap: var(--space-3);
			padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3);
			border-radius: var(--radius-sm);
			background: var(--fill);
		}
	}

	.when {
		flex: 1;
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.reason {
		margin-left: var(--space-2);
		font-weight: 400;
		color: var(--text-secondary);
	}
</style>
