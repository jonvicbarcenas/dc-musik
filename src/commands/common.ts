import { arg, defineCommand } from '../framework/Command.js';
import type { ArgumentSpec } from '../framework/ArgumentParser.js';
import type { CommandContext } from '../framework/CommandContext.js';
import type { CommandView } from '../framework/CommandUI.js';
import { CommandError } from '../framework/errors.js';
import type { GuildSettings, GuildSettingsPatch, Page, StoredTrack } from '../lib/db/models.js';
import type { CommandPolicy } from '../lib/utils/permissions.js';
import type { FilterPreset } from '../lib/music/FilterPresets.js';
import { applyFilterPreset } from '../lib/music/FilterPresets.js';
import { formatTime } from '../lib/utils/time.js';

export const joinPolicy: CommandPolicy = { voice: 'join', dj: true, musicChannel: true };
export const controlPolicy: CommandPolicy = {
  voice: 'same',
  player: true,
  dj: true,
  musicChannel: true,
};
export const skipPolicy: CommandPolicy = { ...controlPolicy, skip: true };
export const readPolicy: CommandPolicy = { musicChannel: true };
export const playArguments: ArgumentSpec[] = [
  arg.text('query', 'Song title or public music link', false, true),
  { name: 'attachment', description: 'A complete audio file', kind: 'attachment' },
];

export function makePlay(
  name: string,
  description: string,
  mode: 'append' | 'next' | 'now',
  aliases: readonly string[] = [],
) {
  return defineCommand({
    name,
    description,
    category: 'playback',
    aliases,
    policy: joinPolicy,
    arguments: playArguments,
    execute: async (context) => {
      const query = context.args.optionalText('query');
      const file = context.args.attachment();
      if (Boolean(query) === Boolean(file))
        throw new CommandError('ARGUMENT', 'Provide a song title/link or upload one audio file.');
      if (file && file.size > context.services.env.MEDIA_MAX_BYTES)
        throw new CommandError('ARGUMENT', 'This upload exceeds the configured file-size limit.');
      await context.joinPlayer();
      if (file) {
        const item = await context.services.players.resolver.attachment(
          file.url,
          file.name,
          context.signal,
        );
        await context.recheck(joinPolicy);
        await context.services.players.enqueue(context.guildId, [item], context.requester, mode);
        await context.present({
          kind: 'added',
          tracks: [item.track],
          count: 1,
          total: 1,
          name: item.track.title,
          background: false,
          mode,
        });
      } else {
        const result = await context.services.players.enqueueQuery(
          context.guildId,
          query ?? '',
          context.requester,
          mode,
        );
        await context.present({
          kind: 'added',
          tracks: result.tracks,
          count: result.enqueued,
          total: result.total,
          name: result.name,
          background: result.background,
          mode,
        });
      }
    },
  });
}
export function makeControl(
  name: string,
  description: string,
  success: string,
  action: (context: CommandContext) => Promise<void>,
  options: {
    aliases?: readonly string[];
    arguments?: readonly ArgumentSpec[];
    policy?: CommandPolicy;
  } = {},
) {
  return defineCommand({
    name,
    description,
    category: 'playback',
    policy: options.policy ?? controlPolicy,
    ...(options.aliases ? { aliases: options.aliases } : {}),
    ...(options.arguments ? { arguments: options.arguments } : {}),
    execute: async (context) => {
      await action(context);
      await context.notice(success);
    },
  });
}
export function makePreset(
  name: string,
  description: string,
  preset: FilterPreset,
  aliases: readonly string[] = [],
) {
  return defineCommand({
    name,
    description,
    category: 'audio',
    aliases,
    policy: controlPolicy,
    arguments: [arg.boolean('enabled', 'Enable or disable this effect', false)],
    execute: async (context) => {
      const enabled = context.args.boolean('enabled', true);
      await context.services.players.filters(
        context.guildId,
        applyFilterPreset(context.requireSnapshot().filters, preset, enabled),
      );
      await context.notice(`${name} ${enabled ? 'enabled' : 'disabled'}.`);
    },
  });
}
export async function queueView(context: CommandContext, page: number): Promise<CommandView> {
  await context.recheck(readPolicy);
  return { kind: 'queue', snapshot: context.requireSnapshot(), page, onPage: queueView };
}
export async function settingsChanged(
  context: CommandContext,
  patch: GuildSettingsPatch,
): Promise<void> {
  context.settings = await context.services.repositories.guildSettings.update(
    context.guildId,
    patch,
  );
  await context.services.players.refreshSettings(context.guildId);
  const all = settingsValues(context.settings);
  await context.present({
    kind: 'settings',
    values: Object.fromEntries(Object.keys(patch).map((key) => [key, all[key] ?? 'Updated'])),
  });
}
export function makeSetting(
  name: string,
  description: string,
  key: keyof GuildSettingsPatch,
  argument: ArgumentSpec,
  value: (context: CommandContext) => GuildSettingsPatch,
) {
  return defineCommand({
    name,
    description,
    category: 'admin',
    policy: { admin: true },
    arguments: [{ ...argument, required: false }],
    execute: async (context) => {
      if (!context.args.has(argument.name)) {
        await context.present({
          kind: 'settings',
          values: { [key]: settingsValues(context.settings)[key] ?? 'Not set' },
        });
        return;
      }
      await settingsChanged(context, value(context));
    },
  });
}
export function settingsValues(settings: GuildSettings): Record<string, string> {
  return {
    prefix: settings.prefix,
    djRoleId: settings.djRoleId ? `<@&${settings.djRoleId}>` : 'Not set',
    musicChannelId: settings.musicChannelId ? `<#${settings.musicChannelId}>` : 'Not set',
    stayInVoice: onOff(settings.stayInVoice),
    defaultVolume: `${settings.defaultVolume}%`,
    voteSkipEnabled: onOff(settings.voteSkipEnabled),
    voteSkipThreshold: `${settings.voteSkipThreshold}%`,
    announceNowPlaying: onOff(settings.announceNowPlaying),
    autoLeaveTimeoutSeconds: `${settings.autoLeaveTimeoutSeconds}s`,
    language: settings.language,
    cleanMode: onOff(settings.cleanMode),
    cleanAfterSeconds: `${settings.cleanAfterSeconds}s`,
    maxQueueSize: String(settings.maxQueueSize),
    maxTrackLengthSeconds: formatTime(settings.maxTrackLengthSeconds * 1000),
    autoplayEnabled: onOff(settings.autoplayEnabled),
    sponsorBlockEnabled: onOff(settings.sponsorBlockEnabled),
    embedColor: settings.embedColor,
  };
}
export function mapPage<T, R>(page: Page<T>, mapper: (item: T, index: number) => R): Page<R> {
  return { ...page, items: page.items.map(mapper) };
}
export function selectedTrack(context: CommandContext, position?: number): StoredTrack {
  if (position === undefined) return context.current().track;
  const entry = context.requireSnapshot().upcoming[position - 1];
  if (!entry) throw new CommandError('ARGUMENT', 'That queue position does not exist.');
  return entry.track;
}
export function onOff(value: boolean): string {
  return value ? 'On' : 'Off';
}
