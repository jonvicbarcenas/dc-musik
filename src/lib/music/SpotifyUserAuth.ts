import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { Env } from '../../config/env.js';
import type { SafeHttpClient } from '../security/SafeHttpClient.js';
import { MusicError } from '../utils/errors.js';
import { spotifyTokenValid } from './SpotifyToken.js';

export type SpotifyAuthEnv = Pick<Env, 'SPOTIFY_CLIENT_ID'> &
  Partial<Pick<Env, 'SPOTIFY_REFRESH_TOKEN' | 'DATABASE_PATH'>>;
interface SavedToken {
  identity: string;
  refreshToken: string;
  accessToken: string;
  expiresAt: number;
}
export const spotifySignInRequired = () =>
  new MusicError(
    'SPOTIFY_AUTH_REQUIRED',
    'Spotify playlist access needs account sign-in. Ask the bot owner to run npm run spotify:auth, then restart the bot.',
  );

/** Private durable tokens. A short file lease serializes refreshes across accounts and shards. */
export class SpotifyUserAuth {
  private readonly path: string;
  private readonly identity: string;
  constructor(
    private readonly env: SpotifyAuthEnv,
    private readonly http: SafeHttpClient,
  ) {
    const directory = dirname(resolve(env.DATABASE_PATH ?? './data/music.sqlite'));
    const application = createHash('sha256')
      .update(env.SPOTIFY_CLIENT_ID ?? '')
      .digest('hex')
      .slice(0, 16);
    this.path = join(directory, `spotify-oauth-${application}.json`);
    this.identity = createHash('sha256')
      .update(`${env.SPOTIFY_CLIENT_ID ?? ''}\0${env.SPOTIFY_REFRESH_TOKEN ?? ''}`)
      .digest('hex');
  }
  async accessToken(signal?: AbortSignal): Promise<string> {
    if (!this.env.SPOTIFY_REFRESH_TOKEN || !this.env.SPOTIFY_CLIENT_ID)
      throw spotifySignInRequired();
    const cached = await this.read();
    if (cached && cached.expiresAt > Date.now()) return cached.accessToken;
    const release = await this.lock(signal);
    try {
      // Another account/shard may have refreshed while this request waited for the lease.
      const saved = await this.read();
      if (saved && saved.expiresAt > Date.now()) return saved.accessToken;
      const response = await this.http.request('https://accounts.spotify.com/api/token', {
        method: 'POST',
        allowedOrigin: 'https://accounts.spotify.com',
        redirects: 0,
        maxBytes: 64 * 1024,
        timeoutMs: 30_000,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.env.SPOTIFY_CLIENT_ID,
          refresh_token: saved?.refreshToken ?? this.env.SPOTIFY_REFRESH_TOKEN,
        }).toString(),
        ...(signal ? { signal } : {}),
      });
      if (response.status === 400 || response.status === 401) throw spotifySignInRequired();
      if (response.status !== 200)
        throw new MusicError(
          'UNAVAILABLE',
          'Spotify authorization is temporarily unavailable. Try again later.',
        );
      let body: unknown;
      try {
        body = JSON.parse(response.body.toString('utf8')) as unknown;
      } catch {
        throw spotifySignInRequired();
      }
      if (
        typeof body !== 'object' ||
        !body ||
        !('access_token' in body) ||
        !spotifyTokenValid(body.access_token) ||
        !('expires_in' in body) ||
        typeof body.expires_in !== 'number' ||
        !Number.isFinite(body.expires_in) ||
        body.expires_in <= 0
      )
        throw spotifySignInRequired();
      const replacement = 'refresh_token' in body ? body.refresh_token : undefined;
      if (replacement !== undefined && !spotifyTokenValid(replacement))
        throw spotifySignInRequired();
      if (
        'scope' in body &&
        (typeof body.scope !== 'string' || !body.scope.split(' ').includes('playlist-read-private'))
      )
        throw spotifySignInRequired();
      const record: SavedToken = {
        identity: this.identity,
        accessToken: body.access_token,
        refreshToken: replacement ?? saved?.refreshToken ?? this.env.SPOTIFY_REFRESH_TOKEN,
        expiresAt: Date.now() + Math.max(1, Math.min(body.expires_in, 86_400) - 30) * 1000,
      };
      await this.write(record);
      return record.accessToken;
    } finally {
      await release();
    }
  }
  async invalidate(accessToken: string): Promise<void> {
    const release = await this.lock();
    try {
      const saved = await this.read();
      if (saved?.accessToken === accessToken) await this.write({ ...saved, expiresAt: 0 });
    } finally {
      await release();
    }
  }
  private async read(): Promise<SavedToken | null> {
    try {
      const size = await stat(this.path);
      if (size.size > 32 * 1024) return null;
      const value: unknown = JSON.parse(await readFile(this.path, 'utf8'));
      if (
        typeof value !== 'object' ||
        !value ||
        !('identity' in value) ||
        value.identity !== this.identity ||
        !('refreshToken' in value) ||
        !spotifyTokenValid(value.refreshToken) ||
        !('accessToken' in value) ||
        !spotifyTokenValid(value.accessToken) ||
        !('expiresAt' in value) ||
        typeof value.expiresAt !== 'number' ||
        !Number.isFinite(value.expiresAt)
      )
        return null;
      return {
        identity: this.identity,
        refreshToken: value.refreshToken,
        accessToken: value.accessToken,
        expiresAt: value.expiresAt,
      };
    } catch {
      return null;
    }
  }
  private async write(value: SavedToken): Promise<void> {
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(value), { flag: 'wx', mode: 0o600 });
      await rename(temporary, this.path);
    } catch {
      throw new MusicError(
        'UNAVAILABLE',
        'Spotify authorization could not be saved. Check that the data directory is writable.',
      );
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }
  private async lock(signal?: AbortSignal): Promise<() => Promise<void>> {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const path = `${this.path}.lock`;
    const lease = randomUUID();
    const deadline = Date.now() + 45_000;
    while (true) {
      signal?.throwIfAborted();
      try {
        await writeFile(path, lease, { flag: 'wx', mode: 0o600 });
        break;
      } catch (error) {
        if (typeof error !== 'object' || !error || !('code' in error) || error.code !== 'EEXIST')
          throw new MusicError(
            'UNAVAILABLE',
            'Spotify authorization requires a writable data directory.',
          );
        // A refresh request has a 30-second deadline; a two-minute lease left by a crashed process is stale.
        const previous = await readFile(path, 'utf8').catch(() => null);
        const previousStat = await stat(path).catch(() => null);
        if (
          previous !== null &&
          previousStat &&
          Date.now() - previousStat.mtimeMs > 120_000 &&
          (await readFile(path, 'utf8').catch(() => null)) === previous
        ) {
          await unlink(path).catch(() => undefined);
          continue;
        }
        if (Date.now() >= deadline)
          throw new MusicError('UNAVAILABLE', 'Spotify authorization is busy. Retry in a moment.');
        await new Promise<void>((ready) => setTimeout(ready, 100));
      }
    }
    return async () => {
      if ((await readFile(path, 'utf8').catch(() => null)) === lease)
        await unlink(path).catch(() => undefined);
    };
  }
}
