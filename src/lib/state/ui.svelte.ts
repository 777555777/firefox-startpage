export type SettingsSection =
	'general' | 'appearance' | 'background' | 'performance' | 'search' | 'data';

/** Flüchtiger UI-Zustand, wird nicht gespeichert */
class UiState {
	editing = $state(false);
	settingsOpen = $state(false);
	settingsSection = $state<SettingsSection>('general');
	/** Anzahl offener modaler Dialoge; dahinter dimmt der Glas-Layer die Szene */
	modals = $state(0);

	openSettings(section: SettingsSection = this.settingsSection) {
		this.settingsSection = section;
		this.settingsOpen = true;
	}
}

export const ui = new UiState();
