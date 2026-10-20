/**
 * API-Probe für das GitLab-Widget (Meilenstein G0, siehe docs/plan-gitlab.md). Prüft, was eine
 * Instanz kann: Version, GraphQL-Felder, Komplexität, `user_counts`, Token-Info, ETag und die
 * Antworten bei falschem Token bzw. fehlendem Scope.
 *
 *   pnpm gitlab:probe [https://gitlab.firma.de]
 *
 * Das Token wird verdeckt abgefragt oder aus `GITLAB_TOKEN` gelesen (auch aus `.env.local`).
 * Optional prüft `GITLAB_TOKEN_READ_USER` (ein Token nur mit `read_user`) die Antwort bei
 * fehlendem Scope. Die Ausgabe enthält nie ein Token und keine Inhalte aus GitLab (Titel,
 * Projekte, Namen), nur Statuscodes, Header, Feldnamen und Anzahlen. Sie kann also so
 * weitergegeben werden.
 */

import { createInterface } from 'node:readline/promises';

const DEFAULT_URL = 'https://gitlab.com';
const TIMEOUT_MS = 20_000;
/** Erkennbar falsches Token für die 401-Prüfung */
const INVALID_TOKEN = 'glpat-startpage-probe-invalid-000';

const secrets: string[] = [];

/** Entfernt alle Tokens aus einem Text, bevor er ausgegeben wird */
function scrub(text: string): string {
	let result = text;
	for (const secret of secrets) result = result.split(secret).join('[Token]');
	return result;
}

function log(text = '') {
	console.log(scrub(text));
}

function heading(text: string) {
	log();
	log(`## ${text}`);
}

function line(label: string, value: unknown) {
	log(`- ${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
}

// --- Eingaben ----------------------------------------------------------------------------------

/** Liest eine Zeile ohne Echo (für das Token) */
async function readHidden(prompt: string): Promise<string> {
	const { stdin, stdout } = process;
	if (!stdin.isTTY) {
		const rl = createInterface({ input: stdin });
		for await (const value of rl) {
			rl.close();
			return value.trim();
		}
		return '';
	}
	stdout.write(prompt);
	stdin.setRawMode(true);
	stdin.resume();
	stdin.setEncoding('utf8');
	return new Promise((resolve) => {
		let value = '';
		const onData = (chunk: string) => {
			for (const char of chunk) {
				if (char === '\r' || char === '\n') {
					stdin.setRawMode(false);
					stdin.pause();
					stdin.off('data', onData);
					stdout.write('\n');
					resolve(value.trim());
					return;
				}
				if (char === '\u0003') {
					stdout.write('\n');
					process.exit(130);
				}
				if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
				else value += char;
			}
		};
		stdin.on('data', onData);
	});
}

async function ask(prompt: string): Promise<string> {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	const answer = await rl.question(prompt);
	rl.close();
	return answer.trim();
}

/** Wie im Widget geplant: Schema ergänzen, http heben, bekannte Endungen abschneiden */
function normalizeBase(input: string): string | null {
	let raw = input.trim();
	if (!raw) return null;
	if (!/^[a-z]+:\/\//i.test(raw)) raw = `https://${raw}`;
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return null;
	}
	// http nur für lokale Tests; im Widget wird es auf https gehoben
	const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
	if (url.protocol === 'http:' && !local) url.protocol = 'https:';
	if (url.protocol !== 'https:' && !local) return null;
	let path = url.pathname;
	for (const marker of ['/api/v4', '/api/graphql', '/-/', '/dashboard', '/users/sign_in']) {
		const index = path.indexOf(marker);
		if (index !== -1) path = path.slice(0, index);
	}
	return `${url.origin}${path.replace(/\/+$/, '')}`;
}

// --- Anfragen ----------------------------------------------------------------------------------

type Probe = {
	status: number | null;
	error: string | null;
	ms: number;
	headers: Headers | null;
	json: unknown;
};

async function request(
	url: string,
	init: RequestInit & { token?: string; header?: 'bearer' | 'private' } = {}
): Promise<Probe> {
	const { token, header = 'bearer', ...rest } = init;
	const headers = new Headers(rest.headers);
	headers.set('Accept', 'application/json');
	if (token) {
		if (header === 'bearer') headers.set('Authorization', `Bearer ${token}`);
		else headers.set('PRIVATE-TOKEN', token);
	}
	const started = performance.now();
	try {
		const response = await fetch(url, {
			...rest,
			headers,
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		const text = await response.text();
		let json: unknown = null;
		try {
			json = JSON.parse(text);
		} catch {
			// kein JSON, z. B. eine Anmeldeseite
		}
		return {
			status: response.status,
			error: null,
			ms: Math.round(performance.now() - started),
			headers: response.headers,
			json
		};
	} catch (error) {
		const cause = error instanceof Error ? (error.cause ?? error) : error;
		const code =
			cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : String(cause);
		return {
			status: null,
			error: code,
			ms: Math.round(performance.now() - started),
			headers: null,
			json: null
		};
	}
}

function graphql(base: string, token: string, query: string, variables = {}, header?: 'private') {
	return request(`${base}/api/graphql`, {
		method: 'POST',
		token,
		header,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ query, variables })
	});
}

function summary(probe: Probe): string {
	if (probe.status === null) return `Netzwerkfehler (${probe.error}) nach ${probe.ms} ms`;
	return `HTTP ${probe.status} in ${probe.ms} ms`;
}

const INTERESTING_HEADERS = [
	'content-type',
	'etag',
	'cache-control',
	'vary',
	'location',
	'retry-after',
	'ratelimit-limit',
	'ratelimit-remaining',
	'ratelimit-reset',
	'ratelimit-name',
	'www-authenticate'
];

function headerLine(probe: Probe) {
	if (!probe.headers) return;
	const found = INTERESTING_HEADERS.flatMap((name) => {
		const value = probe.headers!.get(name);
		return value === null ? [] : [`${name}=${value}`];
	});
	line('Header', found.length > 0 ? found.join(' | ') : '(keine der gesuchten)');
}

function record(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

/** Fehlermeldungen von GraphQL, gekürzt; sie nennen Feldnamen, keine Inhalte */
function graphqlErrors(probe: Probe): string[] {
	const errors = record(probe.json).errors;
	if (!Array.isArray(errors)) return [];
	return errors.map((error) => String(record(error).message ?? '').slice(0, 200));
}

function count(values: unknown[]): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const value of values) {
		const key = value === null || value === undefined ? '(keiner)' : String(value);
		counts[key] = (counts[key] ?? 0) + 1;
	}
	return counts;
}

// --- GraphQL-Abfragen ----------------------------------------------------------------------------

const MR_FULL = `fragment Mr on MergeRequest {
	id iid title webUrl draft conflicts detailedMergeStatus updatedAt
	reference(full: true)
	project { fullPath }
	author { username name }
	headPipeline { status }
}`;

const MR_LEAN = `fragment Mr on MergeRequest {
	id iid title webUrl draft conflicts updatedAt
	reference(full: true)
	project { fullPath }
	author { username name }
	headPipeline { status }
}`;

function mrQuery(fragment: string, reviewerFields: string, extra = '') {
	return `${fragment}
query Probe($first: Int!) {
	${extra}
	currentUser {
		username
		reviewRequestedMergeRequests(state: opened, first: $first) {
			pageInfo { hasNextPage }
			nodes { ...Mr reviewers { nodes { username ${reviewerFields} } } }
		}
		authoredMergeRequests(state: opened, first: $first) {
			pageInfo { hasNextPage }
			nodes { ...Mr }
		}
	}
}`;
}

const FULL_QUERY = mrQuery(MR_FULL, 'mergeRequestInteraction { reviewState }');
const LEAN_QUERY = mrQuery(MR_LEAN, '');
const COMPLEXITY_QUERY = mrQuery(
	MR_FULL,
	'mergeRequestInteraction { reviewState }',
	'queryComplexity { score limit }'
);

const INTROSPECTION = `{
	mr: __type(name: "MergeRequest") { fields { name } }
	reviewer: __type(name: "MergeRequestReviewer") { fields { name } }
	interaction: __type(name: "UserMergeRequestInteraction") { fields { name } }
	currentUser: __type(name: "CurrentUser") { fields { name } }
	userCore: __type(name: "UserCore") { fields { name } }
	todos: __type(name: "TodoConnection") { fields { name } }
	query: __type(name: "Query") { fields { name } }
}`;

const WANTED: Record<string, string[]> = {
	mr: [
		'headPipeline',
		'draft',
		'conflicts',
		'detailedMergeStatus',
		'reference',
		'webUrl',
		'updatedAt',
		'reviewers'
	],
	reviewer: ['mergeRequestInteraction'],
	interaction: ['reviewState', 'approved'],
	currentUser: ['reviewRequestedMergeRequests', 'authoredMergeRequests', 'todos'],
	userCore: ['reviewRequestedMergeRequests', 'authoredMergeRequests', 'todos'],
	todos: ['count'],
	query: ['currentUser', 'queryComplexity']
};

/** Kennzahlen einer MR-Abfrage, ohne Inhalte */
function describeMrs(probe: Probe, me: string | null) {
	const user = record(record(record(probe.json).data).currentUser);
	for (const [key, label] of [
		['reviewRequestedMergeRequests', 'Reviews'],
		['authoredMergeRequests', 'Meine MRs']
	] as const) {
		const connection = record(user[key]);
		const nodes = Array.isArray(connection.nodes) ? connection.nodes.map(record) : [];
		const more = record(connection.pageInfo).hasNextPage;
		log(`  ${label}: ${nodes.length} MRs, weitere Seiten: ${String(more)}`);
		log(`    Pipeline: ${JSON.stringify(count(nodes.map((n) => record(n.headPipeline).status)))}`);
		log(
			`    detailedMergeStatus: ${JSON.stringify(count(nodes.map((n) => n.detailedMergeStatus)))}`
		);
		log(
			`    draft: ${nodes.filter((n) => n.draft).length}, conflicts: ${nodes.filter((n) => n.conflicts).length}`
		);
		const titlePrefix = nodes.filter((n) => /^(draft|wip)\s*:/i.test(String(n.title ?? ''))).length;
		log(`    Titel mit „Draft:“-Präfix: ${titlePrefix}`);
		if (key === 'reviewRequestedMergeRequests') {
			const states = nodes.map((n) => {
				const reviewers = record(n.reviewers).nodes;
				const mine = Array.isArray(reviewers)
					? reviewers.map(record).find((r) => r.username === me)
					: undefined;
				return mine ? record(mine.mergeRequestInteraction).reviewState : '(nicht gefunden)';
			});
			log(`    eigener reviewState: ${JSON.stringify(count(states))}`);
		}
	}
}

// --- Ablauf ------------------------------------------------------------------------------------

async function main() {
	const input =
		process.argv[2] ?? process.env.GITLAB_URL ?? (await ask(`GitLab-Adresse [${DEFAULT_URL}]: `));
	const base = normalizeBase(input || DEFAULT_URL);
	if (!base) {
		console.error('Ungültige Adresse. Erwartet wird z. B. https://gitlab.firma.de');
		process.exit(1);
	}
	const token =
		process.env.GITLAB_TOKEN?.trim() ||
		(await readHidden('Personal Access Token (Scope read_api, Eingabe bleibt unsichtbar): '));
	if (!token) {
		console.error('Kein Token angegeben.');
		process.exit(1);
	}
	secrets.push(token);
	const readUserToken = process.env.GITLAB_TOKEN_READ_USER?.trim() || null;
	if (readUserToken) secrets.push(readUserToken);

	log('# GitLab-Probe für das Startseiten-Widget');
	line('Instanz', base);
	line('Zeit', new Date().toISOString());
	line('Node', process.version);

	heading('1. Erreichbarkeit und Version');
	const redirect = await request(`${base}/api/v4/version`, { token, redirect: 'manual' });
	line('GET /api/v4/version (Umleitungen nicht folgen)', summary(redirect));
	headerLine(redirect);
	const version = record(redirect.json);
	line('Version', version.version ?? '(unbekannt)');
	line('Enterprise', version.enterprise ?? '(unbekannt)');
	if (redirect.status === null) {
		log();
		log('Instanz nicht erreichbar. VPN verbunden? Zertifikat gültig? Abbruch.');
		return;
	}

	heading('2. user_counts (To-dos)');
	const counts = await request(`${base}/api/v4/user_counts`, { token });
	line('GET /api/v4/user_counts', summary(counts));
	headerLine(counts);
	line('Felder', Object.keys(record(counts.json)));
	line('todos ist eine Zahl', typeof record(counts.json).todos === 'number');
	const etag = counts.headers?.get('etag');
	if (etag) {
		const again = await request(`${base}/api/v4/user_counts`, {
			token,
			headers: { 'If-None-Match': etag }
		});
		line('Erneut mit If-None-Match', summary(again));
	} else {
		line('ETag', 'keins, bedingte Anfrage nicht möglich');
	}
	const privateHeader = await request(`${base}/api/v4/user_counts`, { token, header: 'private' });
	line('Gleiche Anfrage mit PRIVATE-TOKEN statt Bearer', summary(privateHeader));

	heading('3. Token-Info (personal_access_tokens/self)');
	const self = await request(`${base}/api/v4/personal_access_tokens/self`, { token });
	line('GET /api/v4/personal_access_tokens/self', summary(self));
	const info = record(self.json);
	if (self.status === 200) {
		line('Scopes', info.scopes);
		line('active', info.active);
		line('revoked', info.revoked);
		line('expires_at vorhanden', info.expires_at !== undefined);
		if (typeof info.expires_at === 'string') {
			const days = Math.round((Date.parse(info.expires_at) - Date.now()) / 86_400_000);
			line('Läuft ab in Tagen', days);
		}
	} else {
		line('Antwort', record(self.json).message ?? record(self.json).error ?? '(kein JSON)');
	}

	heading('4. GraphQL: Anmeldung und Felder');
	const who = await graphql(base, token, '{ currentUser { username } }');
	line('POST /api/graphql mit Bearer', summary(who));
	headerLine(who);
	const me = record(record(record(who.json).data).currentUser).username;
	line('currentUser vorhanden', typeof me === 'string');
	const whoPrivate = await graphql(base, token, '{ currentUser { username } }', {}, 'private');
	line('Mit PRIVATE-TOKEN', summary(whoPrivate));
	line(
		'currentUser mit PRIVATE-TOKEN',
		typeof record(record(record(whoPrivate.json).data).currentUser).username === 'string'
	);

	const introspection = await graphql(base, token, INTROSPECTION);
	line('Introspection', summary(introspection));
	const types = record(record(introspection.json).data);
	for (const [type, fields] of Object.entries(WANTED)) {
		const available = record(types[type]).fields;
		if (!Array.isArray(available)) {
			line(`Typ ${type}`, 'nicht vorhanden');
			continue;
		}
		const names = new Set(available.map((field) => record(field).name));
		const result = fields.map((field) => `${field} ${names.has(field) ? '✓' : '✗'}`);
		line(`Typ ${type}`, result.join(', '));
	}
	for (const error of graphqlErrors(introspection)) line('Fehler', error);

	heading('5. GraphQL: MR-Abfragen');
	for (const [label, query, first] of [
		['voll, first: 50', FULL_QUERY, 50],
		['voll, first: 30', FULL_QUERY, 30],
		['schlank, first: 50', LEAN_QUERY, 50]
	] as const) {
		const result = await graphql(base, token, query, { first });
		const errors = graphqlErrors(result);
		log(
			`- ${label}: ${summary(result)}, ${errors.length === 0 ? 'ohne Fehler' : `${errors.length} Fehler`}`
		);
		for (const error of errors) log(`  Fehler: ${error}`);
		if (errors.length === 0 && result.status === 200)
			describeMrs(result, typeof me === 'string' ? me : null);
	}
	const complexity = await graphql(base, token, COMPLEXITY_QUERY, { first: 50 });
	const measured = record(record(record(complexity.json).data).queryComplexity);
	line(
		'Komplexität (voll, first: 50)',
		Object.keys(measured).length > 0 ? measured : graphqlErrors(complexity)
	);

	heading('6. Falsches Token');
	const wrongRest = await request(`${base}/api/v4/user_counts`, { token: INVALID_TOKEN });
	line('REST user_counts', summary(wrongRest));
	line('Antwort', record(wrongRest.json).message ?? record(wrongRest.json).error ?? '(kein JSON)');
	headerLine(wrongRest);
	const wrongGraphql = await graphql(base, INVALID_TOKEN, '{ currentUser { username } }');
	line('GraphQL currentUser', summary(wrongGraphql));
	line('currentUser', record(record(wrongGraphql.json).data).currentUser ?? null);
	line('Fehler', graphqlErrors(wrongGraphql));

	heading('7. Token ohne read_api');
	if (readUserToken) {
		const rest = await request(`${base}/api/v4/user_counts`, { token: readUserToken });
		line('REST user_counts', summary(rest));
		line('Antwort', record(rest.json).error ?? record(rest.json).message ?? '(kein JSON)');
		line('scope', record(rest.json).scope ?? '(nicht angegeben)');
		headerLine(rest);
		const gql = await graphql(base, readUserToken, '{ currentUser { username } }');
		line('GraphQL currentUser', summary(gql));
		line('Fehler', graphqlErrors(gql));
	} else {
		log('- übersprungen (GITLAB_TOKEN_READ_USER nicht gesetzt)');
	}

	heading('8. Pfad zum Token-Anlegen (ohne Anmeldung)');
	for (const path of [
		'/-/user_settings/personal_access_tokens',
		'/-/profile/personal_access_tokens'
	]) {
		const result = await request(`${base}${path}?name=Startseite&scopes=read_api`, {
			redirect: 'manual'
		});
		const location = result.headers?.get('location') ?? '';
		line(path, `${summary(result)}${location ? ` → ${new URL(location, base).pathname}` : ''}`);
	}

	log();
	log('Fertig. Die Ausgabe enthält kein Token und keine Inhalte aus GitLab.');
}

await main();
