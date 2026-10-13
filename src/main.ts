import { mount } from 'svelte';
import App from './App.svelte';
import { createAppState } from '$lib/state/app.svelte';
import './app.css';

// Erster Paint in der Stimmung des letzten Besuchs, damit nachts nichts hell aufblitzt
try {
	const paint = JSON.parse(localStorage.getItem('startpage:paint') ?? 'null') as {
		tone?: string;
		color?: string;
	} | null;
	if (paint?.color && /^[\d ]+$/.test(paint.color)) {
		document.documentElement.style.backgroundColor = `rgb(${paint.color})`;
	}
	if (paint?.tone === 'dark') document.documentElement.dataset.tone = 'dark';
} catch {
	// egal, dann eben die Standardfarbe
}

const target = document.getElementById('app');
if (!target) throw new Error('#app fehlt');

const app = createAppState();
await app.init();
mount(App, { target, props: { app } });
