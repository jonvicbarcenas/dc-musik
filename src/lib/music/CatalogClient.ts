import type { Env } from '../../config/env.js';
import { SafeHttpClient } from '../security/SafeHttpClient.js';
import { AsyncLock } from '../utils/AsyncLock.js';
import { MusicError } from '../utils/errors.js';
import type { CatalogPage, RawTrack } from './types.js';
import { toResolvedItem } from './TrackCodec.js';
import { SpotifyUserAuth, spotifySignInRequired } from './SpotifyUserAuth.js';

export function object(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function array(value: unknown): unknown[] {
  return Array.isArray(value) ? (value as unknown[]) : [];
}
export function string(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
export function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Metadata only. Neither access tokens nor preview URLs enter queue entries or cache keys. */
export class CatalogClient {
  private token: { value: string; expiresAt: number } | null = null;
  private readonly tokenLock = new AsyncLock();
  private readonly userAuth: SpotifyUserAuth;
  constructor(
    private readonly env: Pick<
      Env,
      'SPOTIFY_ENABLED' | 'SPOTIFY_CLIENT_ID' | 'SPOTIFY_CLIENT_SECRET' | 'SOURCE_COUNTRY_CODE'
    > &
      Partial<Pick<Env, 'SPOTIFY_REFRESH_TOKEN' | 'DATABASE_PATH'>>,
    private readonly http = new SafeHttpClient(),
  ) {
    this.userAuth = new SpotifyUserAuth(env, http);
  }

  supports(url: URL): boolean {
    return (
      url.hostname === 'www.deezer.com' ||
      url.hostname === 'deezer.com' ||
      (this.env.SPOTIFY_ENABLED && url.hostname === 'open.spotify.com')
    );
  }

  async *pages(url: URL, limit: number, signal?: AbortSignal): AsyncGenerator<CatalogPage> {
    if (url.hostname.includes('deezer.com')) yield* this.deezer(url, limit, signal);
    else yield* this.spotify(url, limit, signal);
  }

  private async *deezer(
    url: URL,
    limit: number,
    signal?: AbortSignal,
  ): AsyncGenerator<CatalogPage> {
    const match = /^\/(?:[a-z]{2}\/)?(track|album|playlist|artist)\/(\d+)\/?$/.exec(url.pathname);
    if (!match)
      throw new MusicError('INVALID_INPUT', 'Use a Deezer track, album, playlist, or artist link.');
    const kind = match[1] ?? '';
    const id = match[2] ?? '';
    const root = `https://api.deezer.com/${kind}/${id}`;
    if (kind === 'track') {
      const raw = await this.http.json(root, {
        ...(signal ? { signal } : {}),
        allowedOrigin: 'https://api.deezer.com',
      });
      const item = this.deezerTrack(raw);
      yield { name: item.title, items: [toResolvedItem(item)], total: 1 };
      return;
    }
    let offset = 0;
    while (offset < limit) {
      const size = Math.min(offset === 0 ? 5 : 100, limit - offset);
      const suffix = kind === 'artist' ? 'top' : 'tracks';
      const response = object(
        await this.http.json(`${root}/${suffix}?index=${offset}&limit=${size}`, {
          ...(signal ? { signal } : {}),
          allowedOrigin: 'https://api.deezer.com',
        }),
      );
      if (response['error']) throw new MusicError('UNAVAILABLE', 'Deezer metadata is unavailable.');
      const records = array(response['data']);
      if (!records.length) return;
      const items = records.slice(0, size).flatMap((raw) => {
        try {
          return [toResolvedItem(this.deezerTrack(raw))];
        } catch {
          return [];
        }
      });
      yield { name: `Deezer ${kind}`, items, total: number(response['total']) || null };
      offset += records.length;
      if (!response['next'] || records.length < size) return;
    }
  }
  private deezerTrack(value: unknown): RawTrack {
    const track = object(value);
    const artist = object(track['artist']);
    const album = object(track['album']);
    const identifier = track['id'];
    const id =
      typeof identifier === 'number' && Number.isSafeInteger(identifier)
        ? String(identifier)
        : string(identifier);
    if (!/^\d+$/.test(id) || !string(track['title']) || !number(track['duration']))
      throw new MusicError('UNAVAILABLE', 'Deezer metadata is incomplete.');
    return {
      encoded: null,
      identifier: id,
      title: string(track['title']),
      artist: string(artist['name']),
      source: 'deezer',
      uri: `https://www.deezer.com/track/${id}`,
      durationMs: number(track['duration']) * 1000,
      isStream: false,
      isSeekable: true,
      artworkUrl: string(album['cover_xl']) || string(album['cover_big']) || null,
      isrc: string(track['isrc']) || null,
      album: string(album['title']) || null,
      isPreview: false,
    };
  }

  private async *spotify(
    url: URL,
    limit: number,
    signal?: AbortSignal,
  ): AsyncGenerator<CatalogPage> {
    const match =
      /^\/(?:intl-[a-z]{2}\/)?(track|album|playlist|artist)\/([A-Za-z0-9]{22})\/?$/.exec(
        url.pathname,
      );
    if (!match)
      throw new MusicError(
        'INVALID_INPUT',
        'Use a Spotify track, album, playlist, or artist link.',
      );
    const kind = match[1] ?? '';
    const id = match[2] ?? '';
    const root = `https://api.spotify.com/v1/${kind}s/${id}`;
    const market = this.env.SOURCE_COUNTRY_CODE;
    let playlistName = `Spotify ${kind}`;
    if (kind === 'playlist' && this.env.SPOTIFY_REFRESH_TOKEN) {
      const playlist = object(await this.spotifyRequest(root, signal));
      // The operator's authorization is shared by the bot; never disclose their private libraries.
      if (playlist['public'] !== true)
        throw new MusicError(
          'SPOTIFY_ACCESS_DENIED',
          'Only public Spotify playlists can be imported. Make this playlist public and sign in with its owner or a collaborator.',
        );
      playlistName = string(playlist['name']) || playlistName;
    }
    if (kind === 'track' || kind === 'artist') {
      const response = await this.spotifyRequest(
        `${root}${kind === 'artist' ? '/top-tracks' : ''}?market=${market}`,
        signal,
      );
      const records = kind === 'track' ? [response] : array(object(response)['tracks']);
      yield {
        name: playlistName,
        items: records.slice(0, limit).flatMap((track) => this.spotifyItem(track)),
        total: records.length,
      };
      return;
    }
    let offset = 0;
    while (offset < limit) {
      const size = Math.min(offset === 0 ? 5 : 50, limit - offset);
      const suffix = kind === 'playlist' ? 'items' : 'tracks';
      const response = object(
        await this.spotifyRequest(
          `${root}/${suffix}?limit=${size}&offset=${offset}&market=${market}`,
          signal,
        ),
      );
      const records = array(response['items']);
      if (!records.length) return;
      yield {
        name: playlistName,
        items: records.slice(0, size).flatMap((record) => {
          const item = object(record);
          return this.spotifyItem(kind === 'playlist' ? (item['item'] ?? item['track']) : record);
        }),
        total: number(response['total']) || null,
      };
      offset += records.length;
      if (!response['next'] || records.length < size) return;
    }
  }
  private spotifyItem(value: unknown) {
    const track = object(value);
    const album = object(track['album']);
    const id = string(track['id']);
    if (
      !/^[A-Za-z0-9]{22}$/.test(id) ||
      track['is_local'] === true ||
      string(track['type']) === 'episode'
    )
      return [];
    const raw: RawTrack = {
      encoded: null,
      identifier: id,
      title: string(track['name']),
      artist: array(track['artists'])
        .map((artist) => string(object(artist)['name']))
        .join(', '),
      source: 'spotify',
      uri: `https://open.spotify.com/track/${id}`,
      durationMs: number(track['duration_ms']),
      isStream: false,
      isSeekable: true,
      artworkUrl: string(object(array(album['images'])[0])['url']) || null,
      isrc: string(object(track['external_ids'])['isrc']) || null,
      album: string(album['name']) || null,
      isPreview: false,
    };
    try {
      return [toResolvedItem(raw)];
    } catch {
      return [];
    }
  }
  private async spotifyRequest(url: string, signal?: AbortSignal): Promise<unknown> {
    let token = await this.accessToken(signal);
    let response = await this.http.request(url, {
      allowedOrigin: 'https://api.spotify.com',
      headers: { Authorization: `Bearer ${token}` },
      ...(signal ? { signal } : {}),
    });
    if (response.status === 401) {
      this.token = null;
      if (this.env.SPOTIFY_REFRESH_TOKEN) await this.userAuth.invalidate(token);
      token = await this.accessToken(signal);
      response = await this.http.request(url, {
        allowedOrigin: 'https://api.spotify.com',
        headers: { Authorization: `Bearer ${token}` },
        ...(signal ? { signal } : {}),
      });
    }
    if ([401, 403, 404].includes(response.status) && url.includes('/playlists/')) {
      if (!this.env.SPOTIFY_REFRESH_TOKEN || response.status === 401) throw spotifySignInRequired();
      throw new MusicError(
        'SPOTIFY_ACCESS_DENIED',
        'Spotify cannot read this playlist. Use a public playlist owned by the authorized account, or one it collaborates on. Ask the bot owner to check Spotify app access.',
      );
    }
    if (response.status !== 200)
      throw new MusicError('UNAVAILABLE', 'Spotify metadata access is restricted or unavailable.');
    try {
      return JSON.parse(response.body.toString('utf8')) as unknown;
    } catch {
      throw new MusicError('UNAVAILABLE', 'Spotify metadata is unavailable.');
    }
  }
  private async accessToken(signal?: AbortSignal): Promise<string> {
    if (this.env.SPOTIFY_REFRESH_TOKEN) return this.userAuth.accessToken(signal);
    return this.tokenLock.run(async () => {
      if (this.token && this.token.expiresAt > Date.now()) return this.token.value;
      if (!this.env.SPOTIFY_CLIENT_ID || !this.env.SPOTIFY_CLIENT_SECRET)
        throw new MusicError('UNAVAILABLE', 'Spotify is not configured.');
      const auth = Buffer.from(
        `${this.env.SPOTIFY_CLIENT_ID}:${this.env.SPOTIFY_CLIENT_SECRET}`,
      ).toString('base64');
      const response = object(
        await this.http.json('https://accounts.spotify.com/api/token', {
          method: 'POST',
          redirects: 0,
          allowedOrigin: 'https://accounts.spotify.com',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'grant_type=client_credentials',
        }),
      );
      const value = string(response['access_token']);
      const expires = number(response['expires_in']);
      if (!value || expires <= 0)
        throw new MusicError('UNAVAILABLE', 'Spotify authentication is unavailable.');
      this.token = { value, expiresAt: Date.now() + Math.max(1, expires - 30) * 1000 };
      return value;
    });
  }
}
