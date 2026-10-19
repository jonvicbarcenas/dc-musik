import { describe, expect, it, vi } from 'vitest';
import { CatalogClient } from '../src/lib/music/CatalogClient.js';
import { SourceResolver } from '../src/lib/music/SourceResolver.js';
import { SafeHttpClient } from '../src/lib/security/SafeHttpClient.js';
import { MediaBridge } from '../src/lib/security/MediaBridge.js';
import { MemoryCache } from '../src/lib/cache/Cache.js';
import type { SafeResponse } from '../src/lib/security/SafeHttpClient.js';
import { MusicError } from '../src/lib/utils/errors.js';

const env = {
  SPOTIFY_ENABLED: true,
  SPOTIFY_CLIENT_ID: 'spotify-test-client',
  SPOTIFY_CLIENT_SECRET: 'private-test-client-secret',
  SOURCE_COUNTRY_CODE: 'PH',
};
const record = {
  id: '4PTG3Z6ehGkBFwjybzWkR8',
  name: 'Blue Sky',
  type: 'track',
  duration_ms: 222000,
  artists: [{ name: 'Hale' }],
  album: { name: 'Hale', images: [{ url: 'https://i.scdn.co/image/test-artwork' }] },
  external_ids: { isrc: 'PHAAA0500001' },
  preview_url: 'https://preview.example.com/30-second-clip.mp3',
};
const response = (url: string, value: unknown, status = 200): SafeResponse => ({
  status,
  url,
  headers: {},
  body: Buffer.from(JSON.stringify(value)),
});
function setup(items: unknown[] = [record]) {
  const http = new SafeHttpClient();
  const request = vi
    .spyOn(http, 'request')
    .mockImplementation((url) =>
      Promise.resolve(
        response(
          url,
          url.startsWith('https://accounts.spotify.com/')
            ? { access_token: 'private-access-token', expires_in: 3600 }
            : { tracks: { items } },
        ),
      ),
    );
  const catalog = new CatalogClient(env, http);
  const transport = {
    load: vi.fn(() => Promise.resolve({ kind: 'empty' as const, name: '', tracks: [] })),
  };
  const media = new MediaBridge({
    MEDIA_BRIDGE_PORT: 3001,
    MEDIA_BRIDGE_BIND: '127.0.0.1',
    MEDIA_BRIDGE_PUBLIC_URL: 'http://127.0.0.1:3001',
    MEDIA_MAX_BYTES: 1024,
    MEDIA_REQUEST_TIMEOUT_MS: 1000,
  });
  const resolver = new SourceResolver(transport, new MemoryCache(), media, catalog);
  return { http, request, catalog, transport, resolver };
}
describe('Spotify catalog search', () => {
  it('uses the official search API and returns Spotify identities without previews or tokens', async () => {
    const { request, resolver, transport } = setup();
    const query = 'track:"Blue Sky" artist:Hale & favorites';
    const items = await resolver.search(`spsearch:${query}`);
    const searchCall = request.mock.calls.find(([url]) =>
      url.startsWith('https://api.spotify.com/'),
    );
    const url = new URL(searchCall?.[0] ?? '');
    expect(url.pathname).toBe('/v1/search');
    expect(url.searchParams.get('q')).toBe(query);
    expect(url.searchParams.get('type')).toBe('track');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(url.searchParams.get('market')).toBe('PH');
    expect(transport.load).not.toHaveBeenCalled();
    expect(items).toHaveLength(1);
    expect(items[0]?.track).toMatchObject({
      source: 'spotify',
      identifier: record.id,
      title: 'Blue Sky',
      artist: 'Hale',
      uri: `https://open.spotify.com/track/${record.id}`,
      durationMs: 222000,
      album: 'Hale',
      artworkUrl: record.album.images[0]?.url,
    });
    expect(items[0]?.playable).toBeNull();
    expect(JSON.stringify(items)).not.toContain('preview');
    expect(JSON.stringify(items)).not.toContain('private-');
  });
  it('bounds the current API page size and skips non-track records', async () => {
    const { catalog, request } = setup([
      null,
      { ...record, is_local: true },
      { ...record, type: 'episode' },
      { ...record, id: 'invalid' },
      ...Array.from({ length: 12 }, () => record),
    ]);
    expect(await catalog.searchSpotify('Hale', 100)).toHaveLength(6);
    expect(new URL(request.mock.calls.at(-1)?.[0] ?? '').searchParams.get('limit')).toBe('10');
  });
  it('reports missing configuration before making any provider request', async () => {
    const { http, request } = setup();
    for (const config of [
      { ...env, SPOTIFY_ENABLED: false },
      { ...env, SPOTIFY_CLIENT_ID: undefined },
      { ...env, SPOTIFY_CLIENT_SECRET: undefined },
    ]) {
      const catalog = new CatalogClient(config, http);
      await expect(catalog.searchSpotify('Hale')).rejects.toMatchObject({
        code: 'SPOTIFY_AUTH_REQUIRED',
      });
    }
    expect(request).not.toHaveBeenCalled();
  });
  it.each([403, 429])(
    'returns a useful error for Spotify status %i without switching sources',
    async (status) => {
      const { request, resolver, transport } = setup();
      request.mockImplementation((url) =>
        Promise.resolve(
          response(
            url,
            url.includes('accounts.spotify.com')
              ? { access_token: 'private-access-token', expires_in: 3600 }
              : { error: 'private-provider-details' },
            url.includes('accounts.spotify.com') ? 200 : status,
          ),
        ),
      );
      const failure: unknown = await resolver
        .search('spsearch:Hale')
        .catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(MusicError);
      if (!(failure instanceof MusicError)) throw new Error('Expected a Spotify source error.');
      expect(failure.code).toBe(status === 403 ? 'SPOTIFY_ACCESS_DENIED' : 'UNAVAILABLE');
      expect(failure.message).toContain(
        status === 403 ? 'Spotify denied search access' : 'rate limited',
      );
      expect(transport.load).not.toHaveBeenCalled();
    },
  );
  it('refreshes an expired token once and retries the same catalog query', async () => {
    const { request, catalog } = setup();
    let searches = 0;
    request.mockImplementation((url) => {
      if (url.includes('accounts.spotify.com'))
        return Promise.resolve(
          response(url, { access_token: 'private-refreshed-token', expires_in: 3600 }),
        );
      searches++;
      return Promise.resolve(
        response(
          url,
          searches === 1 ? {} : { tracks: { items: [record] } },
          searches === 1 ? 401 : 200,
        ),
      );
    });
    expect(await catalog.searchSpotify('Hale')).toHaveLength(1);
    expect(searches).toBe(2);
    expect(request.mock.calls.filter(([url]) => url.includes('accounts.spotify.com'))).toHaveLength(
      2,
    );
  });
  it('honors cancellation and retains the YouTube Music search path', async () => {
    const { catalog, resolver, request, transport } = setup();
    const cancellation = new AbortController();
    cancellation.abort();
    await expect(catalog.searchSpotify('Hale', 10, cancellation.signal)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
    await resolver.search('ytmsearch:Hale');
    expect(transport.load).toHaveBeenCalledWith('ytmsearch:Hale', undefined);
  });
});
