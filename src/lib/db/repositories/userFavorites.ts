import { and, asc, count, eq } from 'drizzle-orm';
import type { AppDatabase } from '../client.js';
import type { UserFavoritesRepository } from '../contracts.js';
import { snowflakeSchema, storedTrackSchema } from '../models.js';
import type { Favorite, PageRequest, StoredTrack } from '../models.js';
import { userFavorites } from '../schema.js';
import {
  RepositoryError,
  makePage,
  pagination,
  readStoredJson,
  runRepository,
  validateInput,
} from '../validation.js';

function favorite(row: typeof userFavorites.$inferSelect): Favorite {
  const track = readStoredJson(storedTrackSchema, row.trackJson);
  if (track.key !== row.trackKey)
    throw new RepositoryError('CORRUPT_DATA', 'Favorite identity is inconsistent.');
  return {
    userId: row.userId,
    trackKey: row.trackKey,
    track,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class SqliteUserFavoritesRepository implements UserFavoritesRepository {
  constructor(
    private readonly db: AppDatabase,
    private readonly limit: number,
  ) {}

  add(userId: string, input: StoredTrack) {
    return runRepository(() => {
      const id = validateInput(snowflakeSchema, userId);
      const track = validateInput(storedTrackSchema, input);
      return this.db.transaction(
        (tx) => {
          const where = and(eq(userFavorites.userId, id), eq(userFavorites.trackKey, track.key));
          const existing = tx.select().from(userFavorites).where(where).get();
          const total =
            tx
              .select({ count: count() })
              .from(userFavorites)
              .where(eq(userFavorites.userId, id))
              .get()?.count ?? 0;
          if (!existing && total >= this.limit)
            throw new RepositoryError('LIMIT', 'Your favorites list is full.');
          const now = Date.now();
          const trackJson = JSON.stringify(track);
          const row = tx
            .insert(userFavorites)
            .values({ userId: id, trackKey: track.key, trackJson, createdAt: now, updatedAt: now })
            .onConflictDoUpdate({
              target: [userFavorites.userId, userFavorites.trackKey],
              set: { trackJson, updatedAt: now },
            })
            .returning()
            .get();
          if (!row) throw new RepositoryError('NOT_FOUND', 'The favorite could not be saved.');
          return favorite(row);
        },
        { behavior: 'immediate' },
      );
    });
  }

  get(userId: string, trackKey: string) {
    return runRepository(() => {
      const id = validateInput(snowflakeSchema, userId);
      const key = validateInput(storedTrackSchema.shape.key, trackKey);
      const row = this.db
        .select()
        .from(userFavorites)
        .where(and(eq(userFavorites.userId, id), eq(userFavorites.trackKey, key)))
        .get();
      return row ? favorite(row) : null;
    });
  }

  remove(userId: string, trackKey: string) {
    return runRepository(() => {
      const id = validateInput(snowflakeSchema, userId);
      const key = validateInput(storedTrackSchema.shape.key, trackKey);
      return (
        this.db
          .delete(userFavorites)
          .where(and(eq(userFavorites.userId, id), eq(userFavorites.trackKey, key)))
          .run().changes > 0
      );
    });
  }

  list(userId: string, request: PageRequest = {}) {
    return runRepository(() => {
      const id = validateInput(snowflakeSchema, userId);
      return this.db.transaction((tx) => {
        const where = eq(userFavorites.userId, id);
        const total =
          tx.select({ count: count() }).from(userFavorites).where(where).get()?.count ?? 0;
        const paging = pagination(total, request);
        const rows = tx
          .select()
          .from(userFavorites)
          .where(where)
          .orderBy(asc(userFavorites.createdAt), asc(userFavorites.trackKey))
          .limit(paging.pageSize)
          .offset(paging.offset)
          .all();
        return makePage(rows.map(favorite), paging);
      });
    });
  }

  all(userId: string) {
    return runRepository(() => {
      const id = validateInput(snowflakeSchema, userId);
      const rows = this.db
        .select()
        .from(userFavorites)
        .where(eq(userFavorites.userId, id))
        .orderBy(asc(userFavorites.createdAt), asc(userFavorites.trackKey))
        .limit(this.limit + 1)
        .all();
      if (rows.length > this.limit)
        throw new RepositoryError('LIMIT', 'Your favorites exceed the current library limit.');
      return rows.map((row) => favorite(row).track);
    });
  }
}
