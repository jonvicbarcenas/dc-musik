import { ChannelType, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import type { GuildMember, GuildTextBasedChannel, VoiceBasedChannel } from 'discord.js';
import type { GuildSettings } from '../db/models.js';
import { CommandError } from '../../framework/errors.js';

export interface CommandPolicy {
  voice?: 'none' | 'join' | 'same' | 'move';
  player?: boolean;
  dj?: boolean;
  admin?: boolean;
  owner?: boolean;
  musicChannel?: boolean;
  skip?: boolean;
}
export interface AccessFacts {
  userId: string;
  userVoiceId: string | null;
  playerVoiceId: string | null;
  channelId: string;
  roleIds: ReadonlySet<string>;
  manageGuild: boolean;
  owner: boolean;
  hasPlayer: boolean;
  requesterId: string | null;
  skipCount: number;
}
export function isDj(
  settings: GuildSettings,
  facts: Pick<AccessFacts, 'roleIds' | 'manageGuild' | 'owner'>,
): boolean {
  return (
    facts.owner || facts.manageGuild || !settings.djRoleId || facts.roleIds.has(settings.djRoleId)
  );
}
export function bypassVote(settings: GuildSettings, facts: AccessFacts): boolean {
  return (
    facts.owner ||
    facts.manageGuild ||
    Boolean(settings.djRoleId && facts.roleIds.has(settings.djRoleId)) ||
    (facts.skipCount === 1 && facts.requesterId === facts.userId)
  );
}
/** Pure policy function, shared by slash, prefix, and component execution. */
export function authorize(
  policy: CommandPolicy,
  settings: GuildSettings,
  facts: AccessFacts,
): void {
  if (policy.owner && !facts.owner)
    throw new CommandError('PERMISSION', 'This command is only available to the bot owner.');
  if (policy.admin && !facts.manageGuild && !facts.owner)
    throw new CommandError('PERMISSION', 'You need Manage Server to change these settings.');
  if (policy.musicChannel && settings.musicChannelId && facts.channelId !== settings.musicChannelId)
    throw new CommandError('PERMISSION', `Use music commands in <#${settings.musicChannelId}>.`);
  if (policy.player && !facts.hasPlayer)
    throw new CommandError('VOICE', 'Join a voice channel and play a track first.');
  const voice = policy.voice ?? 'none';
  if (voice !== 'none' && !facts.userVoiceId)
    throw new CommandError('VOICE', 'Join a voice channel first.');
  if (voice === 'same' && !facts.playerVoiceId)
    throw new CommandError('VOICE', 'The bot is not connected to voice.');
  if (
    (voice === 'same' || voice === 'join') &&
    facts.playerVoiceId &&
    facts.playerVoiceId !== facts.userVoiceId
  )
    throw new CommandError('VOICE', 'Join the same voice channel as the bot to control it.');
  if (policy.skip) {
    if (facts.skipCount === 1 && (facts.requesterId === facts.userId || settings.voteSkipEnabled))
      return;
    if (settings.voteSkipEnabled && !bypassVote(settings, facts))
      throw new CommandError(
        'PERMISSION',
        'Multi-track skipping requires the DJ role or Manage Server while vote skip is enabled.',
      );
  }
  if (policy.dj && !isDj(settings, facts))
    throw new CommandError(
      'PERMISSION',
      'You need the configured DJ role or Manage Server for this command.',
    );
}

export const invitePermissions = new PermissionsBitField([
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.SendMessagesInThreads,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.UseExternalEmojis,
  PermissionFlagsBits.Connect,
  PermissionFlagsBits.Speak,
  PermissionFlagsBits.RequestToSpeak,
]);

export function checkTextPermissions(bot: GuildMember, channel: GuildTextBasedChannel): void {
  const permissions = channel.permissionsFor(bot);
  const send = channel.isThread()
    ? PermissionFlagsBits.SendMessagesInThreads
    : PermissionFlagsBits.SendMessages;
  const required = [
    [PermissionFlagsBits.ViewChannel, 'View Channel'],
    [send, channel.isThread() ? 'Send Messages in Threads' : 'Send Messages'],
    [PermissionFlagsBits.EmbedLinks, 'Embed Links'],
    [PermissionFlagsBits.UseExternalEmojis, 'Use External Emojis'],
  ] as const;
  const missing = required.filter(([bit]) => !permissions?.has(bit)).map(([, name]) => name);
  if (missing.length)
    throw new CommandError(
      'PERMISSION',
      `I need these channel permissions: ${missing.join(', ')}.`,
    );
}
export function checkVoicePermissions(bot: GuildMember, channel: VoiceBasedChannel): void {
  const permissions = channel.permissionsFor(bot);
  const missing = [
    [PermissionFlagsBits.ViewChannel, 'View Channel'],
    [PermissionFlagsBits.Connect, 'Connect'],
    [PermissionFlagsBits.Speak, 'Speak'],
  ] as const;
  const names = missing.filter(([bit]) => !permissions?.has(bit)).map(([, name]) => name);
  if (names.length)
    throw new CommandError('PERMISSION', `I need these voice permissions: ${names.join(', ')}.`);
  if (
    channel.full &&
    bot.voice.channelId !== channel.id &&
    !permissions?.has(PermissionFlagsBits.MoveMembers)
  )
    throw new CommandError('VOICE', 'That voice channel is full.');
}
export async function ensureStageSpeaker(
  bot: GuildMember,
  channel: VoiceBasedChannel,
): Promise<void> {
  if (channel.type !== ChannelType.GuildStageVoice || !bot.voice.suppress) return;
  if (channel.permissionsFor(bot)?.has(PermissionFlagsBits.MuteMembers)) {
    await bot.voice.setSuppressed(false);
    return;
  }
  if (channel.permissionsFor(bot)?.has(PermissionFlagsBits.RequestToSpeak))
    await bot.voice.setRequestToSpeak(true);
  throw new CommandError(
    'VOICE',
    'I joined the stage. A stage moderator must invite me to speak before playback can start.',
  );
}
