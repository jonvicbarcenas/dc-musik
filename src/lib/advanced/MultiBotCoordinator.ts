import { MessageFlags } from 'discord.js';
import type { ChatInputCommandInteraction, Message, MessageComponentInteraction } from 'discord.js';
import type { BotEvents } from '../../events/types.js';
import type { Command } from '../../framework/Command.js';
import type { Arguments } from '../../framework/ArgumentParser.js';
import { parseInteraction, parsePrefix } from '../../framework/ArgumentParser.js';
import { prefixBody } from '../../framework/CommandHandler.js';
import { commandErrorMessage } from '../../framework/errors.js';
import { AsyncLock } from '../utils/AsyncLock.js';

interface Account {
  bot: BotEvents;
  primary: boolean;
}
/** Optional accounts share repositories, but players, snapshots and controllers remain bot-scoped.
 * Reservations cover the interval between account selection and completion of a join command. */
export class MultiBotCoordinator {
  private readonly accounts: Account[] = [];
  private readonly lock = new AsyncLock();
  private readonly reservations = new Map<string, { voiceId: string; count: number }>();
  private closing = false;
  add(bot: BotEvents, primary: boolean): void {
    this.accounts.push({ bot, primary });
  }
  private policy(command: Command, args: Arguments) {
    return typeof command.policy === 'function' ? command.policy(args) : command.policy;
  }
  private async select(
    source: BotEvents,
    guildId: string,
    voiceId: string | null,
    command: Command,
    args: Arguments,
  ): Promise<{ bot: BotEvents; release: () => void }> {
    const policy = this.policy(command, args);
    const music =
      (policy.voice !== undefined && policy.voice !== 'none') ||
      (policy.musicChannel && ['queue', 'nowplaying', 'lyrics'].includes(command.name));
    if (!voiceId || !music || !this.accounts.find((account) => account.bot === source)?.primary)
      return { bot: source, release: () => undefined };
    const savedVoices = new Map<string, string>();
    await Promise.all(
      this.accounts.map(async ({ bot }) => {
        if (!bot.services.client.guilds.cache.has(guildId) || bot.services.players.view(guildId))
          return;
        const saved = await bot.services.repositories.queueSnapshots.load(
          bot.services.players.botId,
          guildId,
        );
        if (saved) savedVoices.set(bot.services.players.botId, saved.voiceChannelId);
      }),
    );
    return this.lock.run(() => {
      const candidates = this.accounts.filter(
        ({ bot }) => bot.services.client.isReady() && bot.services.client.guilds.cache.has(guildId),
      );
      const channel = (bot: BotEvents) =>
        bot.services.players.view(guildId)?.voiceChannelId ??
        this.reservations.get(`${bot.services.players.botId}:${guildId}`)?.voiceId ??
        savedVoices.get(bot.services.players.botId) ??
        bot.services.client.guilds.cache.get(guildId)?.members.cache.get(bot.services.players.botId)
          ?.voice.channelId;
      const existing = candidates.find(({ bot }) => channel(bot) === voiceId);
      const chosen =
        existing ??
        (policy.voice === 'join' ? candidates.find(({ bot }) => !channel(bot)) : undefined);
      const bot = chosen?.bot ?? source;
      const key = `${bot.services.players.botId}:${guildId}`;
      if (!chosen || (channel(bot) && channel(bot) !== voiceId))
        return Promise.resolve({ bot: source, release: () => undefined });
      const reservation = this.reservations.get(key) ?? { voiceId, count: 0 };
      reservation.count++;
      this.reservations.set(key, reservation);
      return Promise.resolve({
        bot,
        release: () => {
          reservation.count--;
          if (!reservation.count) this.reservations.delete(key);
        },
      });
    });
  }
  async interaction(source: BotEvents, interaction: ChatInputCommandInteraction): Promise<void> {
    if (this.closing) return;
    if (this.accounts.length <= 1 || !interaction.guildId) {
      await source.handler.handleInteraction(interaction);
      return;
    }
    const command = source.services.registry.get(interaction.commandName);
    if (!command) {
      await source.handler.handleInteraction(interaction);
      return;
    }
    await interaction.deferReply(command.ephemeral ? { flags: MessageFlags.Ephemeral } : {});
    try {
      const guild = await source.services.client.guilds.fetch(interaction.guildId);
      const member = await guild.members.fetch(interaction.user.id);
      const choice = await this.select(
        source,
        guild.id,
        member.voice.channelId,
        command,
        parseInteraction(command, interaction),
      );
      try {
        await choice.bot.handler.handleInteraction(interaction);
        if (command.category === 'admin') await this.refreshSettings(choice.bot, guild.id);
      } finally {
        choice.release();
      }
    } catch (error) {
      await interaction
        .editReply({ content: commandErrorMessage(error), allowedMentions: { parse: [] } })
        .catch(() => undefined);
    }
  }
  async message(source: BotEvents, message: Message): Promise<void> {
    if (this.closing || !message.inGuild() || message.author.bot || message.webhookId) return;
    const ownMention = new RegExp(`^<@!?${source.services.players.botId}>`).test(message.content);
    const first = this.accounts.find(({ bot }) =>
      bot.services.client.guilds.cache.has(message.guildId),
    );
    if (!ownMention && first?.bot !== source) return;
    if (ownMention || this.accounts.length <= 1) {
      await source.handler.handleMessage(message);
      if (ownMention && this.accounts.length > 1)
        await this.refreshSettings(source, message.guildId);
      return;
    }
    const settings = await source.services.repositories.guildSettings.get(message.guildId);
    const body = prefixBody(message.content, settings.prefix, source.services.players.botId);
    if (body === null) return;
    const match = /^(\S+)(?:\s+([\s\S]*))?$/.exec(body.trim());
    const command = match ? source.services.registry.get(match[1] ?? '') : undefined;
    if (!command) return;
    try {
      const member = await message.guild.members.fetch(message.author.id);
      const choice = await this.select(
        source,
        message.guildId,
        member.voice.channelId,
        command,
        parsePrefix(command, match?.[2] ?? ''),
      );
      try {
        if (choice.bot === source) await source.handler.handleMessage(message);
        else {
          const guild = await choice.bot.services.client.guilds.fetch(message.guildId);
          const channel = await guild.channels.fetch(message.channelId);
          if (channel?.isTextBased())
            await choice.bot.handler.handleMessage(await channel.messages.fetch(message.id));
        }
      } finally {
        choice.release();
      }
      if (command.category === 'admin') await this.refreshSettings(choice.bot, message.guildId);
    } catch (error) {
      await message
        .reply({ content: commandErrorMessage(error), allowedMentions: { parse: [] } })
        .catch(() => undefined);
    }
  }
  async component(source: BotEvents, interaction: MessageComponentInteraction): Promise<void> {
    if (this.closing) return;
    const target =
      this.accounts.find(({ bot }) => bot.router.owns(interaction.customId))?.bot ?? source;
    await target.router.handle(interaction);
  }
  private async refreshSettings(source: BotEvents, guildId: string): Promise<void> {
    await Promise.all(
      this.accounts
        .filter(({ bot }) => bot !== source)
        .map(async ({ bot }) => {
          await bot.services.players
            .refreshSettings(guildId)
            .catch(() =>
              source.services.logger.warn(
                { guildId },
                'Another account will refresh settings on recovery.',
              ),
            );
        }),
    );
  }
  close(): void {
    this.closing = true;
    this.reservations.clear();
  }
}
