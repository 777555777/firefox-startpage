<script lang="ts">
	import { LARGE_FILE_BYTES, mediaKindOf, type BackgroundSlot } from '$lib/background/media-utils';
	import type { DayPhase } from '$lib/config/types';
	import { i18n, t } from '$lib/i18n/index.svelte';
	import { getApp } from '$lib/state/context';
	import { toasts } from '$lib/state/toasts.svelte';
	import { formatMinutes, parseTime, PHASES } from '$lib/theme/phase';
	import Segmented from '$lib/ui/Segmented.svelte';
	import Switch from '$lib/ui/Switch.svelte';
	import FocusPicker from './FocusPicker.svelte';
	import MediaSlot from './MediaSlot.svelte';

	const app = getApp();
	const id = $props.id();
	const background = $derived(app.config.value.appearance.background);
	const timeOfDay = $derived(app.config.value.appearance.timeOfDay);
	/** Vorschau für den Fokuspunkt: Haupt-Hintergrund, sonst der erste Slot */
	const focusMedia = $derived(
		background.main ?? PHASES.map((phase) => background.slots[phase]).find(Boolean) ?? null
	);

	const phaseName = (phase: DayPhase) => t(`phase.${phase}`);

	async function upload(slot: BackgroundSlot, file: File) {
		if (!mediaKindOf(file)) {
			toasts.show(t('background.unsupported', { name: file.name }), { tone: 'error' });
			return;
		}
		if (file.size > LARGE_FILE_BYTES) {
			const size = new Intl.NumberFormat(i18n.lang, {
				style: 'unit',
				unit: 'megabyte',
				maximumFractionDigits: 0
			}).format(file.size / 1024 / 1024);
			toasts.show(t('background.large', { name: file.name, size }), { duration: 8000 });
		}
		const result = await app.setBackground(slot, file);
		if (result === 'failed') toasts.show(t('background.failed'), { tone: 'error' });
	}

	function setPhaseStart(phase: DayPhase, value: string) {
		const minutes = parseTime(value);
		if (minutes !== null) app.config.value.appearance.timeOfDay.phaseStart[phase] = minutes;
	}

	/** Dateien, die neben einem Slot landen, öffnen nicht den Browser-Viewer */
	function swallow(event: DragEvent) {
		if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
	}
</script>

<div class="section" role="presentation" ondragover={swallow} ondrop={swallow}>
	<section class="group">
		<MediaSlot
			label={t('background.main')}
			ref={background.main}
			emptyLabel={t('background.sky')}
			onfile={(file) => upload('main', file)}
			onremove={() => app.clearBackground('main')}
		/>
		<p class="field-hint">{t('background.mainHint')} {t('background.formats')}.</p>
	</section>

	<section class="group">
		<h3 class="field-label">{t('background.slots')}</h3>
		<p class="field-hint">{t('background.slotsHint')}</p>
		<div class="slots">
			{#each PHASES as phase (phase)}
				<MediaSlot
					label={phaseName(phase)}
					ref={background.slots[phase] ?? null}
					emptyLabel={t('background.useMain')}
					onfile={(file) => upload(phase, file)}
					onremove={() => app.clearBackground(phase)}
				/>
			{/each}
		</div>
	</section>

	{#if focusMedia}
		<div class="field">
			<span class="field-label">{t('background.fit')}</span>
			<Segmented
				label={t('background.fit')}
				bind:value={app.config.value.appearance.background.fit}
				options={[
					{ value: 'cover', label: t('background.fitCover') },
					{ value: 'contain', label: t('background.fitContain') }
				]}
			/>
		</div>

		<div class="field">
			<span class="field-label" id="{id}-focus">{t('background.focus')}</span>
			<FocusPicker
				media={focusMedia}
				labelledby="{id}-focus"
				bind:focus={app.config.value.appearance.background.focus}
			/>
			<p class="field-hint">{t('background.focusHint')}</p>
		</div>
	{/if}

	<div class="field">
		<Switch
			label={t('background.grading')}
			bind:checked={app.config.value.appearance.timeOfDay.grading}
		/>
		<p class="field-hint">{t('background.gradingHint')}</p>
	</div>

	<fieldset class="field">
		<legend class="field-label">{t('background.phases')}</legend>
		<div class="phases">
			{#each PHASES as phase (phase)}
				<label class="phase" class:current={app.timeOfDay.phase === phase}>
					<span>{phaseName(phase)}</span>
					<input
						class="input"
						type="time"
						value={formatMinutes(timeOfDay.phaseStart[phase])}
						onchange={(event) => setPhaseStart(phase, event.currentTarget.value)}
					/>
				</label>
			{/each}
		</div>
		<p class="field-hint">
			{t('background.current', { phase: phaseName(app.timeOfDay.phase) })} · {t(
				'background.phasesHint'
			)}
		</p>
	</fieldset>
</div>

<style>
	.section {
		display: grid;
		gap: var(--space-6);
	}

	.group {
		display: grid;
		gap: var(--space-2);
	}

	.slots {
		display: grid;
		gap: var(--space-2);
	}

	fieldset {
		margin: 0;
		padding: 0;
		border: none;
	}

	legend {
		padding: 0;
	}

	.phases {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: var(--space-2);
		margin-top: var(--space-2);
	}

	.phase {
		display: grid;
		gap: var(--space-1);
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text-secondary);

		&.current span {
			color: var(--accent-text);
		}

		&.current span::after {
			content: ' ●';
		}
	}
</style>
