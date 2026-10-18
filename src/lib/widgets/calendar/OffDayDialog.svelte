<script lang="ts">
	import { t } from '$lib/i18n/index.svelte';
	import Dialog from '$lib/ui/Dialog.svelte';
	import { daysBetween, isDateKey, MAX_RANGE_DAYS, orderRange, type OffDayRange } from './agenda';

	let {
		open = $bindable(false),
		range,
		date,
		onsave
	}: {
		open?: boolean;
		/** Zu bearbeitender Zeitraum; null = neuer Zeitraum */
		range: OffDayRange | null;
		/** Vorgabe für Anfang und Ende eines neuen Zeitraums (`YYYY-MM-DD`) */
		date: string;
		onsave: (data: Omit<OffDayRange, 'id'>) => void;
	} = $props();

	let label = $state('');
	let start = $state('');
	let end = $state('');
	let startBad = $state(false);
	let endBad = $state(false);
	let submitted = $state(false);
	const id = $props.id();

	$effect.pre(() => {
		if (!open) return;
		label = range?.label ?? '';
		start = range?.start ?? date;
		end = range?.end ?? date;
		startBad = endBad = submitted = false;
	});

	/** Leeres Ende heißt: nur ein Tag */
	const effectiveEnd = $derived(end || start);
	const datesInvalid = $derived(
		submitted && (startBad || endBad || !isDateKey(start) || !isDateKey(effectiveEnd))
	);
	const tooLong = $derived(
		submitted && !datesInvalid && Math.abs(daysBetween(start, effectiveEnd)) >= MAX_RANGE_DAYS
	);

	function onStartInput(e: Event & { currentTarget: HTMLInputElement }) {
		startBad = e.currentTarget.validity.badInput;
		// Ein Ende vor dem neuen Anfang zieht mit, damit aus „ein Tag“ kein Rückwärts-Zeitraum wird
		if (isDateKey(start) && (!end || end < start)) end = start;
	}

	function save(e: SubmitEvent) {
		e.preventDefault();
		submitted = true;
		if (datesInvalid || tooLong) return;
		onsave({ label: label.trim(), ...orderRange(start, effectiveEnd) });
		open = false;
	}
</script>

<Dialog bind:open title={range ? t('calendar.editOff') : t('calendar.newOff')} size="sm">
	<form class="form" id="{id}-form" onsubmit={save} novalidate>
		<div class="field">
			<label class="field-label" for="{id}-label">{t('calendar.fieldOffLabel')}</label>
			<!-- Im Dialog gehört der Fokus ins erste Feld (statt auf „Schließen“) -->
			<!-- svelte-ignore a11y_autofocus -->
			<input
				id="{id}-label"
				autofocus
				class="input"
				type="text"
				autocomplete="off"
				maxlength="200"
				placeholder={t('calendar.offLabelPlaceholder')}
				bind:value={label}
			/>
		</div>
		<div class="pair">
			<div class="field">
				<label class="field-label" for="{id}-start">{t('calendar.fieldOffStart')}</label>
				<input
					id="{id}-start"
					class="input"
					type="date"
					required
					aria-invalid={datesInvalid}
					aria-describedby={datesInvalid ? `${id}-error` : undefined}
					bind:value={start}
					oninput={onStartInput}
				/>
			</div>
			<div class="field">
				<label class="field-label" for="{id}-end">{t('calendar.fieldOffEnd')}</label>
				<input
					id="{id}-end"
					class="input"
					type="date"
					aria-invalid={datesInvalid || tooLong}
					aria-describedby={datesInvalid || tooLong ? `${id}-error` : `${id}-hint`}
					bind:value={end}
					oninput={(e) => (endBad = e.currentTarget.validity.badInput)}
				/>
			</div>
		</div>
		{#if datesInvalid}
			<p class="field-error" id="{id}-error">{t('calendar.dateInvalid')}</p>
		{:else if tooLong}
			<p class="field-error" id="{id}-error">
				{t('calendar.rangeTooLong', { days: MAX_RANGE_DAYS })}
			</p>
		{:else}
			<p class="field-hint" id="{id}-hint">{t('calendar.fieldOffEndHint')}</p>
		{/if}
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

	.pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
	}

	.form > .field-hint,
	.form > .field-error {
		margin-top: calc(-1 * var(--space-2));
	}
</style>
