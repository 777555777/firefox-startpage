/**
 * Sonnenauf- und -untergang nach dem NOAA-Algorithmus (Jean Meeus, „Astronomical Algorithms“),
 * rein lokal aus Datum und Koordinaten. Genauigkeit etwa eine Minute für Breiten bis ±72°.
 */

export type SunTimes =
	| { kind: 'normal'; sunrise: Date; sunset: Date }
	/** Die Sonne geht an diesem Tag nicht unter */
	| { kind: 'polarDay' }
	/** Die Sonne geht an diesem Tag nicht auf */
	| { kind: 'polarNight' };

const MS_PER_DAY = 86_400_000;
/** Höhe des Sonnenmittelpunkts bei Auf-/Untergang: Refraktion (34′) plus Sonnenradius (16′) */
const ZENITH = 90.833;

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Deklination (Grad) und Zeitgleichung (Minuten) zu einem Julianischen Datum */
function solarPosition(jd: number): { declination: number; equationOfTime: number } {
	const t = (jd - 2451545) / 36525;
	const meanLong = (((280.46646 + t * (36000.76983 + t * 0.0003032)) % 360) + 360) % 360;
	const meanAnomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t);
	const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
	const m = rad(meanAnomaly);
	const center =
		Math.sin(m) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
		Math.sin(2 * m) * (0.019993 - 0.000101 * t) +
		Math.sin(3 * m) * 0.000289;
	const omega = rad(125.04 - 1934.136 * t);
	const apparentLong = meanLong + center - 0.00569 - 0.00478 * Math.sin(omega);
	const meanObliquity =
		23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
	const obliquity = rad(meanObliquity + 0.00256 * Math.cos(omega));

	const declination = deg(Math.asin(Math.sin(obliquity) * Math.sin(rad(apparentLong))));

	const y = Math.tan(obliquity / 2) ** 2;
	const l0 = rad(meanLong);
	const equationOfTime =
		4 *
		deg(
			y * Math.sin(2 * l0) -
				2 * eccentricity * Math.sin(m) +
				4 * eccentricity * y * Math.sin(m) * Math.cos(2 * l0) -
				0.5 * y * y * Math.sin(4 * l0) -
				1.25 * eccentricity * eccentricity * Math.sin(2 * m)
		);

	return { declination, equationOfTime };
}

/** Cosinus des Stundenwinkels bei Auf-/Untergang; außerhalb von [-1, 1] gibt es keinen */
function cosHourAngle(latitude: number, declination: number): number {
	const phi = rad(latitude);
	const delta = rad(declination);
	return (
		Math.cos(rad(ZENITH)) / (Math.cos(phi) * Math.cos(delta)) - Math.tan(phi) * Math.tan(delta)
	);
}

/**
 * Berechnet Auf- und Untergang für den Kalendertag von `date` (in lokaler Zeit gelesen) am Ort
 * `latitude`/`longitude` (Dezimalgrad, Nord und Ost positiv). Gemeint ist der Sonnentag des Orts
 * um dessen Mittag; die Ergebnisse sind absolute Zeitpunkte und werden in der Zeitzone des
 * Rechners angezeigt.
 */
export function sunTimes(date: Date, latitude: number, longitude: number): SunTimes {
	const midnightUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
	const jdMidnight = midnightUtc / MS_PER_DAY + 2440587.5;
	// Minuten nach Mitternacht UTC → Julianisches Datum
	const jdAt = (minutes: number) => jdMidnight + minutes / 1440;

	// Sonnenmittag des Orts, einmal verfeinert mit der Zeitgleichung zu diesem Zeitpunkt
	let noon = 720 - 4 * longitude;
	for (let i = 0; i < 2; i++) noon = 720 - 4 * longitude - solarPosition(jdAt(noon)).equationOfTime;

	const atNoon = cosHourAngle(latitude, solarPosition(jdAt(noon)).declination);
	if (atNoon > 1) return { kind: 'polarNight' };
	if (atNoon < -1) return { kind: 'polarDay' };

	/** Zeitpunkt (Minuten UTC) für Aufgang (-1) bzw. Untergang (+1), iterativ verfeinert */
	const event = (sign: -1 | 1): number => {
		let minutes = noon + sign * 4 * deg(Math.acos(atNoon));
		for (let i = 0; i < 2; i++) {
			const { declination, equationOfTime } = solarPosition(jdAt(minutes));
			// Am Rand der Polarzeit kann die Verfeinerung knapp über ±1 laufen
			const cos = Math.min(1, Math.max(-1, cosHourAngle(latitude, declination)));
			minutes = 720 - 4 * longitude - equationOfTime + sign * 4 * deg(Math.acos(cos));
		}
		return minutes;
	};

	return {
		kind: 'normal',
		sunrise: new Date(midnightUtc + event(-1) * 60_000),
		sunset: new Date(midnightUtc + event(1) * 60_000)
	};
}

/**
 * Liest eine Koordinate in Dezimalgrad, Komma oder Punkt als Trenner, auch mit typografischem
 * Minus. Leere Eingabe ergibt
 * `null`, ungültige oder außerhalb von ±`max` liegende Werte `undefined`.
 */
export function parseCoordinate(value: string, max: number): number | null | undefined {
	const text = value.trim().replace(',', '.').replace('\u2212', '-');
	if (!text) return null;
	if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(text)) return undefined;
	const number = Number(text);
	return Math.abs(number) <= max ? number : undefined;
}
