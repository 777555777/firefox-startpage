import { mount } from 'svelte';
import App from './App.svelte';
import { createAppState } from '$lib/state/app.svelte';
import './app.css';

// Grundfarbe und Standbild für den ersten Paint setzt schon public/boot.js

const target = document.getElementById('app');
if (!target) throw new Error('#app fehlt');

const app = createAppState();
await app.init();
mount(App, { target, props: { app } });
