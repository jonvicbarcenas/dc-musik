import { and, asc, count, eq, max, or, sql } from 'drizzle-orm';
import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { AppDatabase, DatabaseExecutor } from '../client.js';
import type { PlaylistsRepository } from '../contracts.js';
import {
  playlistNameSchema,
  playlistSchema,
  shareTokenSchema,
  snowflakeSchema,
  storedTrackSchema,
} from '../models.js';
import type { PageRequest, PlaylistTrack, RepositoryLimits, StoredTrack } from '../models.js';
import { playlists, playlistTracks } from '../schema.js';
import {
  RepositoryError,
  makePage,
  pagination,
  readStoredJson,
  runRepository,
  validateInput,
  validateStored,
} from '../validation.js';

function nameKey(name: string): string {
  return name.normalize('NFKC').replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}
function trackItem(row: typeof playlistTracks.$inferSelect): PlaylistTrack {
  const track = readStoredJson(storedTrackSchema, row.trackJson);
  if (track.key !== row.trackKey)
    throw new RepositoryError('CORRUPT_DATA', 'Playlist track identity is inconsistent.');
  return { id: row.id, position: row.position + 1, track, addedAt: row.addedAt };
}
function requireOwned(db: DatabaseExecutor, ownerId: string, playlistId: string) {
  const owner = validateInput(snowflakeSchema, ownerId);
  const id = validateInput(z.uuid(), playlistId);
  const row = db
    .select()
    .from(playlists)
    .where(and(eq(playlists.ownerId, owner), eq(playlists.id, id)))
    .get();
  if (!row) throw new RepositoryError('NOT_FOUND', 'That playlist was not found in your library.');
  return validateStored(playlistSchema, row);
}
function requireShared(db: DatabaseExecutor, token: string) {
  const value = validateInput(shareTokenSchema, token);
  const row = db
    .select()
    .from(playlists)
    .where(and(eq(playlists.shareToken, value), eq(playlists.isShared, true)))
    .get();
  if (!row) throw new RepositoryError('NOT_FOUND', 'That shared playlist is unavailable.');
  return validateStored(playlistSchema, row);
}
function view(
  db: DatabaseExecutor,
  playlist: ReturnType<typeof requireOwned>,
  request: PageRequest,
) {
  const where = eq(playlistTracks.playlistId, playlist.id);
  const total = db.select({ count: count() }).from(playlistTracks).where(where).get()?.count ?? 0;
  const paging = pagination(total, request);
  const rows = db
    .select()
    .from(playlistTracks)
    .where(where)
    .orderBy(asc(playlistTracks.position))
    .limit(paging.pageSize)
    .offset(paging.offset)
    .all();
  if (rows.some((row, index) => row.position !== paging.offset + index))
    throw new RepositoryError('CORRUPT_DATA', 'Playlist positions are inconsistent.');
  return { playlist, tracks: makePage(rows.map(trackItem), paging) };
}
function allTracks(db: DatabaseExecutor, playlistId: string, limit: number) {
  const rows = db
    .select()
    .from(playlistTracks)
    .where(eq(playlistTracks.playlistId, playlistId))
    .orderBy(asc(playlistTracks.position))
    .limit(limit + 1)
    .all();
  if (rows.length > limit)
    throw new RepositoryError('LIMIT', 'That playlist exceeds the current track limit.');
  if (rows.some((row, index) => row.position !== index))
    throw new RepositoryError('CORRUPT_DATA', 'Playlist positions are inconsistent.');
  return rows.map((row) => trackItem(row).track);
}

export class SqlitePlaylistsRepository implements PlaylistsRepository {
  constructor(
    private readonly db: AppDatabase,
    private readonly limits: RepositoryLimits,
  ) {}

  create(ownerId: string, name: string) {
    return runRepository(() => {
      const owner = validateInput(snowflakeSchema, ownerId);
      const displayName = validateInput(playlistNameSchema, name);
      const normalized = validateInput(playlistSchema.shape.nameKey, nameKey(displayName));
      return this.db.transaction(
        (tx) => {
          const total =
            tx.select({ count: count() }).from(playlists).where(eq(playlists.ownerId, owner)).get()
              ?.count ?? 0;
          if (total >= this.limits.playlistsPerUser)
            throw new RepositoryError('LIMIT', 'Your playlist library is full.');
          if (
            tx
              .select({ id: playlists.id })
              .from(playlists)
              .where(and(eq(playlists.ownerId, owner), eq(playlists.nameKey, normalized)))
              .get()
          ) {
            throw new RepositoryError('CONFLICT', 'A playlist with that name already exists.');
          }
          const now = Date.now();
          const row = tx
            .insert(playlists)
            .values({
              id: randomUUID(),
              ownerId: owner,
              name: displayName,
              nameKey: normalized,
              createdAt: now,
              updatedAt: now,
            })
            .returning()
            .get();
          if (!row) throw new RepositoryError('NOT_FOUND', 'The playlist could not be created.');
          return validateStored(playlistSchema, row);
        },
        { behavior: 'immediate' },
      );
    });
  }

  findOwned(ownerId: string, nameOrId: string) {
    return runRepository(() => {
      const owner = validateInput(snowflakeSchema, ownerId);
      const value = validateInput(playlistNameSchema, nameOrId);
      const row = this.db
        .select()
        .from(playlists)
        .where(
          and(
            eq(playlists.ownerId, owner),
            or(eq(playlists.id, value), eq(playlists.nameKey, nameKey(value))),
          ),
        )
        .orderBy(sql`CASE WHEN ${playlists.id} = ${value} THEN 0 ELSE 1 END`)
        .get();
      return row ? validateStored(playlistSchema, row) : null;
    });
  }

  list(ownerId: string, request: PageRequest = {}) {
    return runRepository(() => {
      const owner = validateInput(snowflakeSchema, ownerId);
      return this.db.transaction((tx) => {
        const where = eq(playlists.ownerId, owner);
        const total = tx.select({ count: count() }).from(playlists).where(where).get()?.count ?? 0;
        const paging = pagination(total, request);
        const rows = tx
          .select()
          .from(playlists)
          .where(where)
          .orderBy(asc(playlists.createdAt), asc(playlists.id))
          .limit(paging.pageSize)
          .offset(paging.offset)
          .all();
        return makePage(
          rows.map((row) => validateStored(playlistSchema, row)),
          paging,
        );
      });
    });
  }

  delete(ownerId: string, playlistId: string) {
    return runRepository(() =>
      this.db.transaction(
        (tx) => {
          const playlist = requireOwned(tx, ownerId, playlistId);
          tx.delete(playlists).where(eq(playlists.id, playlist.id)).run();
        },
        { behavior: 'immediate' },
      ),
    );
  }

  rename(ownerId: string, playlistId: string, name: string) {
    return runRepository(() => {
      const displayName = validateInput(playlistNameSchema, name);
      const normalized = validateInput(playlistSchema.shape.nameKey, nameKey(displayName));
      return this.db.transaction(
        (tx) => {
          const playlist = requireOwned(tx, ownerId, playlistId);
          const duplicate = tx
            .select()
            .from(playlists)
            .where(and(eq(playlists.ownerId, ownerId), eq(playlists.nameKey, normalized)))
            .get();
          if (duplicate && duplicate.id !== playlist.id)
            throw new RepositoryError('CONFLICT', 'A playlist with that name already exists.');
          const row = tx
            .update(playlists)
            .set({ name: displayName, nameKey: normalized, updatedAt: Date.now() })
            .where(eq(playlists.id, playlist.id))
            .returning()
            .get();
          return validateStored(playlistSchema, row);
        },
        { behavior: 'immediate' },
      );
    });
  }

  detailOwned(ownerId: string, playlistId: string) {
    return runRepository(() =>
      this.db.transaction((tx) => {
        const playlist = requireOwned(tx, ownerId, playlistId);
        const rows = tx
          .select()
          .from(playlistTracks)
          .where(eq(playlistTracks.playlistId, playlist.id))
          .orderBy(asc(playlistTracks.position))
          .all();
        if (rows.some((row, index) => row.position !== index))
          throw new RepositoryError('CORRUPT_DATA', 'Playlist positions are inconsistent.');
        return { playlist, tracks: rows.map(trackItem) };
      }),
    );
  }

  /** Entry IDs preserve duplicate songs; the expected sequence prevents edits to a stale list. */
  updateTracks(
    ownerId: string,
    playlistId: string,
    expectedIds: readonly string[],
    orderedIds: readonly string[],
  ) {
    return runRepository(() => {
      const ids = z.array(z.uuid()).max(10_000);
      const expected = validateInput(ids, expectedIds);
      const ordered = validateInput(ids, orderedIds);
      if (new Set(ordered).size !== ordered.length)
        throw new RepositoryError('INVALID_INPUT', 'A playlist entry cannot appear twice.');
      return this.db.transaction(
        (tx) => {
          const playlist = requireOwned(tx, ownerId, playlistId);
          const rows = tx
            .select()
            .from(playlistTracks)
            .where(eq(playlistTracks.playlistId, playlist.id))
            .orderBy(asc(playlistTracks.position))
            .all();
          if (
            rows.length !== expected.length ||
            rows.some((row, index) => row.id !== expected[index])
          )
            throw new RepositoryError(
              'CONFLICT',
              'This playlist changed elsewhere. Refresh it and try again.',
            );
          const byId = new Map(rows.map((row) => [row.id, row]));
          const updated = ordered.map((id, position) => {
            const row = byId.get(id);
            if (!row)
              throw new RepositoryError('INVALID_INPUT', 'That entry is not in this playlist.');
            return { ...row, position };
          });
          tx.delete(playlistTracks).where(eq(playlistTracks.playlistId, playlist.id)).run();
          for (let offset = 0; offset < updated.length; offset += 100)
            tx.insert(playlistTracks)
              .values(updated.slice(offset, offset + 100))
              .run();
          tx.update(playlists)
            .set({ updatedAt: Date.now() })
            .where(eq(playlists.id, playlist.id))
            .run();
        },
        { behavior: 'immediate' },
      );
    });
  }

  viewOwned(ownerId: string, playlistId: string, request: PageRequest = {}) {
    return runRepository(() =>
      this.db.transaction((tx) => view(tx, requireOwned(tx, ownerId, playlistId), request)),
    );
  }
  viewShared(token: string, request: PageRequest = {}) {
    return runRepository(() =>
      this.db.transaction((tx) => view(tx, requireShared(tx, token), request)),
    );
  }
  tracksOwned(ownerId: string, playlistId: string) {
    return runRepository(() =>
      this.db.transaction((tx) => {
        const playlist = requireOwned(tx, ownerId, playlistId);
        return allTracks(tx, playlist.id, this.limits.tracksPerPlaylist);
      }),
    );
  }
  tracksShared(token: string) {
    return runRepository(() =>
      this.db.transaction((tx) => {
        const playlist = requireShared(tx, token);
        return allTracks(tx, playlist.id, this.limits.tracksPerPlaylist);
      }),
    );
  }

  append(ownerId: string, playlistId: string, tracks: readonly StoredTrack[]) {
    return runRepository(() => {
      const values = validateInput(
        z.array(storedTrackSchema).min(1).max(this.limits.tracksPerPlaylist),
        tracks,
      );
      return this.db.transaction(
        (tx) => {
          const playlist = requireOwned(tx, ownerId, playlistId);
          const total =
            tx
              .select({ count: count() })
              .from(playlistTracks)
              .where(eq(playlistTracks.playlistId, playlist.id))
              .get()?.count ?? 0;
          const lastPosition =
            tx
              .select({ position: max(playlistTracks.position) })
              .from(playlistTracks)
              .where(eq(playlistTracks.playlistId, playlist.id))
              .get()?.position ?? -1;
          if (lastPosition !== total - 1)
            throw new RepositoryError('CORRUPT_DATA', 'Playlist positions are inconsistent.');
          if (total + values.length > this.limits.tracksPerPlaylist)
            throw new RepositoryError('LIMIT', 'That playlist has reached its track limit.');
          const now = Date.now();
          const rows = values.map((track, index) => ({
            id: randomUUID(),
            playlistId: playlist.id,
            position: total + index,
            trackKey: track.key,
            trackJson: JSON.stringify(track),
            addedAt: now,
          }));
          for (let offset = 0; offset < rows.length; offset += 100)
            tx.insert(playlistTracks)
              .values(rows.slice(offset, offset + 100))
              .run();
          tx.update(playlists).set({ updatedAt: now }).where(eq(playlists.id, playlist.id)).run();
          return total + values.length;
        },
        { behavior: 'immediate' },
      );
    });
  }

  remove(ownerId: string, playlistId: string, positions: readonly number[]) {
    return runRepository(() => {
      const selection = new Set(
        validateInput(z.array(z.number().int().min(1).max(10_000)).min(1).max(10_000), positions),
      );
      return this.db.transaction(
        (tx) => {
          const playlist = requireOwned(tx, ownerId, playlistId);
          const rows = tx
            .select()
            .from(playlistTracks)
            .where(eq(playlistTracks.playlistId, playlist.id))
            .orderBy(asc(playlistTracks.position))
            .all();
          if (rows.some((row, index) => row.position !== index))
            throw new RepositoryError('CORRUPT_DATA', 'Playlist positions are inconsistent.');
          if ([...selection].some((position) => position > rows.length))
            throw new RepositoryError(
              'INVALID_INPUT',
              'A track position is outside that playlist.',
            );
          const remaining = rows
            .filter((row) => !selection.has(row.position + 1))
            .map((row, index) => ({ ...row, position: index }));
          // Rebuild positions inside one transaction to avoid transient unique-index collisions.
          tx.delete(playlistTracks).where(eq(playlistTracks.playlistId, playlist.id)).run();
          for (let offset = 0; offset < remaining.length; offset += 100)
            tx.insert(playlistTracks)
              .values(remaining.slice(offset, offset + 100))
              .run();
          tx.update(playlists)
            .set({ updatedAt: Date.now() })
            .where(eq(playlists.id, playlist.id))
            .run();
          return selection.size;
        },
        { behavior: 'immediate' },
      );
    });
  }

  setShared(ownerId: string, playlistId: string, enabled: boolean) {
    return runRepository(() => {
      const shared = validateInput(z.boolean(), enabled);
      return this.db.transaction(
        (tx) => {
          const playlist = requireOwned(tx, ownerId, playlistId);
          const shareToken = shared
            ? (playlist.shareToken ?? randomBytes(24).toString('base64url'))
            : null;
          const row = tx
            .update(playlists)
            .set({ isShared: shared, shareToken, updatedAt: Date.now() })
            .where(eq(playlists.id, playlist.id))
            .returning()
            .get();
          if (!row) throw new RepositoryError('NOT_FOUND', 'That playlist is unavailable.');
          return validateStored(playlistSchema, row);
        },
        { behavior: 'immediate' },
      );
    });
  }
}
