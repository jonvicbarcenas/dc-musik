import { afterEach, describe, expect, it, vi } from 'vitest';
import { SourceResolver } from '../src/lib/music/SourceResolver.js';
import { CatalogClient } from '../src/lib/music/CatalogClient.js';
import { MemoryCache } from '../src/lib/cache/Cache.js';
import { MediaBridge } from '../src/lib/security/MediaBridge.js';
import { UrlGuard } from '../src/lib/security/UrlGuard.js';
import { parseEnv } from '../src/config/env.js';
import { tracks, botId } from './fixtures/live.js';
import type { LoadResult, RawTrack } from '../src/lib/music/types.js';
import type { StoredTrack } from '../src/lib/db/models.js';

const original = tracks[0]!;
const raw: RawTrack = {
  ...original,
  encoded: 'failed-video',
  identifier: original.identifier!,
  source: 'youtube',
  isSeekable: true,
  isPreview: false,
};
const mirror: RawTrack = {
  ...raw,
  source: 'soundcloud',
  identifier: 'soundcloud-full-song',
  encoded: 'soundcloud-full-song',
  uri: 'https://soundcloud.com/hale/blue-sky',
};
const caches: MemoryCache[] = [];
afterEach(async () => {
  await Promise.all(caches.splice(0).map((cache) => cache.close()));
});
function setup() {
  const env = parseEnv({
    DISCORD_TOKEN: `${'a'.repeat(25)}.${'b'.repeat(8)}.${'c'.repeat(30)}`,
    DISCORD_CLIENT_ID: botId,
    LAVALINK_PASSWORD: 'test-lavalink-password',
  });
  const cache = new MemoryCache();
  caches.push(cache);
  const transport = {
    load: vi.fn<(input: string, nodeId?: string | null) => Promise<LoadResult>>(() =>
      Promise.resolve({ kind: 'track', name: '', tracks: [raw] }),
    ),
  };
  const resolver = new SourceResolver(
    transport,
    cache,
    new MediaBridge(env),
    new CatalogClient(env),
    3,
    new UrlGuard(() => Promise.resolve([{ address: '8.8.8.8', family: 4 }])),
  );
  return { resolver, transport };
}

describe('full-track source recovery', () => {
  it('refreshes the original video even when its encoding stays the same', async () => {
    const { resolver, transport } = setup();
    const playable = await resolver.resolve(original, new Set(), 'test-node');
    expect(playable.encoded).toBe(raw.encoded);
    expect(transport.load).toHaveBeenCalledExactlyOnceWith(original.uri, 'test-node');
  });
  it('prefers a matching SoundCloud song when YouTube failed repeatedly, rejecting previews and covers', async () => {
    const { resolver, transport } = setup();
    transport.load.mockResolvedValue({
      kind: 'search',
      name: '',
      tracks: [
        { ...mirror, encoded: 'preview', isPreview: true },
        { ...mirror, encoded: 'cover', title: `${mirror.title} cover` },
        { ...mirror, encoded: 'short', durationMs: 30000 },
        { ...mirror, encoded: 'wrong-artist', artist: 'Different artist' },
        mirror,
      ],
    });
    const playable = await resolver.resolve(original, new Set(['failed-video']), 'test-node');
    expect(playable).toMatchObject({ source: 'soundcloud', encoded: mirror.encoded });
    expect(transport.load).toHaveBeenCalledExactlyOnceWith(
      `scsearch:${original.artist} - ${original.title}`,
      'test-node',
    );
  });
  it('excludes the original YouTube identity even if a search returns it with a new encoding', async () => {
    const { resolver, transport } = setup();
    const excluded = new Set(['failed-video', 'already-failed-mirror']);
    transport.load.mockImplementation((input) =>
      Promise.resolve({
        kind: 'search',
        name: '',
        tracks: input.startsWith('scsearch:')
          ? []
          : [
              { ...raw, encoded: 'new-encoding-for-same-video' },
              { ...raw, encoded: 'already-failed-mirror', identifier: 'other-failed' },
              { ...raw, encoded: 'valid-alternative', identifier: 'different-video' },
            ],
      }),
    );
    expect((await resolver.resolve(original, excluded)).encoded).toBe('valid-alternative');
    // Cached resolutions also respect exclusions.
    excluded.add('valid-alternative');
    await expect(resolver.resolve(original, excluded)).rejects.toMatchObject({
      code: 'UNAVAILABLE',
    });
  });
  it('keeps catalog matching and starts SoundCloud recovery with a different provider', async () => {
    const { resolver, transport } = setup();
    const catalog: StoredTrack = { ...original, source: 'spotify', key: 'spotify:test' };
    expect((await resolver.resolve(catalog)).encoded).toBe(raw.encoded);
    expect(transport.load.mock.calls[0]?.[0]).toMatch(/^ytmsearch:/);
    transport.load.mockClear();
    const soundcloud: StoredTrack = {
      ...original,
      source: 'soundcloud',
      uri: mirror.uri,
      identifier: mirror.identifier,
    };
    expect((await resolver.resolve(soundcloud, new Set([mirror.encoded!]))).source).toBe('youtube');
    expect(transport.load.mock.calls[0]?.[0]).toMatch(/^ytmsearch:/);
  });
  it('never substitutes an unrelated song for a livestream', async () => {
    const { resolver, transport } = setup();
    await expect(
      resolver.resolve({ ...original, isStream: true }, new Set([raw.encoded!])),
    ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    expect(transport.load).toHaveBeenCalledExactlyOnceWith(original.uri, undefined);
  });
});
