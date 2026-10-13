import { z } from 'zod';
import type { RawTrack } from './types.js';
import { SafeHttpClient } from '../security/SafeHttpClient.js';

const trackSchema = z.object({
  uri: z.string().regex(/^spotify:track:[A-Za-z0-9]{22}$/),
  title: z.string().trim().min(1).max(1000),
  subtitle: z.string().trim().min(1).max(1000),
  duration: z.number().int().positive().max(86_400_000),
  entityType: z.literal('track'),
});
const entitySchema = z.object({
  type: z.literal('playlist'),
  uri: z.string(),
  title: z.string().trim().min(1).max(1000),
  trackList: z.array(z.unknown()).max(5000),
});
export interface PublicPlaylist {
  name: string;
  tracks: RawTrack[];
}

/** Only the unsigned, publicly rendered widget. Ignore preview URLs and all auth state. */
export class SpotifyPublicPlaylist {
  private readonly cache = new Map<string, { expiresAt: number; value: PublicPlaylist }>();
  constructor(private readonly http = new SafeHttpClient()) {}

  async get(id: string, signal?: AbortSignal): Promise<PublicPlaylist | null> {
    if (!/^[A-Za-z0-9]{22}$/.test(id)) return null;
    signal?.throwIfAborted();
    const cached = this.cache.get(id);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    try {
      const response = await this.http.request(`https://open.spotify.com/embed/playlist/${id}`, {
        allowedOrigin: 'https://open.spotify.com',
        redirects: 0,
        maxBytes: 2_000_000,
        timeoutMs: 15_000,
        ...(signal ? { signal } : {}),
      });
      signal?.throwIfAborted();
      if (response.status !== 200) return null;
      const value = parsePublicPlaylist(response.body.toString('utf8'), id);
      if (!value?.tracks.length) return null;
      this.cache.delete(id);
      while (this.cache.size >= 128) {
        const oldest = this.cache.keys().next().value;
        if (oldest) this.cache.delete(oldest);
      }
      this.cache.set(id, { expiresAt: Date.now() + 15 * 60_000, value });
      return value;
    } catch {
      signal?.throwIfAborted();
      return null;
    }
  }
}

export function parsePublicPlaylist(html: string, id: string): PublicPlaylist | null {
  if (html.length > 2_000_000 || !/^[A-Za-z0-9]{22}$/.test(id)) return null;
  const script = /<script\b(?=[^>]*\bid=["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script>/i.exec(
    html,
  )?.[1];
  if (!script) return null;
  let value: unknown;
  try {
    value = JSON.parse(script) as unknown;
  } catch {
    return null;
  }
  const object = (input: unknown): Record<string, unknown> =>
    typeof input === 'object' && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const props = object(object(value)['props']);
  const state = object(object(props['pageProps'])['state']);
  const parsed = entitySchema.safeParse(object(state['data'])['entity']);
  if (!parsed.success || parsed.data.uri !== `spotify:playlist:${id}`) return null;
  const tracks: RawTrack[] = [];
  for (const input of parsed.data.trackList.slice(0, 100)) {
    const parsedTrack = trackSchema.safeParse(input);
    if (!parsedTrack.success) continue;
    const track = parsedTrack.data;
    const identifier = track.uri.slice('spotify:track:'.length);
    tracks.push({
      encoded: null,
      identifier,
      title: track.title.slice(0, 500),
      artist: track.subtitle.slice(0, 500),
      source: 'spotify',
      uri: `https://open.spotify.com/track/${identifier}`,
      durationMs: track.duration,
      isStream: false,
      isSeekable: true,
      artworkUrl: null,
      isrc: null,
      album: null,
      isPreview: false,
    });
  }
  return { name: parsed.data.title.slice(0, 300), tracks };
}
