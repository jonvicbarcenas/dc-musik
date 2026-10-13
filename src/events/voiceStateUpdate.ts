import { Events } from 'discord.js';
import type { VoiceState } from 'discord.js';
import { AsyncLock } from '../lib/utils/AsyncLock.js';
import { checkVoicePermissions, ensureStageSpeaker } from '../lib/utils/permissions.js';
import type { BotEvents } from './types.js';

export function updateOccupancy(bot: BotEvents, guildId: string): void {
  const snapshot = bot.services.players.view(guildId);
  if (!snapshot) return;
  const channel = bot.services.client.guilds.cache
    .get(guildId)
    ?.channels.cache.get(snapshot.voiceChannelId);
  if (channel?.isVoiceBased())
    bot.services.players.setVoiceOccupancy(
      guildId,
      channel.members.filter((member) => !member.user.bot).size,
    );
}
export function installVoiceStateUpdate(bot: BotEvents): () => void {
  const locks = new Map<string, AsyncLock>();
  const listener = (old: VoiceState, current: VoiceState) => {
    const id = current.guild.id;
    void bot.tasks.run(async () => {
      let lock = locks.get(id);
      if (!lock) {
        lock = new AsyncLock();
        locks.set(id, lock);
      }
      await lock.run(async () => {
        const snapshot = bot.services.players.view(id);
        if (!snapshot) return;
        if (current.id === bot.services.players.botId) {
          // Use the latest cached state: a queued event may already have been superseded.
          const actual = current.guild.members.cache.get(current.id)?.voice;
          if (!actual?.channelId) {
            await bot.services.players.leave(id);
            return;
          }
          if (actual.channelId !== snapshot.voiceChannelId) {
            const channel = actual.channel;
            if (!channel) return;
            const member = await current.guild.members.fetch(current.id);
            checkVoicePermissions(member, channel);
            await bot.services.players.moveVoice(id, actual.channelId, snapshot.textChannelId);
            await ensureStageSpeaker(member, channel);
          } else if (
            actual.channel &&
            (old.channelId !== actual.channelId ||
              (old.suppress !== actual.suppress && actual.suppress))
          ) {
            await ensureStageSpeaker(await current.guild.members.fetch(current.id), actual.channel);
          }
        }
        updateOccupancy(bot, id);
      });
    }, 'voiceStateUpdate');
  };
  bot.services.client.on(Events.VoiceStateUpdate, listener);
  return () => {
    bot.services.client.off(Events.VoiceStateUpdate, listener);
    locks.clear();
  };
}
