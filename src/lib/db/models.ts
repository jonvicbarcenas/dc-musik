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
