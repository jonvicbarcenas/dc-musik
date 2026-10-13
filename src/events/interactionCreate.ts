import { Events } from 'discord.js';
import type { Interaction } from 'discord.js';
import type { BotEvents } from './types.js';

export function installInteractionCreate(bot: BotEvents): () => void {
  const listener = (interaction: Interaction) => {
    if (interaction.isChatInputCommand())
      void bot.tasks.run(() => bot.coordinator.interaction(bot, interaction), 'interactionCreate');
    else if (interaction.isButton() || interaction.isStringSelectMenu())
      void bot.tasks.run(() => bot.coordinator.component(bot, interaction), 'component');
  };
  bot.services.client.on(Events.InteractionCreate, listener);
  return () => {
    bot.services.client.off(Events.InteractionCreate, listener);
  };
}
