import type { AudioFilters, PlayableTrack, QueueSnapshot, StoredTrack } from '../db/models.js';

export interface ResolvedItem {
  track: StoredTrack;
  playable: PlayableTrack | null;
}
export interface CatalogPage {
  name: string;
  items: ResolvedItem[];
  total: number | null;
  notice?: string;
}
export interface RawTrack {
  encoded: string | null;
  identifier: string;
  title: string;
  artist: string;
  source: string;
  uri: string | null;
  durationMs: number;
  isStream: boolean;
  isSeekable: boolean;
  artworkUrl: string | null;
  isrc: string | null;
  album: string | null;
  isPreview: boolean;
}
export interface LoadResult {
  kind: 'track' | 'playlist' | 'search' | 'empty';
  name: string;
  tracks: RawTrack[];
}
export interface PlaybackOptions {
  playbackId: string;
  positionMs: number;
  paused: boolean;
  volume: number;
  filters: AudioFilters;
}
export interface NodeIdentity {
  nodeId: string | null;
  sessionId: string | null;
}
/** Commands never reach directly into the Lavalink SDK's internal queue. */
export interface AudioTransport {
  load(identifier: string, nodeId?: string | null): Promise<LoadResult>;
  connect(snapshot: QueueSnapshot): Promise<NodeIdentity>;
  play(guildId: string, track: PlayableTrack, options: PlaybackOptions): Promise<void>;
  stop(guildId: string): Promise<void>;
  destroy(guildId: string): Promise<void>;
  pause(guildId: string, paused: boolean): Promise<void>;
  seek(guildId: string, positionMs: number): Promise<void>;
  volume(guildId: string, volume: number): Promise<void>;
  filters(guildId: string, filters: AudioFilters): Promise<void>;
  sponsorBlock(guildId: string, enabled: boolean): Promise<void>;
  identity(guildId: string): NodeIdentity;
  position(guildId: string): number | null;
  migrate(guildId: string, excludedNodeId: string): Promise<NodeIdentity | null>;
}
export interface TrackEvent {
  guildId: string;
  playbackId: string | null;
  encoded: string | null;
  type: 'start' | 'end' | 'error' | 'stuck';
  reason: string | null;
  failure?: 'authentication' | 'forbidden' | 'rate_limited' | 'timeout' | 'decode' | 'unknown';
}
