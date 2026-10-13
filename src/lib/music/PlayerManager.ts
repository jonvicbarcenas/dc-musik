import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { Logger } from 'pino';
import type { Env } from '../../config/env.js';
import type { Repositories } from '../db/contracts.js';
import { queueSnapshotSchema, requesterSchema } from '../db/models.js';
import type {
  AudioFilters,
  GuildSettings,
  HistoryEndReason,
  LoopMode,
  PendingImport,
  QueueEntry,
  QueueSnapshot,
  Requester,
  SnapshotRecord,
  StoredTrack,
} from '../db/models.js';
import { AsyncLock } from '../utils/AsyncLock.js';
import { MusicError, errorCode } from '../utils/errors.js';
import { QueueManager, createQueueEntry } from './QueueManager.js';
import type { SourceResolver } from './SourceResolver.js';
import type { AutoplayEngine } from './AutoplayEngine.js';
import { ImportScheduler } from './ImportScheduler.js';
import { validateFilters } from './FilterPresets.js';
import { catalogSources } from './TrackCodec.js';
import type { AudioTransport, ResolvedItem, TrackEvent } from './types.js';

interface EngineEvents {
  changed: [snapshot: QueueSnapshot];
  trackStart: [snapshot: QueueSnapshot];
  trackEnd: [snapshot: QueueSnapshot, reason: HistoryEndReason];
  queueEnd: [snapshot: QueueSnapshot];
  notice: [guildId: string, message: string];
  importProgress: [guildId: string, importId: string, enqueued: number, total: number | null];
  destroyed: [guildId: string];
}
interface Session {
  state: QueueSnapshot;
  queue: QueueManager;
  settings: GuildSettings;
  version: SnapshotRecord | null;
  lock: AsyncLock;
  closed: boolean;
  online: boolean;
  playing: boolean;
  positionAt: number;
  pump: Promise<void> | null;
  wake: boolean;
  resolution: AbortController | null;
  prefetching: Set<string>;
  prefetchFailed: Set<string>;
  workAbort: AbortController;
  excluded: Set<string>;
  retries: number;
  emptyVoice: boolean;
  idleTimer: ReturnType<typeof setTimeout> | null;
}
export interface ImportResult {
  id: string;
  name: string;
  enqueued: number;
  total: number | null;
  background: boolean;
  tracks: StoredTrack[];
}
interface ImportWaiter {
  first: Promise<ImportResult>;
  resolve: (result: ImportResult) => void;
  reject: (error: MusicError) => void;
  name: string;
  count: number;
  total: number | null;
  settled: boolean;
  replaceCurrent: boolean;
  tracks: StoredTrack[];
}

/** Every session is scoped to this bot account + guild; all mutations/checkpoints are serialized. */
export class PlayerManager extends EventEmitter<EngineEvents> {
  private readonly sessions = new Map<string, Session>();
  private readonly joins = new Map<string, AsyncLock>();
  private readonly waiters = new Map<string, ImportWaiter>();
  private readonly imports: ImportScheduler;
  private readonly background = new Set<Promise<void>>();
  private checkpointTimer: ReturnType<typeof setInterval> | null = null;
  private closing = false;
  constructor(
    public readonly botId: string,
    private readonly env: Pick<
      Env,
      'MAX_PLAYLIST_IMPORT' | 'IMPORT_CONCURRENCY' | 'SPONSORBLOCK_ENABLED'
    >,
    private readonly repositories: Repositories,
    public readonly transport: AudioTransport,
    public readonly resolver: SourceResolver,
    private readonly autoplay: AutoplayEngine,
    private readonly logger: Logger,
  ) {
    super();
    this.imports = new ImportScheduler(resolver, env.IMPORT_CONCURRENCY);
  }

  get size(): number {
    return [...this.sessions.values()].filter((session) => !session.closed).length;
  }
  guildIds(): string[] {
    return [...this.sessions.keys()];
  }
  offlineNodeIds(): string[] {
    return [
      ...new Set(
        [...this.sessions.values()]
          .filter((session) => !session.closed && !session.online)
          .map((session) => session.state.nodeId)
          .filter((id): id is string => id !== null),
      ),
    ];
  }
  view(guildId: string): QueueSnapshot | null {
    const session = this.sessions.get(guildId);
    return session && !session.closed ? this.snapshot(session) : null;
  }
  startCheckpoints(): void {
    if (this.checkpointTimer) return;
    this.checkpointTimer = setInterval(() => this.watch(this.checkpointAll()), 10_000);
    this.checkpointTimer.unref();
  }

  async join(
    guildId: string,
    voiceChannelId: string,
    textChannelId: string | null,
  ): Promise<QueueSnapshot> {
    if (this.closing) throw new MusicError('UNAVAILABLE', 'The bot is restarting.');
    let lock = this.joins.get(guildId);
    if (!lock) {
      lock = new AsyncLock();
      this.joins.set(guildId, lock);
    }
    return lock.run(async () => {
      const existing = this.sessions.get(guildId);
      if (this.closing) throw new MusicError('UNAVAILABLE', 'The bot is restarting.');
      if (existing) {
        if (existing.closed)
          throw new MusicError(
            'CONFLICT',
            'Another process changed this player. Restart this bot process before recovering it.',
          );
        if (existing.state.voiceChannelId !== voiceChannelId)
          throw new MusicError(
            'CONFLICT',
            'The bot is already playing in another voice channel. Use move to bring it here.',
          );
        return this.snapshot(existing);
      }
      const settings = await this.repositories.guildSettings.get(guildId);
      const record = await this.repositories.queueSnapshots.load(this.botId, guildId);
      if (record) {
        if (record.snapshot.voiceChannelId !== voiceChannelId)
          throw new MusicError(
            'CONFLICT',
            'A saved player belongs to another voice channel. Restore or disconnect it first.',
          );
        return this.restoreLocked(record);
      }
      const state = queueSnapshotSchema.parse({
        version: 1,
        botId: this.botId,
        guildId,
        voiceChannelId,
        textChannelId,
        nodeId: null,
        nodeSessionId: null,
        current: null,
        currentPlaybackId: null,
        upcoming: [],
        previous: [],
        positionMs: 0,
        paused: false,
        volume: settings.defaultVolume,
        loopMode: 'off',
        autoplay: settings.autoplayEnabled,
        filters: {},
        pendingImports: [],
      });
      const session = this.createSession(state, settings, null);
      try {
        const node = await this.transport.connect(state);
        if (this.closing) throw new MusicError('UNAVAILABLE', 'The bot is restarting.');
        session.state.nodeId = node.nodeId;
        session.state.nodeSessionId = node.sessionId;
        await this.persist(session);
        this.sessions.set(guildId, session);
        await this.configureSponsor(session);
        this.scheduleIdle(session);
        return this.snapshot(session);
      } catch (error) {
        session.closed = true;
        await this.transport.destroy(guildId).catch(() => undefined);
        throw error;
      }
    });
  }

  async restore(record: SnapshotRecord): Promise<QueueSnapshot> {
    let lock = this.joins.get(record.guildId);
    if (!lock) {
      lock = new AsyncLock();
      this.joins.set(record.guildId, lock);
    }
    return lock.run(() => this.restoreLocked(record));
  }
  private async restoreLocked(record: SnapshotRecord): Promise<QueueSnapshot> {
    if (this.closing) throw new MusicError('UNAVAILABLE', 'The bot is restarting.');
    const existing = this.sessions.get(record.guildId);
    if (existing) {
      if (existing.closed)
        throw new MusicError('CONFLICT', 'Another process owns a newer player snapshot.');
      return this.snapshot(existing);
    }
    if (record.botId !== this.botId)
      throw new MusicError('CONFLICT', 'The saved queue belongs to another bot.');
    const settings = await this.repositories.guildSettings.get(record.guildId);
    const state = structuredClone(record.snapshot);
    // Re-resolve saved encodings, especially HTTP sources. The cached file UUID remains authoritative.
    if (state.current) state.current.playable = null;
    for (const entry of state.upcoming) entry.playable = null;
    const session = this.createSession(state, settings, record);
    const node = await this.transport.connect(state);
    if (this.closing) throw new MusicError('UNAVAILABLE', 'The bot is restarting.');
    session.state.nodeId = node.nodeId;
    session.state.nodeSessionId = node.sessionId;
    await this.persist(session);
    this.sessions.set(record.guildId, session);
    await this.configureSponsor(session);
    for (const job of state.pendingImports) this.startImport(session, job);
    this.kick(session);
    this.prefetch(session);
    return this.snapshot(session);
  }

  async enqueue(
    guildId: string,
    items: readonly ResolvedItem[],
    requester: Requester,
    mode: 'append' | 'next' | 'now' = 'append',
  ): Promise<number> {
    const session = this.require(guildId);
    requesterSchema.parse(requester);
    await this.locked(session, async () => {
      const entries = items.map((item) => {
        this.validateLength(session, item.track.durationMs, item.track.isStream);
        return createQueueEntry(item.track, requester, item.playable);
      });
      this.assertCapacity(
        session,
        entries.length - Number(mode === 'now' && Boolean(session.state.current)),
      );
      if (mode === 'now' && entries.length) await this.retire(session, 'replaced');
      session.queue.add(entries, mode === 'append' ? session.queue.size + 1 : 1);
      await this.persist(session);
      this.changed(session);
    });
    this.kick(session);
    this.prefetch(session);
    return items.length;
  }

  async enqueueQuery(
    guildId: string,
    query: string,
    requester: Requester,
    mode: 'append' | 'next' | 'now' = 'append',
  ): Promise<ImportResult> {
    const session = this.require(guildId);
    requesterSchema.parse(requester);
    // Validate without contacting providers; the scheduler also validates before loading.
    if (!query.trim() || query.length > 4096)
      throw new MusicError('INVALID_INPUT', 'Provide a music title or link.');
    const job = await this.locked(session, async () => {
      if (session.state.pendingImports.length >= 10)
        throw new MusicError('QUEUE_FULL', 'Wait for an existing playlist import to finish.');
      const available =
        session.settings.maxQueueSize -
        session.queue.size -
        Number(mode !== 'now' && Boolean(session.state.current));
      if (available < 1) throw new MusicError('QUEUE_FULL', 'The queue is full.');
      const pending: PendingImport = {
        id: randomUUID(),
        query: query.trim(),
        requester: structuredClone(requester),
        mode: mode === 'append' ? 'append' : 'next',
        processedCount: 0,
        limit: Math.min(this.env.MAX_PLAYLIST_IMPORT, available),
        enqueuedKeys: [],
        createdAt: Date.now(),
      };
      session.state.pendingImports.push(pending);
      await this.persist(session);
      return pending;
    });
    const waiter = this.makeWaiter(mode === 'now');
    this.waiters.set(job.id, waiter);
    this.startImport(session, job);
    return waiter.first;
  }

  async mutateQueue<T>(
    guildId: string,
    operation: (queue: QueueManager) => T,
    expectedPlaybackId?: string,
  ): Promise<T> {
    const session = this.require(guildId);
    const value = await this.locked(session, async () => {
      this.assertPlayback(session, expectedPlaybackId);
      const before = session.queue.view();
      try {
        const result = operation(session.queue);
        await this.persist(session);
        this.changed(session);
        return result;
      } catch (error) {
        session.queue = new QueueManager(
          before,
          Math.max(session.settings.maxQueueSize, before.length),
        );
        session.queue.setMaximum(session.settings.maxQueueSize);
        throw error;
      }
    });
    this.kick(session);
    this.prefetch(session);
    return value;
  }

  async pause(guildId: string, paused: boolean, expectedPlaybackId?: string): Promise<void> {
    const session = this.require(guildId);
    await this.locked(session, async () => {
      this.assertPlayback(session, expectedPlaybackId);
      this.requireCurrent(session);
      this.capturePosition(session);
      await this.transport.pause(guildId, paused);
      session.state.paused = paused;
      session.positionAt = Date.now();
      await this.persist(session);
      this.changed(session);
    });
  }
  async seek(guildId: string, positionMs: number): Promise<void> {
    const session = this.require(guildId);
    await this.locked(session, () => this.seekLocked(session, positionMs));
  }
  async seekRelative(guildId: string, offsetMs: number): Promise<void> {
    const session = this.require(guildId);
    await this.locked(session, () => {
      const current = this.requireCurrent(session);
      return this.seekLocked(
        session,
        Math.max(
          0,
          Math.min(
            this.position(session) + offsetMs,
            (current.playable?.durationMs ?? current.track.durationMs) - 1,
          ),
        ),
      );
    });
  }

  async skip(guildId: string, count = 1, expectedPlaybackId?: string): Promise<void> {
    const session = this.require(guildId);
    if (!expectedPlaybackId) session.resolution?.abort();
    await this.locked(session, async () => {
      if (expectedPlaybackId && session.state.currentPlaybackId !== expectedPlaybackId)
        throw new MusicError('CONFLICT', 'The current track changed. Try the command again.');
      this.requireCurrent(session);
      if (!Number.isInteger(count) || count < 1 || count > session.queue.size + 1)
        throw new MusicError('INVALID_INPUT', 'That skip count exceeds the queue.');
      await this.retire(session, 'skipped');
      for (let index = 1; index < count; index++) session.queue.take();
      await this.persist(session);
      this.changed(session);
    });
    this.kick(session);
  }
  async skipTo(guildId: string, position: number): Promise<void> {
    const session = this.require(guildId);
    if (!Number.isInteger(position) || position < 1 || position > session.queue.size)
      throw new MusicError('INVALID_INPUT', 'That queue position does not exist.');
    if (session.state.current) await this.skip(guildId, position);
    else {
      await this.mutateQueue(guildId, (queue) => {
        for (let index = 1; index < position; index++) queue.take();
      });
    }
  }
  async replay(guildId: string): Promise<void> {
    const session = this.require(guildId);
    session.resolution?.abort();
    await this.locked(session, async () => {
      const current = structuredClone(this.requireCurrent(session));
      await this.retire(session, 'replaced');
      session.state.current = current;
      session.state.currentPlaybackId = randomUUID();
      session.state.positionMs = 0;
      session.state.paused = false;
      await this.persist(session);
    });
    this.kick(session);
  }
  async previous(guildId: string, expectedPlaybackId?: string): Promise<void> {
    const session = this.require(guildId);
    if (!expectedPlaybackId) session.resolution?.abort();
    await this.locked(session, async () => {
      this.assertPlayback(session, expectedPlaybackId);
      const previous = session.state.previous[0];
      if (!previous) throw new MusicError('NOT_FOUND', 'There is no previous track.');
      this.assertCapacity(session, 1);
      session.state.previous.shift();
      const current = session.state.current ? structuredClone(session.state.current) : null;
      if (current) {
        await this.retire(session, 'replaced', false);
        current.id = randomUUID();
        session.queue.add([current], 1, false);
      }
      previous.id = randomUUID();
      session.state.current = previous;
      session.state.currentPlaybackId = randomUUID();
      session.state.positionMs = 0;
      session.state.paused = false;
      await this.persist(session);
    });
    this.kick(session);
  }

  async stop(guildId: string, expectedPlaybackId?: string): Promise<void> {
    const session = this.require(guildId);
    if (!expectedPlaybackId) session.resolution?.abort();
    await this.locked(session, async () => {
      this.assertPlayback(session, expectedPlaybackId);
      this.cancelImports(session);
      await this.retire(session, 'stopped');
      session.prefetchFailed.clear();
      session.queue.clear(false);
      session.state.loopMode = 'off';
      session.state.autoplay = false;
      await this.persist(session);
      this.changed(session);
      this.scheduleIdle(session);
    });
  }
  async clearQueue(guildId: string): Promise<number> {
    const session = this.require(guildId);
    return this.locked(session, async () => {
      this.cancelImports(session);
      const count = session.queue.clear();
      session.prefetchFailed.clear();
      await this.persist(session);
      this.changed(session);
      return count;
    });
  }
  async leave(guildId: string): Promise<void> {
    const session = this.sessions.get(guildId);
    if (!session) {
      const record = await this.repositories.queueSnapshots.load(this.botId, guildId);
      if (record) await this.repositories.queueSnapshots.delete(this.botId, guildId, record);
      await this.transport.destroy(guildId);
      return;
    }
    session.resolution?.abort();
    await this.locked(session, async () => {
      session.closed = true;
      session.workAbort.abort();
      this.cancelIdle(session);
      this.cancelImports(session);
      if (session.state.currentPlaybackId)
        await this.repositories.history.finish(session.state.currentPlaybackId, 'stopped');
      await this.transport
        .destroy(guildId)
        .catch(() => this.logger.warn({ guildId }, 'Audio disconnect failed.'));
      if (session.version)
        await this.repositories.queueSnapshots.delete(this.botId, guildId, session.version);
      this.sessions.delete(guildId);
      this.joins.delete(guildId);
      this.emit('destroyed', guildId);
    });
  }
  async moveVoice(
    guildId: string,
    voiceChannelId: string,
    textChannelId: string | null,
  ): Promise<void> {
    const session = this.require(guildId);
    await this.locked(session, async () => {
      const candidate = this.snapshot(session);
      candidate.voiceChannelId = voiceChannelId;
      candidate.textChannelId = textChannelId;
      const node = await this.transport.connect(candidate);
      session.state.voiceChannelId = voiceChannelId;
      session.state.textChannelId = textChannelId;
      session.state.nodeId = node.nodeId;
      session.state.nodeSessionId = node.sessionId;
      session.emptyVoice = false;
      this.cancelIdle(session);
      await this.persist(session);
      this.changed(session);
    });
  }

  async volume(guildId: string, volume: number, expectedPlaybackId?: string): Promise<void> {
    if (!Number.isInteger(volume) || volume < 1 || volume > 200)
      throw new MusicError('INVALID_INPUT', 'Volume must be between 1 and 200.');
    const session = this.require(guildId);
    await this.locked(session, async () => {
      this.assertPlayback(session, expectedPlaybackId);
      await this.transport.volume(guildId, volume);
      session.settings = await this.repositories.guildSettings.update(guildId, {
        defaultVolume: volume,
      });
      session.state.volume = volume;
      await this.persist(session);
      this.changed(session);
    });
  }
  async filters(guildId: string, filters: AudioFilters): Promise<void> {
    const parsed = validateFilters(filters);
    const session = this.require(guildId);
    await this.locked(session, async () => {
      this.capturePosition(session);
      await this.transport.filters(guildId, parsed);
      session.state.filters = parsed;
      session.positionAt = Date.now();
      await this.persist(session);
      this.changed(session);
    });
  }
  async loop(guildId: string, mode: LoopMode, expectedPlaybackId?: string): Promise<void> {
    if (!['off', 'track', 'queue'].includes(mode))
      throw new MusicError('INVALID_INPUT', 'Loop mode must be off, track, or queue.');
    const session = this.require(guildId);
    await this.locked(session, async () => {
      this.assertPlayback(session, expectedPlaybackId);
      session.state.loopMode = mode;
      await this.persist(session);
      this.changed(session);
    });
  }
  async setAutoplay(guildId: string, enabled: boolean): Promise<void> {
    const session = this.require(guildId);
    await this.locked(session, async () => {
      session.settings = await this.repositories.guildSettings.update(guildId, {
        autoplayEnabled: enabled,
      });
      session.state.autoplay = enabled;
      await this.persist(session);
      this.changed(session);
    });
    if (enabled) this.kick(session);
  }
  async refreshSettings(guildId: string): Promise<void> {
    const session = this.sessions.get(guildId);
    if (!session) return;
    await this.locked(session, async () => {
      session.settings = await this.repositories.guildSettings.get(guildId);
      session.queue.setMaximum(session.settings.maxQueueSize);
      await this.configureSponsor(session);
      this.scheduleIdle(session);
    });
  }
  setVoiceOccupancy(guildId: string, humans: number): void {
    const session = this.sessions.get(guildId);
    if (!session) return;
    session.emptyVoice = humans === 0;
    this.scheduleIdle(session);
  }

  /** Called by Phase 6 event adapters, with IDs from Lavalink's original event payload. */
  async onTrackEvent(event: TrackEvent): Promise<void> {
    const session = this.sessions.get(event.guildId);
    if (!session || session.closed) return;
    await this.locked(session, async () => {
      if (
        !session.state.current ||
        !event.playbackId ||
        event.playbackId !== session.state.currentPlaybackId
      )
        return;
      if (event.type === 'start') {
        this.emit('trackStart', this.snapshot(session));
        return;
      }
      if (event.type === 'end' && ['replaced', 'stopped', 'cleanup'].includes(event.reason ?? ''))
        return;
      if (event.type === 'error' || event.type === 'stuck' || event.reason === 'loadFailed') {
        await this.retryOrAdvance(session, event.encoded);
        return;
      }
      if (event.type !== 'end' || event.reason !== 'finished') return;
      const finished = structuredClone(session.state.current);
      await this.retire(session, 'finished', true, false);
      if (session.state.loopMode === 'track') {
        finished.id = randomUUID();
        session.state.current = finished;
        session.state.currentPlaybackId = randomUUID();
      } else if (session.state.loopMode === 'queue') {
        finished.id = randomUUID();
        if (session.queue.size < session.settings.maxQueueSize)
          session.queue.add([finished], session.queue.size + 1, false);
        else
          this.emit(
            'notice',
            session.state.guildId,
            'The lowered queue limit prevented re-adding the looped track.',
          );
      }
      await this.persist(session);
    });
    this.kick(session);
    this.prefetch(session);
  }

  /** Freeze the clock; keep the current track and queue intact while nodes reconnect. */
  async nodeDisconnected(nodeId: string): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.closed || session.state.nodeId !== nodeId) continue;
      session.resolution?.abort();
      await this.locked(session, async () => {
        this.capturePosition(session);
        session.online = false;
        session.playing = false;
        await this.persist(session);
        const replacement = await this.transport
          .migrate(session.state.guildId, nodeId)
          .catch(() => null);
        if (replacement) {
          session.state.nodeId = replacement.nodeId;
          session.state.nodeSessionId = replacement.sessionId;
          session.online = true;
          session.prefetchFailed.clear();
          if (session.state.current) session.state.current.playable = null;
          await this.persist(session);
        }
      });
      if (session.online) this.kick(session);
    }
  }
  async nodeConnected(nodeId: string, offlineOnly = false): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.closed || session.state.nodeId !== nodeId || (offlineOnly && session.online))
        continue;
      await this.locked(session, async () => {
        const node = await this.transport.connect(this.snapshot(session));
        session.state.nodeId = node.nodeId;
        session.state.nodeSessionId = node.sessionId;
        session.online = true;
        session.prefetchFailed.clear();
        session.playing = false;
        if (session.state.current) session.state.current.playable = null;
        await this.persist(session);
        await this.configureSponsor(session);
      });
      this.kick(session);
      this.prefetch(session);
    }
  }
  async updatePosition(guildId: string, positionMs: number): Promise<void> {
    const session = this.sessions.get(guildId);
    if (
      !session ||
      !session.state.current ||
      !session.online ||
      !session.playing ||
      !Number.isFinite(positionMs) ||
      positionMs < 0
    )
      return;
    await this.locked(session, () => {
      session.state.positionMs = Math.round(positionMs);
      session.positionAt = Date.now();
      return Promise.resolve();
    });
  }

  async checkpointAll(): Promise<void> {
    for (const session of this.sessions.values()) {
      if (!session.closed)
        await this.locked(session, async () => {
          this.capturePosition(session);
          await this.persist(session);
        });
    }
  }
  /** Save resumable state and cancel work; do not delete queues or destroy Lavalink sessions. */
  async close(): Promise<void> {
    this.closing = true;
    const resumable = [...this.sessions.values()].filter((session) => !session.closed);
    if (this.checkpointTimer) clearInterval(this.checkpointTimer);
    this.checkpointTimer = null;
    for (const session of this.sessions.values()) {
      session.closed = true;
      session.workAbort.abort();
      session.resolution?.abort();
      this.cancelIdle(session);
    }
    await this.imports.close();
    for (const waiter of this.waiters.values())
      if (!waiter.settled) {
        waiter.reject(
          new MusicError('UNAVAILABLE', 'The import will resume after the bot restarts.'),
        );
        waiter.settled = true;
      }
    await Promise.allSettled([...this.background]);
    for (const session of resumable)
      await session.lock.run(async () => {
        this.capturePosition(session);
        await this.persist(session);
      });
  }

  private createSession(
    state: QueueSnapshot,
    settings: GuildSettings,
    version: SnapshotRecord | null,
  ): Session {
    const queue = new QueueManager(
      state.upcoming,
      Math.max(settings.maxQueueSize, state.upcoming.length),
    );
    queue.setMaximum(settings.maxQueueSize);
    return {
      state,
      queue,
      settings,
      version,
      lock: new AsyncLock(),
      closed: false,
      online: true,
      playing: false,
      positionAt: Date.now(),
      pump: null,
      wake: false,
      resolution: null,
      prefetching: new Set(),
      prefetchFailed: new Set(),
      workAbort: new AbortController(),
      excluded: new Set(),
      retries: 0,
      emptyVoice: false,
      idleTimer: null,
    };
  }
  private snapshot(session: Session): QueueSnapshot {
    return {
      ...structuredClone(session.state),
      upcoming: session.queue.view(),
      positionMs: this.position(session),
    };
  }
  private position(session: Session): number {
    const elapsed =
      session.playing && session.online && !session.state.paused
        ? Date.now() - session.positionAt
        : 0;
    const scale = session.state.filters.timescale;
    const position = session.state.positionMs + elapsed * (scale?.speed ?? 1) * (scale?.rate ?? 1);
    const length =
      session.state.current?.playable?.durationMs ?? session.state.current?.track.durationMs ?? 0;
    return Math.round(
      Math.max(0, session.state.current?.track.isStream ? position : Math.min(position, length)),
    );
  }
  private capturePosition(session: Session): void {
    session.state.positionMs = this.position(session);
    session.positionAt = Date.now();
  }
  private async persist(session: Session): Promise<void> {
    const snapshot = this.snapshot(session);
    try {
      session.version = await this.repositories.queueSnapshots.save(snapshot, session.version);
    } catch (error) {
      // A different process owns a newer generation/revision. Stop this session from overwriting it.
      if (error instanceof Error && 'code' in error && error.code === 'STALE_SNAPSHOT') {
        session.closed = true;
        session.workAbort.abort();
        session.resolution?.abort();
        this.cancelIdle(session);
        this.logger.error({ guildId: snapshot.guildId }, 'Snapshot conflict; player suspended.');
      }
      throw error;
    }
  }
  private changed(session: Session): void {
    this.cancelIdle(session);
    this.emit('changed', this.snapshot(session));
    this.scheduleIdle(session);
  }
  private require(guildId: string): Session {
    const session = this.sessions.get(guildId);
    if (!session || session.closed)
      throw new MusicError('NO_PLAYER', 'Join a voice channel and play a track first.');
    return session;
  }
  private locked<T>(session: Session, operation: () => Promise<T>): Promise<T> {
    return session.lock.run(() => {
      if (session.closed) throw new MusicError('NO_PLAYER', 'This player has disconnected.');
      return operation();
    });
  }
  private requireCurrent(session: Session): QueueEntry {
    if (!session.state.current) throw new MusicError('NO_PLAYER', 'Nothing is playing.');
    return session.state.current;
  }
  private async seekLocked(session: Session, positionMs: number): Promise<void> {
    const current = this.requireCurrent(session);
    if (!current.playable?.isSeekable || current.playable.isStream)
      throw new MusicError('NOT_SEEKABLE', 'Live streams and this audio source cannot be seeked.');
    if (
      !Number.isInteger(positionMs) ||
      positionMs < 0 ||
      positionMs >= current.playable.durationMs
    )
      throw new MusicError('INVALID_INPUT', 'Choose a position within the current track.');
    await this.transport.seek(session.state.guildId, positionMs);
    session.state.positionMs = positionMs;
    session.positionAt = Date.now();
    await this.persist(session);
    this.changed(session);
  }
  private assertCapacity(session: Session, added: number): void {
    if (
      session.queue.size + Number(Boolean(session.state.current)) + added >
      session.settings.maxQueueSize
    )
      throw new MusicError('QUEUE_FULL', 'The server queue limit has been reached.');
  }
  private validateLength(session: Session, durationMs: number, isStream: boolean): void {
    if (
      !isStream &&
      (durationMs <= 0 || durationMs > session.settings.maxTrackLengthSeconds * 1000)
    )
      throw new MusicError(
        'INVALID_INPUT',
        'This track exceeds the server duration limit or has no known duration.',
      );
  }

  private kick(session: Session): void {
    if (session.closed || !session.online) return;
    if (session.pump) {
      session.wake = true;
      return;
    }
    const task = this.pump(session)
      .catch((error: unknown) => {
        this.logger.warn(
          { guildId: session.state.guildId, code: errorCode(error) },
          'Playback operation failed.',
        );
        this.emit(
          'notice',
          session.state.guildId,
          'Playback is temporarily unavailable. Your queue has been saved.',
        );
      })
      .finally(() => {
        session.pump = null;
        if (session.wake) {
          session.wake = false;
          this.kick(session);
        }
      });
    session.pump = task;
    this.watch(task);
  }
  private async pump(session: Session): Promise<void> {
    while (!session.closed && session.online) {
      const claim = await this.locked(session, async () => {
        if (session.closed || session.playing) return null;
        if (!session.state.current) {
          session.state.current = session.queue.take();
          if (session.state.current) session.prefetchFailed.delete(session.state.current.id);
          session.state.currentPlaybackId = session.state.current ? randomUUID() : null;
          session.state.positionMs = 0;
          session.state.paused = false;
        }
        if (!session.state.current) return null;
        session.state.currentPlaybackId ??= randomUUID();
        const controller = new AbortController();
        session.resolution = controller;
        await this.persist(session);
        return {
          entry: structuredClone(session.state.current),
          id: session.state.currentPlaybackId,
          nodeId: session.state.nodeId,
          controller,
        };
      });
      if (!claim) {
        if (!session.state.current && !session.closed) await this.queueEnded(session);
        return;
      }
      try {
        this.validateLength(session, claim.entry.track.durationMs, claim.entry.track.isStream);
        let playable = claim.entry.playable;
        if (
          !playable ||
          session.excluded.has(playable.encoded) ||
          (catalogSources.has(claim.entry.track.source) &&
            !this.resolver.validMirror(claim.entry.track, playable))
        ) {
          playable = await this.resolver.resolve(
            claim.entry.track,
            session.excluded,
            claim.nodeId,
            claim.controller.signal,
          );
        }
        this.validateLength(session, playable.durationMs, playable.isStream);
        claim.controller.signal.throwIfAborted();
        await this.locked(session, async () => {
          if (
            session.closed ||
            !session.online ||
            session.state.currentPlaybackId !== claim.id ||
            claim.controller.signal.aborted
          )
            return;
          const current = this.requireCurrent(session);
          current.playable = playable;
          await this.persist(session);
          await this.transport.play(session.state.guildId, playable, {
            playbackId: claim.id,
            positionMs:
              playable.isSeekable && !playable.isStream
                ? Math.min(session.state.positionMs, Math.max(0, playable.durationMs - 1))
                : 0,
            paused: session.state.paused,
            volume: session.state.volume,
            filters: session.state.filters,
          });
          session.playing = true;
          session.positionAt = Date.now();
          session.resolution = null;
          await this.repositories.history.record({
            id: claim.id,
            botId: this.botId,
            guildId: session.state.guildId,
            userId: current.requester.userId,
            track: current.track,
            startedAt: Date.now(),
          });
          this.changed(session);
        });
        this.prefetch(session);
        if (session.playing) return;
      } catch (error) {
        if (claim.controller.signal.aborted) continue;
        if (!(error instanceof MusicError)) throw error;
        await this.locked(session, async () => {
          if (session.closed || session.state.currentPlaybackId !== claim.id) return;
          if (error instanceof MusicError && error.code === 'NODE_UNAVAILABLE') {
            this.capturePosition(session);
            session.online = false;
            session.playing = false;
          } else {
            await this.retire(session, 'error');
            this.emit(
              'notice',
              session.state.guildId,
              'A full playable version was unavailable, so I skipped that track.',
            );
          }
          await this.persist(session);
        });
      }
    }
  }
  private async retire(
    session: Session,
    reason: HistoryEndReason,
    remember = true,
    stopAudio = true,
  ): Promise<void> {
    session.resolution?.abort();
    session.resolution = null;
    const current = session.state.current;
    const playbackId = session.state.currentPlaybackId;
    const ended = this.snapshot(session);
    session.playing = false;
    session.state.current = null;
    session.state.currentPlaybackId = null;
    session.state.positionMs = 0;
    session.state.paused = false;
    session.excluded.clear();
    session.retries = 0;
    session.queue.invalidateUndo();
    if (current && remember)
      session.state.previous = [structuredClone(current), ...session.state.previous].slice(0, 50);
    if (playbackId) await this.repositories.history.finish(playbackId, reason);
    if (stopAudio) await this.transport.stop(session.state.guildId).catch(() => undefined);
    if (current) this.emit('trackEnd', ended, reason);
  }
  private async retryOrAdvance(session: Session, encoded: string | null): Promise<void> {
    const current = this.requireCurrent(session);
    if (encoded) session.excluded.add(encoded);
    if (catalogSources.has(current.track.source) && session.retries < 2) {
      if (session.state.currentPlaybackId)
        await this.repositories.history.finish(session.state.currentPlaybackId, 'error');
      session.resolution?.abort();
      session.playing = false;
      session.retries++;
      current.playable = null;
      session.state.positionMs = 0;
      session.positionAt = Date.now();
      session.state.currentPlaybackId = randomUUID();
      await this.transport.stop(session.state.guildId).catch(() => undefined);
      this.emit(
        'notice',
        session.state.guildId,
        'The audio source failed. Trying another full-length mirror.',
      );
    } else {
      await this.retire(session, 'error');
      this.emit('notice', session.state.guildId, 'This track could not play, so I skipped it.');
    }
    await this.persist(session);
  }
  private async queueEnded(session: Session): Promise<void> {
    if (session.state.pendingImports.length) return; // The next page can still arrive.
    const last = session.state.previous[0];
    if (session.state.autoplay && last && !session.closed) {
      const generation = session.version?.generation;
      const entry = await this.autoplay
        .next(
          this.botId,
          session.state.guildId,
          last,
          session.queue.view(),
          session.settings.maxTrackLengthSeconds * 1000,
          session.state.nodeId,
          session.workAbort.signal,
        )
        .catch(() => null);
      if (entry) {
        await this.locked(session, async () => {
          if (
            session.closed ||
            !session.state.autoplay ||
            session.state.current ||
            session.queue.size ||
            session.version?.generation !== generation
          )
            return;
          this.assertCapacity(session, 1);
          session.queue.add([entry], 1, false);
          await this.persist(session);
          session.wake = true;
        });
        if (session.queue.size) return;
      }
    }
    this.emit('queueEnd', this.snapshot(session));
    this.scheduleIdle(session);
  }

  private startImport(session: Session, job: PendingImport): void {
    this.imports.start(
      structuredClone(job),
      {
        append: (id, items, processed, name, total) =>
          this.locked(session, async () => {
            if (session.closed) return false;
            const active = session.state.pendingImports.find((pending) => pending.id === id);
            if (!active) return false;
            const waiter = this.waiters.get(id);
            if (waiter) {
              waiter.name = name;
              waiter.total = total;
            }
            active.processedCount = processed;
            const valid = items.filter(
              (item) =>
                item.track.isStream ||
                (item.track.durationMs > 0 &&
                  item.track.durationMs <= session.settings.maxTrackLengthSeconds * 1000),
            );
            if (waiter?.replaceCurrent && valid.length) {
              waiter.replaceCurrent = false;
              await this.retire(session, 'replaced');
            }
            const available = Math.max(
              0,
              session.settings.maxQueueSize -
                session.queue.size -
                Number(Boolean(session.state.current)),
            );
            const accepted = valid.slice(0, available);
            let position = session.queue.size + 1;
            if (active.mode === 'next') {
              const lastKey = active.enqueuedKeys.at(-1);
              const entries = session.queue.view();
              const reverseIndex = [...entries]
                .reverse()
                .findIndex((entry) => entry.track.key === lastKey);
              const index = reverseIndex < 0 ? -1 : entries.length - reverseIndex - 1;
              position = index >= 0 ? index + 2 : 1;
            }
            if (accepted.length)
              session.queue.add(
                accepted.map((item) =>
                  createQueueEntry(item.track, active.requester, item.playable),
                ),
                position,
                false,
              );
            active.enqueuedKeys.push(...accepted.map((item) => item.track.key));
            if (waiter) {
              waiter.count += accepted.length;
              waiter.tracks.push(
                ...accepted
                  .slice(0, Math.max(0, 5 - waiter.tracks.length))
                  .map((item) => structuredClone(item.track)),
              );
            }
            await this.persist(session);
            if (waiter && waiter.count >= 5 && !waiter.settled) this.settleImport(id, waiter, true);
            this.emit(
              'importProgress',
              session.state.guildId,
              id,
              active.enqueuedKeys.length,
              total,
            );
            this.changed(session);
            this.kick(session);
            this.prefetch(session);
            return accepted.length === valid.length;
          }),
        complete: (id, failed, failure) =>
          this.locked(session, async () => {
            if (session.closed) return;
            session.state.pendingImports = session.state.pendingImports.filter(
              (pending) => pending.id !== id,
            );
            await this.persist(session);
            const waiter = this.waiters.get(id);
            if (waiter && !waiter.settled) {
              if (waiter.count === 0) {
                waiter.settled = true;
                waiter.reject(
                  failure ??
                    new MusicError(
                      failed ? 'UNAVAILABLE' : 'NOT_FOUND',
                      'No playable tracks could be imported.',
                    ),
                );
              } else this.settleImport(id, waiter, false);
            }
            this.waiters.delete(id);
            this.changed(session);
            this.kick(session);
          }),
      },
      (failure) => {
        const waiter = this.waiters.get(job.id);
        // A failed first page is reported by the command; avoid a second generic channel notice.
        if (waiter && !waiter.settled && waiter.count === 0) return;
        this.emit(
          'notice',
          session.state.guildId,
          `${failure?.message ?? 'The playlist import stopped because its metadata source is unavailable.'} Tracks already queued are preserved.`,
        );
      },
    );
  }
  private makeWaiter(replaceCurrent: boolean): ImportWaiter {
    let resolve!: ImportWaiter['resolve'];
    let reject!: ImportWaiter['reject'];
    const first = new Promise<ImportResult>((ready, fail) => {
      resolve = ready;
      reject = fail;
    });
    return {
      first,
      resolve,
      reject,
      name: 'Playlist',
      count: 0,
      total: null,
      settled: false,
      replaceCurrent,
      tracks: [],
    };
  }
  private settleImport(id: string, waiter: ImportWaiter, background: boolean): void {
    waiter.settled = true;
    waiter.resolve({
      id,
      name: waiter.name,
      enqueued: waiter.count,
      total: waiter.total,
      background,
      tracks: structuredClone(waiter.tracks),
    });
  }
  private cancelImports(session: Session): void {
    for (const job of session.state.pendingImports) {
      this.imports.cancel(job.id);
      const waiter = this.waiters.get(job.id);
      if (waiter && !waiter.settled) {
        waiter.settled = true;
        waiter.reject(new MusicError('UNAVAILABLE', 'The playlist import was cancelled.'));
      }
      this.waiters.delete(job.id);
    }
    session.state.pendingImports = [];
  }
  private prefetch(session: Session): void {
    if (session.closed || !session.online || !session.playing) return;
    const capacity = Math.max(0, this.env.IMPORT_CONCURRENCY - session.prefetching.size);
    if (!capacity) return;
    const excluded = new Set([...session.prefetching, ...session.prefetchFailed]);
    const entries = session.queue.unresolved(capacity, excluded);
    for (const entry of entries) {
      session.prefetching.add(entry.id);
      const task = this.resolver
        .resolve(entry.track, new Set(), session.state.nodeId, session.workAbort.signal)
        .then(async (playable) => {
          await this.locked(session, () => {
            if (session.closed || !session.queue.updatePlayable(entry.id, playable))
              return Promise.resolve();
            // Encodings are an expendable cache. Periodic checkpoints capture them in a batch;
            // a restart safely re-resolves them rather than losing catalog entries.
            return Promise.resolve();
          });
        })
        .catch(() => {
          session.prefetchFailed.add(entry.id);
        })
        .finally(() => {
          session.prefetching.delete(entry.id);
          // Failed entries wait for their turn; other songs still resolve in the background.
          this.prefetch(session);
        });
      this.watch(task);
    }
  }
  private scheduleIdle(session: Session): void {
    if (
      session.closed ||
      session.settings.stayInVoice ||
      (!session.emptyVoice &&
        (session.state.current || session.queue.size || session.state.pendingImports.length))
    ) {
      this.cancelIdle(session);
      return;
    }
    if (session.idleTimer) return;
    session.idleTimer = setTimeout(() => {
      session.idleTimer = null;
      if (
        !session.closed &&
        !session.settings.stayInVoice &&
        (session.emptyVoice ||
          (!session.state.current && !session.queue.size && !session.state.pendingImports.length))
      )
        this.watch(this.leave(session.state.guildId));
    }, session.settings.autoLeaveTimeoutSeconds * 1000);
    session.idleTimer.unref();
  }
  private cancelIdle(session: Session): void {
    if (session.idleTimer) clearTimeout(session.idleTimer);
    session.idleTimer = null;
  }
  private async configureSponsor(session: Session): Promise<void> {
    if (!this.env.SPONSORBLOCK_ENABLED && session.settings.sponsorBlockEnabled) return;
    await this.transport
      .sponsorBlock(
        session.state.guildId,
        this.env.SPONSORBLOCK_ENABLED && session.settings.sponsorBlockEnabled,
      )
      .catch(() =>
        this.emit(
          'notice',
          session.state.guildId,
          'SponsorBlock is unavailable on this audio server.',
        ),
      );
  }
  private assertPlayback(session: Session, expectedPlaybackId?: string): void {
    if (expectedPlaybackId && session.state.currentPlaybackId !== expectedPlaybackId)
      throw new MusicError('CONFLICT', 'This track ended. Use the current controller.');
  }
  private watch(task: Promise<void>): void {
    const guarded = task.catch((error: unknown) =>
      this.logger.warn({ code: errorCode(error) }, 'Background music operation failed.'),
    );
    this.background.add(guarded);
    void guarded.finally(() => this.background.delete(guarded));
  }
}
