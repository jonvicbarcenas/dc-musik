import { setImmediate } from 'node:timers/promises';
import pino from 'pino';
import { parseEnv } from '../../src/config/env.js';
import type { Repositories } from '../../src/lib/db/contracts.js';
import type { PlayableTrack, StoredTrack } from '../../src/lib/db/models.js';
import { MemoryCache } from '../../src/lib/cache/Cache.js';
import { SourceResolver } from '../../src/lib/music/SourceResolver.js';
import { PlayerManager } from '../../src/lib/music/PlayerManager.js';
import { CatalogClient } from '../../src/lib/music/CatalogClient.js';
import { AutoplayEngine } from '../../src/lib/music/AutoplayEngine.js';
import type { AudioTransport } from '../../src/lib/music/types.js';
import { MediaBridge } from '../../src/lib/security/MediaBridge.js';
import { VoteSkipService } from '../../src/framework/VoteSkipService.js';
import { CommandError } from '../../src/framework/errors.js';
import { LiveQueue } from '../../src/lib/web/LiveQueue.js';
import type { LiveAccess, LiveAccount } from '../../src/lib/web/LiveQueue.js';

export const listenerId = '123456789012345678';
export const botId = '333456789012345678';
export const guildId = '433456789012345678';
export const voiceId = '533456789012345678';
export const target = `${botId}:${guildId}:${voiceId}`;
export const tracks: StoredTrack[] = [
  ['Blue Sky', 'Hale'],
  ['Tadhana', 'Up Dharma Down'],
  ['Leaves', 'Ben&Ben'],
  ['Mundo', 'IV Of Spades'],
].map(([title, artist], index) => ({
  version: 1,
  key: `youtube:test-${index}`,
  title: title ?? '',
  artist: artist ?? '',
  source: 'youtube',
  identifier: 'abcdefghijk',
  uri: 'https://www.youtube.com/watch?v=abcdefghijk',
  durationMs: 190000 + index * 13000,
  isStream: false,
  artworkUrl: null,
  isrc: null,
  album: null,
  localFileId: null,
}));
export async function liveFixture(repositories: Repositories) {
  const env = parseEnv({
    DISCORD_TOKEN: `${'a'.repeat(25)}.${'b'.repeat(8)}.${'c'.repeat(30)}`,
    DISCORD_CLIENT_ID: botId,
    LAVALINK_PASSWORD: 'test-lavalink-password',
  });
  const identity = { nodeId: 'test-node', sessionId: 'test-session' };
  const transport: AudioTransport = {
    load: () => Promise.resolve({ kind: 'empty', name: '', tracks: [] }),
    connect: () => Promise.resolve(identity),
    play: () => Promise.resolve(),
    stop: () => Promise.resolve(),
    destroy: () => Promise.resolve(),
    pause: () => Promise.resolve(),
    seek: () => Promise.resolve(),
    volume: () => Promise.resolve(),
    filters: () => Promise.resolve(),
    sponsorBlock: () => Promise.resolve(),
    identity: () => identity,
    position: () => null,
    migrate: () => Promise.resolve(null),
  };
  const playable = (track: StoredTrack): PlayableTrack => ({
    encoded: `test-encoding:${track.key}`,
    identifier: track.identifier ?? 'abcdefghijk',
    title: track.title,
    artist: track.artist,
    source: 'youtube',
    uri: track.uri,
    durationMs: track.durationMs,
    isStream: false,
    isSeekable: true,
    artworkUrl: null,
    isrc: null,
    isPreview: false,
  });
  const cache = new MemoryCache();
  const resolver = new SourceResolver(
    transport,
    cache,
    new MediaBridge(env),
    new CatalogClient(env),
  );
  resolver.resolve = (track) => Promise.resolve(playable(track));
  resolver.validMirror = () => true;
  resolver.search = () => Promise.resolve(tracks.map((track) => ({ track, playable: null })));
  resolver.pages = async function* () {
    await Promise.resolve();
    yield {
      name: 'Test import',
      items: tracks.map((track) => ({ track, playable: null })),
      total: tracks.length,
    };
  };
  const players = new PlayerManager(
    botId,
    env,
    repositories,
    transport,
    resolver,
    new AutoplayEngine(resolver, repositories.history),
    pino({ level: 'silent' }),
  );
  await players.join(guildId, voiceId, '633456789012345678');
  await players.enqueue(
    guildId,
    tracks.map((track) => ({ track, playable: playable(track) })),
    { userId: '723456789012345678', displayName: 'Another listener', avatarUrl: null },
  );
  await setImmediate();
  const fixture = { present: true, refreshes: [] as boolean[] };
  const access: LiveAccess = {
    guildName: 'Test server',
    voiceName: 'Music lounge',
    userVoiceId: voiceId,
    botVoiceId: voiceId,
    roleIds: new Set(),
    manageGuild: false,
    owner: false,
    eligible: new Set([listenerId, '723456789012345678', '823456789012345678']),
    assertPresent() {
      if (!fixture.present || access.userVoiceId !== voiceId || access.botVoiceId !== voiceId)
        throw new CommandError('VOICE', 'Join the same voice channel as the bot.');
    },
  };
  const votes = new VoteSkipService();
  const account: LiveAccount = {
    botId,
    players,
    votes,
    access(userId, requestedGuild, refresh) {
      fixture.refreshes.push(refresh);
      return Promise.resolve(
        fixture.present && userId === listenerId && requestedGuild === guildId ? access : null,
      );
    },
  };
  const live = new LiveQueue(() => [account], repositories);
  return {
    ...fixture,
    access,
    votes,
    players,
    live,
    transport,
    resolver,
    presence: fixture,
    async close() {
      await players.close();
      await cache.close();
    },
  };
}
