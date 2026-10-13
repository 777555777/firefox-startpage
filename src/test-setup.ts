import '@testing-library/jest-dom/vitest';

// jsdom kennt einige Browser-APIs nicht, die Komponenten nutzen
class ResizeObserverStub {
	observe() {}
	unobserve() {}
	disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

if (!HTMLDialogElement.prototype.showModal) {
	HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
		this.setAttribute('open', '');
	};
	HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
		this.removeAttribute('open');
		this.dispatchEvent(new Event('close'));
	};
}

if (!HTMLElement.prototype.showPopover) {
	HTMLElement.prototype.showPopover = function (this: HTMLElement) {
		this.dataset.popoverOpen = '';
	};
	HTMLElement.prototype.hidePopover = function (this: HTMLElement) {
		delete this.dataset.popoverOpen;
	};
}

globalThis.CSS ??= { escape: (value: string) => value } as typeof CSS;

// Svelte-Transitions nutzen die Web Animations API
if (!Element.prototype.animate) {
	Element.prototype.animate = function () {
		const animation = {
			onfinish: null as (() => void) | null,
			cancel() {},
			finish() {},
			play() {},
			pause() {},
			reverse() {},
			currentTime: 0,
			playState: 'finished',
			effect: null
		};
		queueMicrotask(() => animation.onfinish?.());
		return animation as unknown as Animation;
	};
	Element.prototype.getAnimations = () => [];
}
