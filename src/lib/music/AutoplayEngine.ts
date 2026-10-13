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
