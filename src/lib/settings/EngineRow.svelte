<script lang="ts">
	import type { SearchEngine } from '$lib/config/types';
	import { isValidEngineUrl, normalizeBang } from '$lib/config/validate';
	import { t } from '$lib/i18n/index.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import LinkIcon from '$lib/widgets/links/LinkIcon.svelte';

	let {
		engine,
		isDefault,
		bangTaken,
		radioName,
		onchange,
		onmakedefault,
		onremove
	}: {
		engine: SearchEngine;
		isDefault: boolean;
		/** Prüft, ob ein Bang schon von einer anderen Engine genutzt wird */
		bangTaken: (bang: string) => boolean;
		radioName: string;
		onchange: (engine: SearchEngine) => void;
		onmakedefault: () => void;
		onremove: () => void;
	} = $props();

	// Entwurf: Ungültiges wird angezeigt, aber erst gültig in die Config übernommen
	// svelte-ignore state_referenced_locally
	let draft = $state({ name: engine.name, url: engine.url, bang: engine.bang });
	const id = $props.id();

	const urlValid = $derived(isValidEngineUrl(draft.url.trim()));
	const bang = $derived(normalizeBang(draft.bang));
	const bangValid = $derived(!bang || !bangTaken(bang));
	const nameValid = $derived(draft.name.trim().length > 0);

	function commit() {
		if (!urlValid || !bangValid || !nameValid) return;
		onchange({ ...engine, name: draft.name.trim(), url: draft.url.trim(), bang });
	}
</script>

<li class="engine">
	<label class="default" title={t('engine.default')}>
		<input
			type="radio"
			name={radioName}
			checked={isDefault}
			aria-label={t('engine.makeDefault', { name: engine.name })}
			onchange={onmakedefault}
		/>
	</label>
	<LinkIcon url={engine.url} label={engine.name} icon={engine.icon} size={20} />
	<div class="fields">
		<input
			class="input name"
			aria-label={t('engine.name')}
			aria-invalid={!nameValid}
			bind:value={draft.name}
			oninput={commit}
		/>
		<div class="bang-wrap">
			<span aria-hidden="true">!</span>
			<input
				class="input bang"
				aria-label={t('engine.bang')}
				aria-invalid={!bangValid}
				aria-describedby={bangValid ? undefined : `${id}-bang-error`}
				bind:value={draft.bang}
				oninput={commit}
			/>
		</div>
		<input
			class="input url"
			type="url"
			aria-label={t('engine.url')}
			aria-invalid={!urlValid}
			aria-describedby={urlValid ? undefined : `${id}-url-error`}
			bind:value={draft.url}
			oninput={commit}
		/>
		{#if !urlValid}
			<p class="field-error url-error" id="{id}-url-error">{t('engine.invalidUrl')}</p>
		{/if}
		{#if !bangValid}
			<p class="field-error url-error" id="{id}-bang-error">{t('engine.duplicateBang')}</p>
		{/if}
	</div>
	<button
		type="button"
		class="icon-btn"
		aria-label={t('engine.remove', { name: engine.name })}
		onclick={onremove}
	>
		<Icon name="trash" size={16} />
	</button>
</li>

<style>
	.engine {
		display: grid;
		grid-template-columns: auto auto minmax(0, 1fr) auto;
		align-items: start;
		gap: var(--space-3);
		padding: var(--space-3);
		border-radius: var(--radius-md);
		background: var(--fill);
	}

	.engine > :global(.link-icon),
	.default,
	.icon-btn {
		margin-top: 8px;
	}

	.default {
		display: grid;
		place-items: center;
		height: 20px;
	}

	.fields {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 96px;
		gap: var(--space-2);
	}

	.url,
	.url-error {
		grid-column: 1 / -1;
	}

	.bang-wrap {
		position: relative;

		span {
			position: absolute;
			left: 10px;
			top: 50%;
			transform: translateY(-50%);
			color: var(--text-tertiary);
			font-weight: 700;
		}

		input {
			padding-left: 20px;
		}
	}
</style>
