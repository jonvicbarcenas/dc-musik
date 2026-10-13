import { LavalinkManager } from 'lavalink-client';
import type {
  LavalinkNode,
  LavalinkFilterData,
  Track,
  TrackEndEvent,
  TrackExceptionEvent,
  TrackStartEvent,
  TrackStuckEvent,
} from 'lavalink-client';
import type { Env } from '../../config/env.js';
import type { QueueSnapshotsRepository } from '../db/contracts.js';
import type { AudioFilters, PlayableTrack, QueueSnapshot } from '../db/models.js';
import type {
  AudioTransport,
  LoadResult,
  NodeIdentity,
  PlaybackOptions,
  TrackEvent,
} from './types.js';
import { fromClientTrack } from './TrackCodec.js';
import { MusicError } from '../utils/errors.js';

export async function createLavalinkClient(
  env: Env,
  botId: string,
  snapshots: QueueSnapshotsRepository,
  sendToShard: ConstructorParameters<typeof LavalinkManager>[0]['sendToShard'],
  ownsGuild: (guildId: string) => boolean = () => true,
): Promise<LavalinkManager> {
  const sessions = new Map<string, string>();
  // Newest snapshot wins if an older player has not yet checkpointed a reconnected node.
  for (const summary of (await snapshots.list(botId)).sort((a, b) => b.updatedAt - a.updatedAt)) {
    if (!ownsGuild(summary.guildId)) continue;
    const record = await snapshots.load(botId, summary.guildId);
    if (
      record?.snapshot.nodeId &&
      record.snapshot.nodeSessionId &&
      !sessions.has(record.snapshot.nodeId)
    )
      sessions.set(record.snapshot.nodeId, record.snapshot.nodeSessionId);
  }
  return new LavalinkManager({
    nodes: env.lavalinkNodes.map((node) => ({
      ...node,
      host: node.host.includes(':') && !node.host.startsWith('[') ? `[${node.host}]` : node.host,
      requestSignalTimeoutMS: env.LAVALINK_REQUEST_TIMEOUT_MS,
      ...(sessions.has(node.id) ? { sessionId: sessions.get(node.id) ?? '' } : {}),
    })),
    sendToShard,
    autoSkip: false,
    autoSkipOnResolveError: false,
    autoMove: false,
    playerOptions: {
      defaultSearchPlatform: 'ytsearch',
      allowCustomSources: true,
      volumeDecrementer: 1,
      clientBasedPositionUpdateInterval: 250,
      onDisconnect: { autoReconnect: false, destroyPlayer: false },
      maxErrorsPerTime: { threshold: 0, maxAmount: 0 },
      enforceSponsorBlockRequestForEventEnablement: false,
    },
    queueOptions: { maxPreviousTracks: 0 },
    advancedOptions: { enableDebugEvents: false },
  });
}

/** SDK handles nodes and Discord voice. Our engine handles tracks via the typed v4 REST API. */
export class LavalinkTransport implements AudioTransport {
  private readonly stuckCleanup = new Map<
    string,
    {
      done: Promise<boolean>;
      release: (completed: boolean) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  constructor(public readonly client: LavalinkManager) {
    // The SDK sends an automatic stop after emitting trackStuck, even with autoSkip=false.
    // Wait for its resulting queueEnd before our next PATCH so that stop cannot kill a new mirror.
    client.on('trackStuck', (player) => {
      this.releaseStuck(player.guildId, false);
      let release!: (completed: boolean) => void;
      const done = new Promise<boolean>((ready) => {
        release = ready;
      });
      const timeout = (player.node.options.requestSignalTimeoutMS ?? 30_000) + 1000;
      const timer = setTimeout(() => this.releaseStuck(player.guildId, false), timeout);
      timer.unref();
      this.stuckCleanup.set(player.guildId, { done, release, timer });
    });
    client.on('queueEnd', (player, _track, payload) => {
      if (
        payload.type === 'TrackStuckEvent' ||
        (payload.type === 'TrackEndEvent' && payload.reason === 'stopped')
      )
        this.releaseStuck(player.guildId, true);
    });
    client.on('playerDestroy', (player) => this.releaseStuck(player.guildId, false));
  }

  private releaseStuck(guildId: string, completed: boolean): void {
    const pending = this.stuckCleanup.get(guildId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.stuckCleanup.delete(guildId);
    pending.release(completed);
  }
  private async waitForStuckCleanup(guildId: string): Promise<void> {
    const pending = this.stuckCleanup.get(guildId);
    if (pending && !(await pending.done))
      throw new MusicError('NODE_UNAVAILABLE', 'The audio server is reconnecting.');
  }

  private node(preferred?: string | null): LavalinkNode {
    const requested = preferred ? this.client.nodeManager.getNode(preferred) : undefined;
    const node =
      requested?.connected && requested.sessionId && requested.info
        ? requested
        : this.client.nodeManager
            .leastUsedNodes('players')
            .find((candidate) => candidate.connected && candidate.sessionId && candidate.info);
    if (!node)
      throw new MusicError(
        'NODE_UNAVAILABLE',
        'The audio server is reconnecting. Please try again shortly.',
      );
    return node;
  }
  async load(identifier: string, nodeId?: string | null): Promise<LoadResult> {
    try {
      const result = await this.node(nodeId).search({ query: identifier }, null, false);
      if (result.loadType === 'error')
        throw new MusicError('UNAVAILABLE', 'This track or playlist is unavailable.');
      const tracks = result.tracks.map(fromClientTrack);
      return {
        kind:
          result.loadType === 'playlist'
            ? 'playlist'
            : result.loadType === 'search'
              ? 'search'
              : tracks.length
                ? 'track'
                : 'empty',
        name: result.playlist?.name ?? 'Search results',
        tracks,
      };
    } catch (error) {
      if (error instanceof MusicError) throw error;
      throw new MusicError('UNAVAILABLE', 'The audio source could not be loaded.');
    }
  }
  async connect(snapshot: QueueSnapshot): Promise<NodeIdentity> {
    const node = this.node(snapshot.nodeId);
    const player =
      this.client.getPlayer(snapshot.guildId) ??
      this.client.createPlayer({
        guildId: snapshot.guildId,
        voiceChannelId: snapshot.voiceChannelId,
        ...(snapshot.textChannelId ? { textChannelId: snapshot.textChannelId } : {}),
        node,
        volume: snapshot.volume,
        selfDeaf: true,
        selfMute: false,
      });
    if (player.voiceChannelId !== snapshot.voiceChannelId)
      await player.changeVoiceState({ voiceChannelId: snapshot.voiceChannelId, selfDeaf: true });
    else await player.connect();
    const deadline = Date.now() + 15_000;
    while (!player.voice.token || !player.voice.sessionId || !player.voice.endpoint) {
      if (Date.now() >= deadline)
        throw new MusicError(
          'UNAVAILABLE',
          'Voice connection timed out. Check Connect and Speak permissions.',
        );
      await new Promise<void>((ready) => setTimeout(ready, 100));
    }
    return this.identity(snapshot.guildId);
  }
  async play(guildId: string, track: PlayableTrack, options: PlaybackOptions): Promise<void> {
    await this.waitForStuckCleanup(guildId);
    const player = this.requirePlayer(guildId);
    // The SDK may expose the current track for diagnostics; all upcoming entries stay in our queue.
    player.queue.current = {
      ...toClientTrack(track),
      userData: { playbackId: options.playbackId },
    };
    try {
      await player.node.updatePlayer({
        guildId,
        noReplace: false,
        playerOptions: {
          track: { encoded: track.encoded, userData: { playbackId: options.playbackId } },
          position: options.positionMs,
          paused: options.paused,
          volume: options.volume,
          filters: clientFilters(options.filters),
          voice: player.voice,
        },
      });
    } catch {
      throw new MusicError(
        'NODE_UNAVAILABLE',
        'The audio server could not start playback. Your queue is saved.',
      );
    }
    player.lastPosition = options.positionMs;
    player.lastPositionChange = Date.now();
    player.paused = options.paused;
    player.playing = !options.paused;
  }
  async stop(guildId: string): Promise<void> {
    await this.waitForStuckCleanup(guildId);
    const player = this.client.getPlayer(guildId);
    if (player?.node.connected)
      await player.node.updatePlayer({ guildId, playerOptions: { track: { encoded: null } } });
    if (player) {
      player.queue.current = null;
      player.playing = false;
      player.paused = false;
      player.lastPosition = 0;
    }
  }
  async destroy(guildId: string): Promise<void> {
    await this.client.getPlayer(guildId)?.destroy('Requested disconnect');
  }
  async pause(guildId: string, paused: boolean): Promise<void> {
    const player = this.requirePlayer(guildId);
    await player.node.updatePlayer({ guildId, playerOptions: { paused } });
    player.paused = paused;
    player.playing = !paused;
  }
  async seek(guildId: string, positionMs: number): Promise<void> {
    await this.requirePlayer(guildId).node.updatePlayer({
      guildId,
      playerOptions: { position: positionMs },
    });
  }
  async volume(guildId: string, volume: number): Promise<void> {
    await this.requirePlayer(guildId).node.updatePlayer({ guildId, playerOptions: { volume } });
  }
  async filters(guildId: string, filters: AudioFilters): Promise<void> {
    await this.requirePlayer(guildId).node.updatePlayer({
      guildId,
      playerOptions: { filters: clientFilters(filters) },
    });
  }
  async sponsorBlock(guildId: string, enabled: boolean): Promise<void> {
    const player = this.requirePlayer(guildId);
    if (enabled) await player.setSponsorBlock(['sponsor', 'selfpromo', 'interaction']);
    else if (player.node.info?.plugins.some((plugin) => plugin.name === 'sponsorblock-plugin'))
      await player.deleteSponsorBlock();
  }
  identity(guildId: string): NodeIdentity {
    const player = this.client.getPlayer(guildId);
    return { nodeId: player?.node.id ?? null, sessionId: player?.node.sessionId ?? null };
  }
  position(guildId: string): number | null {
    const player = this.client.getPlayer(guildId);
    return player?.node.connected && Number.isFinite(player.position)
      ? Math.max(0, Math.round(player.position))
      : null;
  }
  async migrate(guildId: string, excludedNodeId: string): Promise<NodeIdentity | null> {
    const player = this.client.getPlayer(guildId);
    const target = this.client.nodeManager
      .leastUsedNodes('players')
      .find((node) => node.id !== excludedNodeId && node.connected && node.sessionId);
    if (!player || !target) return null;
    await player.changeNode(target, false);
    return this.identity(guildId);
  }
  private requirePlayer(guildId: string) {
    const player = this.client.getPlayer(guildId);
    if (!player) throw new MusicError('NO_PLAYER', 'Join a voice channel and play a track first.');
    if (!player.node.connected)
      throw new MusicError('NODE_UNAVAILABLE', 'The audio server is reconnecting.');
    return player;
  }

  /** Call AFTER PlayerManager.close(). Remove local SDK state before destroying sockets,
   * so the SDK cannot send DELETE requests for remote players we want to resume. */
  close(): void {
    for (const guildId of this.stuckCleanup.keys()) this.releaseStuck(guildId, false);
    this.client.players.clear();
    for (const node of [...this.client.nodeManager.nodes.values()]) node.destroy('BotShutdown');
  }
}

/** In 2.11.0 `connect` can precede the v4 ready payload. Session PATCH/recovery needs both. */
export function observeNodeReady(
  client: LavalinkManager,
  ready: (node: LavalinkNode) => Promise<void>,
  failed: (nodeId: string) => void,
): () => void {
  const status = new Map<
    string,
    { node: LavalinkNode; sessionId: string | null; info: boolean; fired: boolean }
  >();
  const state = (node: LavalinkNode) => {
    let value = status.get(node.id);
    if (!value) {
      value = { node, sessionId: null, info: false, fired: false };
      status.set(node.id, value);
    }
    return value;
  };
  const dispatch = (node: LavalinkNode) => {
    const value = state(node);
    if (
      value.fired ||
      !value.info ||
      !value.sessionId ||
      node.sessionId !== value.sessionId ||
      !node.connected
    )
      return;
    value.fired = true;
    void ready(node).catch(() => failed(node.id));
  };
  const connect = (node: LavalinkNode) => {
    state(node).info = node.info !== null;
    dispatch(node);
  };
  const raw = (node: LavalinkNode, payload: unknown) => {
    if (
      typeof payload !== 'object' ||
      !payload ||
      !('op' in payload) ||
      payload.op !== 'ready' ||
      !('sessionId' in payload) ||
      typeof payload.sessionId !== 'string'
    )
      return;
    const sessionId = payload.sessionId;
    // SDK assigns sessionId immediately after emitting raw; defer until that assignment completes.
    queueMicrotask(() => {
      state(node).sessionId = sessionId;
      dispatch(node);
    });
  };
  const disconnect = (node: LavalinkNode) => {
    status.delete(node.id);
  };
  client.nodeManager.on('connect', connect);
  client.nodeManager.on('raw', raw);
  client.nodeManager.on('disconnect', disconnect);
  return () => {
    client.nodeManager.off('connect', connect);
    client.nodeManager.off('raw', raw);
    client.nodeManager.off('disconnect', disconnect);
    status.clear();
  };
}

/** Identity comes from the event payload, never the mutable SDK queue after a rapid skip. */
export function trackEvent(
  payload: TrackStartEvent | TrackEndEvent | TrackExceptionEvent | TrackStuckEvent,
): TrackEvent {
  const id: unknown = payload.track.userData?.['playbackId'];
  return {
    guildId: payload.guildId,
    playbackId: typeof id === 'string' ? id : null,
    encoded: payload.track.encoded ?? null,
    type:
      payload.type === 'TrackStartEvent'
        ? 'start'
        : payload.type === 'TrackEndEvent'
          ? 'end'
          : payload.type === 'TrackStuckEvent'
            ? 'stuck'
            : 'error',
    reason: payload.type === 'TrackEndEvent' ? payload.reason : null,
  };
}

export function toClientTrack(track: PlayableTrack): Track {
  return {
    encoded: track.encoded,
    info: {
      identifier: track.identifier,
      title: track.title,
      author: track.artist,
      sourceName: track.source as Track['info']['sourceName'],
      uri: track.uri ?? '',
      duration: track.durationMs,
      isStream: track.isStream,
      isSeekable: track.isSeekable,
      artworkUrl: track.artworkUrl,
      isrc: track.isrc,
    },
    pluginInfo: {},
  };
}

function clientFilters(filters: AudioFilters): Partial<LavalinkFilterData> {
  return {
    ...(filters.equalizer ? { equalizer: filters.equalizer } : {}),
    ...(filters.timescale ? { timescale: filters.timescale } : {}),
    ...(filters.karaoke ? { karaoke: filters.karaoke } : {}),
    ...(filters.tremolo ? { tremolo: filters.tremolo } : {}),
    ...(filters.vibrato ? { vibrato: filters.vibrato } : {}),
    ...(filters.rotation ? { rotation: filters.rotation } : {}),
    ...(filters.lowPass ? { lowPass: filters.lowPass } : {}),
    ...(filters.channelMix ? { channelMix: filters.channelMix } : {}),
  };
}
