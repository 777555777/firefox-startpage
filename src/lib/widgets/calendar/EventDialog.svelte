<script lang="ts">
	import { t } from '$lib/i18n/index.svelte';
	import Dialog from '$lib/ui/Dialog.svelte';
	import { isDateKey, normalizeTime, type CalendarEvent } from './agenda';

	let {
		open = $bindable(false),
		event,
		date,
		onsave
	}: {
		open?: boolean;
		/** Zu bearbeitender Termin; null = neuer Termin */
		event: CalendarEvent | null;
		/** Vorgabe für einen neuen Termin (`YYYY-MM-DD`) */
		date: string;
		onsave: (data: Omit<CalendarEvent, 'id'>) => void;
	} = $props();

	let title = $state('');
	let day = $state('');
	let time = $state('');
	/** Unvollständige Eingabe im Datums- bzw. Zeitfeld (der Wert ist dann leer) */
	let dayBad = $state(false);
	let timeBad = $state(false);
	let submitted = $state(false);
	const id = $props.id();

	// Felder beim Öffnen aus dem Termin füllen
	$effect.pre(() => {
		if (!open) return;
		title = event?.title ?? '';
		day = event?.date ?? date;
		time = event?.time ?? '';
		dayBad = timeBad = submitted = false;
	});

	const titleInvalid = $derived(submitted && !title.trim());
	const dayInvalid = $derived(submitted && (dayBad || !isDateKey(day)));
	const timeInvalid = $derived(submitted && (timeBad || (time !== '' && !normalizeTime(time))));

	function save(e: SubmitEvent) {
		e.preventDefault();
		submitted = true;
		if (titleInvalid || dayInvalid || timeInvalid) return;
		onsave({ title: title.trim(), date: day, time: time ? normalizeTime(time) : null });
		open = false;
	}
</script>

<Dialog bind:open title={event ? t('calendar.editEvent') : t('calendar.newEvent')} size="sm">
	<form class="form" id="{id}-form" onsubmit={save} novalidate>
		<div class="field">
			<label class="field-label" for="{id}-title">{t('calendar.fieldTitle')}</label>
			<!-- Im Dialog gehört der Fokus ins erste Feld (statt auf „Schließen“) -->
			<!-- svelte-ignore a11y_autofocus -->
			<input
				id="{id}-title"
				autofocus
				class="input"
				type="text"
				autocomplete="off"
				maxlength="200"
				aria-invalid={titleInvalid}
				aria-describedby={titleInvalid ? `${id}-title-error` : undefined}
				bind:value={title}
			/>
			{#if titleInvalid}
				<p class="field-error" id="{id}-title-error">{t('calendar.titleRequired')}</p>
			{/if}
		</div>
		<div class="pair">
			<div class="field">
				<label class="field-label" for="{id}-date">{t('calendar.fieldDate')}</label>
				<input
					id="{id}-date"
					class="input"
					type="date"
					required
					aria-invalid={dayInvalid}
					aria-describedby={dayInvalid ? `${id}-date-error` : undefined}
					bind:value={day}
					oninput={(e) => (dayBad = e.currentTarget.validity.badInput)}
				/>
			</div>
			<div class="field">
				<label class="field-label" for="{id}-time">{t('calendar.fieldTime')}</label>
				<input
					id="{id}-time"
					class="input"
					type="time"
					aria-invalid={timeInvalid}
					aria-describedby={timeInvalid ? `${id}-time-error` : `${id}-time-hint`}
					bind:value={time}
					oninput={(e) => (timeBad = e.currentTarget.validity.badInput)}
				/>
			</div>
		</div>
		{#if dayInvalid}
			<p class="field-error" id="{id}-date-error">{t('calendar.dateInvalid')}</p>
		{/if}
		{#if timeInvalid}
			<p class="field-error" id="{id}-time-error">{t('calendar.timeInvalid')}</p>
		{:else}
			<p class="field-hint" id="{id}-time-hint">{t('calendar.fieldTimeHint')}</p>
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
