import { and, count, countDistinct, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { AppDatabase } from '../client.js';
import type { HistoryRepository } from '../contracts.js';
import {
  historyEndReasonSchema,
  historyInputSchema,
  snowflakeSchema,
  storedTrackSchema,
} from '../models.js';
import type {
  HistoryEndReason,
  HistoryEntry,
  HistoryFilter,
  HistoryInput,
  PageRequest,
} from '../models.js';
import { playHistory } from '../schema.js';
import {
  RepositoryError,
  makePage,
  pagination,
  readStoredJson,
  runRepository,
  validateInput,
} from '../validation.js';

const filterSchema = z
  .strictObject({
    userId: snowflakeSchema.optional(),
    guildId: snowflakeSchema.optional(),
    botId: snowflakeSchema.optional(),
  })
  .refine((value) => Boolean(value.userId || value.guildId || value.botId));
function scope(filter: HistoryFilter) {
  const value = validateInput(filterSchema, filter);
  return and(
    value.userId ? eq(playHistory.userId, value.userId) : undefined,
    value.guildId ? eq(playHistory.guildId, value.guildId) : undefined,
    value.botId ? eq(playHistory.botId, value.botId) : undefined,
  );
}
function entry(row: typeof playHistory.$inferSelect): HistoryEntry {
  const track = readStoredJson(storedTrackSchema, row.trackJson);
  if (track.key !== row.trackKey)
    throw new RepositoryError('CORRUPT_DATA', 'History track identity is inconsistent.');
  return {
    id: row.id,
    botId: row.botId,
    guildId: row.guildId,
    userId: row.userId,
    track,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    endReason: row.endReason,
  };
}

export class SqliteHistoryRepository implements HistoryRepository {
  constructor(
    private readonly db: AppDatabase,
    private readonly retention: number,
  ) {}

  record(input: HistoryInput) {
    return runRepository(() => {
      const value = validateInput(historyInputSchema, input);
      return this.db.transaction(
        (tx) => {
          const existing = tx.select().from(playHistory).where(eq(playHistory.id, value.id)).get();
          if (existing) {
            if (
              existing.botId !== value.botId ||
              existing.guildId !== value.guildId ||
              existing.userId !== value.userId ||
              existing.trackKey !== value.track.key
            ) {
              throw new RepositoryError(
                'CONFLICT',
                'That playback ID belongs to another history entry.',
              );
            }
            return entry(existing);
          }
          const row = tx
            .insert(playHistory)
            .values({
              id: value.id,
              botId: value.botId,
              guildId: value.guildId,
              userId: value.userId,
              trackKey: value.track.key,
              trackJson: JSON.stringify(value.track),
              startedAt: value.startedAt,
            })
            .returning()
            .get();
          if (!row) throw new RepositoryError('NOT_FOUND', 'The history entry could not be saved.');
          tx.delete(playHistory)
            .where(
              inArray(
                playHistory.id,
                sql`(SELECT id FROM play_history WHERE user_id = ${value.userId} ORDER BY started_at DESC, id DESC LIMIT -1 OFFSET ${this.retention})`,
              ),
            )
            .run();
          return entry(row);
        },
        { behavior: 'immediate' },
      );
    });
  }

  finish(playbackId: string, reason: HistoryEndReason) {
    return runRepository(() => {
      const id = validateInput(z.uuid(), playbackId);
      const value = validateInput(historyEndReasonSchema, reason);
      // First terminal event wins; repeated track-end/error callbacks are harmless.
      return (
        this.db
          .update(playHistory)
          .set({ endedAt: sql`max(${playHistory.startedAt}, ${Date.now()})`, endReason: value })
          .where(and(eq(playHistory.id, id), isNull(playHistory.endedAt)))
          .run().changes > 0
      );
    });
  }

  list(filter: HistoryFilter, request: PageRequest = {}) {
    return runRepository(() => {
      const where = scope(filter);
      return this.db.transaction((tx) => {
        const total =
          tx.select({ count: count() }).from(playHistory).where(where).get()?.count ?? 0;
        const paging = pagination(total, request);
        const rows = tx
          .select()
          .from(playHistory)
          .where(where)
          .orderBy(desc(playHistory.startedAt), desc(playHistory.id))
          .limit(paging.pageSize)
          .offset(paging.offset)
          .all();
        return makePage(rows.map(entry), paging);
      });
    });
  }

  stats(filter: HistoryFilter) {
    return runRepository(
      () =>
        this.db
          .select({ plays: count(), uniqueTracks: countDistinct(playHistory.trackKey) })
          .from(playHistory)
          .where(scope(filter))
          .get() ?? { plays: 0, uniqueTracks: 0 },
    );
  }
}
