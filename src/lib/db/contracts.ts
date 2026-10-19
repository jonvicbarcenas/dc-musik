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
  PlaylistDetail,
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
  rename(ownerId: string, playlistId: string, name: string): Promise<PersonalPlaylist>;
  detailOwned(ownerId: string, playlistId: string): Promise<PlaylistDetail>;
  updateTracks(
    ownerId: string,
    playlistId: string,
    expectedIds: readonly string[],
    orderedIds: readonly string[],
  ): Promise<void>;
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
