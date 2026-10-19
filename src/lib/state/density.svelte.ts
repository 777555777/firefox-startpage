import {
	loadDensitySetting,
	resolveDensity,
	saveDensitySetting,
	type Density,
	type DensitySetting
} from './density';

/** Gewählte und wirksame Dichte; „Automatisch“ folgt der Fensterhöhe */
class DensityState {
	setting = $state<DensitySetting>(loadDensitySetting());
	#height = $state(typeof innerHeight === 'number' ? innerHeight : 1000);

	constructor() {
		if (typeof window !== 'undefined') {
			window.addEventListener('resize', () => (this.#height = innerHeight));
		}
	}

	get value(): Density {
		return resolveDensity(this.setting, this.#height);
	}

	get compact(): boolean {
		return this.value === 'compact';
	}

	set(setting: DensitySetting) {
		this.setting = setting;
		saveDensitySetting(setting);
	}
}

export const density = new DensityState();
