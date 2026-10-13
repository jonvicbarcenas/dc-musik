import { spawn } from 'node:child_process';
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { loadEnv, ConfigurationError } from '../src/config/env.js';

async function docker(args: string[], overrides: Record<string, string> = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, {
      windowsHide: true,
      env: { ...process.env, ...overrides },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const collect = (chunk: Buffer) => {
      output = (output + chunk.toString('utf8')).slice(-1_000_000);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Docker timed out. Check Docker Desktop and retry.'));
    }, 150_000);
    child.once('error', () => {
      clearTimeout(timer);
      reject(new Error('Docker could not start. Open Docker Desktop and retry.'));
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(output);
      else
        reject(
          new Error(
            'Docker could not start Lavalink. Check Docker Desktop and the service health, then retry.',
          ),
        );
    });
  });
}
/** Update only these keys; preserve every other setting and never print environment contents. */
async function save(values: Readonly<Record<string, string>>): Promise<void> {
  let file: string;
  try {
    file = await readFile('.env', 'utf8');
  } catch {
    throw new Error('Create .env from .env.example before configuring YouTube.');
  }
  const newline = file.includes('\r\n') ? '\r\n' : '\n';
  for (const [key, value] of Object.entries(values)) {
    if (
      ![
        'YOUTUBE_OAUTH_ENABLED',
        'YOUTUBE_OAUTH_SKIP_INITIALIZATION',
        'YOUTUBE_OAUTH_REFRESH_TOKEN',
      ].includes(key)
    )
      throw new Error('Unsupported setting.');
    const pattern = new RegExp(`^${key}\\s*=.*$`, 'm');
    const line = `${key}=${JSON.stringify(value)}`;
    if (pattern.test(file)) file = file.replace(pattern, () => line);
    else file += `${file.endsWith('\n') ? '' : newline}${line}${newline}`;
  }
  const destination = resolve('.env');
  const temporary = `${destination}.youtube-auth-${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, file, { mode: 0o600, flag: 'wx' });
    await rename(temporary, destination);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log(
      'npm run youtube:auth -- --start   Enable OAuth and show the Google device sign-in code.',
    );
    console.log(
      'npm run youtube:auth -- --save    After sign-in, save the refresh token privately in .env.',
    );
    return;
  }
  if (args.length > 1 || args.some((arg) => !['--start', '--save'].includes(arg)))
    throw new Error('Use --start, --save, or --help.');
  const env = loadEnv();
  if (args[0] === '--save') {
    const node = env.lavalinkNodes[0];
    if (!node) throw new Error('Configure a Lavalink node first.');
    const host =
      node.host.includes(':') && !node.host.startsWith('[') ? `[${node.host}]` : node.host;
    const origin = `${node.secure ? 'https' : 'http'}://${host}:${node.port}`;
    let body: unknown;
    try {
      const response = await fetch(`${origin}/youtube`, {
        headers: { Authorization: node.authorization },
        signal: AbortSignal.timeout(10_000),
        redirect: 'error',
      });
      if (!response.ok) throw new Error('Unavailable.');
      body = await response.json();
    } catch {
      throw new Error('YouTube authorization could not be checked. Verify Lavalink is running.');
    }
    const token: unknown =
      typeof body === 'object' && body && 'refreshToken' in body ? body.refreshToken : null;
    if (typeof token !== 'string' || !/^[A-Za-z0-9._~+/=-]{16,4096}$/.test(token))
      throw new Error(
        'Google sign-in is not complete yet. Finish the device authorization, then run --save again.',
      );
    await save({
      YOUTUBE_OAUTH_ENABLED: 'true',
      YOUTUBE_OAUTH_REFRESH_TOKEN: token,
      YOUTUBE_OAUTH_SKIP_INITIALIZATION: 'true',
    });
    console.log('YouTube refresh token saved privately in .env. Its value was not printed.');
    console.log('You can retry /play now. Restart the bot later to reload its environment.');
    return;
  }
  await save({ YOUTUBE_OAUTH_ENABLED: 'true', YOUTUBE_OAUTH_SKIP_INITIALIZATION: 'false' });
  await docker(
    ['compose', 'up', '-d', '--force-recreate', '--wait', '--wait-timeout', '120', 'lavalink'],
    {
      YOUTUBE_OAUTH_ENABLED: 'true',
      YOUTUBE_OAUTH_SKIP_INITIALIZATION: 'false',
    },
  );
  const logs = await docker(['compose', 'logs', '--no-color', '--since', '3m', 'lavalink']);
  const flow = [
    ...logs.matchAll(/OAUTH INTEGRATION:.*?go to (https:\/\/\S+) and enter code ([A-Z0-9-]+)/gi),
  ].at(-1);
  if (!flow?.[1] || !flow[2]) {
    if (env.YOUTUBE_OAUTH_REFRESH_TOKEN) {
      console.log('YouTube OAuth is enabled using the saved refresh token. Retry /play.');
      return;
    }
    throw new Error(
      'The Google device code is not available yet. Check Lavalink startup and retry --start.',
    );
  }
  const url = new URL(flow[1]);
  if (
    !['www.google.com', 'google.com', 'www.youtube.com', 'youtube.com'].includes(url.hostname) ||
    url.protocol !== 'https:'
  )
    throw new Error('Unexpected authorization address; raw logs were not printed.');
  console.log('Use a separate Google account, as the youtube-source plugin recommends.');
  console.log(`Open ${url.origin}${url.pathname} and enter code: ${flow[2]}`);
  console.log(
    'After approving access, run npm run youtube:auth -- --save to retain it across restarts.',
  );
}
try {
  await main();
} catch (error) {
  console.error(
    error instanceof ConfigurationError
      ? error.message
      : error instanceof Error
        ? error.message
        : 'YouTube setup failed.',
  );
  process.exitCode = 1;
}
