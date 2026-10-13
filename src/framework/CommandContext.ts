import { MessageFlags, PermissionFlagsBits, escapeMarkdown } from 'discord.js';
import type {
  ChatInputCommandInteraction,
  MessageComponentInteraction,
  Guild,
  GuildMember,
  GuildTextBasedChannel,
  Message,
  MessageCreateOptions,
  User,
  VoiceBasedChannel,
} from 'discord.js';
import type { GuildSettings, QueueEntry, QueueSnapshot, Requester } from '../lib/db/models.js';
import { cleanText, safeWebUrl } from '../lib/utils/text.js';
import { MusicError } from '../lib/utils/errors.js';
import { checkVoicePermissions, ensureStageSpeaker } from '../lib/utils/permissions.js';
import type { AccessFacts, CommandPolicy } from '../lib/utils/permissions.js';
import type { Arguments } from './ArgumentParser.js';
import type { CommandServices } from './CommandServices.js';
import type { CommandView } from './CommandUI.js';
import { CommandError } from './errors.js';

export type CommandOrigin =
  | { kind: 'prefix'; message: Message<true> }
  | { kind: 'slash'; interaction: ChatInputCommandInteraction }
  | { kind: 'component'; interaction: MessageComponentInteraction };
export type CommandReply = Pick<MessageCreateOptions, 'content' | 'embeds' | 'components'>;
export type ContextGuard = (context: CommandContext, policy: CommandPolicy) => Promise<void>;

export class CommandContext {
  public savedSnapshot: QueueSnapshot | null = null;
  public keepResponse = false;
  public privateResponse = false;
  public expectedPlaybackId: string | null = null;
  public readonly responses: Message[] = [];
  constructor(
    public readonly services: CommandServices,
    public readonly origin: CommandOrigin,
    public readonly guild: Guild,
    public readonly channel: GuildTextBasedChannel,
    public readonly user: User,
    public member: GuildMember,
    public settings: GuildSettings,
    public readonly args: Arguments,
    private readonly guard: ContextGuard,
    public readonly signal: AbortSignal = new AbortController().signal,
  ) {}

  get guildId(): string {
    return this.guild.id;
  }
  get botId(): string {
    return this.services.players.botId;
  }
  get createdTimestamp(): number {
    return this.origin.kind === 'prefix'
      ? this.origin.message.createdTimestamp
      : this.origin.interaction.createdTimestamp;
  }
  get requester(): Requester {
    return {
      userId: this.user.id,
      displayName: cleanText(this.member.displayName, 100),
      avatarUrl: safeWebUrl(this.user.displayAvatarURL()),
    };
  }
  get snapshot(): QueueSnapshot | null {
    return this.services.players.view(this.guildId) ?? this.savedSnapshot;
  }
  current(): QueueEntry {
    const current = this.snapshot?.current;
    if (!current) throw new MusicError('NO_PLAYER', 'Nothing is playing.');
    return current;
  }
  requireSnapshot(): QueueSnapshot {
    const snapshot = this.snapshot;
    if (!snapshot)
      throw new MusicError('NO_PLAYER', 'There is no player or saved queue in this server.');
    return snapshot;
  }
  facts(skipCount = 1): AccessFacts {
    const current = this.services.players.view(this.guildId);
    return {
      userId: this.user.id,
      userVoiceId: this.member.voice.channelId,
      playerVoiceId:
        current?.voiceChannelId ??
        this.savedSnapshot?.voiceChannelId ??
        this.guild.members.cache.get(this.botId)?.voice.channelId ??
        null,
      channelId: this.channel.id,
      roleIds: new Set(this.member.roles.cache.keys()),
      manageGuild: this.member.permissions.has(PermissionFlagsBits.ManageGuild),
      owner: this.services.env.OWNER_IDS.includes(this.user.id),
      hasPlayer: current !== null,
      requesterId: current?.current?.requester.userId ?? null,
      skipCount,
    };
  }
  async recheck(policy: CommandPolicy): Promise<void> {
    await this.guard(this, policy);
  }
  present(view: CommandView): Promise<void> {
    return this.services.ui.present(this, view);
  }
  async notice(
    text: string,
    title = 'Music',
    tone: 'success' | 'info' | 'warning' = 'success',
  ): Promise<void> {
    await this.present({ kind: 'notice', title, text, tone });
  }

  async respond(payload: CommandReply): Promise<Message> {
    const options = { ...payload, allowedMentions: { parse: [] as [] } };
    let message: Message;
    if (this.origin.kind === 'prefix') {
      if (this.privateResponse) {
        try {
          message = await this.user.send(options);
        } catch {
          throw new CommandError(
            'PERMISSION',
            'Your DMs are closed. Enable them or use the private slash command.',
          );
        }
      } else message = await this.origin.message.reply(options);
    } else {
      const interaction = this.origin.interaction;
      if (!interaction.deferred && !interaction.replied) await interaction.reply(options);
      else if (this.responses.length) {
        message = await interaction.followUp({
          ...options,
          ...(this.privateResponse || interaction.ephemeral
            ? { flags: MessageFlags.Ephemeral }
            : {}),
        });
        this.responses.push(message);
        return message;
      } else await interaction.editReply(options);
      message = await interaction.fetchReply();
    }
    this.responses.push(message);
    return message;
  }
  async dm(content: string): Promise<void> {
    try {
      await this.user.send({ content, allowedMentions: { parse: [] } });
    } catch {
      throw new CommandError(
        'PERMISSION',
        'Your DMs are closed. Enable direct messages from this server and try again.',
      );
    }
  }
  async privateText(content: string): Promise<void> {
    if (this.origin.kind !== 'prefix') {
      // Personal-library commands are deferred ephemerally by the handler.
      if (this.origin.interaction.ephemeral !== true)
        throw new CommandError(
          'PERMISSION',
          'Use the private slash command to view this information.',
        );
      await this.respond({ content });
      return;
    }
    await this.dm(content);
    await this.notice('I sent the private details to your DMs.');
  }
  async voiceChannel(): Promise<VoiceBasedChannel> {
    const id = this.member.voice.channelId;
    const channel = id ? await this.guild.channels.fetch(id) : null;
    if (!channel?.isVoiceBased())
      throw new CommandError('VOICE', 'Join a voice or stage channel first.');
    const bot = await this.guild.members.fetch(this.botId);
    checkVoicePermissions(bot, channel);
    return channel;
  }
  async joinPlayer(): Promise<QueueSnapshot> {
    await this.recheck({ voice: 'join', dj: true, musicChannel: true });
    const channel = await this.voiceChannel();
    const snapshot = await this.services.players.join(this.guildId, channel.id, this.channel.id);
    await ensureStageSpeaker(await this.guild.members.fetch(this.botId), channel);
    return snapshot;
  }
  async movePlayer(): Promise<void> {
    await this.recheck({ voice: 'move', dj: true, musicChannel: true });
    const channel = await this.voiceChannel();
    if (this.services.players.view(this.guildId))
      await this.services.players.moveVoice(this.guildId, channel.id, this.channel.id);
    else await this.services.players.join(this.guildId, channel.id, this.channel.id);
    await ensureStageSpeaker(await this.guild.members.fetch(this.botId), channel);
  }
  async disconnect(): Promise<void> {
    await this.services.players.leave(this.guildId);
    const bot = await this.guild.members.fetch(this.botId);
    if (bot.voice.channelId) await bot.voice.disconnect();
  }
  async validateRole(id: string | null): Promise<void> {
    if (id && !(await this.guild.roles.fetch(id)))
      throw new CommandError('ARGUMENT', 'That role does not exist in this server.');
  }
  async validateTextChannel(id: string | null): Promise<void> {
    if (!id) return;
    const channel = await this.guild.channels.fetch(id);
    if (!channel?.isTextBased() || !channel.isSendable())
      throw new CommandError('ARGUMENT', 'Choose a text channel or thread in this server.');
  }
  safeName(value: string): string {
    return escapeMarkdown(cleanText(value, 300));
  }
  async acknowledgeError(message: string): Promise<void> {
    if (this.origin.kind === 'prefix' && this.privateResponse) {
      await this.origin.message.reply({ content: message, allowedMentions: { parse: [] } });
      return;
    }
    if (this.origin.kind === 'component' && this.origin.interaction.deferred) {
      await this.origin.interaction.followUp({
        content: message,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
      return;
    }
    await this.respond({ content: message });
  }
}
