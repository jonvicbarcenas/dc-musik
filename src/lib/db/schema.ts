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
