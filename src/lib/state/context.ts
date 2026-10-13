import { createContext } from 'svelte';
import type { AppState } from './app.svelte';

/** Zugriff auf den App-Zustand aus Komponenten; gesetzt in `App.svelte` bzw. in Tests */
export const [getApp, setApp] = createContext<AppState>();
