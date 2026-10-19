import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setImmediate } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { openDatabase, applyMigrations, createRepositories } from '../src/lib/db/index.js';
import type { DatabaseConnection, Repositories } from '../src/lib/db/index.js';
import {
  liveFixture,
  listenerId,
  target,
  guildId,
  botId,
  voiceId,
  tracks,
} from './fixtures/live.js';
import { QueueManager, createQueueEntry } from '../src/lib/music/QueueManager.js';

describe('live queue with the real player and durable checkpoints', () => {
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
  it('only discovers the listener’s own voice session and exposes display data', async () => {
    expect(await fixture.live.list(listenerId)).toHaveLength(1);
    expect(await fixture.live.list('923456789012345678')).toEqual([]);
    const view = await fixture.live.view(listenerId, target);
    expect(view.current?.track.title).toBe('Blue Sky');
    expect(view.upcoming.map((entry) => entry.track.title)).toEqual(['Tadhana', 'Leaves', 'Mundo']);
    expect(JSON.stringify(view)).not.toContain('test-encoding');
    expect(JSON.stringify(view)).not.toContain('test-session');
    fixture.presence.present = false;
    expect(await fixture.live.list(listenerId)).toEqual([]);
    await expect(fixture.live.view(listenerId, target)).rejects.toMatchObject({ code: 'VOICE' });
  });
  it('reorders and removes upcoming songs without replacing the current song', async () => {
    const before = await fixture.live.view(listenerId, target);
    const ids = before.upcoming.map((entry) => entry.id);
    await fixture.live.edit(listenerId, target, ids, ids.slice().reverse().slice(0, 2));
    const after = await fixture.live.view(listenerId, target);
    expect(after.current?.id).toBe(before.current?.id);
    expect(after.playbackId).toBe(before.playbackId);
    expect(after.upcoming.map((entry) => entry.id)).toEqual([ids[2], ids[1]]);
    expect(
      (await repositories.queueSnapshots.load(botId, guildId))?.snapshot.upcoming.map(
        (entry) => entry.id,
      ),
    ).toEqual([ids[2], ids[1]]);
    await fixture.live.act(listenerId, target, { action: 'undo' });
    expect((await fixture.live.view(listenerId, target)).upcoming.map((entry) => entry.id)).toEqual(
      ids,
    );
  });
  it('rejects edits made stale by playback advancing', async () => {
    const before = await fixture.live.view(listenerId, target);
    await fixture.players.skip(guildId, 1, before.playbackId ?? undefined);
    await setImmediate();
    const advanced = await fixture.live.view(listenerId, target);
    await expect(
      fixture.live.edit(
        listenerId,
        target,
        before.upcoming.map((entry) => entry.id),
        [],
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await fixture.live.view(listenerId, target)).upcoming).toEqual(advanced.upcoming);
  });
  it('preserves server DJ restrictions and allows the configured role', async () => {
    const djRole = '923456789012345678';
    await repositories.guildSettings.update(guildId, { djRoleId: djRole });
    expect((await fixture.live.view(listenerId, target)).permissions.control).toBe(false);
    await expect(fixture.live.edit(listenerId, target, [], [])).rejects.toMatchObject({
      code: 'PERMISSION',
    });
    await expect(fixture.live.add(listenerId, target, tracks, 'Listener')).rejects.toMatchObject({
      code: 'PERMISSION',
    });
    fixture.access.roleIds = new Set([djRole]);
    expect((await fixture.live.view(listenerId, target)).permissions.control).toBe(true);
    await fixture.live.act(listenerId, target, { action: 'volume', volume: 65 });
    expect((await fixture.live.view(listenerId, target)).volume).toBe(65);
    expect((await repositories.guildSettings.get(guildId)).defaultVolume).toBe(65);
    expect(fixture.presence.refreshes).toContain(true);
  });
  it('blocks blacklisted users and servers', async () => {
    await repositories.blacklist.set({
      kind: 'guild',
      targetId: guildId,
      actorId: listenerId,
      reason: 'Disabled',
      expiresAt: null,
    });
    expect(await fixture.live.list(listenerId)).toEqual([]);
    await expect(
      fixture.live.act(listenerId, target, { action: 'volume', volume: 20 }),
    ).rejects.toMatchObject({ code: 'BLACKLIST' });
  });
  it('shares vote counts with the Discord vote service instead of bypassing votes', async () => {
    await repositories.guildSettings.update(guildId, {
      voteSkipEnabled: true,
      voteSkipThreshold: 100,
    });
    const before = await fixture.live.view(listenerId, target);
    const playbackId = before.playbackId ?? '';
    expect(before.permissions.voteSkip).toBe(true);
    expect(await fixture.live.act(listenerId, target, { action: 'skip', playbackId })).toContain(
      '1/3',
    );
    expect((await fixture.live.view(listenerId, target)).playbackId).toBe(playbackId);
    fixture.votes.cast(
      `${botId}:${guildId}:${playbackId}`,
      '723456789012345678',
      fixture.access.eligible,
      100,
    );
    fixture.access.eligible = new Set([listenerId, '723456789012345678']);
    expect(await fixture.live.act(listenerId, target, { action: 'skip', playbackId })).toContain(
      'Vote passed',
    );
    await setImmediate();
    expect((await fixture.live.view(listenerId, target)).playbackId).not.toBe(playbackId);
  });
  it('rejects stale pause/skip buttons after a song changes', async () => {
    const before = await fixture.live.view(listenerId, target);
    const playbackId = before.playbackId ?? '';
    await fixture.live.act(listenerId, target, { action: 'pause', paused: true, playbackId });
    expect((await fixture.live.view(listenerId, target)).paused).toBe(true);
    await fixture.live.act(listenerId, target, { action: 'skip', playbackId });
    await setImmediate();
    await expect(
      fixture.live.act(listenerId, target, { action: 'pause', paused: true, playbackId }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(
      fixture.live.act(listenerId, target, { action: 'skip', playbackId }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
  it('attributes browser additions to the signed-in listener', async () => {
    const track = tracks[0];
    if (!track) throw new Error('Missing fixture track');
    await fixture.live.add(listenerId, target, [track], 'Browser listener');
    const added = fixture.players.view(guildId)?.upcoming.at(-1);
    expect(added?.requester.userId).toBe(listenerId);
    expect(added?.requester.displayName).toBe('Browser listener');
  });
  it('rechecks voice membership inside a queued player operation', async () => {
    const before = await fixture.live.view(listenerId, target);
    let release!: () => void;
    let ready!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const spy = vi.spyOn(fixture.transport, 'volume').mockImplementationOnce(() => {
      ready();
      return held;
    });
    const first = fixture.players.volume(guildId, 50);
    await entered;
    const check = vi.spyOn(fixture.access, 'assertPresent');
    const edit = fixture.live.edit(
      listenerId,
      target,
      before.upcoming.map((entry) => entry.id),
      [],
    );
    await vi.waitFor(() => expect(check).toHaveBeenCalled());
    fixture.presence.present = false;
    release();
    await first;
    await expect(edit).rejects.toMatchObject({ code: 'VOICE' });
    expect(fixture.players.view(guildId)?.upcoming).toHaveLength(before.upcoming.length);
    spy.mockRestore();
  });
  it('rejects a different bot/channel target even in the same guild', async () => {
    await expect(
      fixture.live.view(listenerId, `${botId}:${guildId}:923456789012345678`),
    ).rejects.toMatchObject({ code: 'VOICE' });
    await expect(
      fixture.live.view(listenerId, `923456789012345678:${guildId}:${voiceId}`),
    ).rejects.toMatchObject({ code: 'NO_PLAYER' });
  });
});

describe('queue entry identity edits', () => {
  it('keeps duplicate songs separate, rejects invalid IDs, and preserves undo', () => {
    const track = tracks[0];
    if (!track) throw new Error('Missing fixture track');
    const entries = [
      createQueueEntry(track, { userId: listenerId, displayName: 'Listener', avatarUrl: null }),
      createQueueEntry(track, { userId: listenerId, displayName: 'Listener', avatarUrl: null }),
    ];
    const queue = new QueueManager(entries);
    const ids = entries.map((entry) => entry.id);
    queue.edit(ids, ids.slice().reverse());
    expect(queue.view().map((entry) => entry.id)).toEqual(ids.slice().reverse());
    expect(() => queue.edit(ids.slice().reverse(), [randomUUID()])).toThrow();
    expect(() => queue.edit(ids.slice().reverse(), [ids[0] ?? '', ids[0] ?? ''])).toThrow();
    queue.undo();
    expect(queue.view()).toEqual(entries);
  });
});
