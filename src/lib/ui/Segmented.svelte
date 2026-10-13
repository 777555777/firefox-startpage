<script lang="ts" generics="T extends string | number">
	type Option = { value: T; label: string };

	let {
		value = $bindable(),
		options,
		label,
		onchange
	}: { value: T; options: Option[]; label: string; onchange?: (value: T) => void } = $props();

	const name = $props.id();
</script>

<div class="segmented" role="radiogroup" aria-label={label}>
	{#each options as option (option.value)}
		<label class="option" class:active={option.value === value}>
			<input
				type="radio"
				{name}
				value={option.value}
				checked={option.value === value}
				onchange={() => {
					value = option.value;
					onchange?.(option.value);
				}}
			/>
			<span>{option.label}</span>
		</label>
	{/each}
</div>

<style>
	.segmented {
		display: inline-flex;
		gap: 2px;
		padding: 3px;
		border-radius: var(--radius-full);
		background: rgb(12 31 51 / 0.08);
		box-shadow: inset 0 1px 2px rgb(8 34 66 / 0.12);
	}

	.option {
		position: relative;
		display: grid;
		place-items: center;
		min-width: 40px;
		min-height: 30px;
		padding: 0 var(--space-3);
		border-radius: var(--radius-full);
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text-secondary);
		cursor: pointer;
		transition:
			background-color var(--duration-fast) ease,
			color var(--duration-fast) ease;

		&:hover {
			color: var(--text);
		}

		&.active {
			background: rgb(255 255 255 / 0.92);
			color: var(--text);
			box-shadow:
				0 1px 3px rgb(8 34 66 / 0.18),
				inset 0 1px 0 #fff;
		}

		&:has(input:focus-visible) {
			box-shadow: var(--focus-ring);
		}
	}

	input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
</style>
