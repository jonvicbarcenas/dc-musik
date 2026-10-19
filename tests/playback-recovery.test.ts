import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setImmediate } from 'node:timers/promises';
import { openDatabase, applyMigrations, createRepositories } from '../src/lib/db/index.js';
import type { DatabaseConnection, Repositories } from '../src/lib/db/index.js';
import type { TrackExceptionEvent } from 'lavalink-client';
import { liveFixture, guildId, botId } from './fixtures/live.js';
import { trackEvent, toClientTrack } from '../src/lib/music/LavalinkTransport.js';
import type { TrackEvent } from '../src/lib/music/types.js';
import { MusicError } from '../src/lib/utils/errors.js';

describe('playback recovery with real queue checkpoints', () => {
  let connection: DatabaseConnection;
  let repositories: Repositories;
  let fixture: Awaited<ReturnType<typeof liveFixture>>;
  beforeEach(async () => {
    connection = openDatabase(':memory:');
    applyMigrations(connection);
    repositories = createRepositories(connection);
    fixture = await liveFixture(repositories);
  });
  afterEach(async () => {
    await fixture.close();
    connection.close();
  });
  function failure(type: TrackEvent['type'] = 'error'): TrackEvent {
    const snapshot = fixture.players.view(guildId);
    if (!snapshot?.current) throw new Error('Expected a current track.');
    return {
      guildId,
      playbackId: snapshot.currentPlaybackId,
      encoded: snapshot.current.playable?.encoded ?? null,
      type,
      reason: type === 'end' ? 'loadFailed' : null,
    };
  }
  it('reloads the same video after a minute and resumes with its queue and settings intact', async () => {
    await fixture.players.volume(guildId, 65);
    await fixture.players.filters(guildId, { timescale: { speed: 1.1, pitch: 1, rate: 1 } });
    await fixture.players.updatePosition(guildId, 65000);
    await fixture.players.pause(guildId, true);
    const before = fixture.players.view(guildId);
    const play = vi.spyOn(fixture.transport, 'play');
    const resolve = vi.spyOn(fixture.resolver, 'resolve');
    const failed = failure();
    await fixture.players.onTrackEvent(failed);
    await setImmediate();
    const after = fixture.players.view(guildId);
    expect(after?.current?.id).toBe(before?.current?.id);
    expect(after?.current?.requester).toEqual(before?.current?.requester);
    expect(after?.upcoming).toEqual(before?.upcoming);
    expect(after?.currentPlaybackId).not.toBe(before?.currentPlaybackId);
    expect(resolve.mock.calls[0]?.[1]?.size).toBe(0);
    expect(play).toHaveBeenCalledExactlyOnceWith(
      guildId,
      before?.current?.playable,
      expect.objectContaining({
        playbackId: after?.currentPlaybackId,
        positionMs: before?.positionMs,
        paused: true,
        volume: 65,
        filters: before?.filters,
      }),
    );
    const saved = await repositories.queueSnapshots.load(botId, guildId);
    expect(saved?.snapshot.positionMs).toBe(before?.positionMs);
    expect(saved?.snapshot.current?.id).toBe(before?.current?.id);
    // Lavalink can emit both exception and loadFailed/finished for the old attempt.
    for (const event of [
      failed,
      { ...failed, type: 'end' as const, reason: 'loadFailed' },
      { ...failed, type: 'end' as const, reason: 'finished' },
    ])
      await fixture.players.onTrackEvent(event);
    expect(fixture.players.view(guildId)?.currentPlaybackId).toBe(after?.currentPlaybackId);
    expect(play).toHaveBeenCalledTimes(1);
  });
  it.each(['error', 'stuck', 'end'] as const)(
    'bounds %s recovery, excludes the failed source, then advances exactly one song',
    async (type) => {
      const before = fixture.players.view(guildId);
      const exclusions: string[][] = [];
      const originalResolve = fixture.resolver.resolve.bind(fixture.resolver);
      vi.spyOn(fixture.resolver, 'resolve').mockImplementation((track, excluded, node, signal) => {
        exclusions.push([...(excluded ?? [])]);
        return originalResolve(track, excluded, node, signal);
      });
      const play = vi.spyOn(fixture.transport, 'play');
      for (let attempt = 0; attempt < 3; attempt++) {
        await fixture.players.updatePosition(guildId, 65000 + attempt * 1000);
        await fixture.players.onTrackEvent(failure(type));
        await setImmediate();
      }
      expect(exclusions).toEqual([[], [before?.current?.playable?.encoded]]);
      expect(fixture.players.view(guildId)?.current?.id).toBe(before?.upcoming[0]?.id);
      expect(fixture.players.view(guildId)?.upcoming).toHaveLength(2);
      expect(play).toHaveBeenCalledTimes(3);
      // Retry budget resets for the following song.
      await fixture.players.onTrackEvent(failure(type));
      await setImmediate();
      expect(fixture.players.view(guildId)?.current?.id).toBe(before?.upcoming[0]?.id);
      expect(exclusions.at(-1)).toEqual([]);
    },
  );
  it('resumes catalog mirrors instead of restarting the song', async () => {
    const snapshot = fixture.players.view(guildId);
    if (!snapshot?.current) throw new Error('Expected a current track.');
    await fixture.players.skip(guildId, 1);
    await setImmediate();
    await fixture.players.stop(guildId);
    await fixture.players.enqueue(
      guildId,
      [
        {
          track: {
            ...snapshot.current.track,
            source: 'spotify',
            key: 'spotify:test',
            uri: 'https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8',
          },
          playable: snapshot.current.playable,
        },
      ],
      snapshot.current.requester,
    );
    await setImmediate();
    await fixture.players.updatePosition(guildId, 61000);
    const play = vi.spyOn(fixture.transport, 'play');
    await fixture.players.onTrackEvent(failure());
    await setImmediate();
    const options = play.mock.calls[0]?.[2];
    expect(options?.positionMs).toBeGreaterThanOrEqual(61000);
    expect(options?.positionMs).toBeLessThan(62000);
  });
  it('lets a manual skip win while reconnecting is still resolving', async () => {
    const before = fixture.players.view(guildId);
    const play = vi.spyOn(fixture.transport, 'play');
    let rejectResolution!: (error: unknown) => void;
    vi.spyOn(fixture.resolver, 'resolve').mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectResolution = reject;
        }),
    );
    await fixture.players.onTrackEvent(failure());
    await setImmediate();
    await fixture.players.skip(guildId, 1);
    rejectResolution(new MusicError('UNAVAILABLE', 'Cancelled source request.'));
    await setImmediate();
    expect(fixture.players.view(guildId)?.current?.id).toBe(before?.upcoming[0]?.id);
    expect(play.mock.calls.map((call) => call[1].title)).toEqual([
      before?.upcoming[0]?.track.title,
    ]);
  });
  it('tries an alternate source when refreshing the original metadata fails', async () => {
    const before = fixture.players.view(guildId);
    if (!before?.current?.playable) throw new Error('Expected a current playable track.');
    const alternative = {
      ...before.current.playable,
      encoded: 'alternate-full-song',
      source: 'soundcloud' as const,
    };
    const resolve = vi
      .spyOn(fixture.resolver, 'resolve')
      .mockRejectedValueOnce(new MusicError('UNAVAILABLE', 'Source metadata failed.'))
      .mockResolvedValueOnce(alternative);
    const play = vi.spyOn(fixture.transport, 'play');
    await fixture.players.updatePosition(guildId, 65000);
    await fixture.players.onTrackEvent(failure());
    await setImmediate();
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(resolve.mock.calls[1]?.[1]?.has(before.current.playable.encoded)).toBe(true);
    expect(play.mock.calls[0]?.[1]).toEqual(alternative);
    expect(play.mock.calls[0]?.[2].positionMs).toBeGreaterThanOrEqual(65000);
    expect(fixture.players.view(guildId)?.current?.id).toBe(before.current.id);
    expect(fixture.players.view(guildId)?.upcoming).toEqual(before.upcoming);
  });
  it('classifies provider failures without forwarding signed URLs or tokens', () => {
    const current = fixture.players.view(guildId)?.current;
    if (!current?.playable) throw new Error('Expected playable audio.');
    for (const [cause, category] of [
      ['Client [TVHTML5] failed: Something went wrong when decoding the track.', 'decode'],
      ['Client [ANDROID_VR] failed: This video requires login.', 'authentication'],
      ['Sign in to confirm you’re not a bot', 'authentication'],
      ['Not success status code: 403', 'forbidden'],
      ['429 Too many requests', 'rate_limited'],
      ['SocketTimeoutException: Read timed out', 'timeout'],
      ['unknown provider error', 'unknown'],
    ] as const) {
      const clientTrack = toClientTrack(current.playable);
      const payload: TrackExceptionEvent = {
        op: 'event',
        type: 'TrackExceptionEvent',
        guildId,
        error: 'Provider failed.',
        track: {
          ...clientTrack,
          encoded: current.playable.encoded,
          info: { ...clientTrack.info, length: current.playable.durationMs },
          userData: { playbackId: 'test-playback' },
        },
        exception: {
          message: 'https://stream.example.com/audio?token=private-secret',
          severity: 'FAULT',
          cause,
          causeStackTrace: '',
        },
      };
      const event = trackEvent(payload);
      expect(event.failure).toBe(category);
      expect(JSON.stringify(event)).not.toContain('private-secret');
      expect(JSON.stringify(event)).not.toContain('stream.example.com');
    }
  });
});
