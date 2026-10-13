# Phase 3: Complete file contents

All 21 new or updated delivery files are reproduced below in full, including generated migration SQL and metadata. Each heading is the absolute workspace path. Temporary verification fixtures and generated build artifacts are not application source. This is a snapshot of Phase 3.

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/db/schema.ts

````typescript
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

const timestamp = (name: string) =>
  integer(name)
    .notNull()
    .default(sql`(unixepoch() * 1000)`);
const flag = (name: string, fallback: boolean) =>
  integer(name, { mode: 'boolean' }).notNull().default(fallback);

export const guildSettings = sqliteTable(
  'guild_settings',
  {
    guildId: text('guild_id').primaryKey(),
    prefix: text('prefix').notNull().default('!'),
    djRoleId: text('dj_role_id'),
    musicChannelId: text('music_channel_id'),
    stayInVoice: flag('stay_in_voice', false),
    defaultVolume: integer('default_volume').notNull().default(80),
    voteSkipEnabled: flag('vote_skip_enabled', false),
    voteSkipThreshold: integer('vote_skip_threshold').notNull().default(50),
    announceNowPlaying: flag('announce_now_playing', true),
    autoLeaveTimeoutSeconds: integer('auto_leave_timeout_seconds').notNull().default(120),
    language: text('language', { enum: ['en', 'tl'] })
      .notNull()
      .default('en'),
    cleanMode: flag('clean_mode', false),
    cleanAfterSeconds: integer('clean_after_seconds').notNull().default(30),
    maxQueueSize: integer('max_queue_size').notNull().default(2000),
    maxTrackLengthSeconds: integer('max_track_length_seconds').notNull().default(7200),
    autoplayEnabled: flag('autoplay_enabled', false),
    sponsorBlockEnabled: flag('sponsorblock_enabled', false),
    embedColor: text('embed_color').notNull().default('#5865F2'),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (table) => [
    check('guild_volume_range', sql`${table.defaultVolume} BETWEEN 1 AND 200`),
    check('guild_vote_threshold_range', sql`${table.voteSkipThreshold} BETWEEN 1 AND 100`),
    check('guild_queue_limit_range', sql`${table.maxQueueSize} BETWEEN 1 AND 10000`),
    check('guild_track_limit_range', sql`${table.maxTrackLengthSeconds} BETWEEN 30 AND 86400`),
    check('guild_leave_timeout_range', sql`${table.autoLeaveTimeoutSeconds} BETWEEN 10 AND 86400`),
    check('guild_clean_timeout_range', sql`${table.cleanAfterSeconds} BETWEEN 5 AND 3600`),
    check('guild_language_values', sql`${table.language} IN ('en', 'tl')`),
    check('guild_prefix_length', sql`length(${table.prefix}) BETWEEN 1 AND 10`),
    ...[
      table.stayInVoice,
      table.voteSkipEnabled,
      table.announceNowPlaying,
      table.cleanMode,
      table.autoplayEnabled,
      table.sponsorBlockEnabled,
    ].map((column) => check(`${column.name}_boolean`, sql`${column} IN (0, 1)`)),
  ],
);

export const userFavorites = sqliteTable(
  'user_favorites',
  {
    userId: text('user_id').notNull(),
    trackKey: text('track_key').notNull(),
    trackJson: text('track_json').notNull(),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.trackKey] }),
    index('favorites_user_order_idx').on(table.userId, table.createdAt, table.trackKey),
    check('favorite_track_json_valid', sql`json_valid(${table.trackJson})`),
  ],
);

export const playlists = sqliteTable(
  'playlists',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    name: text('name').notNull(),
    nameKey: text('name_key').notNull(),
    isShared: flag('is_shared', false),
    shareToken: text('share_token'),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (table) => [
    uniqueIndex('playlists_owner_name_idx').on(table.ownerId, table.nameKey),
    uniqueIndex('playlists_share_token_idx').on(table.shareToken),
    index('playlists_owner_order_idx').on(table.ownerId, table.createdAt, table.id),
    check('playlist_name_length', sql`length(${table.name}) BETWEEN 1 AND 64`),
    check(
      'playlist_share_state',
      sql`(${table.isShared} = 0 AND ${table.shareToken} IS NULL) OR (${table.isShared} = 1 AND ${table.shareToken} IS NOT NULL)`,
    ),
  ],
);

export const playlistTracks = sqliteTable(
  'playlist_tracks',
  {
    id: text('id').primaryKey(),
    playlistId: text('playlist_id')
      .notNull()
      .references(() => playlists.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    trackKey: text('track_key').notNull(),
    trackJson: text('track_json').notNull(),
    addedAt: timestamp('added_at'),
  },
  (table) => [
    uniqueIndex('playlist_track_position_idx').on(table.playlistId, table.position),
    check('playlist_position_range', sql`${table.position} BETWEEN 0 AND 9999`),
    check('playlist_track_json_valid', sql`json_valid(${table.trackJson})`),
  ],
);

export const playHistory = sqliteTable(
  'play_history',
  {
    id: text('id').primaryKey(),
    botId: text('bot_id').notNull(),
    guildId: text('guild_id').notNull(),
    userId: text('user_id').notNull(),
    trackKey: text('track_key').notNull(),
    trackJson: text('track_json').notNull(),
    startedAt: integer('started_at').notNull(),
    endedAt: integer('ended_at'),
    endReason: text('end_reason', {
      enum: ['finished', 'skipped', 'stopped', 'error', 'replaced'],
    }),
  },
  (table) => [
    index('history_user_order_idx').on(table.userId, table.startedAt, table.id),
    index('history_guild_order_idx').on(table.guildId, table.startedAt, table.id),
    index('history_bot_order_idx').on(table.botId, table.startedAt, table.id),
    check('history_track_json_valid', sql`json_valid(${table.trackJson})`),
    check('history_start_time', sql`${table.startedAt} >= 0`),
    check(
      'history_end_state',
      sql`(${table.endedAt} IS NULL AND ${table.endReason} IS NULL) OR (${table.endedAt} IS NOT NULL AND ${table.endReason} IS NOT NULL AND ${table.endedAt} >= ${table.startedAt} AND ${table.endReason} IN ('finished', 'skipped', 'stopped', 'error', 'replaced'))`,
    ),
  ],
);

export const queueSnapshots = sqliteTable(
  'queue_snapshots',
  {
    botId: text('bot_id').notNull(),
    guildId: text('guild_id').notNull(),
    voiceChannelId: text('voice_channel_id').notNull(),
    version: integer('version').notNull().default(1),
    generation: text('generation').notNull(),
    revision: integer('revision').notNull().default(1),
    payload: text('payload').notNull(),
    updatedAt: timestamp('updated_at'),
  },
  (table) => [
    primaryKey({ columns: [table.botId, table.guildId] }),
    index('snapshots_bot_order_idx').on(table.botId, table.updatedAt, table.guildId),
    check('snapshot_payload_valid', sql`json_valid(${table.payload})`),
    check('snapshot_version_valid', sql`${table.version} = 1`),
    check('snapshot_revision_valid', sql`${table.revision} >= 1`),
  ],
);

export const blacklist = sqliteTable(
  'blacklist',
  {
    kind: text('kind', { enum: ['user', 'guild'] }).notNull(),
    targetId: text('target_id').notNull(),
    actorId: text('actor_id').notNull(),
    reason: text('reason').notNull(),
    expiresAt: integer('expires_at'),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (table) => [
    primaryKey({ columns: [table.kind, table.targetId] }),
    index('blacklist_expiry_idx').on(table.expiresAt),
    check('blacklist_kind_valid', sql`${table.kind} IN ('user', 'guild')`),
    check('blacklist_reason_length', sql`length(${table.reason}) BETWEEN 1 AND 500`),
    check(
      'blacklist_expiry_valid',
      sql`${table.expiresAt} IS NULL OR ${table.expiresAt} > ${table.createdAt}`,
    ),
  ],
);
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/db/migrations/0000_initial.sql

````sql
CREATE TABLE `blacklist` (
	`kind` text NOT NULL,
	`target_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`reason` text NOT NULL,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`kind`, `target_id`),
	CONSTRAINT "blacklist_kind_valid" CHECK("blacklist"."kind" IN ('user', 'guild')),
	CONSTRAINT "blacklist_reason_length" CHECK(length("blacklist"."reason") BETWEEN 1 AND 500),
	CONSTRAINT "blacklist_expiry_valid" CHECK("blacklist"."expires_at" IS NULL OR "blacklist"."expires_at" > "blacklist"."created_at")
);
--> statement-breakpoint
CREATE INDEX `blacklist_expiry_idx` ON `blacklist` (`expires_at`);--> statement-breakpoint
CREATE TABLE `guild_settings` (
	`guild_id` text PRIMARY KEY NOT NULL,
	`prefix` text DEFAULT '!' NOT NULL,
	`dj_role_id` text,
	`music_channel_id` text,
	`stay_in_voice` integer DEFAULT false NOT NULL,
	`default_volume` integer DEFAULT 80 NOT NULL,
	`vote_skip_enabled` integer DEFAULT false NOT NULL,
	`vote_skip_threshold` integer DEFAULT 50 NOT NULL,
	`announce_now_playing` integer DEFAULT true NOT NULL,
	`auto_leave_timeout_seconds` integer DEFAULT 120 NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`clean_mode` integer DEFAULT false NOT NULL,
	`clean_after_seconds` integer DEFAULT 30 NOT NULL,
	`max_queue_size` integer DEFAULT 2000 NOT NULL,
	`max_track_length_seconds` integer DEFAULT 7200 NOT NULL,
	`autoplay_enabled` integer DEFAULT false NOT NULL,
	`sponsorblock_enabled` integer DEFAULT false NOT NULL,
	`embed_color` text DEFAULT '#5865F2' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "guild_volume_range" CHECK("guild_settings"."default_volume" BETWEEN 1 AND 200),
	CONSTRAINT "guild_vote_threshold_range" CHECK("guild_settings"."vote_skip_threshold" BETWEEN 1 AND 100),
	CONSTRAINT "guild_queue_limit_range" CHECK("guild_settings"."max_queue_size" BETWEEN 1 AND 10000),
	CONSTRAINT "guild_track_limit_range" CHECK("guild_settings"."max_track_length_seconds" BETWEEN 30 AND 86400),
	CONSTRAINT "guild_leave_timeout_range" CHECK("guild_settings"."auto_leave_timeout_seconds" BETWEEN 10 AND 86400),
	CONSTRAINT "guild_clean_timeout_range" CHECK("guild_settings"."clean_after_seconds" BETWEEN 5 AND 3600),
	CONSTRAINT "guild_language_values" CHECK("guild_settings"."language" IN ('en', 'tl')),
	CONSTRAINT "guild_prefix_length" CHECK(length("guild_settings"."prefix") BETWEEN 1 AND 10),
	CONSTRAINT "stay_in_voice_boolean" CHECK("guild_settings"."stay_in_voice" IN (0, 1)),
	CONSTRAINT "vote_skip_enabled_boolean" CHECK("guild_settings"."vote_skip_enabled" IN (0, 1)),
	CONSTRAINT "announce_now_playing_boolean" CHECK("guild_settings"."announce_now_playing" IN (0, 1)),
	CONSTRAINT "clean_mode_boolean" CHECK("guild_settings"."clean_mode" IN (0, 1)),
	CONSTRAINT "autoplay_enabled_boolean" CHECK("guild_settings"."autoplay_enabled" IN (0, 1)),
	CONSTRAINT "sponsorblock_enabled_boolean" CHECK("guild_settings"."sponsorblock_enabled" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `play_history` (
	`id` text PRIMARY KEY NOT NULL,
	`bot_id` text NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`track_key` text NOT NULL,
	`track_json` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`end_reason` text,
	CONSTRAINT "history_track_json_valid" CHECK(json_valid("play_history"."track_json")),
	CONSTRAINT "history_start_time" CHECK("play_history"."started_at" >= 0),
	CONSTRAINT "history_end_state" CHECK(("play_history"."ended_at" IS NULL AND "play_history"."end_reason" IS NULL) OR ("play_history"."ended_at" IS NOT NULL AND "play_history"."end_reason" IS NOT NULL AND "play_history"."ended_at" >= "play_history"."started_at" AND "play_history"."end_reason" IN ('finished', 'skipped', 'stopped', 'error', 'replaced')))
);
--> statement-breakpoint
CREATE INDEX `history_user_order_idx` ON `play_history` (`user_id`,`started_at`,`id`);--> statement-breakpoint
CREATE INDEX `history_guild_order_idx` ON `play_history` (`guild_id`,`started_at`,`id`);--> statement-breakpoint
CREATE INDEX `history_bot_order_idx` ON `play_history` (`bot_id`,`started_at`,`id`);--> statement-breakpoint
CREATE TABLE `playlist_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`playlist_id` text NOT NULL,
	`position` integer NOT NULL,
	`track_key` text NOT NULL,
	`track_json` text NOT NULL,
	`added_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "playlist_position_range" CHECK("playlist_tracks"."position" BETWEEN 0 AND 9999),
	CONSTRAINT "playlist_track_json_valid" CHECK(json_valid("playlist_tracks"."track_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `playlist_track_position_idx` ON `playlist_tracks` (`playlist_id`,`position`);--> statement-breakpoint
CREATE TABLE `playlists` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`is_shared` integer DEFAULT false NOT NULL,
	`share_token` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "playlist_name_length" CHECK(length("playlists"."name") BETWEEN 1 AND 64),
	CONSTRAINT "playlist_share_state" CHECK(("playlists"."is_shared" = 0 AND "playlists"."share_token" IS NULL) OR ("playlists"."is_shared" = 1 AND "playlists"."share_token" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `playlists_owner_name_idx` ON `playlists` (`owner_id`,`name_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `playlists_share_token_idx` ON `playlists` (`share_token`);--> statement-breakpoint
CREATE INDEX `playlists_owner_order_idx` ON `playlists` (`owner_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `queue_snapshots` (
	`bot_id` text NOT NULL,
	`guild_id` text NOT NULL,
	`voice_channel_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`generation` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`payload` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`bot_id`, `guild_id`),
	CONSTRAINT "snapshot_payload_valid" CHECK(json_valid("queue_snapshots"."payload")),
	CONSTRAINT "snapshot_version_valid" CHECK("queue_snapshots"."version" = 1),
	CONSTRAINT "snapshot_revision_valid" CHECK("queue_snapshots"."revision" >= 1)
);
--> statement-breakpoint
CREATE INDEX `snapshots_bot_order_idx` ON `queue_snapshots` (`bot_id`,`updated_at`,`guild_id`);--> statement-breakpoint
CREATE TABLE `user_favorites` (
	`user_id` text NOT NULL,
	`track_key` text NOT NULL,
	`track_json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `track_key`),
	CONSTRAINT "favorite_track_json_valid" CHECK(json_valid("user_favorites"."track_json"))
);
--> statement-breakpoint
CREATE INDEX `favorites_user_order_idx` ON `user_favorites` (`user_id`,`created_at`,`track_key`);
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/db/migrations/meta/_journal.json

````json
{
  "version": "7",
  "dialect": "sqlite",
  "entries": [
    {
      "idx": 0,
      "version": "6",
      "when": 1791804099373,
      "tag": "0000_initial",
      "breakpoints": true
    }
  ]
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/db/migrations/meta/0000_snapshot.json

````json
{
  "version": "6",
  "dialect": "sqlite",
  "id": "2a5d1d65-6149-4be2-a27c-8ba176ab5ba1",
  "prevId": "00000000-0000-0000-0000-000000000000",
  "tables": {
    "blacklist": {
      "name": "blacklist",
      "columns": {
        "kind": {
          "name": "kind",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "target_id": {
          "name": "target_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "actor_id": {
          "name": "actor_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "reason": {
          "name": "reason",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "expires_at": {
          "name": "expires_at",
          "type": "integer",
          "primaryKey": false,
          "notNull": false,
          "autoincrement": false
        },
        "created_at": {
          "name": "created_at",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false,
          "default": "(unixepoch() * 1000)"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false,
          "default": "(unixepoch() * 1000)"
        }
      },
      "indexes": {
        "blacklist_expiry_idx": {
          "name": "blacklist_expiry_idx",
          "columns": [
            "expires_at"
          ],
          "isUnique": false
        }
      },
      "foreignKeys": {},
      "compositePrimaryKeys": {
        "blacklist_kind_target_id_pk": {
          "columns": [
            "kind",
            "target_id"
          ],
          "name": "blacklist_kind_target_id_pk"
        }
      },
      "uniqueConstraints": {},
      "checkConstraints": {
        "blacklist_kind_valid": {
          "name": "blacklist_kind_valid",
          "value": "\"blacklist\".\"kind\" IN ('user', 'guild')"
        },
        "blacklist_reason_length": {
          "name": "blacklist_reason_length",
          "value": "length(\"blacklist\".\"reason\") BETWEEN 1 AND 500"
        },
        "blacklist_expiry_valid": {
          "name": "blacklist_expiry_valid",
          "value": "\"blacklist\".\"expires_at\" IS NULL OR \"blacklist\".\"expires_at\" > \"blacklist\".\"created_at\""
        }
      }
    },
    "guild_settings": {
      "name": "guild_settings",
      "columns": {
        "guild_id": {
          "name": "guild_id",
          "type": "text",
          "primaryKey": true,
          "notNull": true,
          "autoincrement": false
        },
        "prefix": {
          "name": "prefix",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false,
          "default": "'!'"
        },
        "dj_role_id": {
          "name": "dj_role_id",
          "type": "text",
          "primaryKey": false,
          "notNull": false,
          "autoincrement": false
        },
        "music_channel_id": {
          "name": "music_channel_id",
          "type": "text",
          "primaryKey": false,
          "notNull": false,
          "autoincrement": false
        },
        "stay_in_voice": {
          "name": "stay_in_voice",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false,
          "default": false
        },
        "default_volume": {
          "name": "default_volume",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false,
          "default": 80
        },
        "vote_skip_enabled": {
          "name": "vote_skip_enabled",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false,
          "default": false
        },
        "vote_skip_threshold": {
          "name": "vote_skip_threshold",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false,
          "default": 50
        },
        "announce_now_playing": {
          "name": "announce_now_playing",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false,
          "default": true
        },
        "auto_leave_timeout_seconds": {
          "name": "auto_leave_timeout_seconds",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false,
          "default": 120
        },
        "language": {
          "name": "language",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false,
          "default": "'en'"
        },
        "clean_mode": {
          "name": "clean_mode",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false,
          "default": false
        },
        "clean_after_seconds": {
          "name": "clean_after_seconds",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false,
          "default": 30
        },
        "max_queue_size": {
          "name": "max_queue_size",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false,
          "default": 2000
        },
        "max_track_length_seconds": {
          "name": "max_track_length_seconds",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false,
          "default": 7200
        },
        "autoplay_enabled": {
          "name": "autoplay_enabled",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false,
          "default": false
        },
        "sponsorblock_enabled": {
          "name": "sponsorblock_enabled",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false,
          "default": false
        },
        "embed_color": {
          "name": "embed_color",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false,
          "default": "'#5865F2'"
        },
        "created_at": {
          "name": "created_at",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false,
          "default": "(unixepoch() * 1000)"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false,
          "default": "(unixepoch() * 1000)"
        }
      },
      "indexes": {},
      "foreignKeys": {},
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "checkConstraints": {
        "guild_volume_range": {
          "name": "guild_volume_range",
          "value": "\"guild_settings\".\"default_volume\" BETWEEN 1 AND 200"
        },
        "guild_vote_threshold_range": {
          "name": "guild_vote_threshold_range",
          "value": "\"guild_settings\".\"vote_skip_threshold\" BETWEEN 1 AND 100"
        },
        "guild_queue_limit_range": {
          "name": "guild_queue_limit_range",
          "value": "\"guild_settings\".\"max_queue_size\" BETWEEN 1 AND 10000"
        },
        "guild_track_limit_range": {
          "name": "guild_track_limit_range",
          "value": "\"guild_settings\".\"max_track_length_seconds\" BETWEEN 30 AND 86400"
        },
        "guild_leave_timeout_range": {
          "name": "guild_leave_timeout_range",
          "value": "\"guild_settings\".\"auto_leave_timeout_seconds\" BETWEEN 10 AND 86400"
        },
        "guild_clean_timeout_range": {
          "name": "guild_clean_timeout_range",
          "value": "\"guild_settings\".\"clean_after_seconds\" BETWEEN 5 AND 3600"
        },
        "guild_language_values": {
          "name": "guild_language_values",
          "value": "\"guild_settings\".\"language\" IN ('en', 'tl')"
        },
        "guild_prefix_length": {
          "name": "guild_prefix_length",
          "value": "length(\"guild_settings\".\"prefix\") BETWEEN 1 AND 10"
        },
        "stay_in_voice_boolean": {
          "name": "stay_in_voice_boolean",
          "value": "\"guild_settings\".\"stay_in_voice\" IN (0, 1)"
        },
        "vote_skip_enabled_boolean": {
          "name": "vote_skip_enabled_boolean",
          "value": "\"guild_settings\".\"vote_skip_enabled\" IN (0, 1)"
        },
        "announce_now_playing_boolean": {
          "name": "announce_now_playing_boolean",
          "value": "\"guild_settings\".\"announce_now_playing\" IN (0, 1)"
        },
        "clean_mode_boolean": {
          "name": "clean_mode_boolean",
          "value": "\"guild_settings\".\"clean_mode\" IN (0, 1)"
        },
        "autoplay_enabled_boolean": {
          "name": "autoplay_enabled_boolean",
          "value": "\"guild_settings\".\"autoplay_enabled\" IN (0, 1)"
        },
        "sponsorblock_enabled_boolean": {
          "name": "sponsorblock_enabled_boolean",
          "value": "\"guild_settings\".\"sponsorblock_enabled\" IN (0, 1)"
        }
      }
    },
    "play_history": {
      "name": "play_history",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true,
          "autoincrement": false
        },
        "bot_id": {
          "name": "bot_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "guild_id": {
          "name": "guild_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "user_id": {
          "name": "user_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "track_key": {
          "name": "track_key",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "track_json": {
          "name": "track_json",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "started_at": {
          "name": "started_at",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "ended_at": {
          "name": "ended_at",
          "type": "integer",
          "primaryKey": false,
          "notNull": false,
          "autoincrement": false
        },
        "end_reason": {
          "name": "end_reason",
          "type": "text",
          "primaryKey": false,
          "notNull": false,
          "autoincrement": false
        }
      },
      "indexes": {
        "history_user_order_idx": {
          "name": "history_user_order_idx",
          "columns": [
            "user_id",
            "started_at",
            "id"
          ],
          "isUnique": false
        },
        "history_guild_order_idx": {
          "name": "history_guild_order_idx",
          "columns": [
            "guild_id",
            "started_at",
            "id"
          ],
          "isUnique": false
        },
        "history_bot_order_idx": {
          "name": "history_bot_order_idx",
          "columns": [
            "bot_id",
            "started_at",
            "id"
          ],
          "isUnique": false
        }
      },
      "foreignKeys": {},
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "checkConstraints": {
        "history_track_json_valid": {
          "name": "history_track_json_valid",
          "value": "json_valid(\"play_history\".\"track_json\")"
        },
        "history_start_time": {
          "name": "history_start_time",
          "value": "\"play_history\".\"started_at\" >= 0"
        },
        "history_end_state": {
          "name": "history_end_state",
          "value": "(\"play_history\".\"ended_at\" IS NULL AND \"play_history\".\"end_reason\" IS NULL) OR (\"play_history\".\"ended_at\" IS NOT NULL AND \"play_history\".\"end_reason\" IS NOT NULL AND \"play_history\".\"ended_at\" >= \"play_history\".\"started_at\" AND \"play_history\".\"end_reason\" IN ('finished', 'skipped', 'stopped', 'error', 'replaced'))"
        }
      }
    },
    "playlist_tracks": {
      "name": "playlist_tracks",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true,
          "autoincrement": false
        },
        "playlist_id": {
          "name": "playlist_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "position": {
          "name": "position",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "track_key": {
          "name": "track_key",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "track_json": {
          "name": "track_json",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "added_at": {
          "name": "added_at",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false,
          "default": "(unixepoch() * 1000)"
        }
      },
      "indexes": {
        "playlist_track_position_idx": {
          "name": "playlist_track_position_idx",
          "columns": [
            "playlist_id",
            "position"
          ],
          "isUnique": true
        }
      },
      "foreignKeys": {
        "playlist_tracks_playlist_id_playlists_id_fk": {
          "name": "playlist_tracks_playlist_id_playlists_id_fk",
          "tableFrom": "playlist_tracks",
          "tableTo": "playlists",
          "columnsFrom": [
            "playlist_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "checkConstraints": {
        "playlist_position_range": {
          "name": "playlist_position_range",
          "value": "\"playlist_tracks\".\"position\" BETWEEN 0 AND 9999"
        },
        "playlist_track_json_valid": {
          "name": "playlist_track_json_valid",
          "value": "json_valid(\"playlist_tracks\".\"track_json\")"
        }
      }
    },
    "playlists": {
      "name": "playlists",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true,
          "autoincrement": false
        },
        "owner_id": {
          "name": "owner_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "name": {
          "name": "name",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "name_key": {
          "name": "name_key",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "is_shared": {
          "name": "is_shared",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false,
          "default": false
        },
        "share_token": {
          "name": "share_token",
          "type": "text",
          "primaryKey": false,
          "notNull": false,
          "autoincrement": false
        },
        "created_at": {
          "name": "created_at",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false,
          "default": "(unixepoch() * 1000)"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false,
          "default": "(unixepoch() * 1000)"
        }
      },
      "indexes": {
        "playlists_owner_name_idx": {
          "name": "playlists_owner_name_idx",
          "columns": [
            "owner_id",
            "name_key"
          ],
          "isUnique": true
        },
        "playlists_share_token_idx": {
          "name": "playlists_share_token_idx",
          "columns": [
            "share_token"
          ],
          "isUnique": true
        },
        "playlists_owner_order_idx": {
          "name": "playlists_owner_order_idx",
          "columns": [
            "owner_id",
            "created_at",
            "id"
          ],
          "isUnique": false
        }
      },
      "foreignKeys": {},
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "checkConstraints": {
        "playlist_name_length": {
          "name": "playlist_name_length",
          "value": "length(\"playlists\".\"name\") BETWEEN 1 AND 64"
        },
        "playlist_share_state": {
          "name": "playlist_share_state",
          "value": "(\"playlists\".\"is_shared\" = 0 AND \"playlists\".\"share_token\" IS NULL) OR (\"playlists\".\"is_shared\" = 1 AND \"playlists\".\"share_token\" IS NOT NULL)"
        }
      }
    },
    "queue_snapshots": {
      "name": "queue_snapshots",
      "columns": {
        "bot_id": {
          "name": "bot_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "guild_id": {
          "name": "guild_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "voice_channel_id": {
          "name": "voice_channel_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "version": {
          "name": "version",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false,
          "default": 1
        },
        "generation": {
          "name": "generation",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "revision": {
          "name": "revision",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false,
          "default": 1
        },
        "payload": {
          "name": "payload",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "updated_at": {
          "name": "updated_at",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false,
          "default": "(unixepoch() * 1000)"
        }
      },
      "indexes": {
        "snapshots_bot_order_idx": {
          "name": "snapshots_bot_order_idx",
          "columns": [
            "bot_id",
            "updated_at",
            "guild_id"
          ],
          "isUnique": false
        }
      },
      "foreignKeys": {},
      "compositePrimaryKeys": {
        "queue_snapshots_bot_id_guild_id_pk": {
          "columns": [
            "bot_id",
            "guild_id"
          ],
          "name": "queue_snapshots_bot_id_guild_id_pk"
        }
      },
      "uniqueConstraints": {},
      "checkConstraints": {
        "snapshot_payload_valid": {
          "name": "snapshot_payload_valid",
          "value": "json_valid(\"queue_snapshots\".\"payload\")"
        },
        "snapshot_version_valid": {
          "name": "snapshot_version_valid",
          "value": "\"queue_snapshots\".\"version\" = 1"
        },
        "snapshot_revision_valid": {
          "name": "snapshot_revision_valid",
          "value": "\"queue_snapshots\".\"revision\" >= 1"
        }
      }
    },
    "user_favorites": {
      "name": "user_favorites",
      "columns": {
        "user_id": {
          "name": "user_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "track_key": {
          "name": "track_key",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "track_json": {
          "name": "track_json",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "created_at": {
          "name": "created_at",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false,
          "default": "(unixepoch() * 1000)"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false,
          "default": "(unixepoch() * 1000)"
        }
      },
      "indexes": {
        "favorites_user_order_idx": {
          "name": "favorites_user_order_idx",
          "columns": [
            "user_id",
            "created_at",
            "track_key"
          ],
          "isUnique": false
        }
      },
      "foreignKeys": {},
      "compositePrimaryKeys": {
        "user_favorites_user_id_track_key_pk": {
          "columns": [
            "user_id",
            "track_key"
          ],
          "name": "user_favorites_user_id_track_key_pk"
        }
      },
      "uniqueConstraints": {},
      "checkConstraints": {
        "favorite_track_json_valid": {
          "name": "favorite_track_json_valid",
          "value": "json_valid(\"user_favorites\".\"track_json\")"
        }
      }
    }
  },
  "views": {},
  "enums": {},
  "_meta": {
    "schemas": {},
    "tables": {},
    "columns": {}
  },
  "internal": {
    "indexes": {}
  }
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/db/models.ts

````typescript
import { z } from 'zod';

export const snowflakeSchema = z.string().regex(/^\d{17,20}$/);
const epoch = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const boundedText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) =>
      [...value].every((character) => {
        const point = character.codePointAt(0) ?? 0;
        return point >= 32 && point !== 127;
      }),
    );
const webUrl = z
  .string()
  .max(4096)
  .url()
  .refine((value) => {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  });

export const musicSourceSchema = z.enum([
  'youtube',
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
]);

/** Catalog identity survives changes to the selected audio mirror. No credentials belong here. */
export const storedTrackSchema = z.strictObject({
  version: z.literal(1),
  key: boundedText(256),
  title: boundedText(300),
  artist: boundedText(300),
  source: musicSourceSchema,
  identifier: boundedText(1024).nullable(),
  uri: webUrl.nullable(),
  durationMs: z.number().int().min(0).max(86_400_000),
  isStream: z.boolean(),
  artworkUrl: webUrl.nullable(),
  isrc: z
    .string()
    .regex(/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/)
    .nullable(),
  album: boundedText(300).nullable(),
  localFileId: z.uuid().nullable(),
});
export type StoredTrack = z.infer<typeof storedTrackSchema>;
export type MusicSource = z.infer<typeof musicSourceSchema>;

export const requesterSchema = z.strictObject({
  userId: snowflakeSchema,
  displayName: boundedText(100),
  avatarUrl: webUrl.nullable(),
});
export type Requester = z.infer<typeof requesterSchema>;

export const playableTrackSchema = z.strictObject({
  encoded: z.string().min(1).max(20_000),
  identifier: boundedText(1024),
  title: boundedText(300),
  artist: boundedText(300),
  source: musicSourceSchema.exclude(['spotify', 'applemusic']),
  uri: webUrl.nullable(),
  durationMs: z.number().int().min(0).max(86_400_000),
  isStream: z.boolean(),
  isSeekable: z.boolean(),
  artworkUrl: webUrl.nullable(),
  isrc: z
    .string()
    .regex(/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/)
    .nullable(),
  isPreview: z.literal(false),
});
export type PlayableTrack = z.infer<typeof playableTrackSchema>;

export const queueEntrySchema = z.strictObject({
  id: z.uuid(),
  track: storedTrackSchema,
  requester: requesterSchema,
  addedAt: epoch,
  playable: playableTrackSchema.nullable(),
});
export type QueueEntry = z.infer<typeof queueEntrySchema>;

const wave = z.strictObject({
  frequency: z.number().min(0.1).max(14),
  depth: z.number().min(0).max(1),
});
const mixGain = z.number().min(0).max(1);
export const audioFiltersSchema = z.strictObject({
  equalizer: z
    .array(
      z.strictObject({ band: z.number().int().min(0).max(14), gain: z.number().min(-0.25).max(1) }),
    )
    .max(15)
    .optional(),
  timescale: z
    .strictObject({
      speed: z.number().min(0.25).max(4),
      pitch: z.number().min(0.25).max(4),
      rate: z.number().min(0.25).max(4),
    })
    .optional(),
  karaoke: z
    .strictObject({
      level: mixGain,
      monoLevel: mixGain,
      filterBand: z.number().min(0).max(22_000),
      filterWidth: z.number().min(1).max(22_000),
    })
    .optional(),
  tremolo: wave.optional(),
  vibrato: wave.optional(),
  rotation: z.strictObject({ rotationHz: z.number().min(-5).max(5) }).optional(),
  lowPass: z.strictObject({ smoothing: z.number().min(1).max(2000) }).optional(),
  channelMix: z
    .strictObject({
      leftToLeft: mixGain,
      leftToRight: mixGain,
      rightToLeft: mixGain,
      rightToRight: mixGain,
    })
    .optional(),
});
export type AudioFilters = z.infer<typeof audioFiltersSchema>;
export const loopModeSchema = z.enum(['off', 'track', 'queue']);
export type LoopMode = z.infer<typeof loopModeSchema>;

export const pendingImportSchema = z.strictObject({
  id: z.uuid(),
  query: z.string().trim().min(1).max(4096),
  requester: requesterSchema,
  mode: z.enum(['append', 'next']),
  processedCount: z.number().int().min(0).max(10_000),
  limit: z.number().int().min(1).max(10_000),
  enqueuedKeys: z.array(boundedText(256)).max(10_000),
  createdAt: epoch,
});
export type PendingImport = z.infer<typeof pendingImportSchema>;

export const queueSnapshotSchema = z
  .strictObject({
    version: z.literal(1),
    botId: snowflakeSchema,
    guildId: snowflakeSchema,
    voiceChannelId: snowflakeSchema,
    textChannelId: snowflakeSchema.nullable(),
    nodeId: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,64}$/)
      .nullable(),
    nodeSessionId: boundedText(256).nullable(),
    current: queueEntrySchema.nullable(),
    currentPlaybackId: z.uuid().nullable(),
    upcoming: z.array(queueEntrySchema).max(10_000),
    previous: z.array(queueEntrySchema).max(50),
    positionMs: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    paused: z.boolean(),
    volume: z.number().int().min(1).max(200),
    loopMode: loopModeSchema,
    autoplay: z.boolean(),
    filters: audioFiltersSchema,
    pendingImports: z.array(pendingImportSchema).max(10),
  })
  .superRefine((value, context) => {
    const entries = value.current ? [value.current, ...value.upcoming] : value.upcoming;
    if (new Set(entries.map((entry) => entry.id)).size !== entries.length) {
      context.addIssue({
        code: 'custom',
        path: ['upcoming'],
        message: 'Active queue entry IDs must be unique.',
      });
    }
    if (!value.current && value.currentPlaybackId) {
      context.addIssue({
        code: 'custom',
        path: ['currentPlaybackId'],
        message: 'A playback ID requires a current track.',
      });
    }
  });
export type QueueSnapshot = z.infer<typeof queueSnapshotSchema>;

export const settingsValuesSchema = z.strictObject({
  prefix: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .regex(/^[^\s@<>`]+$/),
  djRoleId: snowflakeSchema.nullable(),
  musicChannelId: snowflakeSchema.nullable(),
  stayInVoice: z.boolean(),
  defaultVolume: z.number().int().min(1).max(200),
  voteSkipEnabled: z.boolean(),
  voteSkipThreshold: z.number().int().min(1).max(100),
  announceNowPlaying: z.boolean(),
  autoLeaveTimeoutSeconds: z.number().int().min(10).max(86_400),
  language: z.enum(['en', 'tl']),
  cleanMode: z.boolean(),
  cleanAfterSeconds: z.number().int().min(5).max(3600),
  maxQueueSize: z.number().int().min(1).max(10_000),
  maxTrackLengthSeconds: z.number().int().min(30).max(86_400),
  autoplayEnabled: z.boolean(),
  sponsorBlockEnabled: z.boolean(),
  embedColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export const settingsDefaultsSchema = settingsValuesSchema.partial();
export const settingsPatchSchema = settingsDefaultsSchema.refine(
  (patch) => Object.values(patch).some((value) => value !== undefined),
  'Provide at least one setting.',
);
export const guildSettingsSchema = settingsValuesSchema.extend({
  guildId: snowflakeSchema,
  createdAt: epoch,
  updatedAt: epoch,
});
export type GuildSettings = z.infer<typeof guildSettingsSchema>;
export type GuildSettingsPatch = z.infer<typeof settingsDefaultsSchema>;

export const playlistNameSchema = boundedText(64).refine((value) => !/[<>`]/.test(value));
export const shareTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{32}$/);
export const playlistSchema = z
  .strictObject({
    id: z.uuid(),
    ownerId: snowflakeSchema,
    name: playlistNameSchema,
    nameKey: z.string().min(1).max(128),
    isShared: z.boolean(),
    shareToken: shareTokenSchema.nullable(),
    createdAt: epoch,
    updatedAt: epoch,
  })
  .refine((value) => value.isShared === Boolean(value.shareToken));
export type PersonalPlaylist = z.infer<typeof playlistSchema>;

export interface Favorite {
  userId: string;
  trackKey: string;
  track: StoredTrack;
  createdAt: number;
  updatedAt: number;
}
export interface PlaylistTrack {
  id: string;
  position: number;
  track: StoredTrack;
  addedAt: number;
}
export interface PageRequest {
  page?: number;
  pageSize?: number;
}
export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
export interface PlaylistView {
  playlist: PersonalPlaylist;
  tracks: Page<PlaylistTrack>;
}
export interface SnapshotVersion {
  generation: string;
  revision: number;
}
export interface SnapshotSummary extends SnapshotVersion {
  botId: string;
  guildId: string;
  voiceChannelId: string;
  updatedAt: number;
}
export interface SnapshotRecord extends SnapshotSummary {
  snapshot: QueueSnapshot;
}

export const historyEndReasonSchema = z.enum([
  'finished',
  'skipped',
  'stopped',
  'error',
  'replaced',
]);
export type HistoryEndReason = z.infer<typeof historyEndReasonSchema>;
export const historyInputSchema = z.strictObject({
  id: z.uuid(),
  botId: snowflakeSchema,
  guildId: snowflakeSchema,
  userId: snowflakeSchema,
  track: storedTrackSchema,
  startedAt: epoch,
});
export type HistoryInput = z.infer<typeof historyInputSchema>;
export interface HistoryEntry extends HistoryInput {
  endedAt: number | null;
  endReason: HistoryEndReason | null;
}
export interface HistoryFilter {
  userId?: string;
  guildId?: string;
  botId?: string;
}

export const blacklistInputSchema = z.strictObject({
  kind: z.enum(['user', 'guild']),
  targetId: snowflakeSchema,
  actorId: snowflakeSchema,
  reason: boundedText(500),
  expiresAt: epoch.nullable(),
});
export type BlacklistInput = z.infer<typeof blacklistInputSchema>;
export type BlacklistKind = BlacklistInput['kind'];
export interface BlacklistEntry extends BlacklistInput {
  createdAt: number;
  updatedAt: number;
}

export const repositoryLimitsSchema = z.strictObject({
  favoritesPerUser: z.number().int().min(1).max(10_000).default(2000),
  playlistsPerUser: z.number().int().min(1).max(500).default(50),
  tracksPerPlaylist: z.number().int().min(1).max(10_000).default(2000),
  historyPerUser: z.number().int().min(1).max(10_000).default(1000),
});
export type RepositoryLimits = z.infer<typeof repositoryLimitsSchema>;
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/db/contracts.ts

````typescript
import type {
  BlacklistEntry,
  BlacklistInput,
  BlacklistKind,
  Favorite,
  GuildSettings,
  GuildSettingsPatch,
  HistoryEndReason,
  HistoryEntry,
  HistoryFilter,
  HistoryInput,
  Page,
  PageRequest,
  PersonalPlaylist,
  PlaylistView,
  QueueSnapshot,
  SnapshotRecord,
  SnapshotSummary,
  SnapshotVersion,
  StoredTrack,
} from './models.js';

/** Backend-neutral Promise APIs: commands and music services never receive a SQLite handle. */
export interface GuildSettingsRepository {
  get(guildId: string): Promise<GuildSettings>;
  update(guildId: string, patch: GuildSettingsPatch): Promise<GuildSettings>;
}
export interface UserFavoritesRepository {
  add(userId: string, track: StoredTrack): Promise<Favorite>;
  get(userId: string, trackKey: string): Promise<Favorite | null>;
  remove(userId: string, trackKey: string): Promise<boolean>;
  list(userId: string, request?: PageRequest): Promise<Page<Favorite>>;
  all(userId: string): Promise<StoredTrack[]>;
}
export interface PlaylistsRepository {
  create(ownerId: string, name: string): Promise<PersonalPlaylist>;
  findOwned(ownerId: string, nameOrId: string): Promise<PersonalPlaylist | null>;
  list(ownerId: string, request?: PageRequest): Promise<Page<PersonalPlaylist>>;
  delete(ownerId: string, playlistId: string): Promise<void>;
  viewOwned(ownerId: string, playlistId: string, request?: PageRequest): Promise<PlaylistView>;
  tracksOwned(ownerId: string, playlistId: string): Promise<StoredTrack[]>;
  append(ownerId: string, playlistId: string, tracks: readonly StoredTrack[]): Promise<number>;
  remove(ownerId: string, playlistId: string, positions: readonly number[]): Promise<number>;
  setShared(ownerId: string, playlistId: string, enabled: boolean): Promise<PersonalPlaylist>;
  viewShared(shareToken: string, request?: PageRequest): Promise<PlaylistView>;
  tracksShared(shareToken: string): Promise<StoredTrack[]>;
}
export interface HistoryRepository {
  record(input: HistoryInput): Promise<HistoryEntry>;
  finish(playbackId: string, reason: HistoryEndReason): Promise<boolean>;
  list(filter: HistoryFilter, request?: PageRequest): Promise<Page<HistoryEntry>>;
  stats(filter: HistoryFilter): Promise<{ plays: number; uniqueTracks: number }>;
}
export interface QueueSnapshotsRepository {
  load(botId: string, guildId: string): Promise<SnapshotRecord | null>;
  list(botId: string): Promise<SnapshotSummary[]>;
  save(snapshot: QueueSnapshot, expectedVersion: SnapshotVersion | null): Promise<SnapshotRecord>;
  delete(botId: string, guildId: string, expectedVersion: SnapshotVersion): Promise<boolean>;
}
export interface BlacklistRepository {
  set(input: BlacklistInput): Promise<BlacklistEntry>;
  remove(kind: BlacklistKind, targetId: string): Promise<boolean>;
  findMatch(userId: string, guildId: string): Promise<BlacklistEntry | null>;
  list(
    options?: { kind?: BlacklistKind; includeExpired?: boolean },
    request?: PageRequest,
  ): Promise<Page<BlacklistEntry>>;
  purgeExpired(): Promise<number>;
}
export interface Repositories {
  guildSettings: GuildSettingsRepository;
  userFavorites: UserFavoritesRepository;
  playlists: PlaylistsRepository;
  history: HistoryRepository;
  queueSnapshots: QueueSnapshotsRepository;
  blacklist: BlacklistRepository;
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/db/client.ts

````typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import * as schema from './schema.js';

export type AppDatabase = BetterSQLite3Database<typeof schema>;
export type DatabaseExecutor = Pick<AppDatabase, 'select' | 'insert' | 'update' | 'delete'>;
export interface DatabaseConnection {
  db: AppDatabase;
  sqlite: Database.Database;
  close(): void;
}

export function openDatabase(path = './data/music.sqlite'): DatabaseConnection {
  const filename = path === ':memory:' ? path : resolve(path);
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const sqlite = new Database(filename, { timeout: 5000 });
  try {
    sqlite.pragma('foreign_keys = ON');
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('synchronous = FULL');
    const db = drizzle(sqlite, { schema, logger: false });
    return {
      db,
      sqlite,
      close: () => {
        if (sqlite.open) sqlite.close();
      },
    };
  } catch (error) {
    sqlite.close();
    throw error;
  }
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/db/migrate.ts

````typescript
import { readMigrationFiles } from 'drizzle-orm/migrator';
import type { MigrationMeta } from 'drizzle-orm/migrator';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatabaseConnection } from './client.js';

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

export function findMigrationsDirectory(): string {
  const directory = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(directory, 'migrations'),
    resolve(directory, '../migrations'),
    resolve(directory, '../../migrations'),
  ];
  const folder = candidates.find((candidate) =>
    existsSync(resolve(candidate, 'meta/_journal.json')),
  );
  if (!folder)
    throw new MigrationError(
      'Migration assets are missing. Run npm run build from the project root.',
    );
  return folder;
}

/** Drizzle's SQL/journal format, with an immediate SQLite lock before reading applied migrations. */
export function applyMigrations(
  connection: DatabaseConnection,
  folder = findMigrationsDirectory(),
): void {
  let migrations: MigrationMeta[];
  try {
    migrations = readMigrationFiles({ migrationsFolder: folder });
  } catch {
    throw new MigrationError(
      'Migration files or their journal cannot be read. Check the packaged migration assets.',
    );
  }
  const sqlite = connection.sqlite;
  sqlite
    .transaction(() => {
      sqlite.exec(
        'CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL, created_at NUMERIC NOT NULL)',
      );
      const applied = sqlite
        .prepare<[], { hash: string; created_at: number }>(
          'SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at',
        )
        .all();
      for (const row of applied) {
        const migration = migrations.find((item) => item.folderMillis === row.created_at);
        if (!migration || migration.hash !== row.hash) {
          throw new MigrationError(
            'Migration history differs from this build. Restore the matching migration files before starting.',
          );
        }
      }
      const appliedTimes = new Set(applied.map((row) => row.created_at));
      const insert = sqlite.prepare<[string, number]>(
        'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
      );
      for (const migration of migrations) {
        if (appliedTimes.has(migration.folderMillis)) continue;
        if (applied.some((row) => row.created_at > migration.folderMillis)) {
          throw new MigrationError('Migration history contains a gap. Repair it before starting.');
        }
        for (const statement of migration.sql) if (statement.trim()) sqlite.exec(statement);
        insert.run(migration.hash, migration.folderMillis);
      }
    })
    .immediate();
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/db/validation.ts

````typescript
import type { z } from 'zod';
import { z as validator } from 'zod';
import type { Page, PageRequest } from './models.js';

export type RepositoryErrorCode =
  'INVALID_INPUT' | 'NOT_FOUND' | 'CONFLICT' | 'LIMIT' | 'CORRUPT_DATA' | 'STALE_SNAPSHOT';
export class RepositoryError extends Error {
  constructor(
    public readonly code: RepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export function validateInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new RepositoryError('INVALID_INPUT', 'Invalid database request.');
  return result.data;
}

export function validateStored<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new RepositoryError(
      'CORRUPT_DATA',
      'Stored data is invalid or uses an unsupported version.',
    );
  return result.data;
}

export function readStoredJson<T>(schema: z.ZodType<T>, text: string, maxBytes = 65_536): T {
  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    throw new RepositoryError('CORRUPT_DATA', 'Stored JSON exceeds its size limit.');
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new RepositoryError('CORRUPT_DATA', 'Stored JSON is invalid.');
  }
  return validateStored(schema, value);
}

/** Keeps repository APIs asynchronous and catches synchronous SQLite/validation errors. */
export function runRepository<T>(operation: () => T): Promise<T> {
  return Promise.resolve().then(operation);
}

const pageRequestSchema = validator.strictObject({
  page: validator.number().int().min(1).max(1_000_000).default(1),
  pageSize: validator.number().int().min(1).max(100).default(10),
});
export function pagination(total: number, request: PageRequest = {}) {
  const input = validateInput(pageRequestSchema, request);
  const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
  const page = Math.min(input.page, totalPages);
  return { page, pageSize: input.pageSize, total, totalPages, offset: (page - 1) * input.pageSize };
}
export function makePage<T>(items: T[], paging: ReturnType<typeof pagination>): Page<T> {
  return {
    items,
    page: paging.page,
    pageSize: paging.pageSize,
    total: paging.total,
    totalPages: paging.totalPages,
  };
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/db/index.ts

````typescript
import type { DatabaseConnection } from './client.js';
import type { Repositories } from './contracts.js';
import type { GuildSettingsPatch, RepositoryLimits } from './models.js';
import { repositoryLimitsSchema } from './models.js';
import { validateInput } from './validation.js';
import { SqliteBlacklistRepository } from './repositories/blacklist.js';
import { SqliteGuildSettingsRepository } from './repositories/guildSettings.js';
import { SqliteHistoryRepository } from './repositories/history.js';
import { SqlitePlaylistsRepository } from './repositories/playlists.js';
import { SqliteQueueSnapshotsRepository } from './repositories/queueSnapshots.js';
import { SqliteUserFavoritesRepository } from './repositories/userFavorites.js';

export interface RepositoryOptions {
  guildDefaults?: GuildSettingsPatch;
  limits?: Partial<RepositoryLimits>;
}
export function createRepositories(
  connection: DatabaseConnection,
  options: RepositoryOptions = {},
): Repositories {
  const limits = validateInput(repositoryLimitsSchema, options.limits ?? {});
  const db = connection.db;
  return {
    guildSettings: new SqliteGuildSettingsRepository(db, options.guildDefaults),
    userFavorites: new SqliteUserFavoritesRepository(db, limits.favoritesPerUser),
    playlists: new SqlitePlaylistsRepository(db, limits),
    history: new SqliteHistoryRepository(db, limits.historyPerUser),
    queueSnapshots: new SqliteQueueSnapshotsRepository(db),
    blacklist: new SqliteBlacklistRepository(db),
  };
}

export { openDatabase } from './client.js';
export { applyMigrations, findMigrationsDirectory, MigrationError } from './migrate.js';
export { RepositoryError } from './validation.js';
export type { DatabaseConnection } from './client.js';
export type { Repositories } from './contracts.js';
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/db/repositories/guildSettings.ts

````typescript
import { eq } from 'drizzle-orm';
import type { AppDatabase } from '../client.js';
import type { GuildSettingsRepository } from '../contracts.js';
import {
  guildSettingsSchema,
  settingsDefaultsSchema,
  settingsPatchSchema,
  snowflakeSchema,
} from '../models.js';
import type { GuildSettingsPatch } from '../models.js';
import { guildSettings } from '../schema.js';
import { RepositoryError, runRepository, validateInput, validateStored } from '../validation.js';

export class SqliteGuildSettingsRepository implements GuildSettingsRepository {
  private readonly defaults: GuildSettingsPatch;
  constructor(
    private readonly db: AppDatabase,
    defaults: GuildSettingsPatch = {},
  ) {
    this.defaults = validateInput(settingsDefaultsSchema, defaults);
  }

  get(guildId: string) {
    return runRepository(() => {
      const id = validateInput(snowflakeSchema, guildId);
      const now = Date.now();
      this.db
        .insert(guildSettings)
        .values({ ...this.defaults, guildId: id, createdAt: now, updatedAt: now })
        .onConflictDoNothing()
        .run();
      const row = this.db.select().from(guildSettings).where(eq(guildSettings.guildId, id)).get();
      if (!row) throw new RepositoryError('NOT_FOUND', 'Guild settings were not found.');
      return validateStored(guildSettingsSchema, row);
    });
  }

  update(guildId: string, patch: GuildSettingsPatch) {
    return runRepository(() => {
      const id = validateInput(snowflakeSchema, guildId);
      const values = validateInput(settingsPatchSchema, patch);
      return this.db.transaction(
        (tx) => {
          const now = Date.now();
          tx.insert(guildSettings)
            .values({ ...this.defaults, guildId: id, createdAt: now, updatedAt: now })
            .onConflictDoNothing()
            .run();
          const row = tx
            .update(guildSettings)
            .set({ ...values, updatedAt: now })
            .where(eq(guildSettings.guildId, id))
            .returning()
            .get();
          if (!row) throw new RepositoryError('NOT_FOUND', 'Guild settings were not found.');
          return validateStored(guildSettingsSchema, row);
        },
        { behavior: 'immediate' },
      );
    });
  }
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/db/repositories/userFavorites.ts

````typescript
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
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/db/repositories/playlists.ts

````typescript
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
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/db/repositories/history.ts

````typescript
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
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/db/repositories/queueSnapshots.ts

````typescript
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
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/db/repositories/blacklist.ts

````typescript
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
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/config/database.ts

````typescript
import { config } from 'dotenv';
import { z } from 'zod';

export function loadDatabasePath(): string {
  config({ quiet: true });
  const result = z
    .string()
    .trim()
    .min(1)
    .safeParse(process.env.DATABASE_PATH?.trim() || './data/music.sqlite');
  if (!result.success) throw new Error('DATABASE_PATH must be a nonempty database filename.');
  return result.data;
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/config/env.ts

````typescript
import { config as loadDotenv } from 'dotenv';
import { isIP } from 'node:net';
import { z } from 'zod';

const blankToUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalText = z.preprocess(blankToUndefined, z.string().trim().optional());
const snowflake = z.string().regex(/^\d{17,20}$/, 'Use a Discord snowflake ID.');
const placeholder = /^(?:replace(?:_|-)|change(?:me|_|-)|your(?:_|-)|example(?:_|-))/i;
const secret = z
  .string()
  .trim()
  .min(16)
  .refine((value) => !placeholder.test(value), {
    message: 'Replace the example value with your own secret.',
  });
const token = secret.min(50).regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, {
  message: 'Use a Discord bot token from the Developer Portal.',
});
const optionalSecret = z.preprocess(blankToUndefined, secret.optional());
const optionalSnowflake = z.preprocess(blankToUndefined, snowflake.optional());
const integer = (fallback: number, min: number, max: number) =>
  z.preprocess(blankToUndefined, z.coerce.number().int().min(min).max(max).default(fallback));
const boolean = (fallback: boolean) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? blankToUndefined(value.trim().toLowerCase()) : value),
    z
      .enum(['true', 'false'])
      .default(fallback ? 'true' : 'false')
      .transform((value) => value === 'true'),
  );
const json = <T>(schema: z.ZodType<T>, fallback: string) =>
  z
    .preprocess(blankToUndefined, z.string().default(fallback))
    .transform((value, context): unknown => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        context.addIssue({ code: 'custom', message: 'Use valid JSON; values are not logged.' });
        return z.NEVER;
      }
    })
    .pipe(schema);
const hostname = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .refine(
    (value) =>
      isIP(value) !== 0 ||
      /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(
        value,
      ),
    'Use a hostname or IP address without a scheme, path, or port.',
  );
const httpsUrl = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password;
}, 'Use an HTTPS URL without credentials.');

export const lavalinkNodeSchema = z.strictObject({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  host: hostname,
  port: z.number().int().min(1).max(65_535).default(2333),
  authorization: secret,
  secure: z.boolean().default(false),
  retryAmount: z.number().int().min(1).max(1000).default(100),
  retryDelay: z.number().int().min(1000).max(60_000).default(5000),
});

export type LavalinkNodeConfig = z.infer<typeof lavalinkNodeSchema>;

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DISCORD_TOKEN: token,
    DISCORD_CLIENT_ID: snowflake,
    DISCORD_GUILD_ID: optionalSnowflake,
    OWNER_IDS: z
      .string()
      .default('')
      .transform((value) => [
        ...new Set(
          value
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean),
        ),
      ])
      .pipe(z.array(snowflake).max(20)),
    EXTRA_BOT_TOKENS: json(z.array(token).max(10), '[]').refine(
      (values) => new Set(values).size === values.length,
      'Extra bot tokens must be unique.',
    ),
    SHARD_COUNT: z
      .union([z.literal('auto'), z.coerce.number().int().min(1).max(1000)])
      .default('auto'),
    LAVALINK_HOST: hostname.default('127.0.0.1'),
    LAVALINK_PORT: integer(2333, 1, 65_535),
    LAVALINK_PASSWORD: optionalSecret,
    LAVALINK_SECURE: boolean(false),
    LAVALINK_NODES: json(z.array(lavalinkNodeSchema).max(20), '[]'),
    LAVALINK_RESUME_TIMEOUT_SECONDS: integer(120, 30, 3600),
    LAVALINK_REQUEST_TIMEOUT_MS: integer(30_000, 1000, 120_000),
    DATABASE_PATH: z.preprocess(
      blankToUndefined,
      z.string().trim().min(1).default('./data/music.sqlite'),
    ),
    REDIS_URL: z.preprocess(
      blankToUndefined,
      z
        .url()
        .refine((value) => ['redis:', 'rediss:'].includes(new URL(value).protocol), {
          message: 'Use a redis:// or rediss:// URL.',
        })
        .optional(),
    ),
    LOG_LEVEL: z
      .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
      .default('info'),
    LOG_PRETTY: boolean(true),
    DEFAULT_PREFIX: z
      .string()
      .trim()
      .min(1)
      .max(10)
      .refine(
        (value) => !/[\s@<>`]/.test(value),
        'Use a prefix without whitespace, mentions, or backticks.',
      )
      .default('!'),
    EMBED_COLOR: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default('#5865F2'),
    DEFAULT_LANGUAGE: z.enum(['en', 'tl']).default('en'),
    DEFAULT_VOLUME: integer(80, 1, 200),
    MAX_QUEUE_SIZE: integer(2000, 5, 10_000),
    MAX_PLAYLIST_IMPORT: integer(2000, 5, 10_000),
    MAX_TRACK_LENGTH_SECONDS: integer(7200, 30, 86_400),
    AUTO_LEAVE_TIMEOUT_SECONDS: integer(120, 10, 86_400),
    COMMAND_COOLDOWN_MS: integer(1500, 100, 60_000),
    CONTROLLER_UPDATE_INTERVAL_MS: integer(10_000, 10_000, 60_000),
    IMPORT_CONCURRENCY: integer(3, 1, 8),
    HEALTH_PORT: integer(3000, 1, 65_535),
    MEDIA_BRIDGE_PORT: integer(3001, 1, 65_535),
    MEDIA_BRIDGE_BIND: hostname.default('127.0.0.1'),
    MEDIA_BRIDGE_PUBLIC_URL: z.preprocess(
      blankToUndefined,
      z
        .url()
        .refine((value) => {
          const url = new URL(value);
          return (
            ['http:', 'https:'].includes(url.protocol) &&
            !url.username &&
            !url.password &&
            !url.search &&
            !url.hash &&
            url.pathname === '/'
          );
        }, 'Use an HTTP(S) origin without credentials, path, query, or fragment.')
        .default('http://127.0.0.1:3001'),
    ),
    MEDIA_MAX_BYTES: integer(100 * 1024 * 1024, 1024, 1024 * 1024 * 1024),
    MEDIA_REQUEST_TIMEOUT_MS: integer(30_000, 1000, 120_000),
    SUPPORT_URL: z.preprocess(blankToUndefined, httpsUrl.optional()),
    SOURCE_COUNTRY_CODE: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .default('PH'),
    SPOTIFY_ENABLED: boolean(false),
    SPOTIFY_CLIENT_ID: optionalText,
    SPOTIFY_CLIENT_SECRET: optionalSecret,
    SPOTIFY_SP_DC: optionalText,
    SPOTIFY_TOKEN_ENDPOINT: z.preprocess(blankToUndefined, httpsUrl.optional()),
    APPLE_MUSIC_ENABLED: boolean(false),
    APPLE_MUSIC_TOKEN: optionalText,
    DEEZER_ENABLED: boolean(false),
    DEEZER_ARL: optionalText,
    DEEZER_MASTER_DECRYPTION_KEY: optionalText,
    YANDEX_MUSIC_ENABLED: boolean(false),
    YANDEX_MUSIC_ACCESS_TOKEN: optionalText,
    YOUTUBE_OAUTH_ENABLED: boolean(false),
    YOUTUBE_OAUTH_REFRESH_TOKEN: optionalText,
    YOUTUBE_OAUTH_SKIP_INITIALIZATION: boolean(false),
    YOUTUBE_PO_TOKEN: optionalText,
    YOUTUBE_VISITOR_DATA: optionalText,
    SPONSORBLOCK_ENABLED: boolean(false),
    YOUTUBE_PLAYLIST_PAGES: integer(20, 1, 100),
    SPOTIFY_PLAYLIST_PAGES: integer(20, 1, 100),
    SPOTIFY_ALBUM_PAGES: integer(40, 1, 200),
    APPLE_MUSIC_PLAYLIST_PAGES: integer(7, 1, 100),
    APPLE_MUSIC_ALBUM_PAGES: integer(7, 1, 100),
    YANDEX_PLAYLIST_PAGES: integer(20, 1, 100),
    YANDEX_ALBUM_PAGES: integer(40, 1, 200),
    YANDEX_ARTIST_PAGES: integer(10, 1, 100),
    YOUTUBE_LYRICS_ENABLED: boolean(true),
    SPOTIFY_LYRICS_ENABLED: boolean(false),
    DEEZER_LYRICS_ENABLED: boolean(false),
    YANDEX_LYRICS_ENABLED: boolean(false),
    LAVALINK_SOURCE_SOCKET_TIMEOUT_MS: integer(30_000, 1000, 120_000),
  })
  .superRefine((value, context) => {
    const issue = (key: string, message: string) =>
      context.addIssue({ code: 'custom', path: [key], message });
    if (value.LAVALINK_NODES.length === 0 && !value.LAVALINK_PASSWORD) {
      issue('LAVALINK_PASSWORD', 'Set a Lavalink password or provide LAVALINK_NODES.');
    }
    if (new Set(value.LAVALINK_NODES.map((node) => node.id)).size !== value.LAVALINK_NODES.length) {
      issue('LAVALINK_NODES', 'Each node needs a unique ID.');
    }
    if (value.EXTRA_BOT_TOKENS.includes(value.DISCORD_TOKEN)) {
      issue('EXTRA_BOT_TOKENS', 'Do not repeat the primary bot token.');
    }
    if (value.HEALTH_PORT === value.MEDIA_BRIDGE_PORT) {
      issue('MEDIA_BRIDGE_PORT', 'Health and media bridge ports must differ.');
    }
    if (value.MAX_PLAYLIST_IMPORT > value.MAX_QUEUE_SIZE) {
      issue('MAX_PLAYLIST_IMPORT', 'The import limit must not exceed the queue limit.');
    }
    if (value.SPOTIFY_ENABLED && (!value.SPOTIFY_CLIENT_ID || !value.SPOTIFY_CLIENT_SECRET)) {
      issue('SPOTIFY_ENABLED', 'Enable Spotify only after setting its client ID and secret.');
    }
    if (value.APPLE_MUSIC_ENABLED && !value.APPLE_MUSIC_TOKEN) {
      issue(
        'APPLE_MUSIC_TOKEN',
        'Provide an Apple Music media API token when enabling this source.',
      );
    }
    if (value.DEEZER_ENABLED && (!value.DEEZER_ARL || !value.DEEZER_MASTER_DECRYPTION_KEY)) {
      issue(
        'DEEZER_ENABLED',
        'The optional LavaSrc Deezer source requires its ARL and decryption key.',
      );
    }
    if (value.YANDEX_MUSIC_ENABLED && !value.YANDEX_MUSIC_ACCESS_TOKEN) {
      issue('YANDEX_MUSIC_ACCESS_TOKEN', 'Provide a Yandex token when enabling this source.');
    }
    if (value.SPOTIFY_LYRICS_ENABLED && !value.SPOTIFY_SP_DC) {
      issue('SPOTIFY_SP_DC', 'Spotify lyrics require an explicitly configured cookie.');
    }
    if (value.DEEZER_LYRICS_ENABLED && !value.DEEZER_ARL) {
      issue('DEEZER_ARL', 'Deezer lyrics require an explicitly configured ARL.');
    }
    if (value.YANDEX_LYRICS_ENABLED && !value.YANDEX_MUSIC_ACCESS_TOKEN) {
      issue('YANDEX_MUSIC_ACCESS_TOKEN', 'Yandex lyrics require an explicitly configured token.');
    }
    if (Boolean(value.YOUTUBE_PO_TOKEN) !== Boolean(value.YOUTUBE_VISITOR_DATA)) {
      issue('YOUTUBE_PO_TOKEN', 'Set both poToken and visitorData, or leave both empty.');
    }
    if (
      value.YOUTUBE_OAUTH_ENABLED &&
      value.YOUTUBE_OAUTH_SKIP_INITIALIZATION &&
      !value.YOUTUBE_OAUTH_REFRESH_TOKEN
    ) {
      issue(
        'YOUTUBE_OAUTH_REFRESH_TOKEN',
        'Skipping OAuth initialization requires a refresh token.',
      );
    }
  });

export class ConfigurationError extends Error {
  constructor(
    issues: ReadonlyArray<{ path: readonly PropertyKey[]; message: string; code?: string }>,
  ) {
    super(
      `Invalid configuration:\n${issues.map((issue) => `- ${issue.path.map(String).join('.')}: ${issue.code === 'unrecognized_keys' ? 'Remove unrecognized configuration keys.' : issue.message}`).join('\n')}\nSee .env.example. Secret values are never included.`,
    );
    this.name = 'ConfigurationError';
  }
}

export type Env = z.infer<typeof envSchema> & { lavalinkNodes: LavalinkNodeConfig[] };

/** Pure parser: safe to use in tests without reading .env or contacting services. */
export function parseEnv(source: Readonly<Record<string, string | undefined>>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) throw new ConfigurationError(result.error.issues);
  const values = result.data;
  const lavalinkNodes =
    values.LAVALINK_NODES.length > 0
      ? values.LAVALINK_NODES
      : [
          lavalinkNodeSchema.parse({
            id: 'primary',
            host: values.LAVALINK_HOST,
            port: values.LAVALINK_PORT,
            authorization: values.LAVALINK_PASSWORD,
            secure: values.LAVALINK_SECURE,
          }),
        ];
  return {
    ...values,
    LOG_PRETTY: values.NODE_ENV === 'development' && values.LOG_PRETTY,
    lavalinkNodes,
  };
}

/** Call at boot; environment variables override .env values. */
export function loadEnv(): Env {
  loadDotenv({ quiet: true });
  return parseEnv(process.env);
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/scripts/migrate.ts

````typescript
import { loadDatabasePath } from '../src/config/database.js';
import { openDatabase } from '../src/lib/db/client.js';
import { applyMigrations, MigrationError } from '../src/lib/db/migrate.js';

try {
  const connection = openDatabase(loadDatabasePath());
  try {
    applyMigrations(connection);
    console.info('Database migrations applied successfully.');
  } finally {
    connection.close();
  }
} catch (error) {
  console.error(
    error instanceof MigrationError
      ? error.message
      : 'Database migration failed. Check file permissions, DATABASE_PATH, and matching migration assets.',
  );
  process.exitCode = 1;
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/tsup.config.ts

````typescript
import { defineConfig } from 'tsup';
import { cpSync } from 'node:fs';

export default defineConfig({
  // Bot, sharding, and registration entries arrive in their implementation phases.
  entry: {
    'config/env': 'src/config/env.ts',
    'scripts/check-env': 'scripts/check-env.ts',
    'scripts/healthcheck': 'scripts/healthcheck.ts',
    'scripts/migrate': 'scripts/migrate.ts',
    'lib/db/index': 'src/lib/db/index.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  dts: false,
  treeshake: true,
  external: ['better-sqlite3', 'pino-pretty'],
  noExternal: ['yaml'],
  onSuccess: () =>
    Promise.resolve().then(() => {
      cpSync('src/lib/db/migrations', 'dist/migrations', { recursive: true });
    }),
});
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/docs/phase-3-database.md

````markdown
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
````
