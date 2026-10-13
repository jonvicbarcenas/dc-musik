import { and, asc, count, desc, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { AppDatabase } from '../client.js';
import type { BlacklistRepository } from '../contracts.js';
import { blacklistInputSchema, snowflakeSchema } from '../models.js';
import type { BlacklistInput, BlacklistKind, PageRequest } from '../models.js';
import { blacklist } from '../schema.js';
import {
  RepositoryError,
  makePage,
  pagination,
  runRepository,
  validateInput,
  validateStored,
} from '../validation.js';

const entrySchema = blacklistInputSchema.extend({
  createdAt: z.number().int().min(0),
  updatedAt: z.number().int().min(0),
});
const active = (now: number) => or(isNull(blacklist.expiresAt), gt(blacklist.expiresAt, now));

export class SqliteBlacklistRepository implements BlacklistRepository {
  constructor(private readonly db: AppDatabase) {}

  set(input: BlacklistInput) {
    return runRepository(() => {
      const value = validateInput(blacklistInputSchema, input);
      const now = Date.now();
      if (value.expiresAt !== null && value.expiresAt <= now)
        throw new RepositoryError('INVALID_INPUT', 'Blacklist expiration must be in the future.');
      const row = this.db
        .insert(blacklist)
        .values({ ...value, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({
          target: [blacklist.kind, blacklist.targetId],
          set: {
            actorId: value.actorId,
            reason: value.reason,
            expiresAt: value.expiresAt,
            updatedAt: now,
          },
        })
        .returning()
        .get();
      if (!row) throw new RepositoryError('NOT_FOUND', 'The blacklist entry could not be saved.');
      return validateStored(entrySchema, row);
    });
  }

  remove(kind: BlacklistKind, targetId: string) {
    return runRepository(() => {
      const type = validateInput(blacklistInputSchema.shape.kind, kind);
      const id = validateInput(snowflakeSchema, targetId);
      return (
        this.db
          .delete(blacklist)
          .where(and(eq(blacklist.kind, type), eq(blacklist.targetId, id)))
          .run().changes > 0
      );
    });
  }

  findMatch(userId: string, guildId: string) {
    return runRepository(() => {
      const user = validateInput(snowflakeSchema, userId);
      const guild = validateInput(snowflakeSchema, guildId);
      const row = this.db
        .select()
        .from(blacklist)
        .where(
          and(
            active(Date.now()),
            or(
              and(eq(blacklist.kind, 'user'), eq(blacklist.targetId, user)),
              and(eq(blacklist.kind, 'guild'), eq(blacklist.targetId, guild)),
            ),
          ),
        )
        .orderBy(desc(sql`${blacklist.kind} = 'guild'`))
        .get();
      return row ? validateStored(entrySchema, row) : null;
    });
  }

  list(
    options: { kind?: BlacklistKind; includeExpired?: boolean } = {},
    request: PageRequest = {},
  ) {
    return runRepository(() => {
      const input = validateInput(
        z.strictObject({
          kind: blacklistInputSchema.shape.kind.optional(),
          includeExpired: z.boolean().default(false),
        }),
        options,
      );
      const where = and(
        input.kind ? eq(blacklist.kind, input.kind) : undefined,
        input.includeExpired ? undefined : active(Date.now()),
      );
      return this.db.transaction((tx) => {
        const total = tx.select({ count: count() }).from(blacklist).where(where).get()?.count ?? 0;
        const paging = pagination(total, request);
        const rows = tx
          .select()
          .from(blacklist)
          .where(where)
          .orderBy(asc(blacklist.kind), asc(blacklist.targetId))
          .limit(paging.pageSize)
          .offset(paging.offset)
          .all();
        return makePage(
          rows.map((row) => validateStored(entrySchema, row)),
          paging,
        );
      });
    });
  }

  purgeExpired() {
    return runRepository(
      () => this.db.delete(blacklist).where(lte(blacklist.expiresAt, Date.now())).run().changes,
    );
  }
}
