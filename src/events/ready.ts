import { ActivityType } from 'discord.js';
import type { BotEvents } from './types.js';
export async function initializeReady(bot: BotEvents): Promise<void> {
  const client = bot.services.client;
  client.user.setActivity(`${bot.services.env.DEFAULT_PREFIX}play · /help`, {
    type: ActivityType.Listening,
  });
  bot.services.players.startCheckpoints();
  await bot.lavalink.init({ id: client.user.id, username: client.user.username });
  bot.services.logger.info(
    { botId: client.user.id, guilds: client.guilds.cache.size },
    'Discord client ready.',
  );
}
