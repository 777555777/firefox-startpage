/** Kleine, eigene Icon-Sammlung (24×24, Kontur). Alles als Pfad-Daten, keine Library. */

const circle = (cx: number, cy: number, r: number) =>
	`M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

const rect = (x: number, y: number, w: number, h: number, r = 0) =>
	r === 0
		? `M${x} ${y}h${w}v${h}h${-w}Z`
		: `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`;

export const ICONS = {
	grip: [9, 15].flatMap((x) => [6, 12, 18].map((y) => circle(x, y, 1))),
	sliders: ['M4 7h9M17 7h3M4 17h3M11 17h9', circle(15, 7, 2), circle(9, 17, 2)],
	close: ['M18 6 6 18M6 6l12 12'],
	plus: ['M12 5v14M5 12h14'],
	trash: ['M4 7h16M9 7V4.5h6V7M18.5 7l-.8 12.2a2 2 0 0 1-2 1.8H8.3a2 2 0 0 1-2-1.8L5.5 7'],
	pencil: ['M13.5 6.5l4 4M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5Z'],
	check: ['M20 6 9 17l-5-5'],
	chevronLeft: ['m15 18-6-6 6-6'],
	chevronRight: ['m9 18 6-6-6-6'],
	chevronDown: ['m6 9 6 6 6-6'],
	search: [circle(11, 11, 7), 'm20 20-4-4'],
	external: ['M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'],
	copy: [rect(8, 8, 13, 13, 2), 'M4 16V6a2 2 0 0 1 2-2h10'],
	clock: [circle(12, 12, 9), 'M12 7v5l3 2'],
	calendar: [rect(3, 5, 18, 16, 2), 'M16 3v4M8 3v4M3 10h18'],
	link: [
		'M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5',
		'M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5'
	],
	upload: ['M12 15V3m-5 5 5-5 5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2'],
	download: ['M12 3v12m-5-5 5 5 5-5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2'],
	sideLeft: [rect(3, 4, 18, 16, 2), 'M9 4v16', 'M5.5 8.5h1.5M5.5 12h1.5'],
	sideRight: [rect(3, 4, 18, 16, 2), 'M15 4v16', 'M17 8.5h1.5M17 12h1.5'],
	image: [rect(3, 4, 18, 16, 2), circle(9, 10, 1.75), 'm21 16-5-5-9 9'],
	video: [rect(3, 5, 18, 14, 2), 'm10 9 5 3-5 3Z'],
	warning: ['M12 4 2.5 20h19Z', 'M12 10v4M12 17h.01'],
	gap: ['M4 4v16M20 4v16', 'm8 12h8M10 10l-2 2 2 2M14 10l2 2-2 2'],
	gapVertical: ['M4 4h16M4 20h16', 'm12 8v8M10 10l2-2 2 2M10 14l2 2 2-2'],
	maxWidth: ['M3 12h18', 'm6 9-3 3 3 3M18 9l3 3-3 3', 'M9 7h6M9 17h6'],
	tiles: [
		rect(4, 4, 7, 7, 1.5),
		rect(13, 4, 7, 7, 1.5),
		rect(4, 13, 7, 7, 1.5),
		rect(13, 13, 7, 7, 1.5)
	],
	list: ['M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01'],
	capsules: [rect(4, 3, 6, 18, 3), rect(14, 3, 6, 18, 3)],
	history: ['M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2'],
	palette: [
		'M12 3a9 9 0 0 0 0 18c1.1 0 1.8-.9 1.8-1.9 0-.5-.2-.9-.5-1.3-.3-.3-.5-.8-.5-1.3 0-1 .9-1.9 2-1.9H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3Z',
		circle(7.5, 11, 1),
		circle(10, 7, 1),
		circle(15, 7, 1)
	],
	gauge: ['M12 14l4-4', 'M3.5 18a9 9 0 1 1 17 0'],
	database: [
		'M4 6c0 1.7 3.6 3 8 3s8-1.3 8-3-3.6-3-8-3-8 1.3-8 3Z',
		'M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3'
	],
	language: [
		'M4 5h8M8 3v2M10 5c-1 4-3.5 7-6 8M6 9c1 2 3 3.5 5 4.5',
		'M12 21l4.5-10L21 21M13.5 17.5h6'
	]
} satisfies Record<string, string[]>;

export type IconName = keyof typeof ICONS;
