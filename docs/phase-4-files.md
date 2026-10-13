# Phase 4 — Complete files

Every implementation file added or changed in Phase 4 is reproduced below without abbreviation. There are 25 files. Temporary verification fixtures are reserved for the permanent test phase.

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/cache/Cache.ts

````typescript
import { Redis } from 'ioredis';
import type { Logger } from 'pino';

export interface Cache {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  close(): Promise<void>;
}

export class MemoryCache implements Cache {
  private readonly entries = new Map<string, { value: unknown; expires: number }>();
  constructor(private readonly maximum = 2000) {}
  get(key: string): Promise<unknown> {
    const entry = this.entries.get(key);
    if (!entry || entry.expires <= Date.now()) {
      this.entries.delete(key);
      return Promise.resolve(undefined);
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return Promise.resolve(structuredClone(entry.value));
  }
  set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.entries.delete(key);
    while (this.entries.size >= this.maximum) {
      const first = this.entries.keys().next().value;
      if (first === undefined) break;
      this.entries.delete(first);
    }
    this.entries.set(key, {
      value: structuredClone(value),
      expires: Date.now() + ttlSeconds * 1000,
    });
    return Promise.resolve();
  }
  delete(key: string): Promise<void> {
    this.entries.delete(key);
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.entries.clear();
    return Promise.resolve();
  }
}

/** Redis is an optional cache; snapshots remain durable in the repository. */
export class RedisCache implements Cache {
  private readonly redis: Redis;
  private readonly fallback = new MemoryCache();
  constructor(
    url: string,
    private readonly namespace: string,
    logger: Logger,
  ) {
    this.redis = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 5000,
      retryStrategy: (attempt) => Math.min(attempt * 1000, 30_000),
    });
    this.redis.on('error', () =>
      logger.warn({ service: 'redis' }, 'Cache unavailable; using memory.'),
    );
    void this.redis.connect().catch(() => undefined);
  }
  async get(key: string): Promise<unknown> {
    try {
      const value = await this.redis.get(`${this.namespace}:${key}`);
      return value === null ? await this.fallback.get(key) : (JSON.parse(value) as unknown);
    } catch {
      return this.fallback.get(key);
    }
  }
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.fallback.set(key, value, ttlSeconds);
    try {
      await this.redis.set(`${this.namespace}:${key}`, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      /* A cache outage must not interrupt playback. */
    }
  }
  async delete(key: string): Promise<void> {
    await this.fallback.delete(key);
    try {
      await this.redis.del(`${this.namespace}:${key}`);
    } catch {
      /* Optional cache. */
    }
  }
  async close(): Promise<void> {
    this.redis.disconnect();
    await this.fallback.close();
  }
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/AutoplayEngine.ts

````typescript
import type { HistoryRepository } from '../db/contracts.js';
import type { QueueEntry, StoredTrack } from '../db/models.js';
import { createQueueEntry } from './QueueManager.js';
import { normalizeMusicText } from './MirrorMatcher.js';
import type { SourceResolver } from './SourceResolver.js';

export class AutoplayEngine {
  constructor(
    private readonly resolver: SourceResolver,
    private readonly history: HistoryRepository,
  ) {}
  async next(
    botId: string,
    guildId: string,
    last: QueueEntry,
    queued: readonly QueueEntry[],
    maxLengthMs: number,
    nodeId?: string | null,
    signal?: AbortSignal,
  ): Promise<QueueEntry | null> {
    const recent = await this.history.list({ botId, guildId }, { pageSize: 100 });
    const excluded = new Set([
      ...recent.items.map((item) => identity(item.track)),
      ...queued.map((entry) => identity(entry.track)),
      identity(last.track),
    ]);
    // User history contributes a second seed if the current artist has no fresh related results.
    const personal = await this.history.list({ userId: last.requester.userId }, { pageSize: 10 });
    const seeds = [last.track, ...personal.items.slice(0, 3).map((item) => item.track)];
    for (const seed of seeds) {
      signal?.throwIfAborted();
      const items = await this.resolver.related(seed, nodeId, signal);
      for (const item of items) {
        signal?.throwIfAborted();
        if (
          excluded.has(identity(item.track)) ||
          item.track.isStream ||
          item.track.durationMs > maxLengthMs
        )
          continue;
        try {
          const playable =
            item.playable ?? (await this.resolver.resolve(item.track, new Set(), nodeId, signal));
          return createQueueEntry(item.track, last.requester, playable);
        } catch {
          /* A restricted recommendation must not stop the next candidate. */
        }
      }
    }
    return null;
  }
}
function identity(track: StoredTrack): string {
  return track.isrc ?? `${normalizeMusicText(track.artist)}:${normalizeMusicText(track.title)}`;
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/CatalogClient.ts

````typescript
import type { Env } from '../../config/env.js';
import { SafeHttpClient } from '../security/SafeHttpClient.js';
import { AsyncLock } from '../utils/AsyncLock.js';
import { MusicError } from '../utils/errors.js';
import type { CatalogPage, RawTrack } from './types.js';
import { toResolvedItem } from './TrackCodec.js';

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
  constructor(
    private readonly env: Pick<
      Env,
      'SPOTIFY_ENABLED' | 'SPOTIFY_CLIENT_ID' | 'SPOTIFY_CLIENT_SECRET' | 'SOURCE_COUNTRY_CODE'
    >,
    private readonly http = new SafeHttpClient(),
  ) {}

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
    if (kind === 'track' || kind === 'artist') {
      const response = await this.spotifyRequest(
        `${root}${kind === 'artist' ? '/top-tracks' : ''}?market=${market}`,
        signal,
      );
      const records = kind === 'track' ? [response] : array(object(response)['tracks']);
      yield {
        name: `Spotify ${kind}`,
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
        name: `Spotify ${kind}`,
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
    let token = await this.accessToken();
    let response = await this.http.request(url, {
      allowedOrigin: 'https://api.spotify.com',
      headers: { Authorization: `Bearer ${token}` },
      ...(signal ? { signal } : {}),
    });
    if (response.status === 401) {
      this.token = null;
      token = await this.accessToken();
      response = await this.http.request(url, {
        allowedOrigin: 'https://api.spotify.com',
        headers: { Authorization: `Bearer ${token}` },
        ...(signal ? { signal } : {}),
      });
    }
    if (response.status !== 200)
      throw new MusicError('UNAVAILABLE', 'Spotify metadata access is restricted or unavailable.');
    try {
      return JSON.parse(response.body.toString('utf8')) as unknown;
    } catch {
      throw new MusicError('UNAVAILABLE', 'Spotify metadata is unavailable.');
    }
  }
  private async accessToken(): Promise<string> {
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

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/FilterPresets.ts

````typescript
import { audioFiltersSchema } from '../db/models.js';
import type { AudioFilters } from '../db/models.js';
import { MusicError } from '../utils/errors.js';

export const equalizerPresets = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bass: [0.3, 0.25, 0.2, 0.1, 0.05, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  pop: [0.05, 0.1, 0.1, 0, -0.05, -0.05, 0, 0.05, 0.1, 0.15, 0.15, 0.1, 0.05, 0.05, 0],
  rock: [0.2, 0.15, 0.1, 0, -0.05, -0.05, 0, 0.05, 0.1, 0.15, 0.2, 0.2, 0.15, 0.1, 0.05],
  vocal: [-0.1, -0.1, -0.05, 0, 0.1, 0.15, 0.2, 0.2, 0.15, 0.1, 0.05, 0, -0.05, -0.1, -0.1],
} as const;
export type FilterPreset =
  | 'bassboost'
  | 'nightcore'
  | 'vaporwave'
  | '8d'
  | 'karaoke'
  | 'tremolo'
  | 'vibrato'
  | 'rotation'
  | 'lowpass';

export function applyFilterPreset(
  current: AudioFilters,
  name: FilterPreset,
  enabled = true,
): AudioFilters {
  const next = structuredClone(current);
  switch (name) {
    case 'bassboost':
      if (enabled) next.equalizer = equalizer('bass');
      else delete next.equalizer;
      break;
    case 'nightcore':
      if (enabled) next.timescale = { speed: 1.15, pitch: 1.2, rate: 1 };
      else delete next.timescale;
      break;
    case 'vaporwave':
      if (enabled) next.timescale = { speed: 0.85, pitch: 0.9, rate: 1 };
      else delete next.timescale;
      break;
    case '8d':
    case 'rotation':
      if (enabled) next.rotation = { rotationHz: 0.2 };
      else delete next.rotation;
      break;
    case 'karaoke':
      if (enabled) next.karaoke = { level: 1, monoLevel: 1, filterBand: 220, filterWidth: 100 };
      else delete next.karaoke;
      break;
    case 'tremolo':
      if (enabled) next.tremolo = { frequency: 4, depth: 0.5 };
      else delete next.tremolo;
      break;
    case 'vibrato':
      if (enabled) next.vibrato = { frequency: 4, depth: 0.5 };
      else delete next.vibrato;
      break;
    case 'lowpass':
      if (enabled) next.lowPass = { smoothing: 20 };
      else delete next.lowPass;
      break;
  }
  return validateFilters(next);
}
export function equalizer(
  name: keyof typeof equalizerPresets,
): NonNullable<AudioFilters['equalizer']> {
  return equalizerPresets[name].map((gain, band) => ({ band, gain }));
}
export function setTimescale(
  current: AudioFilters,
  parameter: 'speed' | 'pitch' | 'rate',
  value: number,
): AudioFilters {
  return validateFilters({
    ...current,
    timescale: { speed: 1, pitch: 1, rate: 1, ...current.timescale, [parameter]: value },
  });
}
export function validateFilters(value: unknown): AudioFilters {
  const result = audioFiltersSchema.safeParse(value);
  if (
    !result.success ||
    (result.data.equalizer &&
      new Set(result.data.equalizer.map((band) => band.band)).size !== result.data.equalizer.length)
  )
    throw new MusicError(
      'INVALID_INPUT',
      'Invalid filter values. Speed, pitch, and rate must be between 0.25 and 4.',
    );
  return result.data;
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/ImportScheduler.ts

````typescript
import type { PendingImport } from '../db/models.js';
import type { CatalogPage, ResolvedItem } from './types.js';
import type { SourceResolver } from './SourceResolver.js';
import { Semaphore } from '../utils/AsyncLock.js';

export interface ImportHooks {
  /** Atomic append + checkpoint. Return false when the job is cancelled or the queue is full. */
  append(
    jobId: string,
    items: readonly ResolvedItem[],
    processedCount: number,
    name: string,
    total: number | null,
  ): Promise<boolean>;
  complete(jobId: string, failed: boolean): Promise<void>;
}

/** Bounded metadata workers; mirrored audio is prefetched separately for the next five tracks. */
export class ImportScheduler {
  private readonly workers: Semaphore;
  private readonly jobs = new Map<
    string,
    { controller: AbortController; promise: Promise<void> }
  >();
  constructor(
    private readonly resolver: SourceResolver,
    concurrency = 3,
  ) {
    this.workers = new Semaphore(concurrency);
  }
  start(job: PendingImport, hooks: ImportHooks, onFailure: () => void): void {
    if (this.jobs.has(job.id)) return;
    const controller = new AbortController();
    const promise = this.workers
      .run(async () => {
        let processed = 0;
        try {
          for await (const page of this.resolver.pages(job.query, job.limit, controller.signal)) {
            const skip = Math.max(0, job.processedCount - processed);
            processed += page.items.length;
            const items = page.items.slice(skip);
            if (!items.length) continue;
            controller.signal.throwIfAborted();
            if (!(await hooks.append(job.id, items, processed, page.name, page.total))) {
              await hooks.complete(job.id, false);
              return;
            }
          }
          await hooks.complete(job.id, false);
        } catch {
          if (!controller.signal.aborted) {
            onFailure();
            await hooks.complete(job.id, true);
          }
        }
      }, controller.signal)
      .catch(() => {
        if (!controller.signal.aborted) onFailure();
      })
      .finally(() => this.jobs.delete(job.id));
    this.jobs.set(job.id, { controller, promise });
  }
  cancel(id: string): void {
    this.jobs.get(id)?.controller.abort();
  }
  async close(): Promise<void> {
    const jobs = [...this.jobs.values()];
    for (const job of jobs) job.controller.abort();
    await Promise.allSettled(jobs.map((job) => job.promise));
  }
}

/** Convenience for personal-playlist import commands; no playback or previews are required. */
export async function collectCatalog(
  pages: AsyncIterable<CatalogPage>,
  maximum: number,
): Promise<ResolvedItem[]> {
  const items: ResolvedItem[] = [];
  for await (const page of pages) {
    items.push(...page.items.slice(0, maximum - items.length));
    if (items.length >= maximum) break;
  }
  return items;
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/index.ts

````typescript
export * from './types.js';
export * from './TrackCodec.js';
export * from './QueueManager.js';
export * from './MirrorMatcher.js';
export * from './FilterPresets.js';
export * from './ProgressBar.js';
export { CatalogClient } from './CatalogClient.js';
export * from './SourceResolver.js';
export * from './AutoplayEngine.js';
export * from './ImportScheduler.js';
export * from './PlayerManager.js';
export * from './LavalinkTransport.js';
export * from './RecoveryManager.js';
export * from './LyricsService.js';
export { MemoryCache, RedisCache } from '../cache/Cache.js';
export type { Cache } from '../cache/Cache.js';
export { MediaBridge, isAudioContainer } from '../security/MediaBridge.js';
export { SafeHttpClient } from '../security/SafeHttpClient.js';
export { UrlGuard, isPublicAddress } from '../security/UrlGuard.js';
export { createLogger } from '../utils/logger.js';
export { MusicError, friendlyError, errorCode } from '../utils/errors.js';
export { parseTime, formatTime } from '../utils/time.js';

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/LavalinkTransport.ts

````typescript
import { LavalinkManager } from 'lavalink-client';
import type {
  LavalinkNode,
  LavalinkFilterData,
  Track,
  TrackEndEvent,
  TrackExceptionEvent,
  TrackStartEvent,
  TrackStuckEvent,
} from 'lavalink-client';
import type { Env } from '../../config/env.js';
import type { QueueSnapshotsRepository } from '../db/contracts.js';
import type { AudioFilters, PlayableTrack, QueueSnapshot } from '../db/models.js';
import type {
  AudioTransport,
  LoadResult,
  NodeIdentity,
  PlaybackOptions,
  TrackEvent,
} from './types.js';
import { fromClientTrack } from './TrackCodec.js';
import { MusicError } from '../utils/errors.js';

export async function createLavalinkClient(
  env: Env,
  botId: string,
  snapshots: QueueSnapshotsRepository,
  sendToShard: ConstructorParameters<typeof LavalinkManager>[0]['sendToShard'],
): Promise<LavalinkManager> {
  const sessions = new Map<string, string>();
  // Newest snapshot wins if an older player has not yet checkpointed a reconnected node.
  for (const summary of (await snapshots.list(botId)).sort((a, b) => b.updatedAt - a.updatedAt)) {
    const record = await snapshots.load(botId, summary.guildId);
    if (
      record?.snapshot.nodeId &&
      record.snapshot.nodeSessionId &&
      !sessions.has(record.snapshot.nodeId)
    )
      sessions.set(record.snapshot.nodeId, record.snapshot.nodeSessionId);
  }
  return new LavalinkManager({
    nodes: env.lavalinkNodes.map((node) => ({
      ...node,
      host: node.host.includes(':') && !node.host.startsWith('[') ? `[${node.host}]` : node.host,
      requestSignalTimeoutMS: env.LAVALINK_REQUEST_TIMEOUT_MS,
      ...(sessions.has(node.id) ? { sessionId: sessions.get(node.id) ?? '' } : {}),
    })),
    sendToShard,
    autoSkip: false,
    autoSkipOnResolveError: false,
    autoMove: false,
    playerOptions: {
      defaultSearchPlatform: 'ytsearch',
      allowCustomSources: true,
      volumeDecrementer: 1,
      clientBasedPositionUpdateInterval: 250,
      onDisconnect: { autoReconnect: false, destroyPlayer: false },
      maxErrorsPerTime: { threshold: 0, maxAmount: 0 },
      enforceSponsorBlockRequestForEventEnablement: false,
    },
    queueOptions: { maxPreviousTracks: 0 },
    advancedOptions: { enableDebugEvents: false },
  });
}

/** SDK handles nodes and Discord voice. Our engine handles tracks via the typed v4 REST API. */
export class LavalinkTransport implements AudioTransport {
  private readonly stuckCleanup = new Map<
    string,
    {
      done: Promise<boolean>;
      release: (completed: boolean) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  constructor(public readonly client: LavalinkManager) {
    // The SDK sends an automatic stop after emitting trackStuck, even with autoSkip=false.
    // Wait for its resulting queueEnd before our next PATCH so that stop cannot kill a new mirror.
    client.on('trackStuck', (player) => {
      this.releaseStuck(player.guildId, false);
      let release!: (completed: boolean) => void;
      const done = new Promise<boolean>((ready) => {
        release = ready;
      });
      const timeout = (player.node.options.requestSignalTimeoutMS ?? 30_000) + 1000;
      const timer = setTimeout(() => this.releaseStuck(player.guildId, false), timeout);
      timer.unref();
      this.stuckCleanup.set(player.guildId, { done, release, timer });
    });
    client.on('queueEnd', (player, _track, payload) => {
      if (
        payload.type === 'TrackStuckEvent' ||
        (payload.type === 'TrackEndEvent' && payload.reason === 'stopped')
      )
        this.releaseStuck(player.guildId, true);
    });
    client.on('playerDestroy', (player) => this.releaseStuck(player.guildId, false));
  }

  private releaseStuck(guildId: string, completed: boolean): void {
    const pending = this.stuckCleanup.get(guildId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.stuckCleanup.delete(guildId);
    pending.release(completed);
  }
  private async waitForStuckCleanup(guildId: string): Promise<void> {
    const pending = this.stuckCleanup.get(guildId);
    if (pending && !(await pending.done))
      throw new MusicError('NODE_UNAVAILABLE', 'The audio server is reconnecting.');
  }

  private node(preferred?: string | null): LavalinkNode {
    const requested = preferred ? this.client.nodeManager.getNode(preferred) : undefined;
    const node =
      requested?.connected && requested.sessionId && requested.info
        ? requested
        : this.client.nodeManager
            .leastUsedNodes('players')
            .find((candidate) => candidate.connected && candidate.sessionId && candidate.info);
    if (!node)
      throw new MusicError(
        'NODE_UNAVAILABLE',
        'The audio server is reconnecting. Please try again shortly.',
      );
    return node;
  }
  async load(identifier: string, nodeId?: string | null): Promise<LoadResult> {
    try {
      const result = await this.node(nodeId).search({ query: identifier }, null, false);
      if (result.loadType === 'error')
        throw new MusicError('UNAVAILABLE', 'This track or playlist is unavailable.');
      const tracks = result.tracks.map(fromClientTrack);
      return {
        kind:
          result.loadType === 'playlist'
            ? 'playlist'
            : result.loadType === 'search'
              ? 'search'
              : tracks.length
                ? 'track'
                : 'empty',
        name: result.playlist?.name ?? 'Search results',
        tracks,
      };
    } catch (error) {
      if (error instanceof MusicError) throw error;
      throw new MusicError('UNAVAILABLE', 'The audio source could not be loaded.');
    }
  }
  async connect(snapshot: QueueSnapshot): Promise<NodeIdentity> {
    const node = this.node(snapshot.nodeId);
    const player =
      this.client.getPlayer(snapshot.guildId) ??
      this.client.createPlayer({
        guildId: snapshot.guildId,
        voiceChannelId: snapshot.voiceChannelId,
        ...(snapshot.textChannelId ? { textChannelId: snapshot.textChannelId } : {}),
        node,
        volume: snapshot.volume,
        selfDeaf: true,
        selfMute: false,
      });
    if (player.voiceChannelId !== snapshot.voiceChannelId)
      await player.changeVoiceState({ voiceChannelId: snapshot.voiceChannelId, selfDeaf: true });
    else await player.connect();
    const deadline = Date.now() + 15_000;
    while (!player.voice.token || !player.voice.sessionId || !player.voice.endpoint) {
      if (Date.now() >= deadline)
        throw new MusicError(
          'UNAVAILABLE',
          'Voice connection timed out. Check Connect and Speak permissions.',
        );
      await new Promise<void>((ready) => setTimeout(ready, 100));
    }
    return this.identity(snapshot.guildId);
  }
  async play(guildId: string, track: PlayableTrack, options: PlaybackOptions): Promise<void> {
    await this.waitForStuckCleanup(guildId);
    const player = this.requirePlayer(guildId);
    // The SDK may expose the current track for diagnostics; all upcoming entries stay in our queue.
    player.queue.current = {
      ...toClientTrack(track),
      userData: { playbackId: options.playbackId },
    };
    try {
      await player.node.updatePlayer({
        guildId,
        noReplace: false,
        playerOptions: {
          track: { encoded: track.encoded, userData: { playbackId: options.playbackId } },
          position: options.positionMs,
          paused: options.paused,
          volume: options.volume,
          filters: clientFilters(options.filters),
          voice: player.voice,
        },
      });
    } catch {
      throw new MusicError(
        'NODE_UNAVAILABLE',
        'The audio server could not start playback. Your queue is saved.',
      );
    }
    player.lastPosition = options.positionMs;
    player.lastPositionChange = Date.now();
    player.paused = options.paused;
    player.playing = !options.paused;
  }
  async stop(guildId: string): Promise<void> {
    await this.waitForStuckCleanup(guildId);
    const player = this.client.getPlayer(guildId);
    if (player?.node.connected)
      await player.node.updatePlayer({ guildId, playerOptions: { track: { encoded: null } } });
    if (player) {
      player.queue.current = null;
      player.playing = false;
      player.paused = false;
      player.lastPosition = 0;
    }
  }
  async destroy(guildId: string): Promise<void> {
    await this.client.getPlayer(guildId)?.destroy('Requested disconnect');
  }
  async pause(guildId: string, paused: boolean): Promise<void> {
    const player = this.requirePlayer(guildId);
    await player.node.updatePlayer({ guildId, playerOptions: { paused } });
    player.paused = paused;
    player.playing = !paused;
  }
  async seek(guildId: string, positionMs: number): Promise<void> {
    await this.requirePlayer(guildId).node.updatePlayer({
      guildId,
      playerOptions: { position: positionMs },
    });
  }
  async volume(guildId: string, volume: number): Promise<void> {
    await this.requirePlayer(guildId).node.updatePlayer({ guildId, playerOptions: { volume } });
  }
  async filters(guildId: string, filters: AudioFilters): Promise<void> {
    await this.requirePlayer(guildId).node.updatePlayer({
      guildId,
      playerOptions: { filters: clientFilters(filters) },
    });
  }
  async sponsorBlock(guildId: string, enabled: boolean): Promise<void> {
    const player = this.requirePlayer(guildId);
    if (enabled) await player.setSponsorBlock(['sponsor', 'selfpromo', 'interaction']);
    else if (player.node.info?.plugins.some((plugin) => plugin.name === 'sponsorblock-plugin'))
      await player.deleteSponsorBlock();
  }
  identity(guildId: string): NodeIdentity {
    const player = this.client.getPlayer(guildId);
    return { nodeId: player?.node.id ?? null, sessionId: player?.node.sessionId ?? null };
  }
  position(guildId: string): number | null {
    const player = this.client.getPlayer(guildId);
    return player?.node.connected && Number.isFinite(player.position)
      ? Math.max(0, Math.round(player.position))
      : null;
  }
  async migrate(guildId: string, excludedNodeId: string): Promise<NodeIdentity | null> {
    const player = this.client.getPlayer(guildId);
    const target = this.client.nodeManager
      .leastUsedNodes('players')
      .find((node) => node.id !== excludedNodeId && node.connected && node.sessionId);
    if (!player || !target) return null;
    await player.changeNode(target, false);
    return this.identity(guildId);
  }
  private requirePlayer(guildId: string) {
    const player = this.client.getPlayer(guildId);
    if (!player) throw new MusicError('NO_PLAYER', 'Join a voice channel and play a track first.');
    if (!player.node.connected)
      throw new MusicError('NODE_UNAVAILABLE', 'The audio server is reconnecting.');
    return player;
  }

  /** Call AFTER PlayerManager.close(). Remove local SDK state before destroying sockets,
   * so the SDK cannot send DELETE requests for remote players we want to resume. */
  close(): void {
    for (const guildId of this.stuckCleanup.keys()) this.releaseStuck(guildId, false);
    this.client.players.clear();
    for (const node of [...this.client.nodeManager.nodes.values()]) node.destroy('BotShutdown');
  }
}

/** In 2.11.0 `connect` can precede the v4 ready payload. Session PATCH/recovery needs both. */
export function observeNodeReady(
  client: LavalinkManager,
  ready: (node: LavalinkNode) => Promise<void>,
  failed: (nodeId: string) => void,
): () => void {
  const status = new Map<
    string,
    { node: LavalinkNode; sessionId: string | null; info: boolean; fired: boolean }
  >();
  const state = (node: LavalinkNode) => {
    let value = status.get(node.id);
    if (!value) {
      value = { node, sessionId: null, info: false, fired: false };
      status.set(node.id, value);
    }
    return value;
  };
  const dispatch = (node: LavalinkNode) => {
    const value = state(node);
    if (
      value.fired ||
      !value.info ||
      !value.sessionId ||
      node.sessionId !== value.sessionId ||
      !node.connected
    )
      return;
    value.fired = true;
    void ready(node).catch(() => failed(node.id));
  };
  const connect = (node: LavalinkNode) => {
    state(node).info = node.info !== null;
    dispatch(node);
  };
  const raw = (node: LavalinkNode, payload: unknown) => {
    if (
      typeof payload !== 'object' ||
      !payload ||
      !('op' in payload) ||
      payload.op !== 'ready' ||
      !('sessionId' in payload) ||
      typeof payload.sessionId !== 'string'
    )
      return;
    const sessionId = payload.sessionId;
    // SDK assigns sessionId immediately after emitting raw; defer until that assignment completes.
    queueMicrotask(() => {
      state(node).sessionId = sessionId;
      dispatch(node);
    });
  };
  const disconnect = (node: LavalinkNode) => {
    status.delete(node.id);
  };
  client.nodeManager.on('connect', connect);
  client.nodeManager.on('raw', raw);
  client.nodeManager.on('disconnect', disconnect);
  return () => {
    client.nodeManager.off('connect', connect);
    client.nodeManager.off('raw', raw);
    client.nodeManager.off('disconnect', disconnect);
    status.clear();
  };
}

/** Identity comes from the event payload, never the mutable SDK queue after a rapid skip. */
export function trackEvent(
  payload: TrackStartEvent | TrackEndEvent | TrackExceptionEvent | TrackStuckEvent,
): TrackEvent {
  const id: unknown = payload.track.userData?.['playbackId'];
  return {
    guildId: payload.guildId,
    playbackId: typeof id === 'string' ? id : null,
    encoded: payload.track.encoded ?? null,
    type:
      payload.type === 'TrackStartEvent'
        ? 'start'
        : payload.type === 'TrackEndEvent'
          ? 'end'
          : payload.type === 'TrackStuckEvent'
            ? 'stuck'
            : 'error',
    reason: payload.type === 'TrackEndEvent' ? payload.reason : null,
  };
}

export function toClientTrack(track: PlayableTrack): Track {
  return {
    encoded: track.encoded,
    info: {
      identifier: track.identifier,
      title: track.title,
      author: track.artist,
      sourceName: track.source as Track['info']['sourceName'],
      uri: track.uri ?? '',
      duration: track.durationMs,
      isStream: track.isStream,
      isSeekable: track.isSeekable,
      artworkUrl: track.artworkUrl,
      isrc: track.isrc,
    },
    pluginInfo: {},
  };
}

function clientFilters(filters: AudioFilters): Partial<LavalinkFilterData> {
  return {
    ...(filters.equalizer ? { equalizer: filters.equalizer } : {}),
    ...(filters.timescale ? { timescale: filters.timescale } : {}),
    ...(filters.karaoke ? { karaoke: filters.karaoke } : {}),
    ...(filters.tremolo ? { tremolo: filters.tremolo } : {}),
    ...(filters.vibrato ? { vibrato: filters.vibrato } : {}),
    ...(filters.rotation ? { rotation: filters.rotation } : {}),
    ...(filters.lowPass ? { lowPass: filters.lowPass } : {}),
    ...(filters.channelMix ? { channelMix: filters.channelMix } : {}),
  };
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/LyricsService.ts

````typescript
import type { LavalinkManager } from 'lavalink-client';
import type { StoredTrack, PlayableTrack } from '../db/models.js';
import type { Cache } from '../cache/Cache.js';
import { SafeHttpClient } from '../security/SafeHttpClient.js';
import { object, string } from './CatalogClient.js';
import { toClientTrack } from './LavalinkTransport.js';
import { createHash } from 'node:crypto';
import { z } from 'zod';

const lyricsSchema = z.object({
  text: z.string().max(100_000),
  provider: z.string().max(100),
  lines: z
    .array(z.object({ timestampMs: z.number().min(0), text: z.string().max(1000) }))
    .max(5000),
});
export type Lyrics = z.infer<typeof lyricsSchema>;
export class LyricsService {
  constructor(
    private readonly lavalink: LavalinkManager,
    private readonly cache: Cache,
    private readonly http = new SafeHttpClient(),
  ) {}
  async get(
    guildId: string,
    track: StoredTrack,
    playable: PlayableTrack | null,
  ): Promise<Lyrics | null> {
    const key = `lyrics:${createHash('sha256').update(track.key).digest('hex')}`;
    const cached = lyricsSchema.safeParse(await this.cache.get(key));
    if (cached.success) return cached.data;
    const player = this.lavalink.getPlayer(guildId);
    if (player && playable) {
      try {
        const result = await player.getLyrics(toClientTrack(playable));
        if (result) {
          const lyrics = lyricsSchema.parse({
            text: result.text ?? result.lines.map((line) => line.line).join('\n'),
            provider: result.provider,
            lines: result.lines.map((line) => ({ timestampMs: line.timestamp, text: line.line })),
          });
          if (lyrics.text) {
            await this.cache.set(key, lyrics, 3600);
            return lyrics;
          }
        }
      } catch {
        /* Optional plugin/provider; use the text fallback. */
      }
    }
    try {
      const response = object(
        await this.http.json(
          `https://api.lyrics.ovh/v1/${encodeURIComponent(track.artist)}/${encodeURIComponent(track.title)}`,
          { maxBytes: 200_000, timeoutMs: 10_000, allowedOrigin: 'https://api.lyrics.ovh' },
        ),
      );
      const text = string(response['lyrics']);
      if (!text) return null;
      const lyrics = lyricsSchema.parse({ text, provider: 'lyrics.ovh', lines: [] });
      await this.cache.set(key, lyrics, 3600);
      return lyrics;
    } catch {
      return null;
    }
  }
}

export function parseSyncedLyrics(input: string): Lyrics['lines'] {
  const lines: Lyrics['lines'] = [];
  for (const line of input.split(/\r?\n/)) {
    const text = line.replace(/\[\d+:\d{2}(?:\.\d{1,3})?\]/g, '').trim();
    for (const match of line.matchAll(/\[(\d+):(\d{2})(?:\.(\d{1,3}))?\]/g)) {
      if (Number(match[2]) >= 60) continue;
      lines.push({
        timestampMs:
          Number(match[1]) * 60_000 +
          Number(match[2]) * 1000 +
          Number((match[3] ?? '').padEnd(3, '0')),
        text: text.slice(0, 1000),
      });
      if (lines.length >= 5000) return lines.sort((a, b) => a.timestampMs - b.timestampMs);
    }
  }
  return lines.sort((a, b) => a.timestampMs - b.timestampMs);
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/MirrorMatcher.ts

````typescript
import type { StoredTrack } from '../db/models.js';
import type { RawTrack } from './types.js';
import { isPreview, normalizeIsrc, normalizeSource } from './TrackCodec.js';

export interface MirrorScore {
  candidate: RawTrack;
  score: number;
  exactIsrc: boolean;
  durationDifferenceMs: number;
}
const variants = [
  /\blive\b/i,
  /\bremix\b/i,
  /\bcover\b/i,
  /\bsped[ -]?up\b/i,
  /\bslowed\b/i,
  /\bnightcore\b/i,
  /\bkaraoke\b/i,
  /\binstrumental\b/i,
  /\b(?:8d|bass[ -]?boosted)\b/i,
  /\b(?:reverb|acoustic)\b/i,
];

export function normalizeMusicText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\b(?:official|audio|video|lyrics?|visuali[sz]er|hd|hq|topic|vevo)\b/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
export function textSimilarity(first: string, second: string): number {
  const a = new Set(normalizeMusicText(first).split(' ').filter(Boolean));
  const b = new Set(normalizeMusicText(second).split(' ').filter(Boolean));
  if (!a.size || !b.size) return 0;
  const overlap = [...a].filter((word) => b.has(word)).length;
  return (2 * overlap) / (a.size + b.size);
}

export class MirrorMatcher {
  score(original: StoredTrack, candidate: RawTrack): MirrorScore | null {
    let source: string;
    try {
      source = normalizeSource(candidate.source);
    } catch {
      return null;
    }
    if (
      !['youtube', 'soundcloud'].includes(source) ||
      isPreview(candidate) ||
      candidate.isStream ||
      original.isStream ||
      !candidate.encoded ||
      candidate.durationMs <= 0 ||
      original.durationMs <= 0
    )
      return null;
    const difference = Math.abs(candidate.durationMs - original.durationMs);
    if (!Number.isFinite(difference) || difference > 10_000) return null;
    if (
      variants.some(
        (pattern) =>
          (pattern.test(candidate.title) ||
            (pattern.test(candidate.artist) && !pattern.test(original.artist))) &&
          !pattern.test(original.title),
      )
    )
      return null;
    const exactIsrc = Boolean(original.isrc && normalizeIsrc(candidate.isrc) === original.isrc);
    const title = textSimilarity(original.title, candidate.title);
    const artist = Math.max(
      textSimilarity(original.artist, candidate.artist),
      textSimilarity(original.artist, candidate.title),
    );
    // A shared duration alone is never enough to make a match.
    if (!exactIsrc && (title < 0.5 || artist < 0.4)) return null;
    let score = title * 45 + artist * 30 + (1 - difference / 10_000) * 10;
    if (exactIsrc) score += 100;
    if (/\btopic\b|vevo$/i.test(candidate.artist)) score += 12;
    if (/\bofficial (?:audio|video)\b/i.test(candidate.title)) score += 7;
    if (source === 'youtube') score += 3;
    return { candidate, score, exactIsrc, durationDifferenceMs: difference };
  }
  rank(original: StoredTrack, candidates: readonly RawTrack[]): MirrorScore[] {
    return candidates
      .map((candidate) => this.score(original, candidate))
      .filter((score): score is MirrorScore => score !== null)
      .sort((a, b) => b.score - a.score || a.durationDifferenceMs - b.durationDifferenceMs);
  }
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/PlayerManager.ts

````typescript
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { Logger } from 'pino';
import type { Env } from '../../config/env.js';
import type { Repositories } from '../db/contracts.js';
import { queueSnapshotSchema, requesterSchema } from '../db/models.js';
import type {
  AudioFilters,
  GuildSettings,
  HistoryEndReason,
  LoopMode,
  PendingImport,
  QueueEntry,
  QueueSnapshot,
  Requester,
  SnapshotRecord,
} from '../db/models.js';
import { AsyncLock } from '../utils/AsyncLock.js';
import { MusicError, errorCode } from '../utils/errors.js';
import { QueueManager, createQueueEntry } from './QueueManager.js';
import type { SourceResolver } from './SourceResolver.js';
import type { AutoplayEngine } from './AutoplayEngine.js';
import { ImportScheduler } from './ImportScheduler.js';
import { validateFilters } from './FilterPresets.js';
import { catalogSources } from './TrackCodec.js';
import type { AudioTransport, ResolvedItem, TrackEvent } from './types.js';

interface EngineEvents {
  changed: [snapshot: QueueSnapshot];
  trackStart: [snapshot: QueueSnapshot];
  trackEnd: [snapshot: QueueSnapshot, reason: HistoryEndReason];
  queueEnd: [snapshot: QueueSnapshot];
  notice: [guildId: string, message: string];
  importProgress: [guildId: string, importId: string, enqueued: number, total: number | null];
  destroyed: [guildId: string];
}
interface Session {
  state: QueueSnapshot;
  queue: QueueManager;
  settings: GuildSettings;
  version: SnapshotRecord | null;
  lock: AsyncLock;
  closed: boolean;
  online: boolean;
  playing: boolean;
  positionAt: number;
  pump: Promise<void> | null;
  wake: boolean;
  resolution: AbortController | null;
  prefetching: Set<string>;
  prefetchFailed: Set<string>;
  workAbort: AbortController;
  excluded: Set<string>;
  retries: number;
  emptyVoice: boolean;
  idleTimer: ReturnType<typeof setTimeout> | null;
}
export interface ImportResult {
  id: string;
  name: string;
  enqueued: number;
  total: number | null;
  background: boolean;
}
interface ImportWaiter {
  first: Promise<ImportResult>;
  resolve: (result: ImportResult) => void;
  reject: (error: MusicError) => void;
  name: string;
  count: number;
  total: number | null;
  settled: boolean;
  replaceCurrent: boolean;
}

/** Every session is scoped to this bot account + guild; all mutations/checkpoints are serialized. */
export class PlayerManager extends EventEmitter<EngineEvents> {
  private readonly sessions = new Map<string, Session>();
  private readonly joins = new Map<string, AsyncLock>();
  private readonly waiters = new Map<string, ImportWaiter>();
  private readonly imports: ImportScheduler;
  private readonly background = new Set<Promise<void>>();
  private checkpointTimer: ReturnType<typeof setInterval> | null = null;
  private closing = false;
  constructor(
    public readonly botId: string,
    private readonly env: Pick<
      Env,
      'MAX_PLAYLIST_IMPORT' | 'IMPORT_CONCURRENCY' | 'SPONSORBLOCK_ENABLED'
    >,
    private readonly repositories: Repositories,
    public readonly transport: AudioTransport,
    public readonly resolver: SourceResolver,
    private readonly autoplay: AutoplayEngine,
    private readonly logger: Logger,
  ) {
    super();
    this.imports = new ImportScheduler(resolver, env.IMPORT_CONCURRENCY);
  }

  get size(): number {
    return [...this.sessions.values()].filter((session) => !session.closed).length;
  }
  guildIds(): string[] {
    return [...this.sessions.keys()];
  }
  offlineNodeIds(): string[] {
    return [
      ...new Set(
        [...this.sessions.values()]
          .filter((session) => !session.closed && !session.online)
          .map((session) => session.state.nodeId)
          .filter((id): id is string => id !== null),
      ),
    ];
  }
  view(guildId: string): QueueSnapshot | null {
    const session = this.sessions.get(guildId);
    return session && !session.closed ? this.snapshot(session) : null;
  }
  startCheckpoints(): void {
    if (this.checkpointTimer) return;
    this.checkpointTimer = setInterval(() => this.watch(this.checkpointAll()), 10_000);
    this.checkpointTimer.unref();
  }

  async join(
    guildId: string,
    voiceChannelId: string,
    textChannelId: string | null,
  ): Promise<QueueSnapshot> {
    if (this.closing) throw new MusicError('UNAVAILABLE', 'The bot is restarting.');
    let lock = this.joins.get(guildId);
    if (!lock) {
      lock = new AsyncLock();
      this.joins.set(guildId, lock);
    }
    return lock.run(async () => {
      const existing = this.sessions.get(guildId);
      if (existing) {
        if (existing.closed)
          throw new MusicError(
            'CONFLICT',
            'Another process changed this player. Restart this bot process before recovering it.',
          );
        if (existing.state.voiceChannelId !== voiceChannelId)
          throw new MusicError(
            'CONFLICT',
            'The bot is already playing in another voice channel. Use move to bring it here.',
          );
        return this.snapshot(existing);
      }
      const settings = await this.repositories.guildSettings.get(guildId);
      const record = await this.repositories.queueSnapshots.load(this.botId, guildId);
      if (record) {
        if (record.snapshot.voiceChannelId !== voiceChannelId)
          throw new MusicError(
            'CONFLICT',
            'A saved player belongs to another voice channel. Restore or disconnect it first.',
          );
        return this.restore(record);
      }
      const state = queueSnapshotSchema.parse({
        version: 1,
        botId: this.botId,
        guildId,
        voiceChannelId,
        textChannelId,
        nodeId: null,
        nodeSessionId: null,
        current: null,
        currentPlaybackId: null,
        upcoming: [],
        previous: [],
        positionMs: 0,
        paused: false,
        volume: settings.defaultVolume,
        loopMode: 'off',
        autoplay: settings.autoplayEnabled,
        filters: {},
        pendingImports: [],
      });
      const session = this.createSession(state, settings, null);
      try {
        const node = await this.transport.connect(state);
        session.state.nodeId = node.nodeId;
        session.state.nodeSessionId = node.sessionId;
        await this.persist(session);
        this.sessions.set(guildId, session);
        await this.configureSponsor(session);
        this.scheduleIdle(session);
        return this.snapshot(session);
      } catch (error) {
        session.closed = true;
        await this.transport.destroy(guildId).catch(() => undefined);
        throw error;
      }
    });
  }

  async restore(record: SnapshotRecord): Promise<QueueSnapshot> {
    const existing = this.sessions.get(record.guildId);
    if (existing) {
      if (existing.closed)
        throw new MusicError('CONFLICT', 'Another process owns a newer player snapshot.');
      return this.snapshot(existing);
    }
    if (record.botId !== this.botId)
      throw new MusicError('CONFLICT', 'The saved queue belongs to another bot.');
    const settings = await this.repositories.guildSettings.get(record.guildId);
    const state = structuredClone(record.snapshot);
    // Re-resolve saved encodings, especially HTTP sources. The cached file UUID remains authoritative.
    if (state.current) state.current.playable = null;
    for (const entry of state.upcoming) entry.playable = null;
    const session = this.createSession(state, settings, record);
    const node = await this.transport.connect(state);
    session.state.nodeId = node.nodeId;
    session.state.nodeSessionId = node.sessionId;
    await this.persist(session);
    this.sessions.set(record.guildId, session);
    await this.configureSponsor(session);
    for (const job of state.pendingImports) this.startImport(session, job);
    this.kick(session);
    this.prefetch(session);
    return this.snapshot(session);
  }

  async enqueue(
    guildId: string,
    items: readonly ResolvedItem[],
    requester: Requester,
    mode: 'append' | 'next' | 'now' = 'append',
  ): Promise<number> {
    const session = this.require(guildId);
    requesterSchema.parse(requester);
    await this.locked(session, async () => {
      const entries = items.map((item) => {
        this.validateLength(session, item.track.durationMs, item.track.isStream);
        return createQueueEntry(item.track, requester, item.playable);
      });
      this.assertCapacity(
        session,
        entries.length - Number(mode === 'now' && Boolean(session.state.current)),
      );
      if (mode === 'now' && entries.length) await this.retire(session, 'replaced');
      session.queue.add(entries, mode === 'append' ? session.queue.size + 1 : 1);
      await this.persist(session);
      this.changed(session);
    });
    this.kick(session);
    this.prefetch(session);
    return items.length;
  }

  async enqueueQuery(
    guildId: string,
    query: string,
    requester: Requester,
    mode: 'append' | 'next' | 'now' = 'append',
  ): Promise<ImportResult> {
    const session = this.require(guildId);
    requesterSchema.parse(requester);
    // Validate without contacting providers; the scheduler also validates before loading.
    if (!query.trim() || query.length > 4096)
      throw new MusicError('INVALID_INPUT', 'Provide a music title or link.');
    const job = await this.locked(session, async () => {
      if (session.state.pendingImports.length >= 10)
        throw new MusicError('QUEUE_FULL', 'Wait for an existing playlist import to finish.');
      const available =
        session.settings.maxQueueSize -
        session.queue.size -
        Number(mode !== 'now' && Boolean(session.state.current));
      if (available < 1) throw new MusicError('QUEUE_FULL', 'The queue is full.');
      const pending: PendingImport = {
        id: randomUUID(),
        query: query.trim(),
        requester: structuredClone(requester),
        mode: mode === 'append' ? 'append' : 'next',
        processedCount: 0,
        limit: Math.min(this.env.MAX_PLAYLIST_IMPORT, available),
        enqueuedKeys: [],
        createdAt: Date.now(),
      };
      session.state.pendingImports.push(pending);
      await this.persist(session);
      return pending;
    });
    const waiter = this.makeWaiter(mode === 'now');
    this.waiters.set(job.id, waiter);
    this.startImport(session, job);
    return waiter.first;
  }

  async mutateQueue<T>(guildId: string, operation: (queue: QueueManager) => T): Promise<T> {
    const session = this.require(guildId);
    const value = await this.locked(session, async () => {
      const before = session.queue.view();
      try {
        const result = operation(session.queue);
        await this.persist(session);
        this.changed(session);
        return result;
      } catch (error) {
        session.queue = new QueueManager(
          before,
          Math.max(session.settings.maxQueueSize, before.length),
        );
        session.queue.setMaximum(session.settings.maxQueueSize);
        throw error;
      }
    });
    this.kick(session);
    this.prefetch(session);
    return value;
  }

  async pause(guildId: string, paused: boolean): Promise<void> {
    const session = this.require(guildId);
    await this.locked(session, async () => {
      this.requireCurrent(session);
      this.capturePosition(session);
      await this.transport.pause(guildId, paused);
      session.state.paused = paused;
      session.positionAt = Date.now();
      await this.persist(session);
      this.changed(session);
    });
  }
  async seek(guildId: string, positionMs: number): Promise<void> {
    const session = this.require(guildId);
    await this.locked(session, () => this.seekLocked(session, positionMs));
  }
  async seekRelative(guildId: string, offsetMs: number): Promise<void> {
    const session = this.require(guildId);
    await this.locked(session, () => {
      const current = this.requireCurrent(session);
      return this.seekLocked(
        session,
        Math.max(
          0,
          Math.min(
            this.position(session) + offsetMs,
            (current.playable?.durationMs ?? current.track.durationMs) - 1,
          ),
        ),
      );
    });
  }

  async skip(guildId: string, count = 1): Promise<void> {
    const session = this.require(guildId);
    session.resolution?.abort();
    await this.locked(session, async () => {
      this.requireCurrent(session);
      if (!Number.isInteger(count) || count < 1 || count > session.queue.size + 1)
        throw new MusicError('INVALID_INPUT', 'That skip count exceeds the queue.');
      await this.retire(session, 'skipped');
      for (let index = 1; index < count; index++) session.queue.take();
      await this.persist(session);
      this.changed(session);
    });
    this.kick(session);
  }
  async skipTo(guildId: string, position: number): Promise<void> {
    const session = this.require(guildId);
    if (!Number.isInteger(position) || position < 1 || position > session.queue.size)
      throw new MusicError('INVALID_INPUT', 'That queue position does not exist.');
    if (session.state.current) await this.skip(guildId, position);
    else {
      await this.mutateQueue(guildId, (queue) => {
        for (let index = 1; index < position; index++) queue.take();
      });
    }
  }
  async replay(guildId: string): Promise<void> {
    const session = this.require(guildId);
    session.resolution?.abort();
    await this.locked(session, async () => {
      const current = structuredClone(this.requireCurrent(session));
      await this.retire(session, 'replaced');
      session.state.current = current;
      session.state.currentPlaybackId = randomUUID();
      session.state.positionMs = 0;
      session.state.paused = false;
      await this.persist(session);
    });
    this.kick(session);
  }
  async previous(guildId: string): Promise<void> {
    const session = this.require(guildId);
    session.resolution?.abort();
    await this.locked(session, async () => {
      const previous = session.state.previous[0];
      if (!previous) throw new MusicError('NOT_FOUND', 'There is no previous track.');
      this.assertCapacity(session, 1);
      session.state.previous.shift();
      const current = session.state.current ? structuredClone(session.state.current) : null;
      if (current) {
        await this.retire(session, 'replaced', false);
        current.id = randomUUID();
        session.queue.add([current], 1, false);
      }
      previous.id = randomUUID();
      session.state.current = previous;
      session.state.currentPlaybackId = randomUUID();
      session.state.positionMs = 0;
      session.state.paused = false;
      await this.persist(session);
    });
    this.kick(session);
  }

  async stop(guildId: string): Promise<void> {
    const session = this.require(guildId);
    session.resolution?.abort();
    await this.locked(session, async () => {
      this.cancelImports(session);
      await this.retire(session, 'stopped');
      session.prefetchFailed.clear();
      session.queue.clear(false);
      session.state.loopMode = 'off';
      session.state.autoplay = false;
      await this.persist(session);
      this.changed(session);
      this.scheduleIdle(session);
    });
  }
  async leave(guildId: string): Promise<void> {
    const session = this.sessions.get(guildId);
    if (!session) {
      const record = await this.repositories.queueSnapshots.load(this.botId, guildId);
      if (record) await this.repositories.queueSnapshots.delete(this.botId, guildId, record);
      await this.transport.destroy(guildId);
      return;
    }
    session.resolution?.abort();
    await this.locked(session, async () => {
      session.closed = true;
      session.workAbort.abort();
      this.cancelIdle(session);
      this.cancelImports(session);
      if (session.state.currentPlaybackId)
        await this.repositories.history.finish(session.state.currentPlaybackId, 'stopped');
      await this.transport
        .destroy(guildId)
        .catch(() => this.logger.warn({ guildId }, 'Audio disconnect failed.'));
      if (session.version)
        await this.repositories.queueSnapshots.delete(this.botId, guildId, session.version);
      this.sessions.delete(guildId);
      this.joins.delete(guildId);
      this.emit('destroyed', guildId);
    });
  }
  async moveVoice(
    guildId: string,
    voiceChannelId: string,
    textChannelId: string | null,
  ): Promise<void> {
    const session = this.require(guildId);
    await this.locked(session, async () => {
      const candidate = this.snapshot(session);
      candidate.voiceChannelId = voiceChannelId;
      candidate.textChannelId = textChannelId;
      const node = await this.transport.connect(candidate);
      session.state.voiceChannelId = voiceChannelId;
      session.state.textChannelId = textChannelId;
      session.state.nodeId = node.nodeId;
      session.state.nodeSessionId = node.sessionId;
      session.emptyVoice = false;
      this.cancelIdle(session);
      await this.persist(session);
      this.changed(session);
    });
  }

  async volume(guildId: string, volume: number): Promise<void> {
    if (!Number.isInteger(volume) || volume < 1 || volume > 200)
      throw new MusicError('INVALID_INPUT', 'Volume must be between 1 and 200.');
    const session = this.require(guildId);
    await this.locked(session, async () => {
      await this.transport.volume(guildId, volume);
      session.settings = await this.repositories.guildSettings.update(guildId, {
        defaultVolume: volume,
      });
      session.state.volume = volume;
      await this.persist(session);
      this.changed(session);
    });
  }
  async filters(guildId: string, filters: AudioFilters): Promise<void> {
    const parsed = validateFilters(filters);
    const session = this.require(guildId);
    await this.locked(session, async () => {
      this.capturePosition(session);
      await this.transport.filters(guildId, parsed);
      session.state.filters = parsed;
      session.positionAt = Date.now();
      await this.persist(session);
      this.changed(session);
    });
  }
  async loop(guildId: string, mode: LoopMode): Promise<void> {
    if (!['off', 'track', 'queue'].includes(mode))
      throw new MusicError('INVALID_INPUT', 'Loop mode must be off, track, or queue.');
    const session = this.require(guildId);
    await this.locked(session, async () => {
      session.state.loopMode = mode;
      await this.persist(session);
      this.changed(session);
    });
  }
  async setAutoplay(guildId: string, enabled: boolean): Promise<void> {
    const session = this.require(guildId);
    await this.locked(session, async () => {
      session.settings = await this.repositories.guildSettings.update(guildId, {
        autoplayEnabled: enabled,
      });
      session.state.autoplay = enabled;
      await this.persist(session);
      this.changed(session);
    });
    if (enabled) this.kick(session);
  }
  async refreshSettings(guildId: string): Promise<void> {
    const session = this.sessions.get(guildId);
    if (!session) return;
    await this.locked(session, async () => {
      session.settings = await this.repositories.guildSettings.get(guildId);
      session.queue.setMaximum(session.settings.maxQueueSize);
      await this.configureSponsor(session);
      this.scheduleIdle(session);
    });
  }
  setVoiceOccupancy(guildId: string, humans: number): void {
    const session = this.sessions.get(guildId);
    if (!session) return;
    session.emptyVoice = humans === 0;
    this.scheduleIdle(session);
  }

  /** Called by Phase 6 event adapters, with IDs from Lavalink's original event payload. */
  async onTrackEvent(event: TrackEvent): Promise<void> {
    const session = this.sessions.get(event.guildId);
    if (!session || session.closed) return;
    await this.locked(session, async () => {
      if (
        !session.state.current ||
        !event.playbackId ||
        event.playbackId !== session.state.currentPlaybackId
      )
        return;
      if (event.type === 'start') {
        this.emit('trackStart', this.snapshot(session));
        return;
      }
      if (event.type === 'end' && ['replaced', 'stopped', 'cleanup'].includes(event.reason ?? ''))
        return;
      if (event.type === 'error' || event.type === 'stuck' || event.reason === 'loadFailed') {
        await this.retryOrAdvance(session, event.encoded);
        return;
      }
      if (event.type !== 'end' || event.reason !== 'finished') return;
      const finished = structuredClone(session.state.current);
      await this.retire(session, 'finished', true, false);
      if (session.state.loopMode === 'track') {
        finished.id = randomUUID();
        session.state.current = finished;
        session.state.currentPlaybackId = randomUUID();
      } else if (session.state.loopMode === 'queue') {
        finished.id = randomUUID();
        if (session.queue.size < session.settings.maxQueueSize)
          session.queue.add([finished], session.queue.size + 1, false);
        else
          this.emit(
            'notice',
            session.state.guildId,
            'The lowered queue limit prevented re-adding the looped track.',
          );
      }
      await this.persist(session);
    });
    this.kick(session);
    this.prefetch(session);
  }

  /** Freeze the clock; keep the current track and queue intact while nodes reconnect. */
  async nodeDisconnected(nodeId: string): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.closed || session.state.nodeId !== nodeId) continue;
      session.resolution?.abort();
      await this.locked(session, async () => {
        this.capturePosition(session);
        session.online = false;
        session.playing = false;
        await this.persist(session);
        const replacement = await this.transport
          .migrate(session.state.guildId, nodeId)
          .catch(() => null);
        if (replacement) {
          session.state.nodeId = replacement.nodeId;
          session.state.nodeSessionId = replacement.sessionId;
          session.online = true;
          session.prefetchFailed.clear();
          if (session.state.current) session.state.current.playable = null;
          await this.persist(session);
        }
      });
      if (session.online) this.kick(session);
    }
  }
  async nodeConnected(nodeId: string, offlineOnly = false): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.closed || session.state.nodeId !== nodeId || (offlineOnly && session.online))
        continue;
      await this.locked(session, async () => {
        const node = await this.transport.connect(this.snapshot(session));
        session.state.nodeId = node.nodeId;
        session.state.nodeSessionId = node.sessionId;
        session.online = true;
        session.prefetchFailed.clear();
        session.playing = false;
        if (session.state.current) session.state.current.playable = null;
        await this.persist(session);
        await this.configureSponsor(session);
      });
      this.kick(session);
      this.prefetch(session);
    }
  }
  async updatePosition(guildId: string, positionMs: number): Promise<void> {
    const session = this.sessions.get(guildId);
    if (
      !session ||
      !session.state.current ||
      !session.online ||
      !session.playing ||
      !Number.isFinite(positionMs) ||
      positionMs < 0
    )
      return;
    await this.locked(session, () => {
      session.state.positionMs = Math.round(positionMs);
      session.positionAt = Date.now();
      return Promise.resolve();
    });
  }

  async checkpointAll(): Promise<void> {
    for (const session of this.sessions.values()) {
      if (!session.closed)
        await this.locked(session, async () => {
          this.capturePosition(session);
          await this.persist(session);
        });
    }
  }
  /** Save resumable state and cancel work; do not delete queues or destroy Lavalink sessions. */
  async close(): Promise<void> {
    this.closing = true;
    const resumable = [...this.sessions.values()].filter((session) => !session.closed);
    if (this.checkpointTimer) clearInterval(this.checkpointTimer);
    this.checkpointTimer = null;
    for (const session of this.sessions.values()) {
      session.closed = true;
      session.workAbort.abort();
      session.resolution?.abort();
      this.cancelIdle(session);
    }
    await this.imports.close();
    for (const waiter of this.waiters.values())
      if (!waiter.settled) {
        waiter.reject(
          new MusicError('UNAVAILABLE', 'The import will resume after the bot restarts.'),
        );
        waiter.settled = true;
      }
    await Promise.allSettled([...this.background]);
    for (const session of resumable)
      await session.lock.run(async () => {
        this.capturePosition(session);
        await this.persist(session);
      });
  }

  private createSession(
    state: QueueSnapshot,
    settings: GuildSettings,
    version: SnapshotRecord | null,
  ): Session {
    const queue = new QueueManager(
      state.upcoming,
      Math.max(settings.maxQueueSize, state.upcoming.length),
    );
    queue.setMaximum(settings.maxQueueSize);
    return {
      state,
      queue,
      settings,
      version,
      lock: new AsyncLock(),
      closed: false,
      online: true,
      playing: false,
      positionAt: Date.now(),
      pump: null,
      wake: false,
      resolution: null,
      prefetching: new Set(),
      prefetchFailed: new Set(),
      workAbort: new AbortController(),
      excluded: new Set(),
      retries: 0,
      emptyVoice: false,
      idleTimer: null,
    };
  }
  private snapshot(session: Session): QueueSnapshot {
    return {
      ...structuredClone(session.state),
      upcoming: session.queue.view(),
      positionMs: this.position(session),
    };
  }
  private position(session: Session): number {
    const elapsed =
      session.playing && session.online && !session.state.paused
        ? Date.now() - session.positionAt
        : 0;
    const scale = session.state.filters.timescale;
    const position = session.state.positionMs + elapsed * (scale?.speed ?? 1) * (scale?.rate ?? 1);
    const length =
      session.state.current?.playable?.durationMs ?? session.state.current?.track.durationMs ?? 0;
    return Math.round(
      Math.max(0, session.state.current?.track.isStream ? position : Math.min(position, length)),
    );
  }
  private capturePosition(session: Session): void {
    session.state.positionMs = this.position(session);
    session.positionAt = Date.now();
  }
  private async persist(session: Session): Promise<void> {
    const snapshot = this.snapshot(session);
    try {
      session.version = await this.repositories.queueSnapshots.save(snapshot, session.version);
    } catch (error) {
      // A different process owns a newer generation/revision. Stop this session from overwriting it.
      if (error instanceof Error && 'code' in error && error.code === 'STALE_SNAPSHOT') {
        session.closed = true;
        session.workAbort.abort();
        session.resolution?.abort();
        this.cancelIdle(session);
        this.logger.error({ guildId: snapshot.guildId }, 'Snapshot conflict; player suspended.');
      }
      throw error;
    }
  }
  private changed(session: Session): void {
    this.cancelIdle(session);
    this.emit('changed', this.snapshot(session));
    this.scheduleIdle(session);
  }
  private require(guildId: string): Session {
    const session = this.sessions.get(guildId);
    if (!session || session.closed)
      throw new MusicError('NO_PLAYER', 'Join a voice channel and play a track first.');
    return session;
  }
  private locked<T>(session: Session, operation: () => Promise<T>): Promise<T> {
    return session.lock.run(() => {
      if (session.closed) throw new MusicError('NO_PLAYER', 'This player has disconnected.');
      return operation();
    });
  }
  private requireCurrent(session: Session): QueueEntry {
    if (!session.state.current) throw new MusicError('NO_PLAYER', 'Nothing is playing.');
    return session.state.current;
  }
  private async seekLocked(session: Session, positionMs: number): Promise<void> {
    const current = this.requireCurrent(session);
    if (!current.playable?.isSeekable || current.playable.isStream)
      throw new MusicError('NOT_SEEKABLE', 'Live streams and this audio source cannot be seeked.');
    if (
      !Number.isInteger(positionMs) ||
      positionMs < 0 ||
      positionMs >= current.playable.durationMs
    )
      throw new MusicError('INVALID_INPUT', 'Choose a position within the current track.');
    await this.transport.seek(session.state.guildId, positionMs);
    session.state.positionMs = positionMs;
    session.positionAt = Date.now();
    await this.persist(session);
    this.changed(session);
  }
  private assertCapacity(session: Session, added: number): void {
    if (
      session.queue.size + Number(Boolean(session.state.current)) + added >
      session.settings.maxQueueSize
    )
      throw new MusicError('QUEUE_FULL', 'The server queue limit has been reached.');
  }
  private validateLength(session: Session, durationMs: number, isStream: boolean): void {
    if (
      !isStream &&
      (durationMs <= 0 || durationMs > session.settings.maxTrackLengthSeconds * 1000)
    )
      throw new MusicError(
        'INVALID_INPUT',
        'This track exceeds the server duration limit or has no known duration.',
      );
  }

  private kick(session: Session): void {
    if (session.closed || !session.online) return;
    if (session.pump) {
      session.wake = true;
      return;
    }
    const task = this.pump(session)
      .catch((error: unknown) => {
        this.logger.warn(
          { guildId: session.state.guildId, code: errorCode(error) },
          'Playback operation failed.',
        );
        this.emit(
          'notice',
          session.state.guildId,
          'Playback is temporarily unavailable. Your queue has been saved.',
        );
      })
      .finally(() => {
        session.pump = null;
        if (session.wake) {
          session.wake = false;
          this.kick(session);
        }
      });
    session.pump = task;
    this.watch(task);
  }
  private async pump(session: Session): Promise<void> {
    while (!session.closed && session.online) {
      const claim = await this.locked(session, async () => {
        if (session.closed || session.playing) return null;
        if (!session.state.current) {
          session.state.current = session.queue.take();
          if (session.state.current) session.prefetchFailed.delete(session.state.current.id);
          session.state.currentPlaybackId = session.state.current ? randomUUID() : null;
          session.state.positionMs = 0;
          session.state.paused = false;
        }
        if (!session.state.current) return null;
        session.state.currentPlaybackId ??= randomUUID();
        const controller = new AbortController();
        session.resolution = controller;
        await this.persist(session);
        return {
          entry: structuredClone(session.state.current),
          id: session.state.currentPlaybackId,
          nodeId: session.state.nodeId,
          controller,
        };
      });
      if (!claim) {
        if (!session.state.current && !session.closed) await this.queueEnded(session);
        return;
      }
      try {
        this.validateLength(session, claim.entry.track.durationMs, claim.entry.track.isStream);
        let playable = claim.entry.playable;
        if (
          !playable ||
          session.excluded.has(playable.encoded) ||
          (catalogSources.has(claim.entry.track.source) &&
            !this.resolver.validMirror(claim.entry.track, playable))
        ) {
          playable = await this.resolver.resolve(
            claim.entry.track,
            session.excluded,
            claim.nodeId,
            claim.controller.signal,
          );
        }
        this.validateLength(session, playable.durationMs, playable.isStream);
        claim.controller.signal.throwIfAborted();
        await this.locked(session, async () => {
          if (
            session.closed ||
            !session.online ||
            session.state.currentPlaybackId !== claim.id ||
            claim.controller.signal.aborted
          )
            return;
          const current = this.requireCurrent(session);
          current.playable = playable;
          await this.persist(session);
          await this.transport.play(session.state.guildId, playable, {
            playbackId: claim.id,
            positionMs:
              playable.isSeekable && !playable.isStream
                ? Math.min(session.state.positionMs, Math.max(0, playable.durationMs - 1))
                : 0,
            paused: session.state.paused,
            volume: session.state.volume,
            filters: session.state.filters,
          });
          session.playing = true;
          session.positionAt = Date.now();
          session.resolution = null;
          await this.repositories.history.record({
            id: claim.id,
            botId: this.botId,
            guildId: session.state.guildId,
            userId: current.requester.userId,
            track: current.track,
            startedAt: Date.now(),
          });
          this.changed(session);
        });
        this.prefetch(session);
        if (session.playing) return;
      } catch (error) {
        if (claim.controller.signal.aborted) continue;
        if (!(error instanceof MusicError)) throw error;
        await this.locked(session, async () => {
          if (session.closed || session.state.currentPlaybackId !== claim.id) return;
          if (error instanceof MusicError && error.code === 'NODE_UNAVAILABLE') {
            this.capturePosition(session);
            session.online = false;
            session.playing = false;
          } else {
            await this.retire(session, 'error');
            this.emit(
              'notice',
              session.state.guildId,
              'A full playable version was unavailable, so I skipped that track.',
            );
          }
          await this.persist(session);
        });
      }
    }
  }
  private async retire(
    session: Session,
    reason: HistoryEndReason,
    remember = true,
    stopAudio = true,
  ): Promise<void> {
    session.resolution?.abort();
    session.resolution = null;
    const current = session.state.current;
    const playbackId = session.state.currentPlaybackId;
    const ended = this.snapshot(session);
    session.playing = false;
    session.state.current = null;
    session.state.currentPlaybackId = null;
    session.state.positionMs = 0;
    session.state.paused = false;
    session.excluded.clear();
    session.retries = 0;
    session.queue.invalidateUndo();
    if (current && remember)
      session.state.previous = [structuredClone(current), ...session.state.previous].slice(0, 50);
    if (playbackId) await this.repositories.history.finish(playbackId, reason);
    if (stopAudio) await this.transport.stop(session.state.guildId).catch(() => undefined);
    if (current) this.emit('trackEnd', ended, reason);
  }
  private async retryOrAdvance(session: Session, encoded: string | null): Promise<void> {
    const current = this.requireCurrent(session);
    if (encoded) session.excluded.add(encoded);
    if (catalogSources.has(current.track.source) && session.retries < 2) {
      if (session.state.currentPlaybackId)
        await this.repositories.history.finish(session.state.currentPlaybackId, 'error');
      session.resolution?.abort();
      session.playing = false;
      session.retries++;
      current.playable = null;
      session.state.positionMs = 0;
      session.positionAt = Date.now();
      session.state.currentPlaybackId = randomUUID();
      await this.transport.stop(session.state.guildId).catch(() => undefined);
      this.emit(
        'notice',
        session.state.guildId,
        'The audio source failed. Trying another full-length mirror.',
      );
    } else {
      await this.retire(session, 'error');
      this.emit('notice', session.state.guildId, 'This track could not play, so I skipped it.');
    }
    await this.persist(session);
  }
  private async queueEnded(session: Session): Promise<void> {
    if (session.state.pendingImports.length) return; // The next page can still arrive.
    const last = session.state.previous[0];
    if (session.state.autoplay && last && !session.closed) {
      const generation = session.version?.generation;
      const entry = await this.autoplay
        .next(
          this.botId,
          session.state.guildId,
          last,
          session.queue.view(),
          session.settings.maxTrackLengthSeconds * 1000,
          session.state.nodeId,
          session.workAbort.signal,
        )
        .catch(() => null);
      if (entry) {
        await this.locked(session, async () => {
          if (
            session.closed ||
            !session.state.autoplay ||
            session.state.current ||
            session.queue.size ||
            session.version?.generation !== generation
          )
            return;
          this.assertCapacity(session, 1);
          session.queue.add([entry], 1, false);
          await this.persist(session);
          session.wake = true;
        });
        if (session.queue.size) return;
      }
    }
    this.emit('queueEnd', this.snapshot(session));
    this.scheduleIdle(session);
  }

  private startImport(session: Session, job: PendingImport): void {
    this.imports.start(
      structuredClone(job),
      {
        append: (id, items, processed, name, total) =>
          this.locked(session, async () => {
            if (session.closed) return false;
            const active = session.state.pendingImports.find((pending) => pending.id === id);
            if (!active) return false;
            const waiter = this.waiters.get(id);
            if (waiter) {
              waiter.name = name;
              waiter.total = total;
            }
            active.processedCount = processed;
            const valid = items.filter(
              (item) =>
                item.track.isStream ||
                (item.track.durationMs > 0 &&
                  item.track.durationMs <= session.settings.maxTrackLengthSeconds * 1000),
            );
            if (waiter?.replaceCurrent && valid.length) {
              waiter.replaceCurrent = false;
              await this.retire(session, 'replaced');
            }
            const available = Math.max(
              0,
              session.settings.maxQueueSize -
                session.queue.size -
                Number(Boolean(session.state.current)),
            );
            const accepted = valid.slice(0, available);
            let position = session.queue.size + 1;
            if (active.mode === 'next') {
              const lastKey = active.enqueuedKeys.at(-1);
              const entries = session.queue.view();
              const reverseIndex = [...entries]
                .reverse()
                .findIndex((entry) => entry.track.key === lastKey);
              const index = reverseIndex < 0 ? -1 : entries.length - reverseIndex - 1;
              position = index >= 0 ? index + 2 : 1;
            }
            if (accepted.length)
              session.queue.add(
                accepted.map((item) =>
                  createQueueEntry(item.track, active.requester, item.playable),
                ),
                position,
                false,
              );
            active.enqueuedKeys.push(...accepted.map((item) => item.track.key));
            if (waiter) waiter.count += accepted.length;
            await this.persist(session);
            if (waiter && waiter.count >= 5 && !waiter.settled) this.settleImport(id, waiter, true);
            this.emit(
              'importProgress',
              session.state.guildId,
              id,
              active.enqueuedKeys.length,
              total,
            );
            this.changed(session);
            this.kick(session);
            this.prefetch(session);
            return accepted.length === valid.length;
          }),
        complete: (id, failed) =>
          this.locked(session, async () => {
            if (session.closed) return;
            session.state.pendingImports = session.state.pendingImports.filter(
              (pending) => pending.id !== id,
            );
            await this.persist(session);
            const waiter = this.waiters.get(id);
            if (waiter && !waiter.settled) {
              if (waiter.count === 0) {
                waiter.settled = true;
                waiter.reject(
                  new MusicError(
                    failed ? 'UNAVAILABLE' : 'NOT_FOUND',
                    'No playable tracks could be imported.',
                  ),
                );
              } else this.settleImport(id, waiter, false);
            }
            this.waiters.delete(id);
            this.changed(session);
            this.kick(session);
          }),
      },
      () =>
        this.emit(
          'notice',
          session.state.guildId,
          'The playlist import stopped because its metadata source is unavailable. Tracks already queued are preserved.',
        ),
    );
  }
  private makeWaiter(replaceCurrent: boolean): ImportWaiter {
    let resolve!: ImportWaiter['resolve'];
    let reject!: ImportWaiter['reject'];
    const first = new Promise<ImportResult>((ready, fail) => {
      resolve = ready;
      reject = fail;
    });
    return {
      first,
      resolve,
      reject,
      name: 'Playlist',
      count: 0,
      total: null,
      settled: false,
      replaceCurrent,
    };
  }
  private settleImport(id: string, waiter: ImportWaiter, background: boolean): void {
    waiter.settled = true;
    waiter.resolve({
      id,
      name: waiter.name,
      enqueued: waiter.count,
      total: waiter.total,
      background,
    });
  }
  private cancelImports(session: Session): void {
    for (const job of session.state.pendingImports) {
      this.imports.cancel(job.id);
      const waiter = this.waiters.get(job.id);
      if (waiter && !waiter.settled) {
        waiter.settled = true;
        waiter.reject(new MusicError('UNAVAILABLE', 'The playlist import was cancelled.'));
      }
      this.waiters.delete(job.id);
    }
    session.state.pendingImports = [];
  }
  private prefetch(session: Session): void {
    if (session.closed || !session.online || !session.playing) return;
    const capacity = Math.max(0, this.env.IMPORT_CONCURRENCY - session.prefetching.size);
    if (!capacity) return;
    const excluded = new Set([...session.prefetching, ...session.prefetchFailed]);
    const entries = session.queue.unresolved(capacity, excluded);
    for (const entry of entries) {
      session.prefetching.add(entry.id);
      const task = this.resolver
        .resolve(entry.track, new Set(), session.state.nodeId, session.workAbort.signal)
        .then(async (playable) => {
          await this.locked(session, () => {
            if (session.closed || !session.queue.updatePlayable(entry.id, playable))
              return Promise.resolve();
            // Encodings are an expendable cache. Periodic checkpoints capture them in a batch;
            // a restart safely re-resolves them rather than losing catalog entries.
            return Promise.resolve();
          });
        })
        .catch(() => {
          session.prefetchFailed.add(entry.id);
        })
        .finally(() => {
          session.prefetching.delete(entry.id);
          // Failed entries wait for their turn; other songs still resolve in the background.
          this.prefetch(session);
        });
      this.watch(task);
    }
  }
  private scheduleIdle(session: Session): void {
    if (
      session.closed ||
      session.settings.stayInVoice ||
      (!session.emptyVoice &&
        (session.state.current || session.queue.size || session.state.pendingImports.length))
    ) {
      this.cancelIdle(session);
      return;
    }
    if (session.idleTimer) return;
    session.idleTimer = setTimeout(() => {
      session.idleTimer = null;
      if (
        !session.closed &&
        !session.settings.stayInVoice &&
        (session.emptyVoice ||
          (!session.state.current && !session.queue.size && !session.state.pendingImports.length))
      )
        this.watch(this.leave(session.state.guildId));
    }, session.settings.autoLeaveTimeoutSeconds * 1000);
    session.idleTimer.unref();
  }
  private cancelIdle(session: Session): void {
    if (session.idleTimer) clearTimeout(session.idleTimer);
    session.idleTimer = null;
  }
  private async configureSponsor(session: Session): Promise<void> {
    if (!this.env.SPONSORBLOCK_ENABLED && session.settings.sponsorBlockEnabled) return;
    await this.transport
      .sponsorBlock(
        session.state.guildId,
        this.env.SPONSORBLOCK_ENABLED && session.settings.sponsorBlockEnabled,
      )
      .catch(() =>
        this.emit(
          'notice',
          session.state.guildId,
          'SponsorBlock is unavailable on this audio server.',
        ),
      );
  }
  private watch(task: Promise<void>): void {
    const guarded = task.catch((error: unknown) =>
      this.logger.warn({ code: errorCode(error) }, 'Background music operation failed.'),
    );
    this.background.add(guarded);
    void guarded.finally(() => this.background.delete(guarded));
  }
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/ProgressBar.ts

````typescript
import { formatTime } from '../utils/time.js';

export function progressBar(
  positionMs: number,
  durationMs: number,
  isStream = false,
  width = 14,
): string {
  if (isStream) return `🔴 LIVE · ${formatTime(positionMs)}`;
  const length = Math.max(3, Math.min(30, Math.floor(Number.isFinite(width) ? width : 14)));
  const duration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
  const position = Math.min(duration, Math.max(0, Number.isFinite(positionMs) ? positionMs : 0));
  const marker = duration > 0 ? Math.round((position / duration) * (length - 1)) : 0;
  return `${'▬'.repeat(marker)}🔘${'▬'.repeat(length - marker - 1)} ${formatTime(position)} / ${formatTime(duration)}`;
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/QueueManager.ts

````typescript
import { randomInt, randomUUID } from 'node:crypto';
import { queueEntrySchema } from '../db/models.js';
import type { PlayableTrack, QueueEntry, Requester, StoredTrack } from '../db/models.js';
import { MusicError } from '../utils/errors.js';

export function createQueueEntry(
  track: StoredTrack,
  requester: Requester,
  playable: PlayableTrack | null = null,
): QueueEntry {
  return queueEntrySchema.parse({
    id: randomUUID(),
    track,
    requester,
    playable,
    addedAt: Date.now(),
  });
}

/** One-based user positions; internal storage is private and every outward view is copied. */
export class QueueManager {
  private entries: QueueEntry[];
  private undoState: { entries: QueueEntry[]; expiresAt: number } | null = null;
  constructor(
    entries: readonly QueueEntry[] = [],
    private maximum = 2000,
    private readonly now: () => number = Date.now,
  ) {
    this.entries = entries.map((entry) => queueEntrySchema.parse(entry));
    this.assertCapacity(this.entries.length);
    this.assertUnique(this.entries);
  }
  get size(): number {
    return this.entries.length;
  }
  get remaining(): number {
    return Math.max(0, this.maximum - this.size);
  }
  get totalDurationMs(): number {
    return this.entries.reduce((sum, entry) => sum + entry.track.durationMs, 0);
  }
  view(): QueueEntry[] {
    return structuredClone(this.entries);
  }
  peek(): QueueEntry | null {
    return structuredClone(this.entries[0] ?? null);
  }
  unresolved(limit: number, excluded: ReadonlySet<string>): QueueEntry[] {
    if (limit < 1) return [];
    const candidates: QueueEntry[] = [];
    for (const entry of this.entries) {
      if (!entry.playable && !excluded.has(entry.id)) candidates.push(structuredClone(entry));
      if (candidates.length >= limit) break;
    }
    return candidates;
  }
  setMaximum(maximum: number): void {
    if (!Number.isInteger(maximum) || maximum < 1 || maximum > 10_000)
      throw new MusicError('INVALID_INPUT', 'Invalid queue limit.');
    this.maximum = maximum; // Existing tracks survive a lowered server limit.
  }

  add(entries: readonly QueueEntry[], position = this.size + 1, undoable = true): void {
    this.position(position, true);
    this.assertCapacity(this.size + entries.length);
    const parsed = entries.map((entry) => queueEntrySchema.parse(entry));
    this.assertUnique([...this.entries, ...parsed]);
    if (undoable) this.remember();
    else this.invalidateUndo();
    this.entries.splice(position - 1, 0, ...parsed);
  }
  take(): QueueEntry | null {
    this.invalidateUndo();
    return this.entries.shift() ?? null;
  }
  remove(positions: readonly number[]): QueueEntry[] {
    const indexes = new Set(
      positions.map((position) => {
        this.position(position);
        return position - 1;
      }),
    );
    if (indexes.size === 0)
      throw new MusicError('INVALID_INPUT', 'Choose at least one queue position.');
    this.remember();
    const removed = this.entries.filter((_, index) => indexes.has(index));
    this.entries = this.entries.filter((_, index) => !indexes.has(index));
    return structuredClone(removed);
  }
  move(from: number, to: number): void {
    this.position(from);
    this.position(to);
    this.remember();
    const entry = this.entries.splice(from - 1, 1)[0];
    if (entry) this.entries.splice(to - 1, 0, entry);
  }
  swap(first: number, second: number): void {
    this.position(first);
    this.position(second);
    this.remember();
    const a = this.entries[first - 1];
    const b = this.entries[second - 1];
    if (a && b) {
      this.entries[first - 1] = b;
      this.entries[second - 1] = a;
    }
  }
  clear(undoable = true): number {
    if (undoable) this.remember();
    else this.invalidateUndo();
    const count = this.size;
    this.entries = [];
    return count;
  }
  shuffle(random: (upperExclusive: number) => number = randomInt): void {
    this.remember();
    for (let index = this.size - 1; index > 0; index--) {
      const target = random(index + 1);
      if (!Number.isInteger(target) || target < 0 || target > index)
        throw new RangeError('Invalid shuffle random value.');
      const a = this.entries[index];
      const b = this.entries[target];
      if (a && b) {
        this.entries[index] = b;
        this.entries[target] = a;
      }
    }
  }
  dedupe(currentKey?: string): number {
    this.remember();
    const keys = new Set(currentKey ? [currentKey] : []);
    const before = this.size;
    this.entries = this.entries.filter((entry) => {
      if (keys.has(entry.track.key)) return false;
      keys.add(entry.track.key);
      return true;
    });
    return before - this.size;
  }
  undo(): void {
    const state = this.undoState;
    if (!state || state.expiresAt < this.now())
      throw new MusicError('NOT_FOUND', 'There is no recent queue change to undo.');
    this.assertCapacity(state.entries.length);
    this.entries = structuredClone(state.entries);
    this.invalidateUndo();
  }
  updatePlayable(id: string, playable: PlayableTrack): boolean {
    const entry = this.entries.find((entry) => entry.id === id);
    if (!entry) return false;
    entry.playable = queueEntrySchema.shape.playable.parse(playable);
    return true;
  }
  invalidateUndo(): void {
    this.undoState = null;
  }
  private remember(): void {
    this.undoState = { entries: this.view(), expiresAt: this.now() + 20_000 };
  }
  private position(position: number, allowEnd = false): void {
    if (!Number.isInteger(position) || position < 1 || position > this.size + (allowEnd ? 1 : 0))
      throw new MusicError('INVALID_INPUT', 'That queue position does not exist.');
  }
  private assertCapacity(size: number): void {
    if (size > this.maximum)
      throw new MusicError('QUEUE_FULL', 'The server queue limit has been reached.');
  }
  private assertUnique(entries: readonly QueueEntry[]): void {
    if (new Set(entries.map((entry) => entry.id)).size !== entries.length)
      throw new MusicError('CONFLICT', 'Queue entry IDs must be unique.');
  }
}

export function parsePositions(input: string, maximum: number): number[] {
  const selected = new Set<number>();
  for (const part of input.trim().split(/[ ,]+/)) {
    const match = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!match) throw new MusicError('INVALID_INPUT', 'Use positions such as 2, 4, or 5-8.');
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start || end > maximum || !Number.isSafeInteger(end))
      throw new MusicError('INVALID_INPUT', 'That queue range does not exist.');
    for (let position = start; position <= end; position++) selected.add(position);
  }
  return [...selected].sort((a, b) => a - b);
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/RecoveryManager.ts

````typescript
import type { Logger } from 'pino';
import type { QueueSnapshotsRepository } from '../db/contracts.js';
import type { SnapshotSummary } from '../db/models.js';
import type { PlayerManager } from './PlayerManager.js';
import { AsyncLock } from '../utils/AsyncLock.js';
import { errorCode } from '../utils/errors.js';

/** The Discord adapter checks shard ownership, guild membership, voice permissions, and stage readiness. */
export type RecoveryGuard = (snapshot: SnapshotSummary) => Promise<boolean>;
export class RecoveryManager {
  private readonly lock = new AsyncLock();
  constructor(
    private readonly players: PlayerManager,
    private readonly snapshots: QueueSnapshotsRepository,
    private readonly guard: RecoveryGuard,
    private readonly logger: Logger,
  ) {}
  async restoreAll(): Promise<{ restored: number; deferred: number }> {
    return this.lock.run(async () => {
      let restored = 0;
      let deferred = 0;
      for (const summary of await this.snapshots.list(this.players.botId)) {
        if (this.players.view(summary.guildId)) continue;
        try {
          if (!(await this.guard(summary))) {
            deferred++;
            continue;
          }
          const record = await this.snapshots.load(this.players.botId, summary.guildId);
          if (!record) continue;
          await this.players.restore(record);
          restored++;
        } catch (error) {
          deferred++;
          this.logger.warn(
            { guildId: summary.guildId, code: errorCode(error) },
            'Saved player recovery deferred.',
          );
        }
      }
      return { restored, deferred };
    });
  }
  /** Use on node-ready and at a bounded retry interval; retained snapshots are never deleted on failure. */
  async retryOffline(): Promise<void> {
    for (const id of this.players.offlineNodeIds()) {
      await this.players
        .nodeConnected(id, true)
        .catch((error: unknown) =>
          this.logger.warn({ nodeId: id, code: errorCode(error) }, 'Node recovery deferred.'),
        );
    }
    await this.restoreAll();
  }
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/SourceResolver.ts

````typescript
import { createHash } from 'node:crypto';
import { playableTrackSchema, storedTrackSchema } from '../db/models.js';
import type { PlayableTrack, StoredTrack } from '../db/models.js';
import type { Cache } from '../cache/Cache.js';
import type { AudioTransport, CatalogPage, RawTrack, ResolvedItem } from './types.js';
import type { CatalogClient } from './CatalogClient.js';
import { MirrorMatcher } from './MirrorMatcher.js';
import {
  catalogSources,
  cleanText,
  toPlayableTrack,
  toResolvedItem,
  toStoredTrack,
} from './TrackCodec.js';
import { UrlGuard } from '../security/UrlGuard.js';
import type { MediaBridge } from '../security/MediaBridge.js';
import { Semaphore } from '../utils/AsyncLock.js';
import { MusicError } from '../utils/errors.js';

const platforms = new Set([
  'ytsearch',
  'ytmsearch',
  'scsearch',
  'spsearch',
  'amsearch',
  'dzsearch',
  'ymsearch',
  'bcsearch',
]);
export class SourceResolver {
  private readonly work: Semaphore;
  constructor(
    private readonly transport: AudioTransport,
    private readonly cache: Cache,
    private readonly media: MediaBridge,
    private readonly catalog: CatalogClient,
    concurrency = 3,
    private readonly guard = new UrlGuard(),
    private readonly matcher = new MirrorMatcher(),
  ) {
    this.work = new Semaphore(concurrency);
  }

  async *pages(input: string, limit: number, signal?: AbortSignal): AsyncGenerator<CatalogPage> {
    const query = this.sanitizeQuery(input);
    signal?.throwIfAborted();
    let identifier = query;
    if (/^https?:\/\//i.test(query)) {
      const { url } = await this.guard.validate(query);
      const provider = canonicalProviderUrl(url);
      if (!provider) {
        const cached = await this.media.download(url.href, signal);
        const result = await this.transport.load(cached.url);
        const raw = result.tracks[0];
        if (!raw || raw.isStream)
          throw new MusicError('UNAVAILABLE', 'This file could not be decoded as complete audio.');
        const playable = toPlayableTrack({ ...raw, source: 'http' });
        const track = storedTrackSchema.parse({
          ...toStoredTrack({ ...raw, source: 'http' }),
          key: `http:${cached.id}`,
          uri: null,
          identifier: null,
          localFileId: cached.id,
          title: cleanText(decodeFilename(url.pathname)),
          artist: 'Uploaded audio',
        });
        yield { name: track.title, items: [{ track, playable }], total: 1 };
        return;
      }
      identifier = provider;
      const canonical = new URL(provider);
      if (this.catalog.supports(canonical)) {
        let yielded = false;
        try {
          for await (const page of this.catalog.pages(canonical, limit, signal)) {
            yielded = true;
            yield page;
          }
          return;
        } catch (error) {
          signal?.throwIfAborted();
          // Fall back only before the first page, so a partial failure cannot duplicate the import.
          if (yielded || !canonical.hostname.includes('spotify')) throw error;
        }
      }
    } else if (!/^[a-z]+search:/i.test(query)) identifier = `ytsearch:${query}`;
    signal?.throwIfAborted();
    const result = await this.transport.load(identifier);
    const items = result.tracks.slice(0, result.kind === 'search' ? 1 : limit).flatMap((raw) => {
      try {
        return [toResolvedItem(raw)];
      } catch {
        return [];
      }
    });
    if (!items.length)
      throw new MusicError('NOT_FOUND', 'No full tracks were found. Try another title or link.');
    // Lavalink's loadtracks endpoint returns aggregated metadata. Only mirror resolution is lazy here.
    for (let offset = 0; offset < items.length; offset += offset === 0 ? 5 : 50) {
      signal?.throwIfAborted();
      const size = offset === 0 ? 5 : 50;
      yield {
        name: cleanText(result.name),
        items: items.slice(offset, offset + size),
        total: items.length,
      };
    }
  }

  async search(
    input: string,
    count = 10,
    nodeId?: string | null,
    signal?: AbortSignal,
  ): Promise<ResolvedItem[]> {
    signal?.throwIfAborted();
    const query = this.sanitizeQuery(input);
    if (/^https?:\/\//i.test(query))
      throw new MusicError('INVALID_INPUT', 'Search with a title and artist. Use play for links.');
    const result = await this.transport.load(
      /^[a-z]+search:/i.test(query) ? query : `ytsearch:${query}`,
      nodeId,
    );
    signal?.throwIfAborted();
    return result.tracks.slice(0, Math.max(1, Math.min(10, count))).flatMap((raw) => {
      try {
        return [toResolvedItem(raw)];
      } catch {
        return [];
      }
    });
  }

  async resolve(
    track: StoredTrack,
    excluded: ReadonlySet<string> = new Set(),
    nodeId?: string | null,
    signal?: AbortSignal,
  ): Promise<PlayableTrack> {
    return this.work.run(async () => {
      storedTrackSchema.parse(track);
      signal?.throwIfAborted();
      if (track.localFileId) {
        const result = await this.transport.load(
          await this.media.urlFor(track.localFileId),
          nodeId,
        );
        const raw = result.tracks[0];
        if (!raw) throw unavailable();
        return toPlayableTrack({
          ...raw,
          source: track.source === 'attachment' ? 'attachment' : 'http',
        });
      }
      if (!catalogSources.has(track.source)) {
        if (!track.uri) throw unavailable();
        // Restore never hands an arbitrary saved HTTP URL or encoding to Lavalink.
        const { url } = await this.guard.validate(track.uri);
        const canonical = canonicalProviderUrl(url);
        if (!canonical) throw unavailable();
        const result = await this.transport.load(canonical, nodeId);
        const raw =
          result.tracks.find(
            (candidate) =>
              !excluded.has(candidate.encoded ?? '') && candidate.identifier === track.identifier,
          ) ?? result.tracks.find((candidate) => !excluded.has(candidate.encoded ?? ''));
        if (!raw) throw unavailable();
        return toPlayableTrack(raw);
      }
      const key = `mirror:v1:${createHash('sha256')
        .update(
          JSON.stringify([track.key, track.title, track.artist, track.durationMs, track.isrc]),
        )
        .digest('hex')}`;
      const cached = playableTrackSchema.safeParse(await this.cache.get(key));
      if (
        cached.success &&
        !excluded.has(cached.data.encoded) &&
        this.validMirror(track, cached.data)
      )
        return cached.data;
      const candidates: RawTrack[] = [];
      const query = `${track.artist} - ${track.title}`;
      const searches = [
        ...(track.isrc ? [`ytmsearch:"${track.isrc}"`, `ytsearch:"${track.isrc}"`] : []),
        `ytmsearch:${query}`,
        `ytsearch:${query}`,
        `scsearch:${query}`,
      ];
      for (const search of searches) {
        signal?.throwIfAborted();
        try {
          const result = await this.transport.load(search, nodeId);
          candidates.push(
            ...result.tracks.filter((candidate) => !excluded.has(candidate.encoded ?? '')),
          );
        } catch (error) {
          if (error instanceof MusicError && error.code === 'NODE_UNAVAILABLE') throw error;
        }
        const best = this.matcher.rank(track, candidates)[0];
        if (best && (best.exactIsrc || !search.includes(track.isrc ?? '\u0000'))) {
          const playable = toPlayableTrack(best.candidate);
          await this.cache.set(key, playable, 1800);
          return playable;
        }
      }
      const best = this.matcher.rank(track, candidates)[0];
      if (!best) throw unavailable();
      const playable = toPlayableTrack(best.candidate);
      await this.cache.set(key, playable, 1800);
      return playable;
    }, signal);
  }

  validMirror(track: StoredTrack, playable: PlayableTrack): boolean {
    return (
      this.matcher.score(track, {
        ...playable,
        encoded: playable.encoded,
        source: playable.source,
        album: null,
        isPreview: false,
      }) !== null
    );
  }

  async attachment(url: string, filename: string, signal?: AbortSignal): Promise<ResolvedItem> {
    const cached = await this.media.download(url, signal);
    const result = await this.transport.load(cached.url);
    const raw = result.tracks[0];
    if (!raw || raw.isStream) throw unavailable();
    return {
      track: storedTrackSchema.parse({
        ...toStoredTrack({ ...raw, source: 'attachment' }),
        key: `attachment:${cached.id}`,
        identifier: null,
        uri: null,
        localFileId: cached.id,
        title: cleanText(filename),
        artist: 'Uploaded audio',
      }),
      playable: toPlayableTrack({ ...raw, source: 'attachment' }),
    };
  }

  async related(
    track: StoredTrack,
    nodeId?: string | null,
    signal?: AbortSignal,
  ): Promise<ResolvedItem[]> {
    signal?.throwIfAborted();
    if (
      track.source === 'youtube' &&
      track.identifier &&
      /^[A-Za-z0-9_-]{11}$/.test(track.identifier)
    ) {
      try {
        const result = await this.transport.load(
          `https://www.youtube.com/watch?v=${track.identifier}&list=RD${track.identifier}`,
          nodeId,
        );
        signal?.throwIfAborted();
        const items = result.tracks.slice(0, 30).flatMap((raw) => {
          try {
            return [toResolvedItem(raw)];
          } catch {
            return [];
          }
        });
        if (items.length > 1) return items;
      } catch {
        /* Artist search remains available when mixes are restricted. */
      }
    }
    return this.search(`${track.artist} official audio`, 10, nodeId, signal);
  }

  private sanitizeQuery(input: string): string {
    const query = input.trim();
    if (
      !query ||
      query.length > 4096 ||
      [...query].some((c) => {
        const p = c.codePointAt(0) ?? 0;
        return p < 32 || p === 127;
      })
    )
      throw new MusicError(
        'INVALID_INPUT',
        'Provide a title or public music link up to 4096 characters.',
      );
    const prefix = /^([a-z][a-z0-9+.-]*):/i.exec(query)?.[1]?.toLowerCase();
    if (prefix && !['http', 'https'].includes(prefix) && !platforms.has(prefix))
      throw new MusicError('INVALID_INPUT', 'That URL scheme or search source is not supported.');
    if (platforms.has(prefix ?? '') && !query.slice((prefix?.length ?? 0) + 1).trim())
      throw new MusicError('INVALID_INPUT', 'Provide a search title after the source prefix.');
    return query;
  }
}

/** Strip arbitrary provider query parameters before a URL reaches the remote Lavalink machine. */
export function canonicalProviderUrl(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (
    ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(
      host,
    )
  ) {
    const id =
      host === 'youtu.be'
        ? url.pathname.slice(1)
        : (url.searchParams.get('v') ??
          /^\/(?:shorts|live)\/([A-Za-z0-9_-]{11})$/.exec(url.pathname)?.[1]);
    const list = url.searchParams.get('list');
    if ((id && !/^[A-Za-z0-9_-]{11}$/.test(id)) || (list && !/^[A-Za-z0-9_-]{10,200}$/.test(list)))
      throw invalidLink();
    if (id) return `https://www.youtube.com/watch?v=${id}${list ? `&list=${list}` : ''}`;
    if (list && url.pathname === '/playlist')
      return `https://www.youtube.com/playlist?list=${list}`;
    throw invalidLink();
  }
  if (
    host === 'open.spotify.com' &&
    /^\/(?:intl-[a-z]{2}\/)?(?:track|album|playlist|artist)\/[A-Za-z0-9]{22}\/?$/.test(url.pathname)
  )
    return `https://${host}${url.pathname}`;
  if (
    ['deezer.com', 'www.deezer.com'].includes(host) &&
    /^\/(?:[a-z]{2}\/)?(?:track|album|playlist|artist)\/\d+\/?$/.test(url.pathname)
  )
    return `https://www.deezer.com${url.pathname}`;
  if (
    host === 'music.apple.com' &&
    /^\/[a-z]{2}\/(?:album|playlist|artist|song)\/[A-Za-z0-9%._~-]+\/[A-Za-z0-9.-]+\/?$/.test(
      url.pathname,
    )
  ) {
    const id = url.searchParams.get('i');
    return `https://${host}${url.pathname}${id && /^\d+$/.test(id) ? `?i=${id}` : ''}`;
  }
  if (
    /^music\.yandex\.(?:ru|com|by|kz)$/.test(host) &&
    /^\/(?:album\/\d+(?:\/track\/\d+)?|artist\/\d+(?:\/tracks)?|users\/[A-Za-z0-9._-]+\/playlists\/\d+|track\/\d+)\/?$/.test(
      url.pathname,
    )
  )
    return `https://${host}${url.pathname}`;
  if (
    ['soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com'].includes(host) &&
    /^\/[A-Za-z0-9_-]+\/(?:sets\/)?[A-Za-z0-9_-]+\/?$/.test(url.pathname)
  )
    return `https://soundcloud.com${url.pathname}`;
  if (
    ['twitch.tv', 'www.twitch.tv'].includes(host) &&
    /^\/(?:videos\/\d+|[A-Za-z0-9_]+)\/?$/.test(url.pathname)
  )
    return `https://www.twitch.tv${url.pathname}`;
  if (
    /^(?:[a-z0-9-]+\.)?bandcamp\.com$/.test(host) &&
    /^\/(?:track|album)\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
  )
    return `https://${host}${url.pathname}`;
  if (['vimeo.com', 'www.vimeo.com'].includes(host) && /^\/\d+\/?$/.test(url.pathname))
    return `https://vimeo.com${url.pathname}`;
  return null;
}
function invalidLink(): MusicError {
  return new MusicError(
    'INVALID_INPUT',
    'Use a complete music track, artist, album, or playlist link.',
  );
}
function unavailable(): MusicError {
  return new MusicError('UNAVAILABLE', 'No full-length match is available for this track.');
}
function decodeFilename(pathname: string): string {
  try {
    return decodeURIComponent(pathname.split('/').at(-1) ?? 'Audio file');
  } catch {
    return 'Audio file';
  }
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/TrackCodec.ts

````typescript
import { createHash } from 'node:crypto';
import type { Track } from 'lavalink-client';
import { playableTrackSchema, storedTrackSchema } from '../db/models.js';
import type { MusicSource, PlayableTrack, StoredTrack } from '../db/models.js';
import type { RawTrack, ResolvedItem } from './types.js';
import { MusicError } from '../utils/errors.js';

export const catalogSources = new Set<MusicSource>([
  'spotify',
  'applemusic',
  'deezer',
  'yandexmusic',
]);
export const mirrorSources = new Set<MusicSource>(['youtube', 'soundcloud']);

export function cleanText(value: string, maximum = 300): string {
  return (
    [...value]
      .filter((character) => {
        const point = character.codePointAt(0) ?? 0;
        return point >= 32 && point !== 127;
      })
      .join('')
      .trim()
      .slice(0, maximum) || 'Unknown'
  );
}
export function safeWebUrl(value: string | null | undefined): string | null {
  try {
    if (!value || value.length > 4096) return null;
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function normalizeSource(value: string): MusicSource {
  const normalized = value.toLowerCase().replace(/[ _-]/g, '');
  if (['youtube', 'youtubemusic'].includes(normalized)) return 'youtube';
  if (
    [
      'spotify',
      'soundcloud',
      'deezer',
      'applemusic',
      'yandexmusic',
      'twitch',
      'bandcamp',
      'vimeo',
      'http',
      'attachment',
    ].includes(normalized)
  )
    return normalized as MusicSource;
  throw new MusicError('UNAVAILABLE', 'This audio source is not supported.');
}
export function normalizeIsrc(value: string | null | undefined): string | null {
  const isrc = value?.replace(/-/g, '').toUpperCase() ?? '';
  return /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(isrc) ? isrc : null;
}
export function fromClientTrack(track: Track): RawTrack {
  return {
    encoded: track.encoded ?? null,
    identifier: track.info.identifier,
    title: track.info.title,
    artist: track.info.author,
    source: track.info.sourceName,
    uri: track.info.uri,
    durationMs: track.info.duration,
    isStream: track.info.isStream,
    isSeekable: track.info.isSeekable,
    artworkUrl: track.info.artworkUrl,
    isrc: track.info.isrc,
    album: track.pluginInfo.albumName ?? null,
    // previewUrl alone is metadata, not evidence that this encoded track is a preview.
    isPreview: track.pluginInfo.isPreview === true,
  };
}
export function isPreview(track: RawTrack): boolean {
  return (
    track.isPreview ||
    /(?:^|\W)(?:preview|sample clip|30[ -]second clip)(?:\W|$)/i.test(track.title) ||
    /(?:p\.scdn\.co|audio-ssl\.itunes\.apple\.com|cdns-preview[^.]*\.dzcdn\.net)/i.test(
      track.uri ?? '',
    )
  );
}
export function toStoredTrack(raw: RawTrack): StoredTrack {
  const source = normalizeSource(raw.source);
  const identifier = cleanText(raw.identifier, 1024);
  return storedTrackSchema.parse({
    version: 1,
    key: `${source}:${createHash('sha256').update(identifier).digest('hex')}`,
    title: cleanText(raw.title),
    artist: cleanText(raw.artist),
    source,
    identifier,
    uri: safeWebUrl(raw.uri),
    durationMs: Math.round(raw.durationMs),
    isStream: raw.isStream,
    artworkUrl: safeWebUrl(raw.artworkUrl),
    isrc: normalizeIsrc(raw.isrc),
    album: raw.album ? cleanText(raw.album) : null,
    localFileId: null,
  });
}
export function toPlayableTrack(raw: RawTrack): PlayableTrack {
  const track = toStoredTrack(raw);
  if (catalogSources.has(track.source) || isPreview(raw) || !raw.encoded) {
    throw new MusicError('UNAVAILABLE', 'A full playable version could not be found.');
  }
  return playableTrackSchema.parse({
    encoded: raw.encoded,
    identifier: track.identifier,
    title: track.title,
    artist: track.artist,
    source: track.source,
    uri: track.uri,
    durationMs: track.durationMs,
    isStream: track.isStream,
    isSeekable: raw.isSeekable,
    artworkUrl: track.artworkUrl,
    isrc: track.isrc,
    isPreview: false,
  });
}
export function toResolvedItem(raw: RawTrack): ResolvedItem {
  if (isPreview(raw) && !catalogSources.has(normalizeSource(raw.source))) {
    throw new MusicError('UNAVAILABLE', 'Preview clips are not playable.');
  }
  const track = toStoredTrack(raw);
  return { track, playable: catalogSources.has(track.source) ? null : toPlayableTrack(raw) };
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/types.ts

````typescript
import type { AudioFilters, PlayableTrack, QueueSnapshot, StoredTrack } from '../db/models.js';

export interface ResolvedItem {
  track: StoredTrack;
  playable: PlayableTrack | null;
}
export interface CatalogPage {
  name: string;
  items: ResolvedItem[];
  total: number | null;
}
export interface RawTrack {
  encoded: string | null;
  identifier: string;
  title: string;
  artist: string;
  source: string;
  uri: string | null;
  durationMs: number;
  isStream: boolean;
  isSeekable: boolean;
  artworkUrl: string | null;
  isrc: string | null;
  album: string | null;
  isPreview: boolean;
}
export interface LoadResult {
  kind: 'track' | 'playlist' | 'search' | 'empty';
  name: string;
  tracks: RawTrack[];
}
export interface PlaybackOptions {
  playbackId: string;
  positionMs: number;
  paused: boolean;
  volume: number;
  filters: AudioFilters;
}
export interface NodeIdentity {
  nodeId: string | null;
  sessionId: string | null;
}
/** Commands never reach directly into the Lavalink SDK's internal queue. */
export interface AudioTransport {
  load(identifier: string, nodeId?: string | null): Promise<LoadResult>;
  connect(snapshot: QueueSnapshot): Promise<NodeIdentity>;
  play(guildId: string, track: PlayableTrack, options: PlaybackOptions): Promise<void>;
  stop(guildId: string): Promise<void>;
  destroy(guildId: string): Promise<void>;
  pause(guildId: string, paused: boolean): Promise<void>;
  seek(guildId: string, positionMs: number): Promise<void>;
  volume(guildId: string, volume: number): Promise<void>;
  filters(guildId: string, filters: AudioFilters): Promise<void>;
  sponsorBlock(guildId: string, enabled: boolean): Promise<void>;
  identity(guildId: string): NodeIdentity;
  position(guildId: string): number | null;
  migrate(guildId: string, excludedNodeId: string): Promise<NodeIdentity | null>;
}
export interface TrackEvent {
  guildId: string;
  playbackId: string | null;
  encoded: string | null;
  type: 'start' | 'end' | 'error' | 'stuck';
  reason: string | null;
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/security/MediaBridge.ts

````typescript
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile, stat, readdir, unlink } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { Server, IncomingMessage, ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import type { Env } from '../../config/env.js';
import { SafeHttpClient } from './SafeHttpClient.js';
import { AsyncLock } from '../utils/AsyncLock.js';
import { MusicError } from '../utils/errors.js';

const idSchema = z.uuid();
export interface CachedMedia {
  id: string;
  url: string;
  size: number;
}

/** Lavalink sees only immutable, bounded files, never arbitrary user download URLs or manifests. */
export class MediaBridge {
  private server: Server | null = null;
  private key: Buffer | null = null;
  private readonly lock = new AsyncLock();
  private readonly directory: string;
  constructor(
    private readonly env: Pick<
      Env,
      | 'MEDIA_BRIDGE_PORT'
      | 'MEDIA_BRIDGE_BIND'
      | 'MEDIA_BRIDGE_PUBLIC_URL'
      | 'MEDIA_MAX_BYTES'
      | 'MEDIA_REQUEST_TIMEOUT_MS'
    >,
    private readonly http = new SafeHttpClient(),
    directory = './media-cache',
  ) {
    this.directory = resolve(directory);
  }

  async start(): Promise<void> {
    if (this.server) return;
    await mkdir(this.directory, { recursive: true });
    const keyPath = join(this.directory, '.bridge-key');
    try {
      await writeFile(keyPath, randomBytes(32), { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
    }
    this.key = await readFile(keyPath);
    if (this.key.length !== 32) throw new Error('Invalid media bridge key.');
    const server = createServer((request, response) => {
      void this.serve(request, response).catch(() => {
        response.destroy();
      });
    });
    server.requestTimeout = 30_000;
    server.headersTimeout = 10_000;
    await new Promise<void>((ready, reject) => {
      server.once('error', reject);
      server.listen(this.env.MEDIA_BRIDGE_PORT, this.env.MEDIA_BRIDGE_BIND, () => {
        server.off('error', reject);
        ready();
      });
    });
    server.on('error', () => {
      /* Socket-level failures must not crash the bot. */
    });
    this.server = server;
  }

  async download(url: string, signal?: AbortSignal): Promise<CachedMedia> {
    return this.lock.run(async () => {
      if (!this.key) throw new Error('Start the media bridge before downloading.');
      const response = await this.http.request(url, {
        maxBytes: this.env.MEDIA_MAX_BYTES,
        timeoutMs: this.env.MEDIA_REQUEST_TIMEOUT_MS,
        ...(signal ? { signal } : {}),
      });
      if (response.status !== 200 || !isAudioContainer(response.body)) {
        throw new MusicError(
          'UNAVAILABLE',
          'Use a complete MP3, AAC, Ogg, FLAC, WAV, MP4, or WebM audio file.',
        );
      }
      const files = await readdir(this.directory);
      let used = 0;
      for (const file of files.filter((file) => /^[a-f0-9-]{36}\.media$/.test(file))) {
        used += (await stat(join(this.directory, file))).size;
      }
      if (used + response.body.length > this.env.MEDIA_MAX_BYTES * 20) {
        throw new MusicError(
          'MEDIA_TOO_LARGE',
          'The media cache is full. Ask the bot owner to clear unused files.',
        );
      }
      const id = randomUUID();
      await writeFile(this.filePath(id), response.body, { flag: 'wx', mode: 0o600 });
      return { id, url: await this.urlFor(id), size: response.body.length };
    });
  }

  async urlFor(id: string): Promise<string> {
    idSchema.parse(id);
    if (!this.key) throw new Error('Media bridge has not started.');
    try {
      await stat(this.filePath(id));
    } catch {
      throw new MusicError(
        'UNAVAILABLE',
        'This uploaded file is no longer available. Upload it again.',
      );
    }
    const signature = createHmac('sha256', this.key).update(id).digest('hex');
    return `${this.env.MEDIA_BRIDGE_PUBLIC_URL}/media/${id}/${signature}`;
  }

  /** Call with IDs referenced by ALL bot snapshots/favorites/playlists, never just one guild. */
  async pruneUnused(retained: ReadonlySet<string>, olderThanMs = 7 * 86_400_000): Promise<number> {
    return this.lock.run(async () => {
      let removed = 0;
      for (const file of await readdir(this.directory)) {
        const id = file.replace(/\.media$/, '');
        if (!idSchema.safeParse(id).success || retained.has(id)) continue;
        const path = this.filePath(id);
        if ((await stat(path)).mtimeMs > Date.now() - olderThanMs) continue;
        await unlink(path);
        removed++;
      }
      return removed;
    });
  }

  async close(): Promise<void> {
    const server = this.server;
    this.server = null;
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((ready) => server.close(() => ready()));
    }
  }

  private filePath(id: string): string {
    return join(this.directory, `${idSchema.parse(id)}.media`);
  }
  private async serve(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const match = /^\/media\/([a-f0-9-]{36})\/([a-f0-9]{64})$/.exec(request.url ?? '');
    if (!match || !this.key || !['GET', 'HEAD'].includes(request.method ?? '')) {
      response.writeHead(404).end();
      return;
    }
    const id = match[1] ?? '';
    if (!idSchema.safeParse(id).success) {
      response.writeHead(404).end();
      return;
    }
    const expected = createHmac('sha256', this.key).update(id).digest();
    if (!timingSafeEqual(expected, Buffer.from(match[2] ?? '', 'hex'))) {
      response.writeHead(404).end();
      return;
    }
    let size: number;
    try {
      size = (await stat(this.filePath(id))).size;
    } catch {
      response.writeHead(404).end();
      return;
    }
    let start = 0;
    let end = size - 1;
    let status = 200;
    const range = request.headers.range;
    if (range) {
      const parsed = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!parsed || (!parsed[1] && !parsed[2])) {
        response.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
        return;
      }
      if (!parsed[1]) start = Math.max(0, size - Number(parsed[2]));
      else {
        start = Number(parsed[1]);
        end = parsed[2] ? Math.min(Number(parsed[2]), end) : end;
      }
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start > end ||
        start >= size
      ) {
        response.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
        return;
      }
      status = 206;
    }
    response.writeHead(status, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': end - start + 1,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
      ...(status === 206 ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    await pipeline(createReadStream(this.filePath(id), { start, end }), response);
  }
}

export function isAudioContainer(body: Buffer): boolean {
  if (body.length < 12) return false;
  const header = body.subarray(0, 12);
  const ascii = header.toString('ascii');
  return (
    ascii.startsWith('ID3') ||
    ascii.startsWith('OggS') ||
    ascii.startsWith('fLaC') ||
    (ascii.startsWith('RIFF') && ascii.slice(8) === 'WAVE') ||
    ascii.slice(4, 8) === 'ftyp' ||
    header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) ||
    (header[0] === 0xff && ((header[1] ?? 0) & 0xe0) === 0xe0)
  );
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/security/SafeHttpClient.ts

````typescript
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { IncomingHttpHeaders } from 'node:http';
import { UrlGuard } from './UrlGuard.js';
import { MusicError } from '../utils/errors.js';

export interface SafeResponse {
  status: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
  url: string;
}
export interface RequestOptions {
  signal?: AbortSignal;
  maxBytes?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST';
  body?: string;
  allowedOrigin?: string;
  redirects?: number;
}

/** Connect to a validated address while preserving Host and TLS SNI. No ambient proxy or cookies. */
export class SafeHttpClient {
  constructor(private readonly guard = new UrlGuard()) {}

  async request(input: string, options: RequestOptions = {}): Promise<SafeResponse> {
    const deadline = Date.now() + (options.timeoutMs ?? 30_000);
    let current = input;
    for (let redirects = 0; redirects <= (options.redirects ?? 4); redirects++) {
      options.signal?.throwIfAborted();
      const remaining = deadline - Date.now();
      if (remaining <= 0)
        throw new MusicError('UNAVAILABLE', 'The source took too long to respond.');
      let dnsTimer: ReturnType<typeof setTimeout> | undefined;
      const validated = await Promise.race([
        this.guard.validate(current),
        new Promise<never>((_, reject) => {
          dnsTimer = setTimeout(
            () => reject(new MusicError('UNAVAILABLE', 'The source took too long to respond.')),
            remaining,
          );
          dnsTimer.unref();
        }),
      ]).finally(() => {
        if (dnsTimer) clearTimeout(dnsTimer);
      });
      const { url, addresses } = validated;
      if (options.allowedOrigin && url.origin !== options.allowedOrigin)
        throw new MusicError('UNSAFE_URL', 'The source redirected outside its permitted service.');
      const address = addresses[0];
      if (!address) throw new MusicError('UNSAFE_URL', 'The destination is unavailable.');
      const response = await new Promise<SafeResponse>((resolve, reject) => {
        const requester = url.protocol === 'https:' ? httpsRequest : httpRequest;
        const request = requester(
          url,
          {
            method: options.method ?? 'GET',
            agent: false,
            family: address.family,
            headers: {
              'User-Agent': 'DiscordMusicStream/0.1',
              'Accept-Encoding': 'identity',
              ...options.headers,
            },
            lookup: (_hostname, _lookupOptions, callback) =>
              callback(null, address.address, address.family),
            ...(options.signal ? { signal: options.signal } : {}),
          },
          (incoming) => {
            const status = incoming.statusCode ?? 0;
            if ([301, 302, 303, 307, 308].includes(status)) {
              incoming.destroy();
              resolve({ status, headers: incoming.headers, body: Buffer.alloc(0), url: url.href });
              return;
            }
            const maximum = options.maxBytes ?? 4 * 1024 * 1024;
            const declared = Number(incoming.headers['content-length']);
            if (Number.isFinite(declared) && declared > maximum) {
              incoming.destroy();
              reject(tooLarge());
              return;
            }
            const chunks: Buffer[] = [];
            let size = 0;
            incoming.on('data', (chunk: Buffer) => {
              size += chunk.length;
              if (size > maximum) {
                incoming.destroy();
                reject(tooLarge());
              } else chunks.push(chunk);
            });
            incoming.on('end', () =>
              resolve({
                status,
                headers: incoming.headers,
                body: Buffer.concat(chunks),
                url: url.href,
              }),
            );
            incoming.on('error', () => reject(unavailable()));
            incoming.on('aborted', () => reject(unavailable()));
          },
        );
        const timer = setTimeout(
          () => {
            request.destroy();
            reject(unavailable());
          },
          Math.max(1, deadline - Date.now()),
        );
        timer.unref();
        request.on('close', () => clearTimeout(timer));
        request.on('error', () => reject(unavailable()));
        if (options.body !== undefined) request.write(options.body);
        request.end();
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) return response;
      const location = response.headers.location;
      if (!location || (options.method ?? 'GET') !== 'GET') throw unavailable();
      const next = new URL(location, url);
      // User downloads carry no auth. Authenticated service requests cannot change origin.
      if (options.headers?.Authorization && next.origin !== url.origin) throw unavailable();
      current = next.href;
    }
    throw unavailable();
  }

  async json(input: string, options: RequestOptions = {}): Promise<unknown> {
    const response = await this.request(input, options);
    if (response.status < 200 || response.status >= 300) throw unavailable();
    try {
      return JSON.parse(response.body.toString('utf8')) as unknown;
    } catch {
      throw unavailable();
    }
  }
}
function unavailable(): MusicError {
  return new MusicError('UNAVAILABLE', 'The source is unavailable. Please try another link.');
}
function tooLarge(): MusicError {
  return new MusicError('MEDIA_TOO_LARGE', 'This file exceeds the configured download limit.');
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/security/UrlGuard.ts

````typescript
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';
import { MusicError } from '../utils/errors.js';

export interface PublicAddress {
  address: string;
  family: 4 | 6;
}
export type AddressLookup = (hostname: string) => Promise<PublicAddress[]>;

export function isPublicAddress(address: string): boolean {
  try {
    const parsed = ipaddr.process(address);
    return parsed.range() === 'unicast';
  } catch {
    return false;
  }
}

/** Reject every non-public answer, including mapped IPv4, metadata IPs, and rebinding answers. */
export class UrlGuard {
  constructor(
    private readonly resolve: AddressLookup = async (hostname) => {
      const answers = await lookup(hostname, { all: true, verbatim: true });
      return answers.map((answer) => ({
        address: answer.address,
        family: answer.family === 6 ? 6 : 4,
      }));
    },
  ) {}

  async validate(input: string): Promise<{ url: URL; addresses: PublicAddress[] }> {
    let url: URL;
    try {
      url = new URL(input);
    } catch {
      throw unsafe();
    }
    if (
      input.length > 4096 ||
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      !['', '80', '443'].includes(url.port) ||
      url.hash ||
      [...input].some((c) => (c.codePointAt(0) ?? 0) < 32)
    )
      throw unsafe();
    const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (
      hostname === 'localhost' ||
      (!hostname.includes('.') && !isIP(hostname)) ||
      /\.(?:localhost|local|internal|lan|home|test|invalid|onion)$/.test(hostname)
    )
      throw unsafe();
    let addresses: PublicAddress[];
    try {
      addresses = isIP(hostname)
        ? [{ address: hostname, family: isIP(hostname) === 6 ? 6 : 4 }]
        : await this.resolve(hostname);
    } catch {
      throw unsafe();
    }
    if (addresses.length === 0 || addresses.some((answer) => !isPublicAddress(answer.address)))
      throw unsafe();
    return { url, addresses };
  }
}
function unsafe(): MusicError {
  return new MusicError(
    'UNSAFE_URL',
    'Use a public HTTP or HTTPS URL without credentials or a custom port.',
  );
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/utils/AsyncLock.ts

````typescript
/** FIFO serialization; a failed operation never poisons the next operation. */
export class AsyncLock {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation);
    this.tail = result.catch(() => undefined);
    return result;
  }

  async drain(): Promise<void> {
    await this.tail;
  }
}

/** Shared bound across guilds, not merely a per-playlist concurrency limit. */
export class Semaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('Invalid capacity.');
  }

  async run<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    signal?.throwIfAborted();
    if (this.active >= this.capacity)
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    else this.active++;
    try {
      signal?.throwIfAborted();
      return await operation();
    } finally {
      const next = this.waiters.shift();
      if (next) next();
      else this.active--;
    }
  }
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/utils/errors.ts

````typescript
export type MusicErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'UNAVAILABLE'
  | 'NO_PLAYER'
  | 'QUEUE_FULL'
  | 'NOT_SEEKABLE'
  | 'UNSAFE_URL'
  | 'MEDIA_TOO_LARGE'
  | 'NODE_UNAVAILABLE'
  | 'CONFLICT';

/** Only these deliberately authored messages may be shown to Discord users. */
export class MusicError extends Error {
  constructor(
    public readonly code: MusicErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'MusicError';
  }
}

export function friendlyError(error: unknown): string {
  return error instanceof MusicError
    ? error.message
    : 'Something went wrong. Please try again in a moment.';
}

export function errorCode(error: unknown): string {
  return error instanceof MusicError ? error.code : 'INTERNAL';
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/utils/logger.ts

````typescript
import { pino } from 'pino';
import type { Env } from '../../config/env.js';

/** Do not log raw provider errors, queries, track encodings, voice packets, or SDK payloads. */
export function createLogger(env: Pick<Env, 'LOG_LEVEL' | 'LOG_PRETTY'>) {
  return pino({
    level: env.LOG_LEVEL,
    redact: {
      paths: [
        'token',
        'password',
        'authorization',
        'secret',
        'cookie',
        'headers',
        'env',
        'encoded',
        '*.token',
        '*.password',
        '*.authorization',
        '*.secret',
        '*.cookie',
        '*.headers',
        '*.encoded',
      ],
      censor: '[REDACTED]',
    },
    ...(env.LOG_PRETTY
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : {}),
  });
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/utils/time.ts

````typescript
import { MusicError } from './errors.js';

export function formatTime(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(Number.isFinite(milliseconds) ? milliseconds / 1000 : 0));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours > 0
    ? `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
    : `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Seconds, mm:ss, hh:mm:ss, or ordered 1h2m3s; rejects negatives and ambiguous input. */
export function parseTime(input: string): number {
  const value = input.trim().toLowerCase();
  let seconds: number;
  if (/^\d+(?:\.\d{1,3})?$/.test(value)) seconds = Number(value);
  else if (/^\d+:\d{2}(?::\d{2})?$/.test(value)) {
    const parts = value.split(':').map(Number);
    if (parts.slice(1).some((part) => part >= 60)) throw invalidTime();
    seconds = parts.reduce((total, part) => total * 60 + part, 0);
  } else {
    const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d{1,3})?)s)?$/.exec(value);
    if (!match || !match.slice(1).some(Boolean)) throw invalidTime();
    seconds = Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
  }
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 86_400) throw invalidTime();
  return Math.round(seconds * 1000);
}

function invalidTime(): MusicError {
  return new MusicError('INVALID_INPUT', 'Use seconds, mm:ss, hh:mm:ss, or a time such as 1m30s.');
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/tsup.config.ts

````typescript
import { defineConfig } from 'tsup';
import { cpSync } from 'node:fs';

export default defineConfig({
  // Bot, sharding, and registration entries arrive in their implementation phases.
  entry: {
    'config/env': 'src/config/env.ts',
    'scripts/check-env': 'scripts/check-env.ts',
    'scripts/healthcheck': 'scripts/healthcheck.ts',
    'scripts/migrate': 'scripts/migrate.ts',
    'lib/db/index': 'src/lib/db/index.ts',
    'lib/music/index': 'src/lib/music/index.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  dts: false,
  treeshake: true,
  external: ['better-sqlite3', 'pino-pretty'],
  noExternal: ['yaml'],
  onSuccess: () =>
    Promise.resolve().then(() => {
      cpSync('src/lib/db/migrations', 'dist/migrations', { recursive: true });
    }),
});

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/docs/phase-4-engine.md

````markdown
# Phase 4 — Core music engine

Phase 4 of eight is implemented. The command framework and commands come in Phase 5;
Discord bootstrap, events, controller components, and localization come in Phase 6.
The permanent regression suite comes in Phase 7 and the complete deployment README
comes in Phase 8. No Discord login or real source credentials were used in this phase.

## What is implemented

| Module                        | Behavior                                                                                                                                                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PlayerManager`               | Bot-account/guild-scoped players, serialized controls, playback IDs, queue snapshots, history, pause/resume, seek, skip/skip-to, previous/replay, stop/disconnect, move, volume, loop, autoplay, idle leave, and 24/7 settings.   |
| `QueueManager`                | One-based move/swap/remove/ranges, shuffle, clear, dedupe, copy-safe views, bounded capacity, and 20-second undo. Consuming a track invalidates undo.                                                                             |
| `SourceResolver`              | Provider links and prefixed searches, paged metadata, validated audio resolution, attachments/direct audio, safe restoration, related-track lookup, mirror cache, and a shared concurrency bound.                                 |
| `CatalogClient`               | Paged Spotify Web API and public Deezer metadata. It never downloads their preview URLs or records credentials in tracks.                                                                                                         |
| `MirrorMatcher`               | ISRC-first searches, artist/title matching, a hard inclusive ±10-second duration limit, official/Topic preference, and rejection of previews, streams, unrelated songs, and unrequested live/remix/cover/sped-up/slowed variants. |
| `ImportScheduler`             | Bounded metadata jobs, first-five response, batched append/checkpoint, cancellation, persisted progress, and resuming unfinished imports.                                                                                         |
| `AutoplayEngine`              | Related YouTube mixes or artist search, recent guild history and requester history as seeds, and exclusion of queued/recent songs.                                                                                                |
| `FilterPresets`               | Bass, nightcore, vaporwave, 8d/rotation, karaoke, tremolo, vibrato, lowpass, five equalizer presets, validated speed/pitch/rate, and reset via an empty filter object.                                                            |
| `ProgressBar`                 | Bounded progress bars, finite durations, elapsed live-stream time, and shared time parsing/formatting.                                                                                                                            |
| `LavalinkTransport`           | Typed lavalink-client 2.11.0/v4 adapter, voice handshake, source loading, filters, optional SponsorBlock, failover, payload identity, readiness observation, and resumable socket shutdown.                                       |
| `RecoveryManager`             | Guarded snapshot recovery, deferred retries, and retaining queues when nodes or voice channels are temporarily unavailable.                                                                                                       |
| `LyricsService`               | LavaLyrics synced/text results, bounded cached lyrics, lyrics.ovh text fallback, and an LRC timestamp parser.                                                                                                                     |
| `Cache`                       | Bounded memory cache and optional namespaced Redis with memory fallback. Durable queues remain in the database.                                                                                                                   |
| `UrlGuard` / `SafeHttpClient` | Public IP validation, rejection of mixed/private DNS answers, DNS-pinned sockets, original Host/TLS SNI, redirect revalidation, body limits, deadlines, and restricted authenticated API origins.                                 |
| `MediaBridge`                 | Complete binary media downloads, persistent UUID files and HMAC signing key, authenticated byte-range serving, and a bounded disk cache.                                                                                          |

The queue belongs to the engine. The SDK may expose the current track for diagnostics;
its upcoming queue, repeat, autoplay, and automatic skipping are unused. Every playback
attempt has a UUID in Lavalink `userData`. Delayed events must match that UUID before
the engine advances, retries, or records a terminal history result.

## Full-song policy and source behavior

Spotify, Apple Music, Deezer, and Yandex entries are treated as catalog metadata.
Their encodings are never sent straight to playback. The engine searches YouTube Music,
YouTube, then SoundCloud, validates the candidate, and plays the selected complete
track. A missing full-length match is reported and skipped; there is no preview fallback.
Legitimate complete songs shorter than 30 seconds remain allowed. The duration guard
rejects short clips used in place of longer catalog songs.

Spotify uses the current `/playlists/{id}/items` Web API endpoint with client credentials
when access permits it. Access restrictions before the first page trigger the configured
LavaSrc metadata fallback. Failures after an import starts preserve the tracks already
queued and report the interruption. Apple Music and Yandex use the configured LavaSrc
source. Deezer public metadata works without enabling its optional direct-audio source.

The first five metadata entries are queued together, and playback resolution begins at
once. Remaining metadata pages append in batches. Mirroring continues in bounded
background workers; unavailable entries wait for a final attempt at their playback turn.
The public APIs support incremental metadata pagination. Lavalink's `loadtracks`
endpoint returns one aggregated metadata result, so the initial metadata delay for
LavaSrc/YouTube collections still depends on the upstream service and plugin limits.
Configured import and queue limits intentionally cap collections larger than those limits.
An interrupted import resumes against the playlist's current ordering; changing its
contents while the bot is offline can change what remains after its stored offset.

Public YouTube/YouTube Music video, playlist, mix, shorts, and live links; SoundCloud
track/set links; Twitch channels/videos; Bandcamp tracks/albums; and Vimeo videos are
canonicalized before reaching Lavalink. Queries support `ytsearch:`, `ytmsearch:`,
`scsearch:`, `spsearch:`, `amsearch:`, `dzsearch:`, `ymsearch:`, and `bcsearch:`.
Plain text defaults to YouTube search. Bare Spotify URI schemes and arbitrary Lavalink
source prefixes are rejected; use the supported public links or search prefixes.

Direct URLs and Discord attachments are downloaded by the bot, validated as binary
audio containers, and served to Lavalink through its trusted internal media bridge.
MP3/AAC, Ogg, FLAC, WAV, MP4, and WebM containers are accepted. Remote HLS/M3U/XML
manifests and HTML pages are rejected. Cached file UUIDs survive restart; saved HTTP
encodings are re-resolved through that UUID instead of trusting an old user URL.
The bot media volume and bridge key must be retained for uploads to survive restart.

The media cache is capped at 20 times `MEDIA_MAX_BYTES` in total, with one bounded
download at a time. It reports a full cache instead of deleting files still used by
favorites, playlists, or another bot account. `pruneUnused` accepts the complete set
of retained UUIDs across all accounts and repositories, and removes only old,
unreferenced UUID files. Keep the configured bridge endpoint reachable only by Lavalink
and the bot. The generated HMAC links grant access to their individual files.

## Integration contract for Phases 5–6

1. Open/migrate the database and create repositories with environment-backed guild defaults.
2. Start one `MediaBridge` shared by all configured bot accounts on this process.
3. Create a namespaced cache, `createLavalinkClient`, `LavalinkTransport`, `CatalogClient`,
   `SourceResolver`, `AutoplayEngine`, `PlayerManager`, and `LyricsService` per bot account.
4. Register node/Discord event adapters **before** calling the SDK's `init` on Discord ready.
   Use `observeNodeReady`, which waits for both node information and the actual v4
   ready/session payload. The SDK's `connect` event can arrive earlier.
5. In the ready callback, call `node.updateSession(true, env.LAVALINK_RESUME_TIMEOUT_SECONDS)`.
   The v4 REST timeout is **seconds**. Then call `players.nodeConnected(node.id)` and
   `recovery.restoreAll()`. Resume session IDs are selected from the latest snapshots
   for this account before node initialization.
6. Forward Discord raw voice packets to `lavalink.sendRawData`. The SDK's `sendToShard`
   callback must send its voice-state payload through the guild's actual shard.
7. Deliver SDK `trackStart`, `trackError`, `trackStuck`, `trackEnd`, and `queueEnd` payloads
   through `trackEvent(payload)` to `players.onTrackEvent`. Terminal events carry their
   original `userData.playbackId`; never infer identity from the mutable SDK queue.
   With an empty SDK upcoming queue, natural completion arrives through `queueEnd`.
   Duplicate event delivery is safe for terminal playback IDs.
8. Forward node disconnect to `players.nodeDisconnected`. The SDK adapter waits for
   its automatic stuck-track stop before sending the next playback PATCH, preventing
   that stop from killing the replacement mirror.
9. Forward player position updates to `players.updatePosition`; start periodic snapshots
   with `players.startCheckpoints()`. Run deferred recovery at a bounded interval.
   `retryOffline` leaves already-playing guilds on the same node undisturbed.
10. The Discord recovery guard checks shard ownership, guild membership, channel
    existence, blacklist, Connect/Speak permissions, and stage-channel readiness.
    The command framework handles DJ, same-voice, vote skip, music-channel restrictions,
    and command cooldowns. The core exposes occupancy and move methods for voice events.
11. On shutdown, stop event/UI timers, call `players.close()`, then `transport.close()`,
    close caches and the shared media bridge, destroy Discord clients, and close the DB.
    Engine shutdown retains snapshots/import checkpoints. Adapter shutdown clears local
    SDK players before destroying sockets, preserving remote sessions for resumption.

`players.view(guildId)` returns a copied snapshot with the calculated current position.
`enqueue` accepts saved/selected `ResolvedItem` objects; `enqueueQuery` returns after
the first five additions or a smaller completed import. `mutateQueue` provides the
serialized queue-operation boundary. `enqueue` and `enqueueQuery` accept `append`,
`next`, and `now` modes. `skipTo` uses one-based upcoming positions.

Snapshots checkpoint position about every ten seconds and after controls. A crash can
replay up to that much audio, while keeping the queued songs. Existing catalog records
remain when the server limit is lowered; new additions are blocked until space exists.
Queue undo is intentionally in memory and does not survive a restart. Failover and
restart re-resolve saved tracks, preserve pause/filters/volume, and continue finite tracks
at the saved position. Live streams reconnect at their live edge.

## Verification

Strict TypeScript, zero-warning ESLint, Prettier, and the production tsup build pass.
The engine is exported at `dist/lib/music/index.js`; the later bot bootstrap is still
pending. All 48 temporary verification checks pass, covering:

- Queue operations, ranges, shuffle preservation, dedupe, bounded undo, copy isolation,
  time parsing, progress bars, filter validation, locks, concurrency, and synced lyrics.
- The inclusive mirror-duration boundary, preview/variant rejection, legitimate short
  songs, artist names containing “Live,” ISRC ranking, and excluding failed cached mirrors.
- Real SQLite queue/history checkpoints, rapid stale events, parallel relative seeks,
  loops, previous/replay, cancellation during resolution, guarded recovery, bot restart,
  node restart, failover, 24/7 behavior, snapshot conflicts, and a 1,005-song import.
- Import checkpoint restart without duplicating the first five; autoplay history/queue
  exclusions; paged Deezer/Spotify metadata; refreshed Spotify tokens; and preview secrecy.
- Private/mixed DNS rejection, socket address pinning, redirect revalidation, byte limits,
  binary container checks, authenticated media ranges, and a persistent signing key.
- SDK stuck-track cleanup ordering and waiting for the actual session-ready payload.

A separate local probe connected the installed SDK to **Lavalink 4.2.2** with all four
pinned plugins, enabled a **120-second** resumable session, and decoded a complete
WAV through the authenticated byte-range media bridge. The verification server was
stopped afterward. This probe did not connect to Discord voice or authenticate to
Spotify/Apple/Yandex/YouTube accounts. Those deployment smoke checks remain for the
bootstrapped application with the owner's credentials.

The verification fixtures live under ignored `data/phase-4-verification`; Phase 7 will
add the permanent Vitest suite under `tests/`. No dependencies changed in Phase 4.

## API references

- [Installed-client API documentation](https://tomato6966.github.io/lavalink-client/)
- [Lavalink v4 REST API](https://lavalink.dev/api/rest)
- [Pinned LavaSrc source documentation](https://github.com/topi314/LavaSrc/blob/4.8.3/README.md)
- [Spotify playlist items](https://developer.spotify.com/documentation/web-api/reference/get-playlists-items)
- [Spotify client credentials](https://developer.spotify.com/documentation/web-api/tutorials/client-credentials-flow)

````

