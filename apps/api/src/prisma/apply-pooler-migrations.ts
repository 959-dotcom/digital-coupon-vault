import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveDatabaseUrl } from './database-url.js';

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const databaseUrl = await resolveDatabaseUrl(raw);
const child = spawn('npm', ['exec', '--', 'prisma', 'migrate', 'deploy'], {
  cwd: fileURLToPath(new URL('../..', import.meta.url)),
  env: { ...process.env, DATABASE_URL: databaseUrl },
  stdio: ['ignore', 'pipe', 'pipe'],
});

function redact(chunk: Buffer): string {
  return chunk.toString('utf8').replace(/postgres(?:ql)?:\/\/\S+/gi, 'postgresql://[redacted]');
}

child.stdout.on('data', (chunk: Buffer) => process.stdout.write(redact(chunk)));
child.stderr.on('data', (chunk: Buffer) => process.stderr.write(redact(chunk)));

const code = await new Promise<number>((resolve, reject) => {
  child.on('error', reject);
  child.on('close', (status) => resolve(status ?? 1));
});
process.exit(code);
