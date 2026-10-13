import type { BotEvents } from './types.js';

export function installPlayerDisconnect(bot: BotEvents): () => void {
  const listener = (player: { guildId: string }) => {
    void bot.tasks.run(async () => {
      // Discord's voiceStateUpdate owns movement/kicks. This event also covers SDK-only disconnects.
      const guild = bot.services.client.guilds.cache.get(player.guildId);
      if (!guild || !guild.members.cache.get(bot.services.players.botId)?.voice.channelId)
        if (bot.services.players.view(player.guildId))
          await bot.services.players.leave(player.guildId);
    }, 'playerDisconnect');
  };
  bot.lavalink.on('playerDisconnect', listener);
  return () => {
    bot.lavalink.off('playerDisconnect', listener);
  };
}
