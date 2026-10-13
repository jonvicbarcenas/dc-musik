import { AsyncLock } from '../lib/utils/AsyncLock.js';
import { bypassVote } from '../lib/utils/permissions.js';
import type { CommandContext } from './CommandContext.js';
import { CommandError } from './errors.js';

export interface VoteResult {
  votes: number;
  required: number;
  passed: boolean;
  duplicate: boolean;
  skipping: boolean;
}
export class VoteSkipService {
  private readonly votes = new Map<
    string,
    { voters: Set<string>; passed: boolean; expiresAt: number }
  >();
  private readonly locks = new Map<string, AsyncLock>();
  cast(
    key: string,
    voterId: string,
    eligible: ReadonlySet<string>,
    percentage: number,
  ): VoteResult {
    if (!eligible.has(voterId))
      throw new CommandError('VOICE', 'Only listeners who can hear the bot may vote to skip.');
    let state = this.votes.get(key);
    if (!state || state.expiresAt <= Date.now()) {
      if (this.votes.size >= 10_000) {
        const first = this.votes.keys().next().value;
        if (first) this.votes.delete(first);
      }
      state = { voters: new Set(), passed: false, expiresAt: Date.now() + 86_400_000 };
      this.votes.set(key, state);
    }
    for (const id of state.voters) if (!eligible.has(id)) state.voters.delete(id);
    const required = Math.max(1, Math.ceil((eligible.size * percentage) / 100));
    const duplicate = state.voters.has(voterId);
    if (state.passed)
      return { votes: state.voters.size, required, passed: false, duplicate, skipping: true };
    state.voters.add(voterId);
    const passed = state.voters.size >= required;
    state.passed = passed;
    return { votes: state.voters.size, required, passed, duplicate, skipping: false };
  }
  async skip(context: CommandContext, count: number): Promise<void> {
    const key = `${context.botId}:${context.guildId}`;
    let lock = this.locks.get(key);
    if (!lock) {
      lock = new AsyncLock();
      this.locks.set(key, lock);
    }
    await lock.run(async () => {
      await context.recheck({
        voice: 'same',
        player: true,
        dj: true,
        musicChannel: true,
        skip: true,
      });
      const snapshot = context.requireSnapshot();
      const playbackId = snapshot.currentPlaybackId;
      if (!playbackId || !snapshot.current) throw new CommandError('VOICE', 'Nothing is playing.');
      if (!context.settings.voteSkipEnabled || bypassVote(context.settings, context.facts(count))) {
        await context.services.players.skip(context.guildId, count, playbackId);
        await context.notice(`Skipped ${count === 1 ? 'the current track' : `${count} tracks`}.`);
        return;
      }
      if (count !== 1)
        throw new CommandError('PERMISSION', 'Vote skip can skip one track at a time.');
      const voice = context.guild.channels.cache.get(snapshot.voiceChannelId);
      if (!voice?.isVoiceBased())
        throw new CommandError('VOICE', 'The voice channel is unavailable.');
      const eligible = new Set(
        voice.members.filter((member) => !member.user.bot && !member.voice.deaf).keys(),
      );
      const vote = this.cast(
        `${key}:${playbackId}`,
        context.user.id,
        eligible,
        context.settings.voteSkipThreshold,
      );
      if (vote.passed) {
        await context.services.players.skip(context.guildId, 1, playbackId);
        await context.notice(`Vote passed (${vote.votes}/${vote.required}). Skipped the track.`);
      } else
        await context.notice(
          vote.skipping
            ? 'This track is already being skipped.'
            : `${vote.duplicate ? 'Your vote was already counted.' : 'Vote counted.'} ${vote.votes}/${vote.required} votes to skip.`,
          'Vote skip',
          'info',
        );
    });
  }
  clear(): void {
    this.votes.clear();
    this.locks.clear();
  }
}
