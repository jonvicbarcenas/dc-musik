import { PermissionFlagsBits } from 'discord.js';
import { z } from 'zod';
import type { CommandServices } from '../../framework/CommandServices.js';
import { CommandError } from '../../framework/errors.js';
import type { VoteSkipService } from '../../framework/VoteSkipService.js';
import type { Repositories } from '../db/contracts.js';
import { snowflakeSchema } from '../db/models.js';
import type { QueueEntry, Requester, StoredTrack } from '../db/models.js';
import type { PlayerManager } from '../music/PlayerManager.js';
import { MusicError } from '../utils/errors.js';
import { authorize, bypassVote } from '../utils/permissions.js';
import type { AccessFacts, CommandPolicy } from '../utils/permissions.js';

export interface LiveAccess {
  guildName: string;
  voiceName: string;
  userVoiceId: string;
  botVoiceId: string | null;
  roleIds: ReadonlySet<string>;
  manageGuild: boolean;
  owner: boolean;
  eligible: ReadonlySet<string>;
  assertPresent(): void;
}
export interface LiveAccount {
  botId: string;
  players: Pick<
    PlayerManager,
    'guildIds' | 'view' | 'mutateQueue' | 'pause' | 'skip' | 'volume' | 'enqueue'
  >;
  votes: Pick<VoteSkipService, 'cast'>;
  access(userId: string, guildId: string, refresh: boolean): Promise<LiveAccess | null>;
}
export interface LiveTrack {
  id: string;
  track: StoredTrack;
  requestedBy: string;
}
export interface LiveView {
  id: string;
  guildName: string;
  voiceName: string;
  current: LiveTrack | null;
  upcoming: LiveTrack[];
  playbackId: string | null;
  paused: boolean;
  positionMs: number;
  volume: number;
  pendingImports: number;
  permissions: { control: boolean; skip: boolean; voteSkip: boolean };
}
export const liveActionSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('pause'), paused: z.boolean(), playbackId: z.uuid() }),
  z.strictObject({ action: z.literal('skip'), playbackId: z.uuid() }),
  z.strictObject({ action: z.literal('volume'), volume: z.number().int().min(1).max(200) }),
  z.strictObject({ action: z.literal('undo') }),
]);
export type LiveAction = z.infer<typeof liveActionSchema>;
const control: CommandPolicy = { voice: 'same', player: true, dj: true };
const skip: CommandPolicy = { ...control, skip: true };
const publicTrack = (entry: QueueEntry): LiveTrack => ({
  id: entry.id,
  track: structuredClone(entry.track),
  requestedBy: entry.requester.displayName,
});

/** The browser targets only players sharing the authenticated listener's current voice channel. */
export class LiveQueue {
  constructor(
    private readonly accounts: () => readonly LiveAccount[],
    private readonly repositories: Repositories,
  ) {}

  async list(userId: string) {
    const sessions: {
      id: string;
      guildName: string;
      voiceName: string;
      currentTitle: string | null;
      upcomingCount: number;
    }[] = [];
    for (const account of this.accounts())
      for (const guildId of account.players.guildIds()) {
        const snapshot = account.players.view(guildId);
        if (!snapshot) continue;
        const access = await account.access(userId, guildId, false);
        if (
          !access ||
          access.userVoiceId !== snapshot.voiceChannelId ||
          access.botVoiceId !== snapshot.voiceChannelId
        )
          continue;
        if (await this.repositories.blacklist.findMatch(userId, guildId)) continue;
        sessions.push({
          id: `${account.botId}:${guildId}:${snapshot.voiceChannelId}`,
          guildName: access.guildName,
          voiceName: access.voiceName,
          currentTitle: snapshot.current?.track.title ?? null,
          upcomingCount: snapshot.upcoming.length,
        });
      }
    return sessions;
  }

  async view(userId: string, id: string): Promise<LiveView> {
    const { snapshot, access, settings, facts } = await this.load(userId, id, false);
    const can = (policy: CommandPolicy) => {
      try {
        authorize(policy, settings, facts);
        return true;
      } catch {
        return false;
      }
    };
    const voteSkip = settings.voteSkipEnabled && !bypassVote(settings, facts);
    return {
      id,
      guildName: access.guildName,
      voiceName: access.voiceName,
      current: snapshot.current ? publicTrack(snapshot.current) : null,
      upcoming: snapshot.upcoming.map(publicTrack),
      playbackId: snapshot.currentPlaybackId,
      paused: snapshot.paused,
      positionMs: snapshot.positionMs,
      volume: snapshot.volume,
      pendingImports: snapshot.pendingImports.length,
      permissions: {
        control: can(control),
        skip: can(skip) && (!voteSkip || access.eligible.has(userId)),
        voteSkip,
      },
    };
  }

  async edit(
    userId: string,
    id: string,
    expectedIds: string[],
    orderedIds: string[],
  ): Promise<void> {
    const loaded = await this.load(userId, id, true);
    authorize(control, loaded.settings, loaded.facts);
    await loaded.account.players.mutateQueue(
      loaded.snapshot.guildId,
      (queue) => queue.edit(expectedIds, orderedIds),
      undefined,
      loaded.guard,
    );
  }

  async add(
    userId: string,
    id: string,
    tracks: readonly StoredTrack[],
    displayName: string,
  ): Promise<void> {
    const { account, snapshot, settings, facts, guard } = await this.load(userId, id, true);
    authorize(control, settings, facts);
    const requester: Requester = {
      userId,
      displayName: displayName.slice(0, 100),
      avatarUrl: null,
    };
    await account.players.enqueue(
      snapshot.guildId,
      tracks.map((track) => ({ track, playable: null })),
      requester,
      'append',
      guard,
    );
  }

  async act(userId: string, id: string, action: LiveAction): Promise<string> {
    const { account, snapshot, access, settings, facts, guard } = await this.load(userId, id, true);
    authorize(action.action === 'skip' ? skip : control, settings, facts);
    if ('playbackId' in action && snapshot.currentPlaybackId !== action.playbackId)
      throw new MusicError(
        'CONFLICT',
        'The current song changed. Refresh the live queue and try again.',
      );
    if (action.action === 'pause') {
      await account.players.pause(snapshot.guildId, action.paused, action.playbackId, guard);
      return action.paused ? 'Playback paused' : 'Playback resumed';
    }
    if (action.action === 'volume') {
      await account.players.volume(snapshot.guildId, action.volume, undefined, guard);
      return `Volume: ${action.volume}%`;
    }
    if (action.action === 'undo') {
      await account.players.mutateQueue(
        snapshot.guildId,
        (queue) => queue.undo(),
        undefined,
        guard,
      );
      return 'Last queue edit undone';
    }
    if (!snapshot.current) throw new MusicError('NOT_FOUND', 'Nothing is playing.');
    if (settings.voteSkipEnabled && !bypassVote(settings, facts)) {
      guard();
      const vote = account.votes.cast(
        `${account.botId}:${snapshot.guildId}:${action.playbackId}`,
        userId,
        access.eligible,
        settings.voteSkipThreshold,
      );
      if (!vote.passed)
        return vote.skipping
          ? 'This song is already being skipped.'
          : `${vote.duplicate ? 'Your vote was already counted.' : 'Vote counted.'} ${vote.votes}/${vote.required} votes to skip.`;
      await account.players.skip(snapshot.guildId, 1, action.playbackId, guard);
      return `Vote passed (${vote.votes}/${vote.required}). Song skipped.`;
    }
    await account.players.skip(snapshot.guildId, 1, action.playbackId, guard);
    return 'Song skipped';
  }

  private async load(userId: string, id: string, refresh: boolean) {
    const [botId, guildId, voiceId] = z
      .tuple([snowflakeSchema, snowflakeSchema, snowflakeSchema])
      .parse(id.split(':'));
    const account = this.accounts().find((item) => item.botId === botId);
    if (!account) throw new MusicError('NO_PLAYER', 'That live session is no longer available.');
    const access = await account.access(userId, guildId, refresh);
    // Read the player after asynchronous role/member checks, since playback may have advanced.
    const snapshot = account.players.view(guildId);
    if (
      !access ||
      !snapshot ||
      snapshot.voiceChannelId !== voiceId ||
      access.userVoiceId !== voiceId ||
      access.botVoiceId !== voiceId
    )
      throw new CommandError(
        'VOICE',
        'Join the same voice channel as this bot to open its live queue.',
      );
    if (await this.repositories.blacklist.findMatch(userId, guildId))
      throw new CommandError(
        'BLACKLIST',
        'Music commands are disabled for your account or this server.',
      );
    const settings = await this.repositories.guildSettings.get(guildId);
    const facts: AccessFacts = {
      userId,
      userVoiceId: access.userVoiceId,
      playerVoiceId: snapshot.voiceChannelId,
      channelId: snapshot.textChannelId ?? voiceId,
      roleIds: access.roleIds,
      manageGuild: access.manageGuild,
      owner: access.owner,
      hasPlayer: true,
      requesterId: snapshot.current?.requester.userId ?? null,
      skipCount: 1,
    };
    const guard = () => {
      access.assertPresent();
      if (account.players.view(guildId)?.voiceChannelId !== voiceId)
        throw new CommandError('VOICE', 'This voice session changed. Refresh the live queue.');
    };
    guard();
    return { account, snapshot, access, settings, facts, guard };
  }
}

/** Gateway voice state is authoritative; force-refresh roles for every browser mutation. */
export function discordLiveAccount(services: CommandServices): LiveAccount {
  return {
    botId: services.players.botId,
    players: services.players,
    votes: services.votes,
    async access(userId, guildId, refresh) {
      const guild = services.client.guilds.cache.get(guildId);
      const voiceId = guild?.voiceStates.cache.get(userId)?.channelId;
      if (!guild?.available || !voiceId) return null;
      const member =
        refresh || !guild.members.cache.has(userId)
          ? await guild.members.fetch({ user: userId, force: true }).catch(() => null)
          : guild.members.cache.get(userId);
      const voice = member?.voice.channel;
      if (
        !member ||
        !voice ||
        !voice
          .permissionsFor(member)
          ?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect])
      )
        return null;
      return {
        guildName: guild.name,
        voiceName: voice.name,
        userVoiceId: member.voice.channelId ?? '',
        botVoiceId: guild.voiceStates.cache.get(services.players.botId)?.channelId ?? null,
        roleIds: new Set(member.roles.cache.keys()),
        manageGuild: member.permissions.has(PermissionFlagsBits.ManageGuild),
        owner: services.env.OWNER_IDS.includes(userId),
        eligible: new Set(
          voice.members.filter((listener) => !listener.user.bot && !listener.voice.deaf).keys(),
        ),
        assertPresent() {
          if (
            !guild.available ||
            guild.voiceStates.cache.get(userId)?.channelId !== voice.id ||
            guild.voiceStates.cache.get(services.players.botId)?.channelId !== voice.id
          )
            throw new CommandError(
              'VOICE',
              'Join the same voice channel as this bot to control it.',
            );
        },
      };
    },
  };
}
