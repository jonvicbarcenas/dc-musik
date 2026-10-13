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
