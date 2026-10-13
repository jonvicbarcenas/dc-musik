import { Events } from 'discord.js';
import type { Message } from 'discord.js';
import type { BotEvents } from './types.js';

export function installMessageCreate(bot: BotEvents): () => void {
  const listener = (message: Message) => {
    void bot.tasks.run(() => bot.coordinator.message(bot, message), 'messageCreate');
  };
  bot.services.client.on(Events.MessageCreate, listener);
  return () => {
    bot.services.client.off(Events.MessageCreate, listener);
  };
}
