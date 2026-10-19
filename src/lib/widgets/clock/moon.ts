/**
 * Mondphase sowie Mondauf- und -untergang, rein lokal aus Datum und Koordinaten. Die Position
 * folgt den größten Gliedern der Mondtheorie nach Jean Meeus („Astronomical Algorithms“, Kap. 47,
 * auf etwa 0,1–0,3° genau). Das reicht für Phasenzeitpunkte auf etwa eine halbe Stunde und Auf-
 * und Untergang auf wenige Minuten.
 */

const MS_PER_DAY = 86_400_000;
/** Julianisches Datum der Epoche J2000.0 */
const J2000 = 2451545;
/** Schiefe der Ekliptik (J2000), genügt für diese Genauigkeit */
const OBLIQUITY = 23.4397;
/** Mittlere Zunahme der Elongation Mond–Sonne in Grad pro Tag (synodischer Monat) */
const ELONGATION_PER_DAY = 360 / 29.530589;

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const sin = (d: number) => Math.sin(rad(d));
const cos = (d: number) => Math.cos(rad(d));
/** Winkel auf [0, 360) */
const norm = (d: number) => ((d % 360) + 360) % 360;

/** Tage seit J2000.0 */
const daysSinceJ2000 = (date: Date) => date.getTime() / MS_PER_DAY + 2440587.5 - J2000;

/** Geozentrische ekliptikale Länge der Sonne in Grad */
function sunLongitude(d: number): number {
	const m = 357.5291 + 0.98560028 * d;
	const center = 1.9148 * sin(m) + 0.02 * sin(2 * m) + 0.0003 * sin(3 * m);
	// Mittlere Länge auf das Äquinoktium des Datums bezogen, wie die Mondelemente. Ein festes
	// Perihel (M + 282,94°) ließe die Präzession weg: 2025 schon 0,4° bzw. 45 Minuten Phasenfehler.
	return norm(280.46646 + 0.98564736 * d + center);
}

type MoonPosition = {
	/** Ekliptikale Länge und Breite in Grad */
	longitude: number;
	latitude: number;
	/** Entfernung Erde–Mond in km */
	distance: number;
};

function moonPosition(d: number): MoonPosition {
	// Mittlere Elemente
	const l = 218.3165 + 13.17639648 * d; // mittlere Länge
	const mm = 134.9634 + 13.06499295 * d; // mittlere Anomalie des Monds
	const ms = 357.5291 + 0.98560028 * d; // mittlere Anomalie der Sonne
	const dd = 297.8502 + 12.19074912 * d; // mittlere Elongation
	const f = 93.2721 + 13.22935024 * d; // Argument der Breite

	const longitude =
		l +
		6.289 * sin(mm) +
		1.274 * sin(2 * dd - mm) + // Evektion
		0.658 * sin(2 * dd) + // Variation
		0.214 * sin(2 * mm) -
		0.186 * sin(ms) - // jährliche Gleichung
		0.114 * sin(2 * f) +
		0.059 * sin(2 * dd - 2 * mm) +
		0.057 * sin(2 * dd - ms - mm) +
		0.053 * sin(2 * dd + mm) +
		0.046 * sin(2 * dd - ms) -
		0.041 * sin(ms - mm) -
		0.035 * sin(dd) -
		0.031 * sin(ms + mm);

	const latitude =
		5.128 * sin(f) + 0.281 * sin(mm + f) + 0.278 * sin(mm - f) + 0.173 * sin(2 * dd - f);

	const distance = 385001 - 20905 * cos(mm) - 3699 * cos(2 * dd - mm) - 2956 * cos(2 * dd);

	return { longitude: norm(longitude), latitude, distance };
}

/** Elongation Mond–Sonne entlang der Ekliptik, 0..360 (0 = Neumond, 180 = Vollmond) */
function elongation(d: number): number {
	return norm(moonPosition(d).longitude - sunLongitude(d));
}

// --- Phase ------------------------------------------------------------------------------------

export type MoonPhaseName =
	| 'new'
	| 'waxingCrescent'
	| 'firstQuarter'
	| 'waxingGibbous'
	| 'full'
	| 'waningGibbous'
	| 'lastQuarter'
	| 'waningCrescent';

export type MoonPhase = {
	/** Phase 0..1: 0 Neumond, 0,25 erstes Viertel, 0,5 Vollmond, 0,75 letztes Viertel */
	phase: number;
	/** Beleuchteter Anteil der sichtbaren Scheibe, 0..1 */
	illumination: number;
	waxing: boolean;
	name: MoonPhaseName;
};

/**
 * Die Hauptphasen gelten für ±12° Elongation um ihren Zeitpunkt, also etwa einen Tag davor und
 * danach. Dazwischen liegen Sichel und Dreiviertelmond.
 */
const PRINCIPAL_WINDOW = 12;

export function moonPhase(date: Date): MoonPhase {
	const d = daysSinceJ2000(date);
	const moon = moonPosition(d);
	const sunLong = sunLongitude(d);
	const e = norm(moon.longitude - sunLong);
	// Tatsächlicher Winkel Sonne–Erde–Mond (mit Breite) und daraus der Phasenwinkel am Mond
	const psi = Math.acos(cos(moon.latitude) * cos(moon.longitude - sunLong));
	const sunDistance = 149_598_000;
	const phaseAngle = Math.atan2(
		sunDistance * Math.sin(psi),
		moon.distance - sunDistance * Math.cos(psi)
	);
	const illumination = (1 + Math.cos(phaseAngle)) / 2;

	const near = (target: number) => Math.abs(((e - target + 540) % 360) - 180) <= PRINCIPAL_WINDOW;
	const name: MoonPhaseName = near(0)
		? 'new'
		: near(90)
			? 'firstQuarter'
			: near(180)
				? 'full'
				: near(270)
					? 'lastQuarter'
					: e < 90
						? 'waxingCrescent'
						: e < 180
							? 'waxingGibbous'
							: e < 270
								? 'waningGibbous'
								: 'waningCrescent';

	return { phase: e / 360, illumination, waxing: e < 180, name };
}

/** Nächster Zeitpunkt nach `date`, an dem die Elongation `target` erreicht (0 = Neu, 180 = Voll) */
export function nextPhase(date: Date, target: 0 | 90 | 180 | 270): Date {
	let d = daysSinceJ2000(date);
	// Grob über die mittlere Geschwindigkeit, dann per Newton auf die wahre Elongation
	d += norm(target - elongation(d)) / ELONGATION_PER_DAY;
	for (let i = 0; i < 6; i++) {
		const diff = ((target - elongation(d) + 540) % 360) - 180;
		d += diff / ELONGATION_PER_DAY;
	}
	return new Date((d + J2000 - 2440587.5) * MS_PER_DAY);
}

/** Nächster Voll- oder Neumond, je nachdem, was zuerst kommt */
export function nextMajorPhase(date: Date): { kind: 'full' | 'new'; at: Date } {
	const full = nextPhase(date, 180);
	const fresh = nextPhase(date, 0);
	return full.getTime() < fresh.getTime() ? { kind: 'full', at: full } : { kind: 'new', at: fresh };
}

/**
 * Umriss des beleuchteten Teils als SVG-Pfad um den Ursprung, Radius `r`. Zunehmend ist (von der
 * Nordhalbkugel aus) die rechte Seite hell, abnehmend die linke; die Schattengrenze ist eine
 * Halbellipse mit der Breite `r·|cos(2π·phase)|`. Für die Südhalbkugel wird gespiegelt.
 */
export function litPath(phase: number, r: number): string {
	const a = Math.cos(2 * Math.PI * phase);
	const rx = Math.round(r * Math.abs(a) * 1000) / 1000;
	const waxing = phase < 0.5;
	// Außenrand: oben → unten über die helle Seite
	const outer = waxing ? 1 : 0;
	// Schattengrenze: unten → oben, bei Sichel zur hellen Seite gewölbt, sonst zur dunklen
	const crescent = a > 0;
	const terminator = waxing === crescent ? 0 : 1;
	return `M0 ${-r}A${r} ${r} 0 0 ${outer} 0 ${r}A${rx} ${r} 0 0 ${terminator} 0 ${-r}Z`;
}

// --- Auf- und Untergang -----------------------------------------------------------------------

/** Höhe des Mondmittelpunkts in Grad über dem Horizont (geozentrisch, ohne Refraktion) */
function moonAltitude(date: Date, latitude: number, longitude: number) {
	const d = daysSinceJ2000(date);
	const moon = moonPosition(d);
	const lambda = moon.longitude;
	const beta = moon.latitude;
	const ra = deg(
		Math.atan2(sin(lambda) * cos(OBLIQUITY) - Math.tan(rad(beta)) * sin(OBLIQUITY), cos(lambda))
	);
	const dec = deg(Math.asin(sin(beta) * cos(OBLIQUITY) + cos(beta) * sin(OBLIQUITY) * sin(lambda)));
	// Mittlere Sternzeit von Greenwich plus Länge
	const siderealTime = 280.16 + 360.9856235 * d + longitude;
	const hourAngle = siderealTime - ra;
	const altitude = deg(
		Math.asin(sin(latitude) * sin(dec) + cos(latitude) * cos(dec) * cos(hourAngle))
	);
	// Auf-/Untergang des oberen Rands mit Refraktion und Parallaxe (Meeus 15.1): h0 = 0,7275·π − 34′
	const parallax = deg(Math.asin(6378.14 / moon.distance));
	return altitude - (0.7275 * parallax - 34 / 60);
}

export type MoonTimes = {
	/** null, wenn der Mond an diesem Tag nicht aufgeht bzw. nicht untergeht */
	rise: Date | null;
	set: Date | null;
	/** Ganztägig über bzw. unter dem Horizont (nur ohne Auf- und Untergang möglich) */
	alwaysUp: boolean;
	alwaysDown: boolean;
};

/** Abtastschritt; der Mond kann den Horizont pro Tag höchstens je einmal auf- und abwärts kreuzen */
const STEP_MS = 20 * 60_000;

/**
 * Mondauf- und -untergang am lokalen Kalendertag von `date` (Mitternacht bis Mitternacht in der
 * Zeitzone des Rechners, also auch an Tagen mit Zeitumstellung). Weil der Mond täglich rund 50
 * Minuten später aufgeht, fällt etwa einmal im Monat ein Aufgang bzw. Untergang aus.
 */
export function moonTimes(date: Date, latitude: number, longitude: number): MoonTimes {
	const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
	const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
	const height = (t: number) => moonAltitude(new Date(t), latitude, longitude);

	let rise: Date | null = null;
	let set: Date | null = null;
	let previous = height(start);
	const first = previous;
	for (let t0 = start; t0 < end; t0 += STEP_MS) {
		const t1 = Math.min(t0 + STEP_MS, end);
		const current = height(t1);
		if (previous < 0 !== current < 0) {
			// Kreuzung auf eine halbe Minute genau eingrenzen
			let [lo, hi] = [t0, t1];
			const rising = previous < 0;
			while (hi - lo > 30_000) {
				const mid = (lo + hi) / 2;
				if (height(mid) < 0 === rising) lo = mid;
				else hi = mid;
			}
			const at = new Date(Math.round((lo + hi) / 2 / 60_000) * 60_000);
			if (rising) rise ??= at;
			else set ??= at;
		}
		previous = current;
	}

	const noCrossing = !rise && !set;
	return {
		rise,
		set,
		alwaysUp: noCrossing && first >= 0,
		alwaysDown: noCrossing && first < 0
	};
}

export type MoonEvent = {
	at: Date;
	/** Kalendertag relativ zu `date`: −1 gestern, 0 heute, 1 morgen */
	day: -1 | 0 | 1;
};

export type MoonEvents = {
	rise: MoonEvent | null;
	set: MoonEvent | null;
	alwaysUp: boolean;
	alwaysDown: boolean;
};

/**
 * Auf- und Untergang zur Anzeige: Fällt am Tag von `date` der Untergang aus, gilt der vom
 * nächsten Tag (der Mond ist bis nach Mitternacht zu sehen); fällt der Aufgang aus, der vom
 * Vortag. So bleibt immer die Zeitspanne sichtbar, in der der Mond heute am Himmel steht.
 * Nur ohne Ereignis an beiden Tagen (hohe Breiten) bleibt der Wert `null`.
 */
export function moonEvents(date: Date, latitude: number, longitude: number): MoonEvents {
	const today = moonTimes(date, latitude, longitude);
	if (today.alwaysUp || today.alwaysDown) return { ...today, rise: null, set: null };

	const neighbour = (offset: -1 | 1) =>
		moonTimes(
			new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset, 12),
			latitude,
			longitude
		);
	const event = (at: Date | null, day: -1 | 0 | 1): MoonEvent | null => (at ? { at, day } : null);

	return {
		rise: event(today.rise, 0) ?? event(neighbour(-1).rise, -1),
		set: event(today.set, 0) ?? event(neighbour(1).set, 1),
		alwaysUp: false,
		alwaysDown: false
	};
}
