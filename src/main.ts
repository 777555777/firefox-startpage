import { mount } from 'svelte';
import App from './App.svelte';
import { createAppState } from '$lib/state/app.svelte';
import './app.css';

const target = document.getElementById('app');
if (!target) throw new Error('#app fehlt');

const app = createAppState();
await app.init();
mount(App, { target, props: { app } });
