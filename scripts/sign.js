// Signiert die Extension „unlisted“ bei AMO. Die API-Keys kommen aus Umgebungsvariablen
// bzw. aus `.env.local` (nie committen).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

for (const name of ['WEB_EXT_API_KEY', 'WEB_EXT_API_SECRET']) {
	if (!process.env[name]) {
		console.error(`${name} fehlt (in .env.local oder als Umgebungsvariable setzen).`);
		process.exit(1);
	}
}

const result = spawnSync('web-ext', ['sign', '--channel=unlisted'], {
	stdio: 'inherit',
	shell: process.platform === 'win32'
});
process.exit(result.status ?? 1);
