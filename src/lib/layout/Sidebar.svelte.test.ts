import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sortable } from '$lib/dnd/sortable.svelte';
import { t } from '$lib/i18n/index.svelte';
import type { SidebarArrangement } from './arrangement';
import type { Side } from './operations';
import Sidebar from './Sidebar.svelte';

const segment = createRawSnippet((area: () => number) => ({
	render: () => `<div><button type="button">Inhalt ${area()}</button></div>`
}));

const tabs = {
	left: { icon: 'clock', label: 'Linke Spalte: Uhr' },
	right: { icon: 'rss', label: 'Rechte Spalte: RSS' }
} as const;

function setup(open: Side | null, overrides: Partial<SidebarArrangement> = {}) {
	const ontoggle = vi.fn();
	const onclose = vi.fn();
	const onclosed = vi.fn();
	const ondroptab = vi.fn();
	const onspring = vi.fn();
	const sortable = new Sortable({ group: 'panels', onmove: () => {} });
	const arrangement: SidebarArrangement = {
		areas: [2, 1],
		tabs: ['left', 'right'],
		open,
		width: 352,
		gap: 44,
		...overrides
	};
	const result = render(Sidebar, {
		props: {
			arrangement,
			open,
			tabs,
			segment,
			sortable,
			editing: false,
			ontoggle,
			onclose,
			onclosed,
			ondroptab,
			onspring
		}
	});
	const tab = (name: string) => screen.getByRole('button', { name });
	const content = () => document.getElementById('sidebar-content') as HTMLElement;
	return { ...result, ontoggle, onclose, onclosed, tab, content, arrangement };
}

afterEach(() => {
	vi.useRealTimers();
});

describe('Sidebar mit Tabs am Rand', () => {
	it('zeigt einen Tab pro Seite in einer benannten Gruppe', () => {
		const { tab } = setup(null);
		expect(screen.getByRole('group', { name: t('sidebar.tabs') })).toBeInTheDocument();
		expect(tab('Linke Spalte: Uhr')).toHaveAttribute('aria-expanded', 'false');
		expect(tab('Rechte Spalte: RSS')).toHaveAttribute('aria-controls', 'sidebar-content');
	});

	it('meldet Klicks auf einen Tab', async () => {
		const { tab, ontoggle } = setup(null);
		await fireEvent.click(tab('Rechte Spalte: RSS'));
		expect(ontoggle).toHaveBeenCalledWith('right');
	});

	it('zeigt die offene Seite und verbirgt die andere', () => {
		const { tab, content } = setup('right');
		expect(tab('Rechte Spalte: RSS')).toHaveAttribute('aria-expanded', 'true');
		expect(content().inert).toBe(false);
		expect(content()).toHaveAccessibleName(t('area.right'));
		const sides = content().querySelectorAll<HTMLElement>('[data-sidebar-side]');
		expect([...sides].map((side) => [side.dataset.sidebarSide, side.hidden])).toEqual([
			['left', true],
			['right', false]
		]);
	});

	it('macht den Inhalt einer geschlossenen Sidebar inert', () => {
		const { content } = setup(null);
		// Svelte setzt die Eigenschaft, nicht das Attribut
		expect(content().inert).toBe(true);
	});

	it('meldet das Ende des Hinausfahrens', async () => {
		vi.useFakeTimers();
		// Gewünscht ist „zu“, die Mitte macht aber noch Platz für die linke Seite
		const { onclosed, content } = setup(null, { open: 'left' });
		expect(content().querySelector<HTMLElement>('[data-sidebar-side="left"]')?.hidden).toBe(false);
		await vi.runAllTimersAsync();
		expect(onclosed).toHaveBeenCalled();
	});

	it('gibt nur für Seiten mit Tab einen Reiter aus', () => {
		setup(null, { tabs: ['right'], areas: [1] });
		expect(screen.queryByRole('button', { name: 'Linke Spalte: Uhr' })).toBeNull();
		expect(screen.getByRole('button', { name: 'Rechte Spalte: RSS' })).toBeInTheDocument();
	});

	it('schließt mit Esc aus Inhalt und Tabs', async () => {
		const { onclose, tab, content } = setup('left');
		const inner = content().querySelector('button') as HTMLElement;
		await fireEvent.keyDown(inner, { key: 'Escape' });
		await fireEvent.keyDown(tab('Linke Spalte: Uhr'), { key: 'Escape' });
		expect(onclose).toHaveBeenCalledTimes(2);
	});

	it('lässt Esc bei geschlossener Sidebar durch', async () => {
		const { onclose, tab } = setup(null);
		const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
		tab('Linke Spalte: Uhr').dispatchEvent(event);
		expect(event.defaultPrevented).toBe(false);
		expect(onclose).not.toHaveBeenCalled();
	});

	it('setzt den Fokus beim Schließen auf den Tab der Seite', async () => {
		const { rerender, content, tab, arrangement } = setup('right');
		const inner = content().querySelector('[data-sidebar-side="right"] button') as HTMLElement;
		inner.focus();
		await rerender({ open: null, arrangement: { ...arrangement, open: 'right' } });
		expect(tab('Rechte Spalte: RSS')).toHaveFocus();
	});
});
