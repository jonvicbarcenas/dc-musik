import { and, asc, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { AppDatabase } from '../client.js';
import type { QueueSnapshotsRepository } from '../contracts.js';
import { queueSnapshotSchema, snowflakeSchema } from '../models.js';
import type { QueueSnapshot, SnapshotRecord, SnapshotVersion } from '../models.js';
import { queueSnapshots } from '../schema.js';
import {
  RepositoryError,
  readStoredJson,
  runRepository,
  validateInput,
  validateStored,
} from '../validation.js';

const maxSnapshotBytes = 32 * 1024 * 1024;
const versionSchema = z.strictObject({
  generation: z.uuid(),
  revision: z
    .number()
    .int()
    .min(1)
    .max(Number.MAX_SAFE_INTEGER - 1),
});
const summarySchema = versionSchema.extend({
  botId: snowflakeSchema,
  guildId: snowflakeSchema,
  voiceChannelId: snowflakeSchema,
  updatedAt: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
});
function summary(row: Omit<typeof queueSnapshots.$inferSelect, 'payload' | 'version'>) {
  return validateStored(summarySchema, row);
}
function record(row: typeof queueSnapshots.$inferSelect): SnapshotRecord {
  const snapshot = readStoredJson(queueSnapshotSchema, row.payload, maxSnapshotBytes);
  if (
    row.version !== snapshot.version ||
    row.botId !== snapshot.botId ||
    row.guildId !== snapshot.guildId ||
    row.voiceChannelId !== snapshot.voiceChannelId
  ) {
    throw new RepositoryError('CORRUPT_DATA', 'The queue snapshot identity is inconsistent.');
  }
  const metadata = summary({
    botId: row.botId,
    guildId: row.guildId,
    voiceChannelId: row.voiceChannelId,
    generation: row.generation,
    revision: row.revision,
    updatedAt: row.updatedAt,
  });
  return { ...metadata, snapshot };
}
const stale = () =>
  new RepositoryError(
    'STALE_SNAPSHOT',
    'This player state has changed. Reload it before writing again.',
  );

export class SqliteQueueSnapshotsRepository implements QueueSnapshotsRepository {
  constructor(private readonly db: AppDatabase) {}

  load(botId: string, guildId: string) {
    return runRepository(() => {
      const bot = validateInput(snowflakeSchema, botId);
      const guild = validateInput(snowflakeSchema, guildId);
      const row = this.db
        .select()
        .from(queueSnapshots)
        .where(and(eq(queueSnapshots.botId, bot), eq(queueSnapshots.guildId, guild)))
        .get();
      return row ? record(row) : null;
    });
  }

  list(botId: string) {
    return runRepository(() => {
      const bot = validateInput(snowflakeSchema, botId);
      return this.db
        .select({
          botId: queueSnapshots.botId,
          guildId: queueSnapshots.guildId,
          voiceChannelId: queueSnapshots.voiceChannelId,
          generation: queueSnapshots.generation,
          revision: queueSnapshots.revision,
          updatedAt: queueSnapshots.updatedAt,
        })
        .from(queueSnapshots)
        .where(eq(queueSnapshots.botId, bot))
        .orderBy(asc(queueSnapshots.updatedAt), asc(queueSnapshots.guildId))
        .all()
        .map(summary);
    });
  }

  save(snapshot: QueueSnapshot, expectedVersion: SnapshotVersion | null) {
    return runRepository(() => {
      const value = validateInput(queueSnapshotSchema, snapshot);
      const expected =
        expectedVersion === null
          ? null
          : validateInput(versionSchema, {
              generation: expectedVersion.generation,
              revision: expectedVersion.revision,
            });
      const payload = JSON.stringify(value);
      if (Buffer.byteLength(payload, 'utf8') > maxSnapshotBytes)
        throw new RepositoryError('LIMIT', 'That queue snapshot exceeds the storage size limit.');
      const values = {
        botId: value.botId,
        guildId: value.guildId,
        voiceChannelId: value.voiceChannelId,
        version: value.version,
        payload,
        updatedAt: Date.now(),
      };
      const row = expected
        ? this.db
            .update(queueSnapshots)
            .set({ ...values, revision: sql`${queueSnapshots.revision} + 1` })
            .where(
              and(
                eq(queueSnapshots.botId, value.botId),
                eq(queueSnapshots.guildId, value.guildId),
                eq(queueSnapshots.generation, expected.generation),
                eq(queueSnapshots.revision, expected.revision),
              ),
            )
            .returning()
            .get()
        : this.db
            .insert(queueSnapshots)
            .values({ ...values, generation: randomUUID(), revision: 1 })
            .onConflictDoNothing()
            .returning()
            .get();
      if (!row) throw stale();
      return record(row);
    });
  }

  delete(botId: string, guildId: string, expectedVersion: SnapshotVersion) {
    return runRepository(() => {
      const bot = validateInput(snowflakeSchema, botId);
      const guild = validateInput(snowflakeSchema, guildId);
      const expected = validateInput(versionSchema, {
        generation: expectedVersion.generation,
        revision: expectedVersion.revision,
      });
      const identity = and(eq(queueSnapshots.botId, bot), eq(queueSnapshots.guildId, guild));
      return this.db.transaction(
        (tx) => {
          const removed =
            tx
              .delete(queueSnapshots)
              .where(
                and(
                  identity,
                  eq(queueSnapshots.generation, expected.generation),
                  eq(queueSnapshots.revision, expected.revision),
                ),
              )
              .run().changes > 0;
          if (
            !removed &&
            tx
              .select({ guildId: queueSnapshots.guildId })
              .from(queueSnapshots)
              .where(identity)
              .get()
          )
            throw stale();
          return removed;
        },
        { behavior: 'immediate' },
      );
    });
  }
}
