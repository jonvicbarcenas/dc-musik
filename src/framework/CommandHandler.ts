import { MessageFlags } from 'discord.js';
import type { ChatInputCommandInteraction, MessageComponentInteraction, Message } from 'discord.js';
import { Arguments, parseInteraction, parsePrefix, parseValues } from './ArgumentParser.js';
import type { ArgumentValue } from './ArgumentParser.js';
import type { Command } from './Command.js';
import { CommandContext } from './CommandContext.js';
import type { CommandOrigin } from './CommandContext.js';
import type { CommandServices } from './CommandServices.js';
import { CommandError, commandErrorCode, commandErrorMessage } from './errors.js';
import { Cooldowns } from '../lib/utils/cooldowns.js';
import { authorize, checkTextPermissions } from '../lib/utils/permissions.js';
import type { CommandPolicy } from '../lib/utils/permissions.js';

export class CommandHandler {
  private readonly cooldowns = new Cooldowns();
  private readonly inFlight = new Set<string>();
  private readonly cleanup = new Set<ReturnType<typeof setTimeout>>();
  private readonly cancellation = new AbortController();
  private readonly active = new Set<Promise<void>>();
  private closing = false;
  constructor(public readonly services: CommandServices) {}

  handleMessage(message: Message): Promise<void> {
    return this.track(() => this.runMessage(message));
  }
  private async runMessage(message: Message): Promise<void> {
    if (message.author.bot || message.webhookId || !message.inGuild()) return;
    let context: CommandContext | null = null;
    try {
      const settings = await this.services.repositories.guildSettings.get(message.guildId);
      const input = prefixBody(message.content, settings.prefix, this.services.players.botId);
      if (input === null) return;
      const match = /^(\S+)(?:\s+([\s\S]*))?$/.exec(input.trim());
      if (!match) return;
      const command = this.services.registry.get(match[1] ?? '');
      if (!command) return; // Ordinary messages that happen to start with the prefix stay quiet.
      const args = parsePrefix(
        command,
        match[2] ?? '',
        message.attachments.map((file) => ({
          id: file.id,
          name: file.name,
          url: file.url,
          size: file.size,
        })),
      );
      context = await this.context({ kind: 'prefix', message }, args);
      await this.execute(context, command);
    } catch (error) {
      this.log(error);
      if (context)
        await context.acknowledgeError(commandErrorMessage(error)).catch(() => undefined);
      else
        await message
          .reply({ content: commandErrorMessage(error), allowedMentions: { parse: [] } })
          .catch(() => undefined);
    }
  }

  handleInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
    return this.track(() => this.runInteraction(interaction));
  }
  private async runInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
    let context: CommandContext | null = null;
    const command = this.services.registry.get(interaction.commandName);
    try {
      // Acknowledge before member fetches, database I/O, or source requests can exceed three seconds.
      if (!interaction.deferred && !interaction.replied)
        await interaction.deferReply({
          ...(command?.ephemeral ? { flags: MessageFlags.Ephemeral } : {}),
        });
      if (!command || command.name !== interaction.commandName)
        throw new CommandError(
          'ARGUMENT',
          'This command changed. Ask the bot owner to register commands again.',
        );
      context = await this.context(
        { kind: 'slash', interaction },
        parseInteraction(command, interaction),
      );
      await this.execute(context, command);
    } catch (error) {
      this.log(error);
      if (context)
        await context.acknowledgeError(commandErrorMessage(error)).catch(() => undefined);
      else if (interaction.deferred)
        await interaction
          .editReply({ content: commandErrorMessage(error), allowedMentions: { parse: [] } })
          .catch(() => undefined);
      else if (!interaction.replied)
        await interaction
          .reply({
            content: commandErrorMessage(error),
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
          })
          .catch(() => undefined);
    }
  }

  invokeComponent(
    context: CommandContext,
    name: string,
    values: Readonly<Record<string, ArgumentValue>> = {},
    subcommand: string | null = null,
  ): Promise<void> {
    return this.track(() => this.runComponent(context, name, values, subcommand));
  }
  private async runComponent(
    context: CommandContext,
    name: string,
    values: Readonly<Record<string, ArgumentValue>>,
    subcommand: string | null,
  ): Promise<void> {
    const command = this.services.registry.get(name);
    if (!command)
      throw new CommandError('ARGUMENT', 'This controller action is no longer available.');
    const args = parseValues(command, values, subcommand);
    const next = new CommandContext(
      this.services,
      context.origin,
      context.guild,
      context.channel,
      context.user,
      context.member,
      context.settings,
      args,
      (ctx, policy) => this.guard(ctx, policy),
      context.signal,
    );
    next.expectedPlaybackId = context.expectedPlaybackId;
    await this.execute(next, command);
  }
  async componentContext(
    interaction: MessageComponentInteraction,
    location?: { guildId: string; channelId: string },
  ): Promise<CommandContext> {
    return this.context({ kind: 'component', interaction }, new Arguments(null, {}), location);
  }

  async guard(context: CommandContext, policy: CommandPolicy): Promise<void> {
    if (this.closing)
      throw new CommandError('COOLDOWN', 'The bot is restarting. Try again shortly.');
    context.member = await context.guild.members.fetch(context.user.id);
    context.settings = await this.services.repositories.guildSettings.get(context.guildId);
    if (!this.services.players.view(context.guildId))
      context.savedSnapshot =
        (
          await this.services.repositories.queueSnapshots.load(
            this.services.players.botId,
            context.guildId,
          )
        )?.snapshot ?? null;
    const owner = this.services.env.OWNER_IDS.includes(context.user.id);
    if (
      !(policy.owner && owner) &&
      (await this.services.repositories.blacklist.findMatch(context.user.id, context.guildId))
    )
      throw new CommandError(
        'BLACKLIST',
        'Music commands are disabled for your account or this server.',
      );
    const count = context.args.has('count')
      ? context.args.number('count')
      : context.args.has('position') && policy.skip
        ? context.args.number('position')
        : 1;
    authorize(policy, context.settings, context.facts(count));
    checkTextPermissions(await context.guild.members.fetch(context.botId), context.channel);
    if (
      context.expectedPlaybackId &&
      this.services.players.view(context.guildId)?.currentPlaybackId !== context.expectedPlaybackId
    )
      throw new CommandError('ARGUMENT', 'This track ended. Use the current controller.');
  }

  private async context(
    origin: CommandOrigin,
    args: Arguments,
    location?: { guildId: string; channelId: string },
  ): Promise<CommandContext> {
    const guildId =
      location?.guildId ??
      (origin.kind === 'prefix' ? origin.message.guildId : origin.interaction.guildId);
    if (!guildId) throw new CommandError('GUILD_ONLY', 'Use music commands in a server.');
    const guild = await this.services.client.guilds.fetch(guildId);
    const channelId =
      location?.channelId ??
      (origin.kind === 'prefix' ? origin.message.channelId : origin.interaction.channelId);
    const channel = await guild.channels.fetch(channelId);
    if (!channel?.isTextBased() || !channel.isSendable())
      throw new CommandError('GUILD_ONLY', 'Use a text channel or thread where I can reply.');
    const user = origin.kind === 'prefix' ? origin.message.author : origin.interaction.user;
    const member = await guild.members.fetch(user.id);
    const settings = await this.services.repositories.guildSettings.get(guildId);
    return new CommandContext(
      this.services,
      origin,
      guild,
      channel,
      user,
      member,
      settings,
      args,
      (ctx, policy) => this.guard(ctx, policy),
      this.cancellation.signal,
    );
  }
  private async execute(context: CommandContext, command: Command): Promise<void> {
    context.privateResponse = command.ephemeral;
    const policy =
      typeof command.policy === 'function' ? command.policy(context.args) : command.policy;
    await this.guard(context, policy);
    const key = `${context.botId}:${context.guildId}:${context.user.id}`;
    const running = `${key}:${command.name}`;
    if (this.inFlight.has(running))
      throw new CommandError('COOLDOWN', 'That command is already running.');
    this.cooldowns.consume(key, this.services.env.COMMAND_COOLDOWN_MS);
    this.inFlight.add(running);
    try {
      await command.execute(context);
      this.scheduleCleanup(context);
    } finally {
      this.inFlight.delete(running);
    }
  }
  private scheduleCleanup(context: CommandContext): void {
    if (!context.settings.cleanMode || context.keepResponse) return;
    for (const message of context.responses) {
      const ephemeral = message.flags.has(MessageFlags.Ephemeral);
      if (!ephemeral && message.guildId !== context.guildId) continue;
      const seconds = ephemeral
        ? Math.min(context.settings.cleanAfterSeconds, 840)
        : context.settings.cleanAfterSeconds;
      const timer = setTimeout(() => {
        this.cleanup.delete(timer);
        if (ephemeral && context.origin.kind !== 'prefix')
          void context.origin.interaction.webhook.deleteMessage(message.id).catch(() => undefined);
        else void message.delete().catch(() => undefined);
      }, seconds * 1000);
      timer.unref();
      this.cleanup.add(timer);
    }
  }
  private log(error: unknown): void {
    this.services.logger.warn({ code: commandErrorCode(error) }, 'Command failed.');
  }
  beginShutdown(): void {
    this.closing = true;
    this.cancellation.abort();
    for (const timer of this.cleanup) clearTimeout(timer);
    this.cleanup.clear();
  }
  async close(): Promise<void> {
    this.beginShutdown();
    await Promise.allSettled([...this.active]);
    this.cooldowns.clear();
    this.inFlight.clear();
  }
  private track(operation: () => Promise<void>): Promise<void> {
    if (this.closing) return Promise.resolve();
    const task = operation();
    this.active.add(task);
    void task.then(
      () => this.active.delete(task),
      () => this.active.delete(task),
    );
    return task;
  }
}

export function prefixBody(content: string, prefix: string, botId: string): string | null {
  if (content.startsWith(prefix)) return content.slice(prefix.length).trimStart();
  const mention = new RegExp(`^<@!?${botId}>(?:\\s+|(?=\\S)|$)`);
  const match = mention.exec(content);
  return match ? content.slice(match[0].length).trimStart() : null;
}
