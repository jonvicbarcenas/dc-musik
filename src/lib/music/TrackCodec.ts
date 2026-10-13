import { cleanText, safeWebUrl } from '../utils/text.js';
export { cleanText, safeWebUrl } from '../utils/text.js';
import { createHash } from 'node:crypto';
import type { Track } from 'lavalink-client';
import { playableTrackSchema, storedTrackSchema } from '../db/models.js';
import type { MusicSource, PlayableTrack, StoredTrack } from '../db/models.js';
import type { RawTrack, ResolvedItem } from './types.js';
import { MusicError } from '../utils/errors.js';
import { isPreviewRequest } from './PreviewPolicy.js';
export { isPreviewRequest } from './PreviewPolicy.js';

export const catalogSources = new Set<MusicSource>([
  'spotify',
  'applemusic',
  'deezer',
  'yandexmusic',
]);
export const mirrorSources = new Set<MusicSource>(['youtube', 'soundcloud']);

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
  return track.isPreview || isPreviewRequest(track.title, track.uri);
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
