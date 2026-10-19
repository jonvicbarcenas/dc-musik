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
  isPreviewRequest,
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
    private readonly transport: Pick<AudioTransport, 'load'>,
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
        if (isPreviewRequest(decodeFilename(url.pathname), url.href))
          throw new MusicError(
            'UNAVAILABLE',
            'Preview clips are not playable. Use a full song link or upload.',
          );
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
          if (
            error instanceof MusicError &&
            ['SPOTIFY_AUTH_REQUIRED', 'SPOTIFY_ACCESS_DENIED'].includes(error.code)
          )
            throw error;
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
    if (/^spsearch:/i.test(query))
      return this.catalog.searchSpotify(query.slice('spsearch:'.length), count, signal);
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
    if (isPreviewRequest(filename, url))
      throw new MusicError(
        'UNAVAILABLE',
        'Preview clips are not playable. Upload a complete song.',
      );
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
