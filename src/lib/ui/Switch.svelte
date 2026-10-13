<script lang="ts">
	let {
		checked = $bindable(false),
		label,
		onchange
	}: { checked?: boolean; label: string; onchange?: (checked: boolean) => void } = $props();
</script>

<label class="switch">
	<span class="label">{label}</span>
	<input type="checkbox" role="switch" bind:checked onchange={() => onchange?.(checked)} />
	<span class="track" aria-hidden="true"><span class="thumb"></span></span>
</label>

<style>
	.switch {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		min-height: 36px;
		cursor: pointer;
	}

	.label {
		font-weight: 500;
	}

	input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.track {
		flex: none;
		position: relative;
		width: 42px;
		height: 24px;
		border-radius: var(--radius-full);
		background: var(--track-strong);
		box-shadow: inset 0 1px 2px rgb(var(--shade) / 0.2);
		transition: background-color var(--duration) var(--ease-out);
	}

	.thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: linear-gradient(180deg, #fff, #eef3f8);
		box-shadow: 0 1px 3px rgb(var(--shade) / 0.35);
		transition: transform var(--duration) var(--ease-spring);
	}

	input:checked + .track {
		background: var(--accent);
	}

	input:checked + .track .thumb {
		transform: translateX(18px);
	}

	input:focus-visible + .track {
		box-shadow: var(--focus-ring);
	}
</style>
