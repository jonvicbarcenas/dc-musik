import { randomUUID } from 'node:crypto';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** OAuth helpers change only their own keys, using an atomic private replacement. */
export async function saveOAuthEnv(values: Readonly<Record<string, string>>): Promise<void> {
  const allowed = new Set([
    'YOUTUBE_OAUTH_ENABLED',
    'YOUTUBE_OAUTH_SKIP_INITIALIZATION',
    'YOUTUBE_OAUTH_REFRESH_TOKEN',
    'SPOTIFY_ENABLED',
    'SPOTIFY_REFRESH_TOKEN',
  ]);
  let file: string;
  try {
    file = await readFile('.env', 'utf8');
  } catch {
    throw new Error('Create .env from .env.example before configuring source authorization.');
  }
  const newline = file.includes('\r\n') ? '\r\n' : '\n';
  let lines = file.split(/\r?\n/);
  for (const [key, value] of Object.entries(values)) {
    if (!allowed.has(key) || /[\r\n\0]/.test(value))
      throw new Error('Unsupported authorization setting.');
    const pattern = new RegExp(`^\\s*${key}\\s*=`);
    let replaced = false;
    lines = lines.flatMap((line) => {
      if (!pattern.test(line)) return [line];
      if (replaced) return [];
      replaced = true;
      return [`${key}=${JSON.stringify(value)}`];
    });
    if (!replaced) {
      if (lines.at(-1) === '') lines.pop();
      lines.push(`${key}=${JSON.stringify(value)}`, '');
    }
  }
  const destination = resolve('.env');
  const temporary = `${destination}.oauth-${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, lines.join(newline), { mode: 0o600, flag: 'wx' });
    await rename(temporary, destination);
  } catch {
    throw new Error('Authorization could not be saved. Check that .env is writable.');
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}
