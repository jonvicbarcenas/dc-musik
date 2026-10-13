# Phase 3: Database schema, migrations, and typed repositories

Phase 3 implements the complete SQLite persistence layer. It includes the seven requested application tables, a generated Drizzle migration and its metadata, a migration command, backend-neutral repository interfaces, and the SQLite implementations. The music engine and Discord commands arrive in later phases.

## Files and responsibilities

| File                                     | Responsibility                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| `src/lib/db/schema.ts`                   | Drizzle tables, indexes, foreign key, and SQL checks                         |
| `src/lib/db/models.ts`                   | Versioned track/player models and runtime validation schemas                 |
| `src/lib/db/contracts.ts`                | Promise-based repository interfaces independent of SQLite                    |
| `src/lib/db/client.ts`                   | SQLite connection, WAL, foreign keys, and full commit durability             |
| `src/lib/db/migrate.ts`                  | Migration discovery, serialized application, and hash verification           |
| `src/lib/db/validation.ts`               | Input/stored-data validation, repository errors, and pagination              |
| `src/lib/db/index.ts`                    | Repository factory and public database exports                               |
| `src/lib/db/repositories/*.ts`           | Settings, favorites, playlists, history, snapshots, and blacklist operations |
| `src/lib/db/migrations/0000_initial.sql` | Generated initial SQL migration                                              |
| `src/lib/db/migrations/meta/*`           | Drizzle journal and schema snapshot                                          |
| `src/config/database.ts`                 | Database-only environment loading without Discord credentials                |
| `scripts/migrate.ts`                     | Migration CLI with short, sanitized errors                                   |
| `tsup.config.ts`                         | Database/migration entry points and packaged migration assets                |

`src/config/env.ts` also now trims `DATABASE_PATH`, matching the database-only loader. No packages were added in this phase.

## Tables

| Table             | Identity and stored data                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `guild_settings`  | Guild ID; prefix, DJ role, music channel, 24/7 mode, volume, vote-skip settings, announcements, leave timeout, language, clean mode, limits, autoplay, SponsorBlock, and theme |
| `user_favorites`  | User ID plus canonical track key; versioned catalog metadata and timestamps                                                                                                    |
| `playlists`       | UUID; owner ID, display/normalized name, sharing flag/token, and timestamps                                                                                                    |
| `playlist_tracks` | UUID; playlist foreign key, position, canonical track key, versioned catalog metadata, and addition time                                                                       |
| `play_history`    | Playback UUID; bot/guild/user IDs, track metadata, start/end time, and terminal reason                                                                                         |
| `queue_snapshots` | Bot ID plus guild ID; voice channel, payload version, generation UUID, revision, full player snapshot, and update time                                                         |
| `blacklist`       | User/guild kind plus target ID; acting owner, reason, optional expiration, and timestamps                                                                                      |

There is one additional infrastructure table, `__drizzle_migrations`, used for migration history. Discord snowflakes are stored as text to preserve their full precision. Application timestamps are Unix epoch milliseconds.

SQLite checks enforce numeric ranges, language values, boolean values, sharing state, history terminal state, snapshot version/revision, and valid JSON. Playlist track positions are unique within each playlist. Deleting a playlist cascades to its tracks. Favorite identity is unique per user, and playlist names are unique per owner after normalization.

The schema uses the installed Drizzle `0.45.4` APIs. The upstream [SQLite column documentation](https://orm.drizzle.team/docs/column-types/sqlite) explains boolean, JSON, and integer storage; the [migration documentation](https://orm.drizzle.team/docs/migrations) describes generated SQL and journal assets.

## Running migrations

From the project directory:

```powershell
npm run db:migrate
```

This command reads `DATABASE_PATH` from the environment or `.env`, defaults to `./data/music.sqlite`, creates the parent directory, opens SQLite, applies migrations, and closes the connection. It does not require Discord or Lavalink credentials.

For the built command:

```powershell
npm run build
node dist/scripts/migrate.js
```

Build output includes `dist/migrations/`. Migration discovery uses the module location, so the built CLI and repository bundle can locate their assets even when the current working directory differs from the project directory.

Migration application takes an immediate SQLite transaction before reading applied migrations. This serializes simultaneous shard/process starts. It uses Drizzle's SQL files, journal timestamps, and SHA-256 hashes. A previously applied file with a different hash, an unknown applied migration, or a gap in migration history stops startup. Repeated migration calls are idempotent. Keep applied migrations immutable; generate a new migration when changing the schema.

## Repository behavior

All public repository methods return Promises. The SQLite implementation runs synchronous statements inside those operations; transaction callbacks remain synchronous. This avoids accidentally committing a transaction before asynchronous work finishes.

Settings initialize lazily from supplied application defaults. Reads preserve existing settings, and updates patch only the specified fields. Volume and the other settings receive both application validation and relevant SQL checks.

Favorites store catalog identity independently of a playable mirror. Adding an existing favorite updates its metadata without creating a duplicate or changing its creation time. Lists are scoped by user and have stable ordering. Adding beyond the configured limit fails; updating an existing favorite at the limit remains allowed.

Personal playlists default to private. Every private read and write checks the owner ID in the repository. Names use Unicode normalization, collapsed whitespace, and lowercase keys for uniqueness. Appends validate the entire input and insert bounded batches inside one transaction. A failure in any batch rolls back the whole append. Removing positions validates the complete selection and rebuilds contiguous positions within one transaction, preserving surviving track IDs and timestamps.

Sharing generates a random 32-character token. Shared reads require that token and the current sharing flag. Repeatedly enabling sharing preserves the token; disabling sharing removes it and immediately revokes access. Enabling sharing again generates a new token. Shared access does not grant mutation rights.

History uses a playback UUID for idempotent recording. A duplicate track-start callback for the same playback cannot add another row; conflicting reuse of the ID is rejected. The first terminal callback wins. History reads require at least one user, guild, or bot scope. Retention keeps the newest configured entries per user, and statistics describe retained history rather than lifetime counts.

Blacklists support permanent and expiring restrictions. Expired entries stop matching immediately, even before cleanup. Guild restrictions take precedence when both guild and user restrictions match. A cleanup method removes expired rows. Authorization to administer global blacklists will be enforced by owner checks in the command framework; the persistence layer validates IDs and scopes each operation.

## Queue persistence and recovery contract

Snapshots are scoped by `(botId, guildId)`. Extra bot accounts in the same guild therefore have separate player state. Guild settings remain shared across those accounts.

Each snapshot stores:

- Current, upcoming, and previous entries, including requester identity and original catalog metadata.
- The selected playable track when available, with an explicit non-preview flag.
- Current playback UUID, position, pause state, volume, loop mode, autoplay, and audio filters.
- Voice/text channel IDs, node ID, and Lavalink session ID.
- Unfinished import jobs, their requester, mode, progress, and already-enqueued keys.

Account secrets and Discord voice credentials have no fields in the persistence models. Catalog metadata retains the original source link rather than replacing its identity with the current mirror. Attachment metadata can retain an application-generated local file UUID without accepting arbitrary filesystem paths.

Every save/delete requires the expected generation and revision. The first save uses `null` and receives generation/revision metadata in its returned record. Later writes use that returned version. A successful update increments the revision. If another writer has changed the state, the repository rejects the stale write. A newly created queue receives a different generation, protecting it from delayed operations targeting a queue that was already deleted.

The caller may pass the returned snapshot record directly as its expected version; only its generation and revision are used for comparison. The music engine in Phase 4 will coordinate those writes and implement actual Lavalink/voice recovery.

Payloads are versioned, validated on read, limited to 32 MiB, and reject duplicate active queue-entry IDs. Stream positions may exceed 24 hours. The list operation returns compact snapshot summaries so recovery can load guilds individually. Invalid payloads produce `CORRUPT_DATA` errors and remain stored for inspection or restoration; they are not silently deleted.

The database layer does not fetch track URLs. Source resolution and recovery will apply the network URL policy before fetching or playing those sources.

## Defaults and PostgreSQL adaptation

| Library setting                                 | Default                     |
| ----------------------------------------------- | --------------------------- |
| Favorites per user                              | 2,000                       |
| Playlists per user                              | 50                          |
| Tracks per personal playlist                    | 2,000                       |
| Retained history entries per user               | 1,000                       |
| Maximum configured library track/history limits | 10,000                      |
| Page size                                       | 10; maximum 100             |
| SQLite busy timeout                             | 5 seconds                   |
| SQLite journal/durability                       | WAL with `synchronous=FULL` |

The repository factory accepts validated limits and guild defaults. Existing libraries are not silently truncated if a configured playback/export limit is later lowered; reading the complete library reports a limit error. Paginated reads remain available.

The application-facing contracts and models do not import SQLite schema or driver types. Switching to PostgreSQL requires PostgreSQL tables/migrations and repository implementations of the same Promise interfaces, including ownership checks, ordering, retention, and conditional snapshot updates. It is not a connection-string-only change. The SQLite connection and transaction helpers stay inside this backend's implementation.

## Verification

Phase 3 verification includes strict TypeScript checking, ESLint, Prettier, production builds, migration generation consistency, and 39 database integration checks against real SQLite files. The temporary checks live under ignored `data/phase-3-verification/`; the permanent test suite is delivered in Phase 7.

The checks cover migration idempotence, hash mismatch reporting, simultaneous process migrations, packaged migration discovery, persistence after reopening the file, settings updates, favorites, SQL parameterization, playlist ownership and sharing, multi-batch rollback, position compaction, foreign-key cascades, history retention/idempotence, blacklist expiration, extra-bot isolation, snapshot revision/generation guards, and damaged stored JSON.

Actual Discord voice reconnection, full-track mirror selection, and queue playback restoration are not implemented in this phase. Those require the music engine and event handlers in later phases.

Phase 3 is complete. Reply `continue` for Phase 4: player and queue management, source resolution, mirror matching, filters, autoplay, and recovery.
