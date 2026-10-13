# Phase 5 — Complete files

Every implementation file added or changed in Phase 5 is reproduced below without abbreviation, with an absolute path header. There are 93 files, including all 68 command definitions. Temporary verification fixtures are reserved for Phase 7.

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/admin/announce.ts

````typescript
import { arg } from '../../framework/Command.js';
import { makeSetting } from '../common.js';
const command = makeSetting(
  'announce',
  'View or toggle Now Playing announcements',
  'announceNowPlaying',
  arg.boolean('enabled', 'Announce new tracks', false),
  (context) => ({ announceNowPlaying: context.args.boolean('enabled') }),
);
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/admin/autoleave.ts

````typescript
import { arg } from '../../framework/Command.js';
import { makeSetting } from '../common.js';
const command = makeSetting(
  'autoleave',
  'View or change idle/empty voice leave timeout',
  'autoLeaveTimeoutSeconds',
  arg.integer('seconds', 'Idle leave timeout in seconds', false, 10, 86400),
  (context) => ({ autoLeaveTimeoutSeconds: context.args.number('seconds') }),
);
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/admin/blacklist.ts

````typescript
import { arg, defineCommand } from '../../framework/Command.js';
import type { CommandContext } from '../../framework/CommandContext.js';
import type { CommandView } from '../../framework/CommandUI.js';
import { CommandError } from '../../framework/errors.js';
import { mapPage } from '../common.js';

async function blacklistPage(
  context: CommandContext,
  kind: 'user' | 'guild' | null,
  includeExpired: boolean,
  page: number,
): Promise<CommandView> {
  await context.recheck({ owner: true });
  const result = await context.services.repositories.blacklist.list(
    { ...(kind ? { kind } : {}), includeExpired },
    { page, pageSize: 10 },
  );
  return {
    kind: 'list',
    title: 'Bot blacklist',
    page: mapPage(
      result,
      (entry) => `${entry.kind}: ${entry.targetId} · ${context.safeName(entry.reason)}`,
    ),
    onPage: (fresh, next) => blacklistPage(fresh, kind, includeExpired, next),
  };
}
const command = defineCommand({
  name: 'blacklist',
  description: 'Bot owner: manage blocked users and servers',
  category: 'admin',
  ephemeral: true,
  policy: { owner: true },
  prefixDefault: 'list',
  subcommands: [
    {
      name: 'add',
      description: 'Block a user or server',
      arguments: [
        arg.choice('kind', 'Target kind', ['user', 'guild']),
        arg.text('target', 'User or server ID', true, false, 20),
        arg.text('reason', 'Reason for the owner audit record', false, true, 500),
      ],
    },
    {
      name: 'remove',
      description: 'Unblock a user or server',
      arguments: [
        arg.choice('kind', 'Target kind', ['user', 'guild']),
        arg.text('target', 'User or server ID', true, false, 20),
      ],
    },
    {
      name: 'list',
      description: 'Browse blocked users and servers',
      arguments: [
        arg.choice('kind', 'Target kind', ['all', 'user', 'guild'], false),
        arg.integer('page', 'Page number', false, 1, 1000000),
        arg.boolean('expired', 'Include expired records', false),
      ],
    },
  ],
  execute: async (context) => {
    const kind = context.args.text('kind', 'all');
    if (context.args.subcommand === 'list') {
      await context.present(
        await blacklistPage(
          context,
          kind === 'user' || kind === 'guild' ? kind : null,
          context.args.boolean('expired', false),
          context.args.number('page', 1),
        ),
      );
      return;
    }
    const target = context.args.text('target');
    if (!/^\d{17,20}$/.test(target) || (kind !== 'user' && kind !== 'guild'))
      throw new CommandError('ARGUMENT', 'Provide a valid user or server ID.');
    if (context.args.subcommand === 'remove') {
      const removed = await context.services.repositories.blacklist.remove(kind, target);
      await context.notice(removed ? 'Blacklist entry removed.' : 'That target was not blocked.');
      return;
    }
    await context.services.repositories.blacklist.set({
      kind,
      targetId: target,
      actorId: context.user.id,
      reason: context.args.text('reason', 'Blocked by the bot owner'),
      expiresAt: null,
    });
    await context.notice('Blacklist entry saved.');
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/admin/clean.ts

````typescript
import { arg, defineCommand } from '../../framework/Command.js';
import { settingsChanged, settingsValues } from '../common.js';
const command = defineCommand({
  name: 'clean',
  description: 'View or set automatic deletion of the bot’s command replies',
  category: 'admin',
  policy: { admin: true },
  arguments: [
    arg.boolean('enabled', 'Enable reply cleanup', false),
    arg.integer('seconds', 'Delete replies after this many seconds', false, 5, 3600),
  ],
  execute: async (context) => {
    if (!context.args.has('enabled') && !context.args.has('seconds')) {
      const values = settingsValues(context.settings);
      await context.present({
        kind: 'settings',
        values: {
          cleanMode: values['cleanMode'] ?? 'Off',
          cleanAfterSeconds: values['cleanAfterSeconds'] ?? '30s',
        },
      });
      return;
    }
    await settingsChanged(context, {
      ...(context.args.has('enabled') ? { cleanMode: context.args.boolean('enabled') } : {}),
      ...(context.args.has('seconds') ? { cleanAfterSeconds: context.args.number('seconds') } : {}),
    });
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/admin/defaultvolume.ts

````typescript
import { arg } from '../../framework/Command.js';
import { makeSetting } from '../common.js';
const command = makeSetting(
  'defaultvolume',
  'View or change the volume for future players',
  'defaultVolume',
  arg.integer('percent', 'Default volume percent', false, 1, 200),
  (context) => ({ defaultVolume: context.args.number('percent') }),
);
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/admin/djrole.ts

````typescript
import { defineCommand, arg } from '../../framework/Command.js';
import { CommandError } from '../../framework/errors.js';
import { settingsChanged, settingsValues } from '../common.js';
const command = defineCommand({
  name: 'djrole',
  description: 'View, set, or clear the role required for music controls',
  category: 'admin',
  policy: { admin: true },
  arguments: [
    {
      name: 'role',
      description: 'DJ role; prefix accepts off to clear',
      kind: 'role',
      allowClear: true,
    },
    arg.boolean('clear', 'Clear the DJ role', false),
  ],
  execute: async (context) => {
    if (!context.args.has('role') && !context.args.boolean('clear', false)) {
      await context.present({
        kind: 'settings',
        values: { djRoleId: settingsValues(context.settings)['djRoleId'] ?? 'Not set' },
      });
      return;
    }
    const role = context.args.id('role');
    if (role && context.args.boolean('clear', false))
      throw new CommandError('ARGUMENT', 'Choose a role or clear it, not both.');
    await context.validateRole(role);
    await settingsChanged(context, { djRoleId: role });
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/admin/language.ts

````typescript
import { arg } from '../../framework/Command.js';
import { makeSetting } from '../common.js';
const command = makeSetting(
  'language',
  'View or set the server language',
  'language',
  arg.choice('code', 'Language code', ['en', 'tl'], false),
  (context) => ({ language: context.args.text('code') === 'tl' ? 'tl' : 'en' }),
);
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/admin/maxqueue.ts

````typescript
import { arg } from '../../framework/Command.js';
import { makeSetting } from '../common.js';
const command = makeSetting(
  'maxqueue',
  'View or set the maximum active queue size',
  'maxQueueSize',
  arg.integer('count', 'Maximum tracks including the current track', false, 1, 10000),
  (context) => ({ maxQueueSize: context.args.number('count') }),
);
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/admin/maxtracklength.ts

````typescript
import { arg } from '../../framework/Command.js';
import { makeSetting } from '../common.js';
const command = makeSetting(
  'maxtracklength',
  'View or set maximum finite song duration',
  'maxTrackLengthSeconds',
  arg.duration('time', 'Maximum duration, such as 2h', 30000, 86400000),
  (context) => ({ maxTrackLengthSeconds: Math.floor(context.args.number('time') / 1000) }),
);
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/admin/musicchannel.ts

````typescript
import { defineCommand, arg } from '../../framework/Command.js';
import { CommandError } from '../../framework/errors.js';
import { settingsChanged, settingsValues } from '../common.js';
const command = defineCommand({
  name: 'musicchannel',
  description: 'View, set, or clear the channel for music commands',
  category: 'admin',
  policy: { admin: true },
  arguments: [
    {
      name: 'channel',
      description: 'Music text channel; prefix accepts off to clear',
      kind: 'channel',
      allowClear: true,
    },
    arg.boolean('clear', 'Clear the channel restriction', false),
  ],
  execute: async (context) => {
    if (!context.args.has('channel') && !context.args.boolean('clear', false)) {
      await context.present({
        kind: 'settings',
        values: { musicChannelId: settingsValues(context.settings)['musicChannelId'] ?? 'Not set' },
      });
      return;
    }
    const channel = context.args.id('channel');
    if (channel && context.args.boolean('clear', false))
      throw new CommandError('ARGUMENT', 'Choose a channel or clear it, not both.');
    await context.validateTextChannel(channel);
    await settingsChanged(context, { musicChannelId: channel });
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/admin/prefix.ts

````typescript
import { arg } from '../../framework/Command.js';
import { makeSetting } from '../common.js';
const command = makeSetting(
  'prefix',
  'View or change the server command prefix',
  'prefix',
  arg.text('value', 'New command prefix', false, false, 10),
  (context) => ({ prefix: context.args.text('value') }),
);
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/admin/settings.ts

````typescript
import { defineCommand } from '../../framework/Command.js';
import { settingsValues } from '../common.js';
const command = defineCommand({
  name: 'settings',
  description: 'Show all server music settings',
  category: 'admin',
  policy: { admin: true },
  execute: async (context) => {
    await context.present({ kind: 'settings', values: settingsValues(context.settings) });
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/admin/sponsorblock.ts

````typescript
import { arg, defineCommand } from '../../framework/Command.js';
import { CommandError } from '../../framework/errors.js';
import { settingsChanged, settingsValues } from '../common.js';
const command = defineCommand({
  name: 'sponsorblock',
  description: 'View or toggle optional sponsor segment skipping',
  category: 'admin',
  policy: { admin: true },
  arguments: [arg.boolean('enabled', 'Enable SponsorBlock for this server', false)],
  execute: async (context) => {
    if (!context.args.has('enabled')) {
      await context.present({
        kind: 'settings',
        values: {
          sponsorBlockEnabled: settingsValues(context.settings)['sponsorBlockEnabled'] ?? 'Off',
        },
      });
      return;
    }
    const enabled = context.args.boolean('enabled');
    if (enabled && !context.services.env.SPONSORBLOCK_ENABLED)
      throw new CommandError(
        'PERMISSION',
        'The bot owner must enable SponsorBlock in the bot configuration first.',
      );
    await settingsChanged(context, { sponsorBlockEnabled: enabled });
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/admin/stay.ts

````typescript
import { arg } from '../../framework/Command.js';
import { makeSetting } from '../common.js';
const command = makeSetting(
  'stay',
  'View or toggle 24/7 voice mode',
  'stayInVoice',
  arg.boolean('enabled', 'Keep the bot in voice while idle', false),
  (context) => ({ stayInVoice: context.args.boolean('enabled') }),
);
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/admin/voteskip.ts

````typescript
import { arg, defineCommand } from '../../framework/Command.js';
import { settingsChanged, settingsValues } from '../common.js';
const command = defineCommand({
  name: 'voteskip',
  description: 'View or change vote skip and its listener percentage',
  category: 'admin',
  policy: { admin: true },
  arguments: [
    arg.boolean('enabled', 'Enable vote skip', false),
    arg.integer('threshold', 'Percent of eligible listeners required', false, 1, 100),
  ],
  execute: async (context) => {
    if (!context.args.has('enabled') && !context.args.has('threshold')) {
      const values = settingsValues(context.settings);
      await context.present({
        kind: 'settings',
        values: {
          voteSkipEnabled: values['voteSkipEnabled'] ?? 'Off',
          voteSkipThreshold: values['voteSkipThreshold'] ?? '50%',
        },
      });
      return;
    }
    await settingsChanged(context, {
      ...(context.args.has('enabled') ? { voteSkipEnabled: context.args.boolean('enabled') } : {}),
      ...(context.args.has('threshold')
        ? { voteSkipThreshold: context.args.number('threshold') }
        : {}),
    });
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/audio/bassboost.ts

````typescript
import { makePreset } from '../common.js';
const command = makePreset('bassboost', 'Apply or disable the bass equalizer preset', 'bassboost');
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/audio/eightd.ts

````typescript
import { makePreset } from '../common.js';
const command = makePreset('8d', 'Apply or disable rotating stereo audio', '8d', ['eightd']);
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/audio/equalizer.ts

````typescript
import { arg, defineCommand } from '../../framework/Command.js';
import { equalizer, equalizerPresets } from '../../lib/music/FilterPresets.js';
import { controlPolicy } from '../common.js';
const command = defineCommand({
  name: 'equalizer',
  description: 'Apply an equalizer preset',
  category: 'audio',
  aliases: ['eq'],
  policy: controlPolicy,
  arguments: [arg.choice('preset', 'Equalizer preset', Object.keys(equalizerPresets))],
  execute: async (context) => {
    const name = context.args.text('preset');
    if (!Object.hasOwn(equalizerPresets, name)) return;
    await context.services.players.filters(context.guildId, {
      ...context.requireSnapshot().filters,
      equalizer: equalizer(name as keyof typeof equalizerPresets),
    });
    await context.notice(`Equalizer: ${name}.`);
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/audio/filters.ts

````typescript
import { defineCommand } from '../../framework/Command.js';
import { controlPolicy, readPolicy } from '../common.js';
const command = defineCommand({
  name: 'filters',
  description: 'Inspect or reset all audio filters',
  category: 'audio',
  prefixDefault: 'show',
  policy: (args) => (args.subcommand === 'reset' ? controlPolicy : { ...readPolicy, player: true }),
  subcommands: [
    { name: 'show', description: 'Show active filters' },
    { name: 'reset', description: 'Reset all audio filters' },
  ],
  execute: async (context) => {
    if (context.args.subcommand === 'reset') {
      await context.services.players.filters(context.guildId, {});
      await context.notice('All audio filters reset.');
      return;
    }
    const filters = context.requireSnapshot().filters;
    await context.present({
      kind: 'settings',
      values: {
        speed: (filters.timescale?.speed ?? 1) + '×',
        pitch: (filters.timescale?.pitch ?? 1) + '×',
        rate: (filters.timescale?.rate ?? 1) + '×',
        equalizer:
          filters.equalizer?.map((band) => band.band + ':' + band.gain.toFixed(2)).join(' ') ??
          'Flat',
        effects:
          ['karaoke', 'tremolo', 'vibrato', 'rotation', 'lowPass', 'channelMix']
            .filter((name) => Object.hasOwn(filters, name))
            .join(', ') || 'None',
      },
    });
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/audio/karaoke.ts

````typescript
import { makePreset } from '../common.js';
const command = makePreset('karaoke', 'Apply or disable vocal reduction', 'karaoke');
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/audio/lowpass.ts

````typescript
import { makePreset } from '../common.js';
const command = makePreset('lowpass', 'Apply or disable high-frequency smoothing', 'lowpass');
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/audio/nightcore.ts

````typescript
import { makePreset } from '../common.js';
const command = makePreset(
  'nightcore',
  'Apply or disable faster playback with higher pitch',
  'nightcore',
);
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/audio/pitch.ts

````typescript
import { arg, defineCommand } from '../../framework/Command.js';
import { setTimescale } from '../../lib/music/FilterPresets.js';
import { controlPolicy } from '../common.js';
const command = defineCommand({
  name: 'pitch',
  description: 'Set playback pitch from 0.25 to 4',
  category: 'audio',
  policy: controlPolicy,
  arguments: [arg.number('value', 'pitch multiplier')],
  execute: async (context) => {
    const value = context.args.number('value');
    await context.services.players.filters(
      context.guildId,
      setTimescale(context.requireSnapshot().filters, 'pitch', value),
    );
    await context.notice('pitch: ' + value + '×.');
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/audio/rate.ts

````typescript
import { arg, defineCommand } from '../../framework/Command.js';
import { setTimescale } from '../../lib/music/FilterPresets.js';
import { controlPolicy } from '../common.js';
const command = defineCommand({
  name: 'rate',
  description: 'Set playback rate from 0.25 to 4',
  category: 'audio',
  policy: controlPolicy,
  arguments: [arg.number('value', 'rate multiplier')],
  execute: async (context) => {
    const value = context.args.number('value');
    await context.services.players.filters(
      context.guildId,
      setTimescale(context.requireSnapshot().filters, 'rate', value),
    );
    await context.notice('rate: ' + value + '×.');
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/audio/rotation.ts

````typescript
import { makePreset } from '../common.js';
const command = makePreset('rotation', 'Apply or disable stereo rotation', 'rotation');
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/audio/speed.ts

````typescript
import { arg, defineCommand } from '../../framework/Command.js';
import { setTimescale } from '../../lib/music/FilterPresets.js';
import { controlPolicy } from '../common.js';
const command = defineCommand({
  name: 'speed',
  description: 'Set playback speed from 0.25 to 4',
  category: 'audio',
  policy: controlPolicy,
  arguments: [arg.number('value', 'speed multiplier')],
  execute: async (context) => {
    const value = context.args.number('value');
    await context.services.players.filters(
      context.guildId,
      setTimescale(context.requireSnapshot().filters, 'speed', value),
    );
    await context.notice('speed: ' + value + '×.');
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/audio/tremolo.ts

````typescript
import { makePreset } from '../common.js';
const command = makePreset('tremolo', 'Apply or disable a volume oscillation effect', 'tremolo');
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/audio/vaporwave.ts

````typescript
import { makePreset } from '../common.js';
const command = makePreset(
  'vaporwave',
  'Apply or disable slower playback with lower pitch',
  'vaporwave',
);
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/audio/vibrato.ts

````typescript
import { makePreset } from '../common.js';
const command = makePreset('vibrato', 'Apply or disable a pitch oscillation effect', 'vibrato');
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/audio/volume.ts

````typescript
import { arg, defineCommand } from '../../framework/Command.js';
import { controlPolicy } from '../common.js';
const command = defineCommand({
  name: 'volume',
  description: 'Set and save playback volume from 1 to 200 percent',
  category: 'audio',
  aliases: ['vol'],
  policy: controlPolicy,
  arguments: [arg.integer('percent', 'Volume percent', true, 1, 200)],
  execute: async (context) => {
    const volume = context.args.number('percent');
    await context.services.players.volume(context.guildId, volume);
    await context.notice(`Volume: ${volume}%.`);
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/common.ts

````typescript
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

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/extras/about.ts

````typescript
import { defineCommand } from '../../framework/Command.js';
export const sourceCredits =
  'Powered by discord.js, Lavalink, lavalink-client, LavaSrc, youtube-source, LavaLyrics, optional SponsorBlock, LRCLIB, and lyrics.ovh.';
const command = defineCommand({
  name: 'about',
  description: 'Show source credits and how full-song mirroring works',
  category: 'extras',
  execute: async (context) => {
    await context.notice(
      'Discord Music Stream plays full tracks through Lavalink. Spotify, Apple Music, Deezer, and Yandex links provide metadata for validated YouTube/YouTube Music/SoundCloud mirrors. No matching full track means unavailable; previews are never a fallback.\n\n' +
        sourceCredits,
      'About',
      'info',
    );
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/extras/favorites.ts

````typescript
import { arg, defineCommand } from '../../framework/Command.js';
import type { CommandContext } from '../../framework/CommandContext.js';
import type { CommandView } from '../../framework/CommandUI.js';
import { CommandError } from '../../framework/errors.js';
import { joinPolicy, mapPage, selectedTrack } from '../common.js';

export async function favoritesPage(context: CommandContext, page: number): Promise<CommandView> {
  await context.recheck({});
  const result = await context.services.repositories.userFavorites.list(context.user.id, {
    page,
    pageSize: 10,
  });
  return {
    kind: 'tracks',
    title: 'Your favorites',
    page: mapPage(result, (favorite) => favorite.track),
    onPage: favoritesPage,
  };
}
const command = defineCommand({
  name: 'favorites',
  description: 'Manage and play your personal favorites',
  category: 'extras',
  aliases: ['favorite', 'fav'],
  ephemeral: true,
  prefixDefault: 'list',
  policy: (args) => (args.subcommand === 'play' ? joinPolicy : {}),
  subcommands: [
    {
      name: 'add',
      description: 'Save the current song or an upcoming position',
      arguments: [arg.integer('position', 'Upcoming position; omit for current song', false)],
    },
    {
      name: 'remove',
      description: 'Remove a favorite by list position or key',
      arguments: [arg.text('target', 'Favorite list position or catalog key')],
    },
    {
      name: 'list',
      description: 'Browse your favorites',
      arguments: [arg.integer('page', 'Page number', false, 1, 1000000)],
    },
    {
      name: 'play',
      description: 'Play all favorites or one list position',
      arguments: [arg.integer('position', 'Favorite list position; omit to play all', false)],
    },
  ],
  execute: async (context) => {
    const repository = context.services.repositories.userFavorites;
    switch (context.args.subcommand) {
      case 'add': {
        const track = selectedTrack(
          context,
          context.args.has('position') ? context.args.number('position') : undefined,
        );
        await repository.add(context.user.id, track);
        await context.present({ kind: 'track', title: 'Saved to your favorites', track });
        return;
      }
      case 'remove': {
        const target = context.args.text('target');
        let key = target;
        if (/^\d+$/.test(target)) {
          const track = (await repository.all(context.user.id))[Number(target) - 1];
          if (!track) throw new CommandError('ARGUMENT', 'That favorite position does not exist.');
          key = track.key;
        }
        if (!(await repository.remove(context.user.id, key)))
          throw new CommandError('ARGUMENT', 'That favorite was not found.');
        await context.notice('Favorite removed.');
        return;
      }
      case 'play': {
        const all = await repository.all(context.user.id);
        const tracks = context.args.has('position')
          ? all.slice(context.args.number('position') - 1, context.args.number('position'))
          : all;
        if (!tracks.length)
          throw new CommandError(
            'ARGUMENT',
            'There are no favorites at that position. Save a song first.',
          );
        await context.joinPlayer();
        await context.services.players.enqueue(
          context.guildId,
          tracks.map((track) => ({ track, playable: null })),
          context.requester,
        );
        await context.present({
          kind: 'added',
          tracks: tracks.slice(0, 5),
          count: tracks.length,
          total: tracks.length,
          name: 'Favorites',
          background: false,
          mode: 'append',
        });
        return;
      }
      default:
        await context.present(await favoritesPage(context, context.args.number('page', 1)));
    }
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/extras/grab.ts

````typescript
import { defineCommand } from '../../framework/Command.js';
import { formatTime } from '../../lib/utils/time.js';
import { readPolicy } from '../common.js';
const command = defineCommand({
  name: 'grab',
  description: 'Send the current song details to your DMs',
  category: 'extras',
  aliases: ['save'],
  policy: readPolicy,
  execute: async (context) => {
    const current = context.current();
    const link = current.track.uri ?? current.playable?.uri;
    const publicLink = current.track.localFileId ? null : link && link.length <= 1000 ? link : null;
    await context.dm(
      context.safeName(current.track.title) +
        ' — ' +
        context.safeName(current.track.artist) +
        '\n' +
        (current.track.isStream ? 'Live stream' : formatTime(current.track.durationMs)) +
        (publicLink
          ? '\n<' + publicLink + '>'
          : '\nUploaded audio; save it to favorites to queue it again.'),
    );
    await context.notice('I sent the current song to your DMs.');
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/extras/help.ts

````typescript
import { arg, categories, defineCommand } from '../../framework/Command.js';
import { PermissionFlagsBits } from 'discord.js';
const command = defineCommand({
  name: 'help',
  description: 'Browse commands by category',
  category: 'extras',
  arguments: [arg.choice('category', 'Command category', categories, false)],
  execute: async (context) => {
    const requested = context.args.text('category', 'playback');
    const selected = categories.find((category) => category === requested) ?? 'playback';
    const owner = context.services.env.OWNER_IDS.includes(context.user.id);
    const admin = owner || context.member.permissions.has(PermissionFlagsBits.ManageGuild);
    const entries = context.services.registry
      .all()
      .filter((entry) => {
        if (entry.category === 'admin' && !admin) return false;
        return typeof entry.policy === 'function' || !entry.policy.owner || owner;
      })
      .map((entry) => ({
        category: entry.category,
        name: entry.name,
        description: entry.description,
        usage:
          context.settings.prefix +
          entry.name +
          (entry.subcommands?.length
            ? ' <subcommand>'
            : (entry.arguments ?? [])
                .map((spec) => (spec.required ? ` <${spec.name}>` : ` [${spec.name}]`))
                .join('')),
      }));
    await context.present({ kind: 'help', selected, entries });
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/extras/history.ts

````typescript
import { arg, defineCommand } from '../../framework/Command.js';
import type { CommandContext } from '../../framework/CommandContext.js';
import type { CommandView } from '../../framework/CommandUI.js';
import { mapPage } from '../common.js';

export async function historyPage(context: CommandContext, page: number): Promise<CommandView> {
  await context.recheck({});
  const result = await context.services.repositories.history.list(
    { userId: context.user.id },
    { page, pageSize: 10 },
  );
  return {
    kind: 'tracks',
    title: 'Your recent listening history',
    page: mapPage(result, (entry) => entry.track),
    onPage: historyPage,
  };
}
const command = defineCommand({
  name: 'history',
  description: 'Browse your retained listening history',
  category: 'extras',
  ephemeral: true,
  arguments: [arg.integer('page', 'Page number', false, 1, 1000000)],
  execute: async (context) => {
    await context.present(await historyPage(context, context.args.number('page', 1)));
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/extras/invite.ts

````typescript
import { OAuth2Scopes } from 'discord.js';
import { defineCommand } from '../../framework/Command.js';
import { invitePermissions } from '../../lib/utils/permissions.js';
const command = defineCommand({
  name: 'invite',
  description: 'Get the bot invite with music and slash-command permissions',
  category: 'extras',
  execute: async (context) => {
    const link = context.services.client.generateInvite({
      scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
      permissions: invitePermissions,
    });
    await context.notice('[Invite this bot](' + link + ')', 'Invite', 'info');
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/extras/lyrics.ts

````typescript
import { defineCommand } from '../../framework/Command.js';
import { CommandError } from '../../framework/errors.js';
import { readPolicy } from '../common.js';
const command = defineCommand({
  name: 'lyrics',
  description: 'Show lyrics for the current song, synced when available',
  category: 'extras',
  policy: readPolicy,
  execute: async (context) => {
    const current = context.current();
    const lyrics = await context.services.lyrics.get(
      context.guildId,
      current.track,
      current.playable,
    );
    if (!lyrics) throw new CommandError('ARGUMENT', 'Lyrics are unavailable for this track.');
    await context.present({ kind: 'lyrics', track: current.track, lyrics });
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/extras/ping.ts

````typescript
import { defineCommand } from '../../framework/Command.js';
const command = defineCommand({
  name: 'ping',
  description: 'Show command delivery and gateway latency',
  category: 'extras',
  execute: async (context) => {
    const ping = context.services.client.ws.ping;
    await context.notice(
      'Command delivery: ' +
        Math.max(0, Date.now() - context.createdTimestamp) +
        'ms. Gateway: ' +
        (ping >= 0 && Number.isFinite(ping) ? ping + 'ms.' : 'measuring.'),
      'Pong',
      'info',
    );
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/extras/playlists.ts

````typescript
import { arg, defineCommand } from '../../framework/Command.js';
import type { CommandContext } from '../../framework/CommandContext.js';
import type { CommandView } from '../../framework/CommandUI.js';
import { CommandError } from '../../framework/errors.js';
import { shareTokenSchema } from '../../lib/db/models.js';
import type { PersonalPlaylist, StoredTrack } from '../../lib/db/models.js';
import { collectCatalog } from '../../lib/music/ImportScheduler.js';
import { parsePositions } from '../../lib/utils/positions.js';
import { joinPolicy, mapPage } from '../common.js';

const playlistArg = () =>
  arg.text('playlist', 'Playlist name, ID, or read-only share token', true, false, 64);
async function owned(context: CommandContext, name: string): Promise<PersonalPlaylist> {
  const playlist = await context.services.repositories.playlists.findOwned(context.user.id, name);
  if (!playlist)
    throw new CommandError('ARGUMENT', 'That playlist was not found or does not belong to you.');
  return playlist;
}
export async function playlistsPage(context: CommandContext, page: number): Promise<CommandView> {
  await context.recheck({});
  const result = await context.services.repositories.playlists.list(context.user.id, {
    page,
    pageSize: 10,
  });
  return {
    kind: 'list',
    title: 'Your playlists',
    page: mapPage(
      result,
      (playlist) => `${context.safeName(playlist.name)}${playlist.isShared ? ' · Shared' : ''}`,
    ),
    onPage: playlistsPage,
  };
}
async function playlistPage(
  context: CommandContext,
  name: string,
  page: number,
): Promise<CommandView> {
  await context.recheck({});
  const repository = context.services.repositories.playlists;
  const playlist = await repository.findOwned(context.user.id, name);
  const result = playlist
    ? await repository.viewOwned(context.user.id, playlist.id, { page, pageSize: 10 })
    : shareTokenSchema.safeParse(name).success
      ? await repository.viewShared(name, { page, pageSize: 10 })
      : null;
  if (!result)
    throw new CommandError(
      'ARGUMENT',
      'Playlist not found. Use its quoted name, ID, or share token.',
    );
  return {
    kind: 'tracks',
    title: result.playlist.name,
    page: mapPage(result.tracks, (entry) => entry.track),
    onPage: (fresh, next) => playlistPage(fresh, name, next),
  };
}
async function tracksForPlayback(context: CommandContext, name: string): Promise<StoredTrack[]> {
  const repository = context.services.repositories.playlists;
  const playlist = await repository.findOwned(context.user.id, name);
  if (playlist) return repository.tracksOwned(context.user.id, playlist.id);
  if (shareTokenSchema.safeParse(name).success) return repository.tracksShared(name);
  throw new CommandError(
    'ARGUMENT',
    'Playlist not found. Use its quoted name, ID, or share token.',
  );
}

const command = defineCommand({
  name: 'playlists',
  description: 'Create, edit, import, play, and share personal playlists',
  category: 'extras',
  aliases: ['playlist', 'pl'],
  ephemeral: true,
  prefixDefault: 'list',
  policy: (args) => (args.subcommand === 'play' ? joinPolicy : {}),
  subcommands: [
    {
      name: 'create',
      description: 'Create a private playlist',
      arguments: [arg.text('name', 'Playlist name', true, true, 64)],
    },
    { name: 'delete', description: 'Delete your playlist', arguments: [playlistArg()] },
    {
      name: 'add',
      description: 'Add the current track, queue:N, or a song/link',
      arguments: [
        playlistArg(),
        arg.text('query', 'Current, queue:N, or song/link; omit for current', false, true),
      ],
    },
    {
      name: 'remove',
      description: 'Remove playlist positions or ranges',
      arguments: [
        playlistArg(),
        arg.text('positions', 'Positions such as 2 or 3-5', true, true, 1000),
      ],
    },
    {
      name: 'view',
      description: 'Browse an owned or shared playlist',
      arguments: [playlistArg(), arg.integer('page', 'Page number', false, 1, 1000000)],
    },
    {
      name: 'list',
      description: 'Browse your playlist names',
      arguments: [arg.integer('page', 'Page number', false, 1, 1000000)],
    },
    {
      name: 'play',
      description: 'Queue an owned playlist or read-only share token',
      arguments: [playlistArg()],
    },
    {
      name: 'import',
      description: 'Append metadata from a Spotify or YouTube collection',
      arguments: [playlistArg(), arg.text('query', 'Public Spotify or YouTube link', true, true)],
    },
    {
      name: 'share',
      description: 'Create a private read token or revoke sharing',
      arguments: [
        playlistArg(),
        arg.boolean('enabled', 'Enable or revoke read-only sharing', false),
      ],
    },
  ],
  execute: async (context) => {
    const repository = context.services.repositories.playlists;
    switch (context.args.subcommand) {
      case 'create': {
        const playlist = await repository.create(context.user.id, context.args.text('name'));
        await context.notice(`Created ${context.safeName(playlist.name)}.`);
        return;
      }
      case 'delete': {
        const playlist = await owned(context, context.args.text('playlist'));
        await repository.delete(context.user.id, playlist.id);
        await context.notice(`Deleted ${context.safeName(playlist.name)}.`);
        return;
      }
      case 'add': {
        const playlist = await owned(context, context.args.text('playlist'));
        const query = context.args.text('query', 'current');
        let track: StoredTrack | null = null;
        if (query.toLowerCase() === 'current') track = context.current().track;
        else if (/^queue:\d+$/i.test(query)) {
          const position = Number(query.split(':')[1]);
          track = context.requireSnapshot().upcoming[position - 1]?.track ?? null;
        } else {
          await context.services.catalogWork.run(async () => {
            for await (const page of context.services.players.resolver.pages(
              query,
              1,
              context.signal,
            )) {
              track = page.items[0]?.track ?? null;
              break;
            }
          }, context.signal);
        }
        if (!track)
          throw new CommandError('ARGUMENT', 'That song or queue position was not found.');
        const total = await repository.append(context.user.id, playlist.id, [track]);
        await context.notice(
          `Added one track to ${context.safeName(playlist.name)} (${total} total).`,
        );
        return;
      }
      case 'remove': {
        const playlist = await owned(context, context.args.text('playlist'));
        const tracks = await repository.tracksOwned(context.user.id, playlist.id);
        const removed = await repository.remove(
          context.user.id,
          playlist.id,
          parsePositions(context.args.text('positions'), tracks.length),
        );
        await context.notice(`Removed ${removed} playlist track(s).`);
        return;
      }
      case 'play': {
        const tracks = await tracksForPlayback(context, context.args.text('playlist'));
        if (!tracks.length)
          throw new CommandError('ARGUMENT', 'This playlist is empty. Add or import songs first.');
        await context.joinPlayer();
        await context.services.players.enqueue(
          context.guildId,
          tracks.map((track) => ({ track, playable: null })),
          context.requester,
        );
        await context.present({
          kind: 'added',
          tracks: tracks.slice(0, 5),
          count: tracks.length,
          total: tracks.length,
          name: 'Personal playlist',
          background: false,
          mode: 'append',
        });
        return;
      }
      case 'import': {
        const playlist = await owned(context, context.args.text('playlist'));
        const query = context.args.text('query');
        let url: URL;
        try {
          url = new URL(query);
        } catch {
          throw new CommandError('ARGUMENT', 'Import a public Spotify or YouTube link.');
        }
        if (
          ![
            'open.spotify.com',
            'youtube.com',
            'www.youtube.com',
            'music.youtube.com',
            'm.youtube.com',
            'youtu.be',
          ].includes(url.hostname)
        )
          throw new CommandError('ARGUMENT', 'Import a public Spotify or YouTube link.');
        const items = await context.services.catalogWork.run(
          () =>
            collectCatalog(
              context.services.players.resolver.pages(
                query,
                context.services.env.MAX_PLAYLIST_IMPORT,
                context.signal,
              ),
              context.services.env.MAX_PLAYLIST_IMPORT,
            ),
          context.signal,
        );
        if (!items.length) throw new CommandError('ARGUMENT', 'No tracks could be imported.');
        const total = await repository.append(
          context.user.id,
          playlist.id,
          items.map((item) => item.track),
        );
        await context.notice(
          `Imported ${items.length} track(s) into ${context.safeName(playlist.name)} (${total} total).`,
        );
        return;
      }
      case 'share': {
        const playlist = await owned(context, context.args.text('playlist'));
        const enabled = context.args.boolean('enabled', true);
        const shared = await repository.setShared(context.user.id, playlist.id, enabled);
        if (!enabled) {
          await context.notice('Sharing disabled. The old token no longer works.');
          return;
        }
        if (!shared.shareToken) throw new Error('Missing share token.');
        await context.privateText(
          `Read-only share token for ${context.safeName(playlist.name)}: \`${shared.shareToken}\`\nUse /playlists view or /playlists play with this token as the playlist. Anyone with the token can read it. Disable sharing to revoke it.`,
        );
        return;
      }
      case 'view':
        await context.present(
          await playlistPage(
            context,
            context.args.text('playlist'),
            context.args.number('page', 1),
          ),
        );
        return;
      default:
        await context.present(await playlistsPage(context, context.args.number('page', 1)));
    }
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/extras/stats.ts

````typescript
import { defineCommand } from '../../framework/Command.js';
const command = defineCommand({
  name: 'stats',
  description: 'Show bot uptime, server/player counts, memory, and latency',
  category: 'extras',
  execute: async (context) => {
    const memory = process.memoryUsage();
    const ping = context.services.client.ws.ping;
    await context.present({
      kind: 'stats',
      uptimeMs: Math.floor(process.uptime() * 1000),
      guilds: context.services.client.guilds.cache.size,
      players: context.services.players.size,
      shards: context.services.client.shard?.ids ?? [0],
      rssBytes: memory.rss,
      heapBytes: memory.heapUsed,
      gatewayPingMs: Number.isFinite(ping) && ping >= 0 ? ping : null,
    });
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/extras/support.ts

````typescript
import { defineCommand } from '../../framework/Command.js';
const command = defineCommand({
  name: 'support',
  description: 'Get the configured support link',
  category: 'extras',
  execute: async (context) => {
    await context.notice(
      context.services.env.SUPPORT_URL
        ? '[Get support](' + context.services.env.SUPPORT_URL + ')'
        : 'No support link is configured. Ask this server’s bot owner for help.',
      'Support',
      'info',
    );
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/index.ts

````typescript
import { CommandRegistry } from '../framework/CommandRegistry.js';
import announce from './admin/announce.js';
import autoleave from './admin/autoleave.js';
import blacklist from './admin/blacklist.js';
import clean from './admin/clean.js';
import defaultvolume from './admin/defaultvolume.js';
import djrole from './admin/djrole.js';
import language from './admin/language.js';
import maxqueue from './admin/maxqueue.js';
import maxtracklength from './admin/maxtracklength.js';
import musicchannel from './admin/musicchannel.js';
import prefix from './admin/prefix.js';
import settings from './admin/settings.js';
import sponsorblock from './admin/sponsorblock.js';
import stay from './admin/stay.js';
import voteskip from './admin/voteskip.js';
import bassboost from './audio/bassboost.js';
import eightd from './audio/eightd.js';
import equalizer from './audio/equalizer.js';
import filters from './audio/filters.js';
import karaoke from './audio/karaoke.js';
import lowpass from './audio/lowpass.js';
import nightcore from './audio/nightcore.js';
import pitch from './audio/pitch.js';
import rate from './audio/rate.js';
import rotation from './audio/rotation.js';
import speed from './audio/speed.js';
import tremolo from './audio/tremolo.js';
import vaporwave from './audio/vaporwave.js';
import vibrato from './audio/vibrato.js';
import volume from './audio/volume.js';
import about from './extras/about.js';
import favorites from './extras/favorites.js';
import grab from './extras/grab.js';
import help from './extras/help.js';
import history from './extras/history.js';
import invite from './extras/invite.js';
import lyrics from './extras/lyrics.js';
import ping from './extras/ping.js';
import playlists from './extras/playlists.js';
import stats from './extras/stats.js';
import support from './extras/support.js';
import forward from './playback/forward.js';
import join from './playback/join.js';
import leave from './playback/leave.js';
import pause from './playback/pause.js';
import play from './playback/play.js';
import playnext from './playback/playnext.js';
import playnow from './playback/playnow.js';
import previous from './playback/previous.js';
import replay from './playback/replay.js';
import resume from './playback/resume.js';
import rewind from './playback/rewind.js';
import search from './playback/search.js';
import seek from './playback/seek.js';
import skip from './playback/skip.js';
import skipto from './playback/skipto.js';
import stop from './playback/stop.js';
import autoplay from './queue/autoplay.js';
import clear from './queue/clear.js';
import dedupe from './queue/dedupe.js';
import loop from './queue/loop.js';
import move from './queue/move.js';
import nowplaying from './queue/nowplaying.js';
import queue from './queue/queue.js';
import remove from './queue/remove.js';
import shuffle from './queue/shuffle.js';
import swap from './queue/swap.js';
import undo from './queue/undo.js';

export const commands = [
  announce,
  autoleave,
  blacklist,
  clean,
  defaultvolume,
  djrole,
  language,
  maxqueue,
  maxtracklength,
  musicchannel,
  prefix,
  settings,
  sponsorblock,
  stay,
  voteskip,
  bassboost,
  eightd,
  equalizer,
  filters,
  karaoke,
  lowpass,
  nightcore,
  pitch,
  rate,
  rotation,
  speed,
  tremolo,
  vaporwave,
  vibrato,
  volume,
  about,
  favorites,
  grab,
  help,
  history,
  invite,
  lyrics,
  ping,
  playlists,
  stats,
  support,
  forward,
  join,
  leave,
  pause,
  play,
  playnext,
  playnow,
  previous,
  replay,
  resume,
  rewind,
  search,
  seek,
  skip,
  skipto,
  stop,
  autoplay,
  clear,
  dedupe,
  loop,
  move,
  nowplaying,
  queue,
  remove,
  shuffle,
  swap,
  undo,
] as const;
export function createCommandRegistry(): CommandRegistry {
  return new CommandRegistry(commands);
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/playback/forward.ts

````typescript
import { makeControl } from '../common.js';
import { arg } from '../../framework/Command.js';
const command = makeControl(
  'forward',
  'Move forward by a number of seconds',
  'Moved forward.',
  async (context) => {
    await context.services.players.seekRelative(
      context.guildId,
      Math.round(context.args.number('seconds') * 1000),
    );
  },
  { arguments: [arg.number('seconds', 'Seconds to move forward', 0.1, 86400)] },
);
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/playback/join.ts

````typescript
import { makeControl, joinPolicy } from '../common.js';
const command = makeControl(
  'join',
  'Join your voice or stage channel',
  'Joined your voice channel.',
  async (context) => {
    await context.joinPlayer();
  },
  { policy: joinPolicy },
);
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/playback/leave.ts

````typescript
import { makeControl } from '../common.js';
const command = makeControl(
  'leave',
  'Disconnect and discard this server’s active or saved queue',
  'Disconnected.',
  async (context) => {
    await context.disconnect();
  },
  { aliases: ['disconnect', 'dc'], policy: { voice: 'same', dj: true, musicChannel: true } },
);
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/playback/pause.ts

````typescript
import { makeControl } from '../common.js';
const command = makeControl('pause', 'Pause the current track', 'Paused.', async (context) => {
  await context.services.players.pause(context.guildId, true);
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/playback/play.ts

````typescript
import { makePlay } from '../common.js';
const command = makePlay('play', 'Play a song, link, playlist, or uploaded audio file', 'append', [
  'p',
]);
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/playback/playnext.ts

````typescript
import { makePlay } from '../common.js';
const command = makePlay('playnext', 'Queue music immediately after the current track', 'next');
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/playback/playnow.ts

````typescript
import { makePlay } from '../common.js';
const command = makePlay('playnow', 'Replace the current track with your music', 'now', [
  'forceplay',
]);
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/playback/previous.ts

````typescript
import { makeControl } from '../common.js';
const command = makeControl(
  'previous',
  'Play the previous track',
  'Playing the previous track.',
  async (context) => {
    await context.services.players.previous(context.guildId);
  },
  { aliases: ['prev'] },
);
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/playback/replay.ts

````typescript
import { makeControl } from '../common.js';
const command = makeControl(
  'replay',
  'Restart the current track from the beginning',
  'Restarting the current track.',
  async (context) => {
    await context.services.players.replay(context.guildId);
  },
);
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/playback/resume.ts

````typescript
import { makeControl } from '../common.js';
const command = makeControl('resume', 'Resume the paused track', 'Resumed.', async (context) => {
  await context.services.players.pause(context.guildId, false);
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/playback/rewind.ts

````typescript
import { makeControl } from '../common.js';
import { arg } from '../../framework/Command.js';
const command = makeControl(
  'rewind',
  'Move backward by a number of seconds',
  'Moved backward.',
  async (context) => {
    await context.services.players.seekRelative(
      context.guildId,
      -Math.round(context.args.number('seconds') * 1000),
    );
  },
  { arguments: [arg.number('seconds', 'Seconds to move backward', 0.1, 86400)] },
);
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/playback/search.ts

````typescript
import { arg, defineCommand } from '../../framework/Command.js';
import { CommandError } from '../../framework/errors.js';
import { joinPolicy } from '../common.js';
const command = defineCommand({
  name: 'search',
  description: 'Choose from the top ten search results',
  category: 'playback',
  policy: joinPolicy,
  arguments: [arg.text('query', 'Song title, artist, or source-prefixed search', true, true)],
  execute: async (context) => {
    const items = await context.services.players.resolver.search(context.args.text('query'));
    if (!items.length)
      throw new CommandError('ARGUMENT', 'No full tracks were found. Try another title.');
    await context.present({
      kind: 'search',
      items,
      onSelect: async (selection, index) => {
        if (selection.user.id !== context.user.id)
          throw new CommandError('PERMISSION', 'Only the person who searched may choose a result.');
        if (!Number.isInteger(index) || !items[index])
          throw new CommandError('ARGUMENT', 'Choose a valid search result.');
        await selection.joinPlayer();
        const item = items[index];
        if (!item) return;
        await selection.services.players.enqueue(selection.guildId, [item], selection.requester);
        await selection.present({
          kind: 'added',
          tracks: [item.track],
          count: 1,
          total: 1,
          name: item.track.title,
          background: false,
          mode: 'append',
        });
      },
    });
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/playback/seek.ts

````typescript
import { makeControl } from '../common.js';
import { arg } from '../../framework/Command.js';
const command = makeControl(
  'seek',
  'Seek to a position in the current track',
  'Position updated.',
  async (context) => {
    await context.services.players.seek(context.guildId, context.args.number('time'));
  },
  { arguments: [arg.duration()] },
);
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/playback/skip.ts

````typescript
import { arg, defineCommand } from '../../framework/Command.js';
import { skipPolicy } from '../common.js';
const command = defineCommand({
  name: 'skip',
  description: 'Skip tracks or vote to skip the current song',
  category: 'playback',
  policy: skipPolicy,
  arguments: [arg.integer('count', 'Number of tracks to skip', false)],
  execute: async (context) => {
    await context.services.votes.skip(context, context.args.number('count', 1));
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/playback/skipto.ts

````typescript
import { arg, defineCommand } from '../../framework/Command.js';
import { skipPolicy } from '../common.js';
const command = defineCommand({
  name: 'skipto',
  description: 'Jump to a one-based upcoming queue position',
  category: 'playback',
  aliases: ['jump'],
  policy: skipPolicy,
  arguments: [arg.integer('position', 'Upcoming queue position')],
  execute: async (context) => {
    await context.services.votes.skip(context, context.args.number('position'));
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/playback/stop.ts

````typescript
import { makeControl } from '../common.js';
const command = makeControl(
  'stop',
  'Stop playback and cancel pending imports',
  'Stopped playback and cleared the queue.',
  async (context) => {
    await context.services.players.stop(context.guildId);
  },
);
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/queue/autoplay.ts

````typescript
import { arg, defineCommand } from '../../framework/Command.js';
import { controlPolicy } from '../common.js';
const command = defineCommand({
  name: 'autoplay',
  description: 'Enable or disable related music when the queue ends',
  category: 'queue',
  policy: controlPolicy,
  arguments: [arg.boolean()],
  execute: async (context) => {
    const enabled = context.args.boolean('enabled');
    await context.services.players.setAutoplay(context.guildId, enabled);
    await context.notice(`Autoplay ${enabled ? 'enabled' : 'disabled'}.`);
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/queue/clear.ts

````typescript
import { defineCommand } from '../../framework/Command.js';
import { controlPolicy } from '../common.js';
const command = defineCommand({
  name: 'clear',
  description: 'Clear upcoming tracks and cancel playlist imports',
  category: 'queue',
  policy: controlPolicy,
  execute: async (context) => {
    const count = await context.services.players.clearQueue(context.guildId);
    await context.notice(`Cleared ${count} upcoming track(s). The current track continues.`);
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/queue/dedupe.ts

````typescript
import { defineCommand } from '../../framework/Command.js';
import { controlPolicy } from '../common.js';
const command = defineCommand({
  name: 'dedupe',
  description: 'Remove duplicate upcoming catalog tracks',
  category: 'queue',
  policy: controlPolicy,
  execute: async (context) => {
    const currentKey = context.snapshot?.current?.track.key;
    const count = await context.services.players.mutateQueue(context.guildId, (queue) =>
      queue.dedupe(currentKey),
    );
    await context.notice(`Removed ${count} duplicate track(s).`);
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/queue/loop.ts

````typescript
import { arg, defineCommand } from '../../framework/Command.js';
import { controlPolicy } from '../common.js';
const command = defineCommand({
  name: 'loop',
  description: 'Loop the current track, the queue, or neither',
  category: 'queue',
  policy: controlPolicy,
  arguments: [arg.choice('mode', 'Loop mode', ['off', 'track', 'queue'])],
  execute: async (context) => {
    const mode = context.args.text('mode');
    if (mode !== 'off' && mode !== 'track' && mode !== 'queue') return;
    await context.services.players.loop(context.guildId, mode);
    await context.notice(`Loop mode: ${mode}.`);
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/queue/move.ts

````typescript
import { arg, defineCommand } from '../../framework/Command.js';
import { CommandError } from '../../framework/errors.js';
import { controlPolicy } from '../common.js';
const command = defineCommand({
  name: 'move',
  description: 'Move the bot to your voice channel, or reorder two queue positions',
  category: 'queue',
  policy: (args) =>
    args.has('from') || args.has('to')
      ? controlPolicy
      : { voice: 'move', dj: true, musicChannel: true },
  arguments: [
    arg.integer('from', 'Upcoming position to move', false),
    arg.integer('to', 'New upcoming position', false),
  ],
  execute: async (context) => {
    if (!context.args.has('from') && !context.args.has('to')) {
      await context.movePlayer();
      await context.notice('Moved to your voice channel.');
      return;
    }
    if (!context.args.has('from') || !context.args.has('to'))
      throw new CommandError(
        'ARGUMENT',
        'Provide both from and to positions, or neither to move the bot.',
      );
    await context.services.players.mutateQueue(context.guildId, (queue) =>
      queue.move(context.args.number('from'), context.args.number('to')),
    );
    await context.notice('Queue position moved.');
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/queue/nowplaying.ts

````typescript
import { defineCommand } from '../../framework/Command.js';
import { readPolicy } from '../common.js';
const command = defineCommand({
  name: 'nowplaying',
  description: 'Show the current song and player controls',
  category: 'queue',
  aliases: ['np'],
  policy: readPolicy,
  execute: async (context) => {
    context.current();
    await context.present({ kind: 'nowplaying', snapshot: context.requireSnapshot() });
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/queue/queue.ts

````typescript
import { arg, defineCommand } from '../../framework/Command.js';
import { queueView, readPolicy } from '../common.js';
const command = defineCommand({
  name: 'queue',
  description: 'Browse the upcoming queue',
  category: 'queue',
  aliases: ['q'],
  policy: readPolicy,
  arguments: [arg.integer('page', 'Page number', false, 1, 1000000)],
  execute: async (context) => {
    await context.present(await queueView(context, context.args.number('page', 1)));
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/queue/remove.ts

````typescript
import { arg, defineCommand } from '../../framework/Command.js';
import { parsePositions } from '../../lib/utils/positions.js';
import { controlPolicy } from '../common.js';
const command = defineCommand({
  name: 'remove',
  description: 'Remove upcoming positions or ranges such as 2,4-6',
  category: 'queue',
  policy: controlPolicy,
  arguments: [arg.text('positions', 'One-based positions or ranges', true, true, 1000)],
  execute: async (context) => {
    const removed = await context.services.players.mutateQueue(context.guildId, (queue) =>
      queue.remove(parsePositions(context.args.text('positions'), queue.size)),
    );
    await context.notice(`Removed ${removed.length} queued track(s).`);
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/queue/shuffle.ts

````typescript
import { defineCommand } from '../../framework/Command.js';
import { controlPolicy } from '../common.js';
const command = defineCommand({
  name: 'shuffle',
  description: 'Shuffle upcoming tracks',
  category: 'queue',
  policy: controlPolicy,
  execute: async (context) => {
    await context.services.players.mutateQueue(context.guildId, (queue) => queue.shuffle());
    await context.notice('Queue shuffled.');
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/queue/swap.ts

````typescript
import { arg, defineCommand } from '../../framework/Command.js';
import { controlPolicy } from '../common.js';
const command = defineCommand({
  name: 'swap',
  description: 'Swap two upcoming queue positions',
  category: 'queue',
  policy: controlPolicy,
  arguments: [arg.integer('first', 'First position'), arg.integer('second', 'Second position')],
  execute: async (context) => {
    await context.services.players.mutateQueue(context.guildId, (queue) =>
      queue.swap(context.args.number('first'), context.args.number('second')),
    );
    await context.notice('Queue positions swapped.');
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/queue/undo.ts

````typescript
import { defineCommand } from '../../framework/Command.js';
import { controlPolicy } from '../common.js';
const command = defineCommand({
  name: 'undo',
  description: 'Undo the last queue edit within twenty seconds',
  category: 'queue',
  policy: controlPolicy,
  execute: async (context) => {
    await context.services.players.mutateQueue(context.guildId, (queue) => queue.undo());
    await context.notice('Queue change undone.');
  },
});
export const { slash, aliases, execute } = command;
export default command;

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/framework/ArgumentParser.ts

````typescript
import type { ChatInputCommandInteraction } from 'discord.js';
import { parseTime } from '../lib/utils/time.js';
import { CommandError } from './errors.js';

export interface AttachmentInput {
  id: string;
  url: string;
  name: string;
  size: number;
}
export type ArgumentValue = string | number | boolean | AttachmentInput | null;
export interface ArgumentSpec {
  name: string;
  description: string;
  kind:
    | 'string'
    | 'integer'
    | 'number'
    | 'boolean'
    | 'enum'
    | 'duration'
    | 'role'
    | 'channel'
    | 'attachment';
  required?: boolean;
  rest?: boolean;
  minimum?: number;
  maximum?: number;
  maxLength?: number;
  choices?: readonly string[];
  allowClear?: boolean;
}
export interface SubcommandSpec {
  name: string;
  description: string;
  arguments?: readonly ArgumentSpec[];
}
export interface ArgumentSchema {
  arguments?: readonly ArgumentSpec[];
  subcommands?: readonly SubcommandSpec[];
  prefixDefault?: string;
}
export class Arguments {
  constructor(
    public readonly subcommand: string | null,
    private readonly values: Readonly<Record<string, ArgumentValue>>,
  ) {}
  has(name: string): boolean {
    return Object.hasOwn(this.values, name);
  }
  text(name: string, fallback?: string): string {
    const value = this.values[name];
    if (value === undefined && fallback !== undefined) return fallback;
    if (typeof value !== 'string') throw invalid(name);
    return value;
  }
  optionalText(name: string): string | null {
    return this.has(name) ? this.text(name) : null;
  }
  number(name: string, fallback?: number): number {
    const value = this.values[name];
    if (value === undefined && fallback !== undefined) return fallback;
    if (typeof value !== 'number') throw invalid(name);
    return value;
  }
  boolean(name: string, fallback?: boolean): boolean {
    const value = this.values[name];
    if (value === undefined && fallback !== undefined) return fallback;
    if (typeof value !== 'boolean') throw invalid(name);
    return value;
  }
  id(name: string): string | null {
    if (!this.has(name) || this.values[name] === null) return null;
    return this.text(name);
  }
  attachment(name = 'attachment'): AttachmentInput | null {
    const value = this.values[name];
    return value && typeof value === 'object' ? value : null;
  }
  toObject(): Record<string, ArgumentValue> {
    return structuredClone(this.values);
  }
}

/** Quotes apply at token boundaries; apostrophes in words and URL backslashes are preserved. */
export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let index = 0;
  while (index < input.length) {
    if (/\s/.test(input[index] ?? '')) {
      index++;
      continue;
    }
    let value = '';
    const quote = input[index] === '"' || input[index] === "'" ? input[index++] : null;
    if (quote) {
      let closed = false;
      while (index < input.length) {
        const char = input[index++];
        if (char === quote) {
          closed = true;
          break;
        }
        if (char === '\\' && [quote, '\\'].includes(input[index] ?? ''))
          value += input[index++] ?? '';
        else value += char ?? '';
      }
      if (!closed || (index < input.length && !/\s/.test(input[index] ?? '')))
        throw new CommandError('ARGUMENT', 'Close quoted arguments and separate them with spaces.');
    } else {
      while (index < input.length && !/\s/.test(input[index] ?? '')) value += input[index++] ?? '';
    }
    tokens.push(value);
    if (tokens.length > 100)
      throw new CommandError('ARGUMENT', 'Too many arguments. Quote names containing spaces.');
  }
  return tokens;
}

export function parsePrefix(
  schema: ArgumentSchema,
  input: string,
  attachments: readonly AttachmentInput[] = [],
): Arguments {
  if (input.length > 6000) throw new CommandError('ARGUMENT', 'This command is too long.');
  const tokens = tokenize(input);
  let subcommand: string | null = null;
  let specs = schema.arguments ?? [];
  if (schema.subcommands?.length) {
    const requested = tokens[0]?.toLowerCase();
    const sub =
      schema.subcommands.find((candidate) => candidate.name === requested) ??
      (!requested && schema.prefixDefault
        ? schema.subcommands.find((candidate) => candidate.name === schema.prefixDefault)
        : undefined);
    if (!sub)
      throw new CommandError(
        'ARGUMENT',
        `Choose a subcommand: ${schema.subcommands.map((candidate) => candidate.name).join(', ')}.`,
      );
    if (requested) tokens.shift();
    subcommand = sub.name;
    specs = sub.arguments ?? [];
  }
  const values: Record<string, ArgumentValue> = {};
  for (const spec of specs) {
    if (spec.kind === 'attachment') {
      const attachment = attachments[0];
      if (attachment) values[spec.name] = structuredClone(attachment);
      else if (spec.required) throw invalid(spec.name);
      continue;
    }
    const raw = spec.rest && tokens.length ? tokens.splice(0).join(' ') : tokens.shift();
    if (raw === undefined) {
      if (spec.required) throw invalid(spec.name);
      continue;
    }
    values[spec.name] = parseValue(spec, raw);
  }
  if (tokens.length)
    throw new CommandError(
      'ARGUMENT',
      'Too many arguments. Quote playlist names that contain spaces.',
    );
  return new Arguments(subcommand, values);
}

export function parseInteraction(
  schema: ArgumentSchema,
  interaction: ChatInputCommandInteraction,
): Arguments {
  const subcommand = schema.subcommands?.length ? interaction.options.getSubcommand(true) : null;
  const specs = subcommand
    ? schema.subcommands?.find((sub) => sub.name === subcommand)?.arguments
    : schema.arguments;
  if (subcommand && !schema.subcommands?.some((sub) => sub.name === subcommand))
    throw new CommandError('ARGUMENT', 'This subcommand is no longer available.');
  const values: Record<string, ArgumentValue> = {};
  for (const spec of specs ?? []) {
    let raw: ArgumentValue | undefined;
    switch (spec.kind) {
      case 'integer':
        raw = interaction.options.getInteger(spec.name) ?? undefined;
        break;
      case 'number':
        raw = interaction.options.getNumber(spec.name) ?? undefined;
        break;
      case 'boolean':
        raw = interaction.options.getBoolean(spec.name) ?? undefined;
        break;
      case 'role':
        raw = interaction.options.getRole(spec.name)?.id;
        break;
      case 'channel':
        raw = interaction.options.getChannel(spec.name)?.id;
        break;
      case 'attachment': {
        const file = interaction.options.getAttachment(spec.name);
        raw = file ? { id: file.id, url: file.url, name: file.name, size: file.size } : undefined;
        break;
      }
      default:
        raw = interaction.options.getString(spec.name) ?? undefined;
    }
    if (raw === undefined) {
      if (spec.required) throw invalid(spec.name);
      continue;
    }
    values[spec.name] = spec.kind === 'attachment' ? raw : parseValue(spec, raw);
  }
  return new Arguments(subcommand, values);
}

/** Revalidate controller-provided arguments with the same schema; no UI payload is trusted. */
export function parseValues(
  schema: ArgumentSchema,
  input: Readonly<Record<string, ArgumentValue>>,
  subcommand: string | null = null,
): Arguments {
  const specs = subcommand
    ? schema.subcommands?.find((sub) => sub.name === subcommand)?.arguments
    : schema.arguments;
  if (schema.subcommands?.length && !schema.subcommands.some((sub) => sub.name === subcommand))
    throw new CommandError('ARGUMENT', 'Choose a valid subcommand.');
  const known = new Set((specs ?? []).map((spec) => spec.name));
  if (Object.keys(input).some((name) => !known.has(name)))
    throw new CommandError('ARGUMENT', 'Unexpected command arguments.');
  const values: Record<string, ArgumentValue> = {};
  for (const spec of specs ?? []) {
    const raw = input[spec.name];
    if (raw === undefined) {
      if (spec.required) throw invalid(spec.name);
      continue;
    }
    if (spec.kind === 'attachment')
      throw new CommandError('ARGUMENT', 'Upload files through a command message.');
    values[spec.name] = parseValue(spec, raw);
  }
  return new Arguments(subcommand, values);
}

function parseValue(spec: ArgumentSpec, input: ArgumentValue): ArgumentValue {
  if (
    spec.allowClear &&
    (input === null || (typeof input === 'string' && /^(?:off|none|clear)$/i.test(input)))
  )
    return null;
  if (spec.kind === 'boolean') {
    if (typeof input === 'boolean') return input;
    if (typeof input !== 'string') throw invalid(spec.name);
    if (/^(?:on|true|yes|enabled?|1)$/i.test(input)) return true;
    if (/^(?:off|false|no|disabled?|0)$/i.test(input)) return false;
    throw new CommandError('ARGUMENT', `Use on or off for ${spec.name}.`);
  }
  if (spec.kind === 'integer' || spec.kind === 'number') {
    if (
      typeof input !== 'number' &&
      (typeof input !== 'string' ||
        !(spec.kind === 'integer' ? /^-?\d+$/ : /^-?(?:\d+(?:\.\d*)?|\.\d+)$/).test(input))
    )
      throw invalid(spec.name);
    const value = Number(input);
    if (
      !Number.isFinite(value) ||
      (spec.kind === 'integer' && !Number.isSafeInteger(value)) ||
      (spec.minimum !== undefined && value < spec.minimum) ||
      (spec.maximum !== undefined && value > spec.maximum)
    )
      throw new CommandError(
        'ARGUMENT',
        `${spec.name} must be ${spec.kind === 'integer' ? 'a whole number' : 'a number'}${spec.minimum !== undefined ? ` from ${spec.minimum}` : ''}${spec.maximum !== undefined ? ` to ${spec.maximum}` : ''}.`,
      );
    return value;
  }
  if (typeof input !== 'string') throw invalid(spec.name);
  const value = input.trim();
  if (
    !value ||
    value.length > (spec.maxLength ?? 4096) ||
    [...value].some((char) => {
      const point = char.codePointAt(0) ?? 0;
      return point < 32 || point === 127;
    })
  )
    throw invalid(spec.name);
  if (spec.kind === 'duration') {
    const milliseconds = parseTime(value);
    if (
      (spec.minimum !== undefined && milliseconds < spec.minimum) ||
      (spec.maximum !== undefined && milliseconds > spec.maximum)
    )
      throw invalid(spec.name);
    return milliseconds;
  }
  if (spec.kind === 'enum') {
    const selected = value.toLowerCase();
    if (!spec.choices?.includes(selected))
      throw new CommandError(
        'ARGUMENT',
        `Choose ${spec.choices?.join(', ') ?? 'a valid value'} for ${spec.name}.`,
      );
    return selected;
  }
  if (spec.kind === 'role' || spec.kind === 'channel') {
    const id = value.replace(spec.kind === 'role' ? /^<@&(\d+)>$/ : /^<#(\d+)>$/, '$1');
    if (!/^\d{17,20}$/.test(id))
      throw new CommandError('ARGUMENT', `Mention a ${spec.kind} or provide its ID.`);
    return id;
  }
  return value;
}
function invalid(name: string): CommandError {
  return new CommandError('ARGUMENT', `Provide a valid ${name.replace(/-/g, ' ')}.`);
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/framework/Command.ts

````typescript
import {
  ApplicationIntegrationType,
  ChannelType,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { SlashCommandSubcommandBuilder } from 'discord.js';
import type { CommandContext } from './CommandContext.js';
import type { Arguments, ArgumentSchema, ArgumentSpec } from './ArgumentParser.js';
import type { CommandPolicy } from '../lib/utils/permissions.js';

export const categories = ['playback', 'queue', 'audio', 'extras', 'admin'] as const;
export type CommandCategory = (typeof categories)[number];
export interface CommandDefinition extends ArgumentSchema {
  name: string;
  description: string;
  category: CommandCategory;
  aliases?: readonly string[];
  policy?: CommandPolicy | ((args: Arguments) => CommandPolicy);
  ephemeral?: boolean;
  execute(this: void, context: CommandContext): Promise<void>;
}
export interface Command extends CommandDefinition {
  slash: SlashCommandBuilder;
  aliases: readonly string[];
  policy: CommandPolicy | ((args: Arguments) => CommandPolicy);
  ephemeral: boolean;
}

export function defineCommand(definition: CommandDefinition): Command {
  const slash = new SlashCommandBuilder()
    .setName(definition.name)
    .setDescription(definition.description)
    .setContexts(InteractionContextType.Guild)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall);
  if (typeof definition.policy !== 'function' && definition.policy?.admin)
    slash.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);
  if (definition.subcommands?.length) {
    for (const sub of definition.subcommands)
      slash.addSubcommand((builder) => {
        builder.setName(sub.name).setDescription(sub.description);
        addOptions(builder, sub.arguments ?? []);
        return builder;
      });
  } else addOptions(slash, definition.arguments ?? []);
  return {
    ...definition,
    slash,
    aliases: definition.aliases ?? [],
    policy: definition.policy ?? {},
    ephemeral: definition.ephemeral ?? false,
  };
}
function addOptions(
  builder: SlashCommandBuilder | SlashCommandSubcommandBuilder,
  specs: readonly ArgumentSpec[],
): void {
  // Slash requires required options first; prefix retains the declared positional order.
  for (const spec of [...specs].sort(
    (a, b) => Number(Boolean(b.required)) - Number(Boolean(a.required)),
  )) {
    const common = {
      name: spec.name,
      description: spec.description,
      required: spec.required ?? false,
    };
    switch (spec.kind) {
      case 'integer':
        builder.addIntegerOption((option) => {
          option
            .setName(common.name)
            .setDescription(common.description)
            .setRequired(common.required);
          if (spec.minimum !== undefined) option.setMinValue(spec.minimum);
          if (spec.maximum !== undefined) option.setMaxValue(spec.maximum);
          return option;
        });
        break;
      case 'number':
        builder.addNumberOption((option) => {
          option
            .setName(common.name)
            .setDescription(common.description)
            .setRequired(common.required);
          if (spec.minimum !== undefined) option.setMinValue(spec.minimum);
          if (spec.maximum !== undefined) option.setMaxValue(spec.maximum);
          return option;
        });
        break;
      case 'boolean':
        builder.addBooleanOption((option) =>
          option
            .setName(common.name)
            .setDescription(common.description)
            .setRequired(common.required),
        );
        break;
      case 'role':
        builder.addRoleOption((option) =>
          option
            .setName(common.name)
            .setDescription(common.description)
            .setRequired(common.required),
        );
        break;
      case 'channel':
        builder.addChannelOption((option) =>
          option
            .setName(common.name)
            .setDescription(common.description)
            .setRequired(common.required)
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildAnnouncement,
              ChannelType.PublicThread,
              ChannelType.PrivateThread,
              ChannelType.AnnouncementThread,
            ),
        );
        break;
      case 'attachment':
        builder.addAttachmentOption((option) =>
          option
            .setName(common.name)
            .setDescription(common.description)
            .setRequired(common.required),
        );
        break;
      default:
        builder.addStringOption((option) => {
          option
            .setName(common.name)
            .setDescription(common.description)
            .setRequired(common.required)
            .setMaxLength(spec.maxLength ?? 4096);
          if (spec.choices)
            option.addChoices(...spec.choices.map((value) => ({ name: value, value })));
          return option;
        });
    }
  }
}

export const arg = {
  text: (
    name: string,
    description: string,
    required = true,
    rest = false,
    maxLength = 4096,
  ): ArgumentSpec => ({ name, description, kind: 'string', required, rest, maxLength }),
  integer: (
    name: string,
    description: string,
    required = true,
    minimum = 1,
    maximum = 10_000,
  ): ArgumentSpec => ({ name, description, kind: 'integer', required, minimum, maximum }),
  number: (name: string, description: string, minimum = 0.25, maximum = 4): ArgumentSpec => ({
    name,
    description,
    kind: 'number',
    required: true,
    minimum,
    maximum,
  }),
  boolean: (name = 'enabled', description = 'On or off', required = true): ArgumentSpec => ({
    name,
    description,
    kind: 'boolean',
    required,
  }),
  choice: (
    name: string,
    description: string,
    choices: readonly string[],
    required = true,
  ): ArgumentSpec => ({ name, description, kind: 'enum', choices, required, maxLength: 100 }),
  duration: (
    name = 'time',
    description = 'Seconds, mm:ss, hh:mm:ss, or 1m30s',
    minimum = 0,
    maximum = 86_400_000,
  ): ArgumentSpec => ({
    name,
    description,
    kind: 'duration',
    required: true,
    minimum,
    maximum,
    maxLength: 30,
  }),
};

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/framework/CommandContext.ts

````typescript
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

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/framework/CommandHandler.ts

````typescript
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

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/framework/CommandRegistry.ts

````typescript
import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import type { Command, CommandCategory } from './Command.js';

export class CommandRegistry {
  private readonly names = new Map<string, Command>();
  private readonly commands: readonly Command[];
  constructor(commands: readonly Command[]) {
    if (commands.length > 100) throw new Error('Discord allows at most 100 chat-input commands.');
    this.commands = [...commands];
    for (const command of commands) {
      for (const name of [command.name, ...command.aliases]) {
        const key = name.toLowerCase();
        if (this.names.has(key)) throw new Error(`Duplicate command name or alias: ${key}`);
        this.names.set(key, command);
      }
      command.slash.toJSON(); // Fail locally on invalid Discord schemas, before registering anything.
    }
  }
  get(name: string): Command | null {
    return this.names.get(name.toLowerCase()) ?? null;
  }
  all(category?: CommandCategory): Command[] {
    return this.commands.filter((command) => !category || command.category === category);
  }
  toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
    return this.commands.map((command) => command.slash.toJSON());
  }
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/framework/CommandServices.ts

````typescript
import type { Client } from 'discord.js';
import type { Logger } from 'pino';
import type { Env } from '../config/env.js';
import type { Repositories } from '../lib/db/contracts.js';
import type { PlayerManager } from '../lib/music/PlayerManager.js';
import type { LyricsService } from '../lib/music/LyricsService.js';
import type { Semaphore } from '../lib/utils/AsyncLock.js';
import type { CommandRegistry } from './CommandRegistry.js';
import type { CommandUI } from './CommandUI.js';
import type { VoteSkipService } from './VoteSkipService.js';

export interface CommandServices {
  client: Client<true>;
  env: Env;
  repositories: Repositories;
  players: PlayerManager;
  lyrics: LyricsService;
  registry: CommandRegistry;
  ui: CommandUI;
  votes: VoteSkipService;
  catalogWork: Semaphore;
  logger: Logger;
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/framework/CommandUI.ts

````typescript
import type { CommandContext } from './CommandContext.js';
import type { CommandCategory } from './Command.js';
import type { Page, QueueEntry, QueueSnapshot, StoredTrack } from '../lib/db/models.js';
import type { ResolvedItem } from '../lib/music/types.js';
import type { Lyrics } from '../lib/music/LyricsService.js';

export type CommandView =
  | { kind: 'notice'; title: string; text: string; tone?: 'success' | 'info' | 'warning' }
  | { kind: 'nowplaying'; snapshot: QueueSnapshot }
  | { kind: 'track'; title: string; track: StoredTrack; entry?: QueueEntry }
  | {
      kind: 'added';
      tracks: StoredTrack[];
      count: number;
      total: number | null;
      name: string;
      background: boolean;
      mode: 'append' | 'next' | 'now';
    }
  | {
      kind: 'queue';
      snapshot: QueueSnapshot;
      page: number;
      onPage(context: CommandContext, page: number): Promise<CommandView>;
    }
  | {
      kind: 'tracks';
      title: string;
      page: Page<StoredTrack>;
      onPage(context: CommandContext, page: number): Promise<CommandView>;
    }
  | {
      kind: 'list';
      title: string;
      page: Page<string>;
      onPage(context: CommandContext, page: number): Promise<CommandView>;
    }
  | {
      kind: 'search';
      items: ResolvedItem[];
      onSelect(context: CommandContext, index: number): Promise<void>;
    }
  | { kind: 'lyrics'; track: StoredTrack; lyrics: Lyrics }
  | {
      kind: 'help';
      selected: CommandCategory;
      entries: { category: CommandCategory; name: string; description: string; usage: string }[];
    }
  | { kind: 'settings'; values: Record<string, string> }
  | {
      kind: 'stats';
      uptimeMs: number;
      guilds: number;
      players: number;
      shards: number[];
      rssBytes: number;
      heapBytes: number;
      gatewayPingMs: number | null;
    };

/** Phase 6 supplies the embed/component renderer. Command executors already perform all actions.
 * Search/page callbacks receive a NEW context and must recheck their policy before acting. */
export interface CommandUI {
  present(context: CommandContext, view: CommandView): Promise<void>;
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/framework/errors.ts

````typescript
import { MusicError } from '../lib/utils/errors.js';
import { RepositoryError } from '../lib/db/validation.js';

export class CommandError extends Error {
  constructor(
    public readonly code:
      'ARGUMENT' | 'PERMISSION' | 'VOICE' | 'COOLDOWN' | 'BLACKLIST' | 'GUILD_ONLY',
    message: string,
  ) {
    super(message);
    this.name = 'CommandError';
  }
}
export function commandErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError')
    return 'The bot is restarting. This request was cancelled.';
  if (error instanceof CommandError || error instanceof MusicError) return error.message;
  if (error instanceof RepositoryError) {
    switch (error.code) {
      case 'NOT_FOUND':
        return 'That saved item was not found or does not belong to you.';
      case 'CONFLICT':
        return 'That name or item already exists. Choose another name.';
      case 'LIMIT':
        return 'Your saved-item limit has been reached. Remove an item first.';
      case 'INVALID_INPUT':
        return 'Check the name, positions, and setting values, then try again.';
      case 'STALE_SNAPSHOT':
        return 'The player changed while this command was running. Try again.';
      case 'CORRUPT_DATA':
        return 'This saved item could not be read. Ask the bot owner to check the database.';
    }
  }
  return 'Something went wrong. Please try again in a moment.';
}
export function commandErrorCode(error: unknown): string {
  return error instanceof CommandError ||
    error instanceof MusicError ||
    error instanceof RepositoryError
    ? error.code
    : 'INTERNAL';
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/framework/index.ts

````typescript
export * from './ArgumentParser.js';
export * from './Command.js';
export * from './CommandContext.js';
export * from './CommandHandler.js';
export * from './CommandRegistry.js';
export * from './CommandServices.js';
export * from './CommandUI.js';
export * from './InteractionRouter.js';
export * from './VoteSkipService.js';
export * from './errors.js';
export { createCommandRegistry, commands } from '../commands/index.js';
export { Cooldowns } from '../lib/utils/cooldowns.js';
export {
  authorize,
  isDj,
  bypassVote,
  invitePermissions,
  checkTextPermissions,
  checkVoicePermissions,
  ensureStageSpeaker,
} from '../lib/utils/permissions.js';

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/framework/InteractionRouter.ts

````typescript
import { randomBytes } from 'node:crypto';
import { MessageFlags } from 'discord.js';
import type { MessageComponentInteraction } from 'discord.js';
import type { CommandContext } from './CommandContext.js';
import type { CommandHandler } from './CommandHandler.js';
import { CommandError, commandErrorCode, commandErrorMessage } from './errors.js';
import type { CommandPolicy } from '../lib/utils/permissions.js';

export interface InteractionSessionOptions {
  guildId: string;
  channelId: string;
  sourceChannelId?: string;
  userId: string | null;
  lifetimeMs: number;
  policy: CommandPolicy;
  acknowledgment?: 'reply' | 'update';
  once?: boolean;
  actions: Readonly<
    Record<string, (context: CommandContext, values: readonly string[]) => Promise<void>>
  >;
  onExpire?: () => Promise<void>;
}
export interface InteractionSessionHandle {
  id(action: string): string;
  bind(messageId: string): void;
  dispose(): void;
}
interface Session {
  options: InteractionSessionOptions;
  messageId: string | null;
  expiresAt: number;
  busy: Set<string>;
  timer: ReturnType<typeof setTimeout>;
}

/** Opaque, message-bound sessions. Copying or editing custom IDs never authorizes an action. */
export class InteractionRouter {
  private readonly sessions = new Map<string, Session>();
  constructor(
    private readonly handler: CommandHandler,
    private readonly maximum = 2000,
  ) {}
  register(options: InteractionSessionOptions): InteractionSessionHandle {
    if (this.sessions.size >= this.maximum)
      throw new CommandError('COOLDOWN', 'Too many active menus. Try again shortly.');
    if (
      !Number.isInteger(options.lifetimeMs) ||
      options.lifetimeMs < 1000 ||
      options.lifetimeMs > 86_400_000 ||
      !Object.keys(options.actions).length ||
      Object.keys(options.actions).some((action) => !/^[a-z0-9_-]{1,24}$/.test(action))
    )
      throw new Error('Invalid interaction session.');
    const nonce = randomBytes(16).toString('base64url');
    const timer = setTimeout(() => this.remove(nonce), options.lifetimeMs);
    timer.unref();
    this.sessions.set(nonce, {
      options,
      messageId: null,
      expiresAt: Date.now() + options.lifetimeMs,
      busy: new Set(),
      timer,
    });
    return {
      id: (action) => {
        if (!Object.hasOwn(options.actions, action)) throw new Error('Unknown action.');
        return `dms:${nonce}:${action}`;
      },
      bind: (messageId) => {
        const session = this.sessions.get(nonce);
        if (session) session.messageId = messageId;
      },
      dispose: () => this.remove(nonce),
    };
  }
  async handle(interaction: MessageComponentInteraction): Promise<boolean> {
    const match = /^dms:([A-Za-z0-9_-]{22}):([a-z0-9_-]{1,24})$/.exec(interaction.customId);
    if (!match) return false;
    const nonce = match[1] ?? '';
    const action = match[2] ?? '';
    const session = this.sessions.get(nonce);
    try {
      if (!session || session.expiresAt <= Date.now())
        throw new CommandError('ARGUMENT', 'This menu expired. Run the command again.');
      if (
        (interaction.guildId !== null && session.options.guildId !== interaction.guildId) ||
        (interaction.guildId === null && !session.options.userId) ||
        session.options.channelId !== interaction.channelId ||
        session.messageId !== interaction.message.id
      )
        throw new CommandError('PERMISSION', 'This control belongs to another message.');
      if (session.options.userId && session.options.userId !== interaction.user.id)
        throw new CommandError('PERMISSION', 'Only the person who opened this menu can use it.');
      const callback = Object.hasOwn(session.options.actions, action)
        ? session.options.actions[action]
        : undefined;
      if (!callback) throw new CommandError('ARGUMENT', 'This action is unavailable.');
      if (session.busy.has(interaction.user.id))
        throw new CommandError('COOLDOWN', 'Your previous action is still running.');
      session.busy.add(interaction.user.id);
      try {
        if (session.options.acknowledgment === 'update') await interaction.deferUpdate();
        else await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const context = await this.handler.componentContext(interaction, {
          guildId: session.options.guildId,
          channelId: session.options.sourceChannelId ?? session.options.channelId,
        });
        await this.handler.guard(context, session.options.policy);
        await callback(context, interaction.isStringSelectMenu() ? interaction.values : []);
        if (session.options.once) this.remove(nonce);
      } finally {
        session.busy.delete(interaction.user.id);
      }
    } catch (error) {
      this.handler.services.logger.warn(
        { code: commandErrorCode(error) },
        'Control action failed.',
      );
      const response = {
        content: commandErrorMessage(error),
        flags: MessageFlags.Ephemeral as const,
        allowedMentions: { parse: [] as [] },
      };
      if (interaction.deferred || interaction.replied)
        await interaction.followUp(response).catch(() => undefined);
      else await interaction.reply(response).catch(() => undefined);
    }
    return true;
  }
  private remove(nonce: string): void {
    const session = this.sessions.get(nonce);
    if (!session) return;
    clearTimeout(session.timer);
    this.sessions.delete(nonce);
    if (session.options.onExpire) void session.options.onExpire().catch(() => undefined);
  }
  close(): void {
    for (const nonce of this.sessions.keys()) this.remove(nonce);
  }
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/framework/VoteSkipService.ts

````typescript
import { AsyncLock } from '../lib/utils/AsyncLock.js';
import { bypassVote } from '../lib/utils/permissions.js';
import type { CommandContext } from './CommandContext.js';
import { CommandError } from './errors.js';

export interface VoteResult {
  votes: number;
  required: number;
  passed: boolean;
  duplicate: boolean;
  skipping: boolean;
}
export class VoteSkipService {
  private readonly votes = new Map<
    string,
    { voters: Set<string>; passed: boolean; expiresAt: number }
  >();
  private readonly locks = new Map<string, AsyncLock>();
  cast(
    key: string,
    voterId: string,
    eligible: ReadonlySet<string>,
    percentage: number,
  ): VoteResult {
    if (!eligible.has(voterId))
      throw new CommandError('VOICE', 'Only listeners who can hear the bot may vote to skip.');
    let state = this.votes.get(key);
    if (!state || state.expiresAt <= Date.now()) {
      if (this.votes.size >= 10_000) {
        const first = this.votes.keys().next().value;
        if (first) this.votes.delete(first);
      }
      state = { voters: new Set(), passed: false, expiresAt: Date.now() + 86_400_000 };
      this.votes.set(key, state);
    }
    for (const id of state.voters) if (!eligible.has(id)) state.voters.delete(id);
    const required = Math.max(1, Math.ceil((eligible.size * percentage) / 100));
    const duplicate = state.voters.has(voterId);
    if (state.passed)
      return { votes: state.voters.size, required, passed: false, duplicate, skipping: true };
    state.voters.add(voterId);
    const passed = state.voters.size >= required;
    state.passed = passed;
    return { votes: state.voters.size, required, passed, duplicate, skipping: false };
  }
  async skip(context: CommandContext, count: number): Promise<void> {
    const key = `${context.botId}:${context.guildId}`;
    let lock = this.locks.get(key);
    if (!lock) {
      lock = new AsyncLock();
      this.locks.set(key, lock);
    }
    await lock.run(async () => {
      await context.recheck({
        voice: 'same',
        player: true,
        dj: true,
        musicChannel: true,
        skip: true,
      });
      const snapshot = context.requireSnapshot();
      const playbackId = snapshot.currentPlaybackId;
      if (!playbackId || !snapshot.current) throw new CommandError('VOICE', 'Nothing is playing.');
      if (!context.settings.voteSkipEnabled || bypassVote(context.settings, context.facts(count))) {
        await context.services.players.skip(context.guildId, count, playbackId);
        await context.notice(`Skipped ${count === 1 ? 'the current track' : `${count} tracks`}.`);
        return;
      }
      if (count !== 1)
        throw new CommandError('PERMISSION', 'Vote skip can skip one track at a time.');
      const voice = context.guild.channels.cache.get(snapshot.voiceChannelId);
      if (!voice?.isVoiceBased())
        throw new CommandError('VOICE', 'The voice channel is unavailable.');
      const eligible = new Set(
        voice.members.filter((member) => !member.user.bot && !member.voice.deaf).keys(),
      );
      const vote = this.cast(
        `${key}:${playbackId}`,
        context.user.id,
        eligible,
        context.settings.voteSkipThreshold,
      );
      if (vote.passed) {
        await context.services.players.skip(context.guildId, 1, playbackId);
        await context.notice(`Vote passed (${vote.votes}/${vote.required}). Skipped the track.`);
      } else
        await context.notice(
          vote.skipping
            ? 'This track is already being skipped.'
            : `${vote.duplicate ? 'Your vote was already counted.' : 'Vote counted.'} ${vote.votes}/${vote.required} votes to skip.`,
          'Vote skip',
          'info',
        );
    });
  }
  clear(): void {
    this.votes.clear();
    this.locks.clear();
  }
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/utils/permissions.ts

````typescript
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

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/utils/cooldowns.ts

````typescript
import { CommandError } from '../../framework/errors.js';

export class Cooldowns {
  private readonly until = new Map<string, number>();
  constructor(
    private readonly now: () => number = Date.now,
    private readonly maximum = 10_000,
  ) {}
  consume(key: string, milliseconds: number): void {
    const remaining = (this.until.get(key) ?? 0) - this.now();
    if (remaining > 0)
      throw new CommandError(
        'COOLDOWN',
        `Wait ${(remaining / 1000).toFixed(1)} seconds before another command.`,
      );
    if (this.until.size >= this.maximum) {
      for (const [id, expires] of this.until) if (expires <= this.now()) this.until.delete(id);
      while (this.until.size >= this.maximum) {
        const oldest = this.until.keys().next().value;
        if (oldest === undefined) break;
        this.until.delete(oldest);
      }
    }
    this.until.set(key, this.now() + milliseconds);
  }
  clear(): void {
    this.until.clear();
  }
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/utils/positions.ts

````typescript
import { MusicError } from './errors.js';

export function parsePositions(input: string, maximum: number): number[] {
  const selected = new Set<number>();
  for (const part of input.trim().split(/[ ,]+/)) {
    const match = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!match) throw new MusicError('INVALID_INPUT', 'Use positions such as 2, 4, or 5-8.');
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start || end > maximum || !Number.isSafeInteger(end))
      throw new MusicError('INVALID_INPUT', 'That queue range does not exist.');
    for (let position = start; position <= end; position++) selected.add(position);
  }
  return [...selected].sort((a, b) => a - b);
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/utils/text.ts

````typescript
export function cleanText(value: string, maximum = 300): string {
  return (
    [...value]
      .filter((character) => {
        const point = character.codePointAt(0) ?? 0;
        return point >= 32 && point !== 127;
      })
      .join('')
      .trim()
      .slice(0, maximum) || 'Unknown'
  );
}
export function safeWebUrl(value: string | null | undefined): string | null {
  try {
    if (!value || value.length > 4096) return null;
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/PlayerManager.ts

````typescript
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { Logger } from 'pino';
import type { Env } from '../../config/env.js';
import type { Repositories } from '../db/contracts.js';
import { queueSnapshotSchema, requesterSchema } from '../db/models.js';
import type {
  AudioFilters,
  GuildSettings,
  HistoryEndReason,
  LoopMode,
  PendingImport,
  QueueEntry,
  QueueSnapshot,
  Requester,
  SnapshotRecord,
  StoredTrack,
} from '../db/models.js';
import { AsyncLock } from '../utils/AsyncLock.js';
import { MusicError, errorCode } from '../utils/errors.js';
import { QueueManager, createQueueEntry } from './QueueManager.js';
import type { SourceResolver } from './SourceResolver.js';
import type { AutoplayEngine } from './AutoplayEngine.js';
import { ImportScheduler } from './ImportScheduler.js';
import { validateFilters } from './FilterPresets.js';
import { catalogSources } from './TrackCodec.js';
import type { AudioTransport, ResolvedItem, TrackEvent } from './types.js';

interface EngineEvents {
  changed: [snapshot: QueueSnapshot];
  trackStart: [snapshot: QueueSnapshot];
  trackEnd: [snapshot: QueueSnapshot, reason: HistoryEndReason];
  queueEnd: [snapshot: QueueSnapshot];
  notice: [guildId: string, message: string];
  importProgress: [guildId: string, importId: string, enqueued: number, total: number | null];
  destroyed: [guildId: string];
}
interface Session {
  state: QueueSnapshot;
  queue: QueueManager;
  settings: GuildSettings;
  version: SnapshotRecord | null;
  lock: AsyncLock;
  closed: boolean;
  online: boolean;
  playing: boolean;
  positionAt: number;
  pump: Promise<void> | null;
  wake: boolean;
  resolution: AbortController | null;
  prefetching: Set<string>;
  prefetchFailed: Set<string>;
  workAbort: AbortController;
  excluded: Set<string>;
  retries: number;
  emptyVoice: boolean;
  idleTimer: ReturnType<typeof setTimeout> | null;
}
export interface ImportResult {
  id: string;
  name: string;
  enqueued: number;
  total: number | null;
  background: boolean;
  tracks: StoredTrack[];
}
interface ImportWaiter {
  first: Promise<ImportResult>;
  resolve: (result: ImportResult) => void;
  reject: (error: MusicError) => void;
  name: string;
  count: number;
  total: number | null;
  settled: boolean;
  replaceCurrent: boolean;
  tracks: StoredTrack[];
}

/** Every session is scoped to this bot account + guild; all mutations/checkpoints are serialized. */
export class PlayerManager extends EventEmitter<EngineEvents> {
  private readonly sessions = new Map<string, Session>();
  private readonly joins = new Map<string, AsyncLock>();
  private readonly waiters = new Map<string, ImportWaiter>();
  private readonly imports: ImportScheduler;
  private readonly background = new Set<Promise<void>>();
  private checkpointTimer: ReturnType<typeof setInterval> | null = null;
  private closing = false;
  constructor(
    public readonly botId: string,
    private readonly env: Pick<
      Env,
      'MAX_PLAYLIST_IMPORT' | 'IMPORT_CONCURRENCY' | 'SPONSORBLOCK_ENABLED'
    >,
    private readonly repositories: Repositories,
    public readonly transport: AudioTransport,
    public readonly resolver: SourceResolver,
    private readonly autoplay: AutoplayEngine,
    private readonly logger: Logger,
  ) {
    super();
    this.imports = new ImportScheduler(resolver, env.IMPORT_CONCURRENCY);
  }

  get size(): number {
    return [...this.sessions.values()].filter((session) => !session.closed).length;
  }
  guildIds(): string[] {
    return [...this.sessions.keys()];
  }
  offlineNodeIds(): string[] {
    return [
      ...new Set(
        [...this.sessions.values()]
          .filter((session) => !session.closed && !session.online)
          .map((session) => session.state.nodeId)
          .filter((id): id is string => id !== null),
      ),
    ];
  }
  view(guildId: string): QueueSnapshot | null {
    const session = this.sessions.get(guildId);
    return session && !session.closed ? this.snapshot(session) : null;
  }
  startCheckpoints(): void {
    if (this.checkpointTimer) return;
    this.checkpointTimer = setInterval(() => this.watch(this.checkpointAll()), 10_000);
    this.checkpointTimer.unref();
  }

  async join(
    guildId: string,
    voiceChannelId: string,
    textChannelId: string | null,
  ): Promise<QueueSnapshot> {
    if (this.closing) throw new MusicError('UNAVAILABLE', 'The bot is restarting.');
    let lock = this.joins.get(guildId);
    if (!lock) {
      lock = new AsyncLock();
      this.joins.set(guildId, lock);
    }
    return lock.run(async () => {
      const existing = this.sessions.get(guildId);
      if (existing) {
        if (existing.closed)
          throw new MusicError(
            'CONFLICT',
            'Another process changed this player. Restart this bot process before recovering it.',
          );
        if (existing.state.voiceChannelId !== voiceChannelId)
          throw new MusicError(
            'CONFLICT',
            'The bot is already playing in another voice channel. Use move to bring it here.',
          );
        return this.snapshot(existing);
      }
      const settings = await this.repositories.guildSettings.get(guildId);
      const record = await this.repositories.queueSnapshots.load(this.botId, guildId);
      if (record) {
        if (record.snapshot.voiceChannelId !== voiceChannelId)
          throw new MusicError(
            'CONFLICT',
            'A saved player belongs to another voice channel. Restore or disconnect it first.',
          );
        return this.restore(record);
      }
      const state = queueSnapshotSchema.parse({
        version: 1,
        botId: this.botId,
        guildId,
        voiceChannelId,
        textChannelId,
        nodeId: null,
        nodeSessionId: null,
        current: null,
        currentPlaybackId: null,
        upcoming: [],
        previous: [],
        positionMs: 0,
        paused: false,
        volume: settings.defaultVolume,
        loopMode: 'off',
        autoplay: settings.autoplayEnabled,
        filters: {},
        pendingImports: [],
      });
      const session = this.createSession(state, settings, null);
      try {
        const node = await this.transport.connect(state);
        session.state.nodeId = node.nodeId;
        session.state.nodeSessionId = node.sessionId;
        await this.persist(session);
        this.sessions.set(guildId, session);
        await this.configureSponsor(session);
        this.scheduleIdle(session);
        return this.snapshot(session);
      } catch (error) {
        session.closed = true;
        await this.transport.destroy(guildId).catch(() => undefined);
        throw error;
      }
    });
  }

  async restore(record: SnapshotRecord): Promise<QueueSnapshot> {
    const existing = this.sessions.get(record.guildId);
    if (existing) {
      if (existing.closed)
        throw new MusicError('CONFLICT', 'Another process owns a newer player snapshot.');
      return this.snapshot(existing);
    }
    if (record.botId !== this.botId)
      throw new MusicError('CONFLICT', 'The saved queue belongs to another bot.');
    const settings = await this.repositories.guildSettings.get(record.guildId);
    const state = structuredClone(record.snapshot);
    // Re-resolve saved encodings, especially HTTP sources. The cached file UUID remains authoritative.
    if (state.current) state.current.playable = null;
    for (const entry of state.upcoming) entry.playable = null;
    const session = this.createSession(state, settings, record);
    const node = await this.transport.connect(state);
    session.state.nodeId = node.nodeId;
    session.state.nodeSessionId = node.sessionId;
    await this.persist(session);
    this.sessions.set(record.guildId, session);
    await this.configureSponsor(session);
    for (const job of state.pendingImports) this.startImport(session, job);
    this.kick(session);
    this.prefetch(session);
    return this.snapshot(session);
  }

  async enqueue(
    guildId: string,
    items: readonly ResolvedItem[],
    requester: Requester,
    mode: 'append' | 'next' | 'now' = 'append',
  ): Promise<number> {
    const session = this.require(guildId);
    requesterSchema.parse(requester);
    await this.locked(session, async () => {
      const entries = items.map((item) => {
        this.validateLength(session, item.track.durationMs, item.track.isStream);
        return createQueueEntry(item.track, requester, item.playable);
      });
      this.assertCapacity(
        session,
        entries.length - Number(mode === 'now' && Boolean(session.state.current)),
      );
      if (mode === 'now' && entries.length) await this.retire(session, 'replaced');
      session.queue.add(entries, mode === 'append' ? session.queue.size + 1 : 1);
      await this.persist(session);
      this.changed(session);
    });
    this.kick(session);
    this.prefetch(session);
    return items.length;
  }

  async enqueueQuery(
    guildId: string,
    query: string,
    requester: Requester,
    mode: 'append' | 'next' | 'now' = 'append',
  ): Promise<ImportResult> {
    const session = this.require(guildId);
    requesterSchema.parse(requester);
    // Validate without contacting providers; the scheduler also validates before loading.
    if (!query.trim() || query.length > 4096)
      throw new MusicError('INVALID_INPUT', 'Provide a music title or link.');
    const job = await this.locked(session, async () => {
      if (session.state.pendingImports.length >= 10)
        throw new MusicError('QUEUE_FULL', 'Wait for an existing playlist import to finish.');
      const available =
        session.settings.maxQueueSize -
        session.queue.size -
        Number(mode !== 'now' && Boolean(session.state.current));
      if (available < 1) throw new MusicError('QUEUE_FULL', 'The queue is full.');
      const pending: PendingImport = {
        id: randomUUID(),
        query: query.trim(),
        requester: structuredClone(requester),
        mode: mode === 'append' ? 'append' : 'next',
        processedCount: 0,
        limit: Math.min(this.env.MAX_PLAYLIST_IMPORT, available),
        enqueuedKeys: [],
        createdAt: Date.now(),
      };
      session.state.pendingImports.push(pending);
      await this.persist(session);
      return pending;
    });
    const waiter = this.makeWaiter(mode === 'now');
    this.waiters.set(job.id, waiter);
    this.startImport(session, job);
    return waiter.first;
  }

  async mutateQueue<T>(guildId: string, operation: (queue: QueueManager) => T): Promise<T> {
    const session = this.require(guildId);
    const value = await this.locked(session, async () => {
      const before = session.queue.view();
      try {
        const result = operation(session.queue);
        await this.persist(session);
        this.changed(session);
        return result;
      } catch (error) {
        session.queue = new QueueManager(
          before,
          Math.max(session.settings.maxQueueSize, before.length),
        );
        session.queue.setMaximum(session.settings.maxQueueSize);
        throw error;
      }
    });
    this.kick(session);
    this.prefetch(session);
    return value;
  }

  async pause(guildId: string, paused: boolean): Promise<void> {
    const session = this.require(guildId);
    await this.locked(session, async () => {
      this.requireCurrent(session);
      this.capturePosition(session);
      await this.transport.pause(guildId, paused);
      session.state.paused = paused;
      session.positionAt = Date.now();
      await this.persist(session);
      this.changed(session);
    });
  }
  async seek(guildId: string, positionMs: number): Promise<void> {
    const session = this.require(guildId);
    await this.locked(session, () => this.seekLocked(session, positionMs));
  }
  async seekRelative(guildId: string, offsetMs: number): Promise<void> {
    const session = this.require(guildId);
    await this.locked(session, () => {
      const current = this.requireCurrent(session);
      return this.seekLocked(
        session,
        Math.max(
          0,
          Math.min(
            this.position(session) + offsetMs,
            (current.playable?.durationMs ?? current.track.durationMs) - 1,
          ),
        ),
      );
    });
  }

  async skip(guildId: string, count = 1, expectedPlaybackId?: string): Promise<void> {
    const session = this.require(guildId);
    if (!expectedPlaybackId) session.resolution?.abort();
    await this.locked(session, async () => {
      if (expectedPlaybackId && session.state.currentPlaybackId !== expectedPlaybackId)
        throw new MusicError('CONFLICT', 'The current track changed. Try the command again.');
      this.requireCurrent(session);
      if (!Number.isInteger(count) || count < 1 || count > session.queue.size + 1)
        throw new MusicError('INVALID_INPUT', 'That skip count exceeds the queue.');
      await this.retire(session, 'skipped');
      for (let index = 1; index < count; index++) session.queue.take();
      await this.persist(session);
      this.changed(session);
    });
    this.kick(session);
  }
  async skipTo(guildId: string, position: number): Promise<void> {
    const session = this.require(guildId);
    if (!Number.isInteger(position) || position < 1 || position > session.queue.size)
      throw new MusicError('INVALID_INPUT', 'That queue position does not exist.');
    if (session.state.current) await this.skip(guildId, position);
    else {
      await this.mutateQueue(guildId, (queue) => {
        for (let index = 1; index < position; index++) queue.take();
      });
    }
  }
  async replay(guildId: string): Promise<void> {
    const session = this.require(guildId);
    session.resolution?.abort();
    await this.locked(session, async () => {
      const current = structuredClone(this.requireCurrent(session));
      await this.retire(session, 'replaced');
      session.state.current = current;
      session.state.currentPlaybackId = randomUUID();
      session.state.positionMs = 0;
      session.state.paused = false;
      await this.persist(session);
    });
    this.kick(session);
  }
  async previous(guildId: string): Promise<void> {
    const session = this.require(guildId);
    session.resolution?.abort();
    await this.locked(session, async () => {
      const previous = session.state.previous[0];
      if (!previous) throw new MusicError('NOT_FOUND', 'There is no previous track.');
      this.assertCapacity(session, 1);
      session.state.previous.shift();
      const current = session.state.current ? structuredClone(session.state.current) : null;
      if (current) {
        await this.retire(session, 'replaced', false);
        current.id = randomUUID();
        session.queue.add([current], 1, false);
      }
      previous.id = randomUUID();
      session.state.current = previous;
      session.state.currentPlaybackId = randomUUID();
      session.state.positionMs = 0;
      session.state.paused = false;
      await this.persist(session);
    });
    this.kick(session);
  }

  async stop(guildId: string): Promise<void> {
    const session = this.require(guildId);
    session.resolution?.abort();
    await this.locked(session, async () => {
      this.cancelImports(session);
      await this.retire(session, 'stopped');
      session.prefetchFailed.clear();
      session.queue.clear(false);
      session.state.loopMode = 'off';
      session.state.autoplay = false;
      await this.persist(session);
      this.changed(session);
      this.scheduleIdle(session);
    });
  }
  async clearQueue(guildId: string): Promise<number> {
    const session = this.require(guildId);
    return this.locked(session, async () => {
      this.cancelImports(session);
      const count = session.queue.clear();
      session.prefetchFailed.clear();
      await this.persist(session);
      this.changed(session);
      return count;
    });
  }
  async leave(guildId: string): Promise<void> {
    const session = this.sessions.get(guildId);
    if (!session) {
      const record = await this.repositories.queueSnapshots.load(this.botId, guildId);
      if (record) await this.repositories.queueSnapshots.delete(this.botId, guildId, record);
      await this.transport.destroy(guildId);
      return;
    }
    session.resolution?.abort();
    await this.locked(session, async () => {
      session.closed = true;
      session.workAbort.abort();
      this.cancelIdle(session);
      this.cancelImports(session);
      if (session.state.currentPlaybackId)
        await this.repositories.history.finish(session.state.currentPlaybackId, 'stopped');
      await this.transport
        .destroy(guildId)
        .catch(() => this.logger.warn({ guildId }, 'Audio disconnect failed.'));
      if (session.version)
        await this.repositories.queueSnapshots.delete(this.botId, guildId, session.version);
      this.sessions.delete(guildId);
      this.joins.delete(guildId);
      this.emit('destroyed', guildId);
    });
  }
  async moveVoice(
    guildId: string,
    voiceChannelId: string,
    textChannelId: string | null,
  ): Promise<void> {
    const session = this.require(guildId);
    await this.locked(session, async () => {
      const candidate = this.snapshot(session);
      candidate.voiceChannelId = voiceChannelId;
      candidate.textChannelId = textChannelId;
      const node = await this.transport.connect(candidate);
      session.state.voiceChannelId = voiceChannelId;
      session.state.textChannelId = textChannelId;
      session.state.nodeId = node.nodeId;
      session.state.nodeSessionId = node.sessionId;
      session.emptyVoice = false;
      this.cancelIdle(session);
      await this.persist(session);
      this.changed(session);
    });
  }

  async volume(guildId: string, volume: number): Promise<void> {
    if (!Number.isInteger(volume) || volume < 1 || volume > 200)
      throw new MusicError('INVALID_INPUT', 'Volume must be between 1 and 200.');
    const session = this.require(guildId);
    await this.locked(session, async () => {
      await this.transport.volume(guildId, volume);
      session.settings = await this.repositories.guildSettings.update(guildId, {
        defaultVolume: volume,
      });
      session.state.volume = volume;
      await this.persist(session);
      this.changed(session);
    });
  }
  async filters(guildId: string, filters: AudioFilters): Promise<void> {
    const parsed = validateFilters(filters);
    const session = this.require(guildId);
    await this.locked(session, async () => {
      this.capturePosition(session);
      await this.transport.filters(guildId, parsed);
      session.state.filters = parsed;
      session.positionAt = Date.now();
      await this.persist(session);
      this.changed(session);
    });
  }
  async loop(guildId: string, mode: LoopMode): Promise<void> {
    if (!['off', 'track', 'queue'].includes(mode))
      throw new MusicError('INVALID_INPUT', 'Loop mode must be off, track, or queue.');
    const session = this.require(guildId);
    await this.locked(session, async () => {
      session.state.loopMode = mode;
      await this.persist(session);
      this.changed(session);
    });
  }
  async setAutoplay(guildId: string, enabled: boolean): Promise<void> {
    const session = this.require(guildId);
    await this.locked(session, async () => {
      session.settings = await this.repositories.guildSettings.update(guildId, {
        autoplayEnabled: enabled,
      });
      session.state.autoplay = enabled;
      await this.persist(session);
      this.changed(session);
    });
    if (enabled) this.kick(session);
  }
  async refreshSettings(guildId: string): Promise<void> {
    const session = this.sessions.get(guildId);
    if (!session) return;
    await this.locked(session, async () => {
      session.settings = await this.repositories.guildSettings.get(guildId);
      session.queue.setMaximum(session.settings.maxQueueSize);
      await this.configureSponsor(session);
      this.scheduleIdle(session);
    });
  }
  setVoiceOccupancy(guildId: string, humans: number): void {
    const session = this.sessions.get(guildId);
    if (!session) return;
    session.emptyVoice = humans === 0;
    this.scheduleIdle(session);
  }

  /** Called by Phase 6 event adapters, with IDs from Lavalink's original event payload. */
  async onTrackEvent(event: TrackEvent): Promise<void> {
    const session = this.sessions.get(event.guildId);
    if (!session || session.closed) return;
    await this.locked(session, async () => {
      if (
        !session.state.current ||
        !event.playbackId ||
        event.playbackId !== session.state.currentPlaybackId
      )
        return;
      if (event.type === 'start') {
        this.emit('trackStart', this.snapshot(session));
        return;
      }
      if (event.type === 'end' && ['replaced', 'stopped', 'cleanup'].includes(event.reason ?? ''))
        return;
      if (event.type === 'error' || event.type === 'stuck' || event.reason === 'loadFailed') {
        await this.retryOrAdvance(session, event.encoded);
        return;
      }
      if (event.type !== 'end' || event.reason !== 'finished') return;
      const finished = structuredClone(session.state.current);
      await this.retire(session, 'finished', true, false);
      if (session.state.loopMode === 'track') {
        finished.id = randomUUID();
        session.state.current = finished;
        session.state.currentPlaybackId = randomUUID();
      } else if (session.state.loopMode === 'queue') {
        finished.id = randomUUID();
        if (session.queue.size < session.settings.maxQueueSize)
          session.queue.add([finished], session.queue.size + 1, false);
        else
          this.emit(
            'notice',
            session.state.guildId,
            'The lowered queue limit prevented re-adding the looped track.',
          );
      }
      await this.persist(session);
    });
    this.kick(session);
    this.prefetch(session);
  }

  /** Freeze the clock; keep the current track and queue intact while nodes reconnect. */
  async nodeDisconnected(nodeId: string): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.closed || session.state.nodeId !== nodeId) continue;
      session.resolution?.abort();
      await this.locked(session, async () => {
        this.capturePosition(session);
        session.online = false;
        session.playing = false;
        await this.persist(session);
        const replacement = await this.transport
          .migrate(session.state.guildId, nodeId)
          .catch(() => null);
        if (replacement) {
          session.state.nodeId = replacement.nodeId;
          session.state.nodeSessionId = replacement.sessionId;
          session.online = true;
          session.prefetchFailed.clear();
          if (session.state.current) session.state.current.playable = null;
          await this.persist(session);
        }
      });
      if (session.online) this.kick(session);
    }
  }
  async nodeConnected(nodeId: string, offlineOnly = false): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.closed || session.state.nodeId !== nodeId || (offlineOnly && session.online))
        continue;
      await this.locked(session, async () => {
        const node = await this.transport.connect(this.snapshot(session));
        session.state.nodeId = node.nodeId;
        session.state.nodeSessionId = node.sessionId;
        session.online = true;
        session.prefetchFailed.clear();
        session.playing = false;
        if (session.state.current) session.state.current.playable = null;
        await this.persist(session);
        await this.configureSponsor(session);
      });
      this.kick(session);
      this.prefetch(session);
    }
  }
  async updatePosition(guildId: string, positionMs: number): Promise<void> {
    const session = this.sessions.get(guildId);
    if (
      !session ||
      !session.state.current ||
      !session.online ||
      !session.playing ||
      !Number.isFinite(positionMs) ||
      positionMs < 0
    )
      return;
    await this.locked(session, () => {
      session.state.positionMs = Math.round(positionMs);
      session.positionAt = Date.now();
      return Promise.resolve();
    });
  }

  async checkpointAll(): Promise<void> {
    for (const session of this.sessions.values()) {
      if (!session.closed)
        await this.locked(session, async () => {
          this.capturePosition(session);
          await this.persist(session);
        });
    }
  }
  /** Save resumable state and cancel work; do not delete queues or destroy Lavalink sessions. */
  async close(): Promise<void> {
    this.closing = true;
    const resumable = [...this.sessions.values()].filter((session) => !session.closed);
    if (this.checkpointTimer) clearInterval(this.checkpointTimer);
    this.checkpointTimer = null;
    for (const session of this.sessions.values()) {
      session.closed = true;
      session.workAbort.abort();
      session.resolution?.abort();
      this.cancelIdle(session);
    }
    await this.imports.close();
    for (const waiter of this.waiters.values())
      if (!waiter.settled) {
        waiter.reject(
          new MusicError('UNAVAILABLE', 'The import will resume after the bot restarts.'),
        );
        waiter.settled = true;
      }
    await Promise.allSettled([...this.background]);
    for (const session of resumable)
      await session.lock.run(async () => {
        this.capturePosition(session);
        await this.persist(session);
      });
  }

  private createSession(
    state: QueueSnapshot,
    settings: GuildSettings,
    version: SnapshotRecord | null,
  ): Session {
    const queue = new QueueManager(
      state.upcoming,
      Math.max(settings.maxQueueSize, state.upcoming.length),
    );
    queue.setMaximum(settings.maxQueueSize);
    return {
      state,
      queue,
      settings,
      version,
      lock: new AsyncLock(),
      closed: false,
      online: true,
      playing: false,
      positionAt: Date.now(),
      pump: null,
      wake: false,
      resolution: null,
      prefetching: new Set(),
      prefetchFailed: new Set(),
      workAbort: new AbortController(),
      excluded: new Set(),
      retries: 0,
      emptyVoice: false,
      idleTimer: null,
    };
  }
  private snapshot(session: Session): QueueSnapshot {
    return {
      ...structuredClone(session.state),
      upcoming: session.queue.view(),
      positionMs: this.position(session),
    };
  }
  private position(session: Session): number {
    const elapsed =
      session.playing && session.online && !session.state.paused
        ? Date.now() - session.positionAt
        : 0;
    const scale = session.state.filters.timescale;
    const position = session.state.positionMs + elapsed * (scale?.speed ?? 1) * (scale?.rate ?? 1);
    const length =
      session.state.current?.playable?.durationMs ?? session.state.current?.track.durationMs ?? 0;
    return Math.round(
      Math.max(0, session.state.current?.track.isStream ? position : Math.min(position, length)),
    );
  }
  private capturePosition(session: Session): void {
    session.state.positionMs = this.position(session);
    session.positionAt = Date.now();
  }
  private async persist(session: Session): Promise<void> {
    const snapshot = this.snapshot(session);
    try {
      session.version = await this.repositories.queueSnapshots.save(snapshot, session.version);
    } catch (error) {
      // A different process owns a newer generation/revision. Stop this session from overwriting it.
      if (error instanceof Error && 'code' in error && error.code === 'STALE_SNAPSHOT') {
        session.closed = true;
        session.workAbort.abort();
        session.resolution?.abort();
        this.cancelIdle(session);
        this.logger.error({ guildId: snapshot.guildId }, 'Snapshot conflict; player suspended.');
      }
      throw error;
    }
  }
  private changed(session: Session): void {
    this.cancelIdle(session);
    this.emit('changed', this.snapshot(session));
    this.scheduleIdle(session);
  }
  private require(guildId: string): Session {
    const session = this.sessions.get(guildId);
    if (!session || session.closed)
      throw new MusicError('NO_PLAYER', 'Join a voice channel and play a track first.');
    return session;
  }
  private locked<T>(session: Session, operation: () => Promise<T>): Promise<T> {
    return session.lock.run(() => {
      if (session.closed) throw new MusicError('NO_PLAYER', 'This player has disconnected.');
      return operation();
    });
  }
  private requireCurrent(session: Session): QueueEntry {
    if (!session.state.current) throw new MusicError('NO_PLAYER', 'Nothing is playing.');
    return session.state.current;
  }
  private async seekLocked(session: Session, positionMs: number): Promise<void> {
    const current = this.requireCurrent(session);
    if (!current.playable?.isSeekable || current.playable.isStream)
      throw new MusicError('NOT_SEEKABLE', 'Live streams and this audio source cannot be seeked.');
    if (
      !Number.isInteger(positionMs) ||
      positionMs < 0 ||
      positionMs >= current.playable.durationMs
    )
      throw new MusicError('INVALID_INPUT', 'Choose a position within the current track.');
    await this.transport.seek(session.state.guildId, positionMs);
    session.state.positionMs = positionMs;
    session.positionAt = Date.now();
    await this.persist(session);
    this.changed(session);
  }
  private assertCapacity(session: Session, added: number): void {
    if (
      session.queue.size + Number(Boolean(session.state.current)) + added >
      session.settings.maxQueueSize
    )
      throw new MusicError('QUEUE_FULL', 'The server queue limit has been reached.');
  }
  private validateLength(session: Session, durationMs: number, isStream: boolean): void {
    if (
      !isStream &&
      (durationMs <= 0 || durationMs > session.settings.maxTrackLengthSeconds * 1000)
    )
      throw new MusicError(
        'INVALID_INPUT',
        'This track exceeds the server duration limit or has no known duration.',
      );
  }

  private kick(session: Session): void {
    if (session.closed || !session.online) return;
    if (session.pump) {
      session.wake = true;
      return;
    }
    const task = this.pump(session)
      .catch((error: unknown) => {
        this.logger.warn(
          { guildId: session.state.guildId, code: errorCode(error) },
          'Playback operation failed.',
        );
        this.emit(
          'notice',
          session.state.guildId,
          'Playback is temporarily unavailable. Your queue has been saved.',
        );
      })
      .finally(() => {
        session.pump = null;
        if (session.wake) {
          session.wake = false;
          this.kick(session);
        }
      });
    session.pump = task;
    this.watch(task);
  }
  private async pump(session: Session): Promise<void> {
    while (!session.closed && session.online) {
      const claim = await this.locked(session, async () => {
        if (session.closed || session.playing) return null;
        if (!session.state.current) {
          session.state.current = session.queue.take();
          if (session.state.current) session.prefetchFailed.delete(session.state.current.id);
          session.state.currentPlaybackId = session.state.current ? randomUUID() : null;
          session.state.positionMs = 0;
          session.state.paused = false;
        }
        if (!session.state.current) return null;
        session.state.currentPlaybackId ??= randomUUID();
        const controller = new AbortController();
        session.resolution = controller;
        await this.persist(session);
        return {
          entry: structuredClone(session.state.current),
          id: session.state.currentPlaybackId,
          nodeId: session.state.nodeId,
          controller,
        };
      });
      if (!claim) {
        if (!session.state.current && !session.closed) await this.queueEnded(session);
        return;
      }
      try {
        this.validateLength(session, claim.entry.track.durationMs, claim.entry.track.isStream);
        let playable = claim.entry.playable;
        if (
          !playable ||
          session.excluded.has(playable.encoded) ||
          (catalogSources.has(claim.entry.track.source) &&
            !this.resolver.validMirror(claim.entry.track, playable))
        ) {
          playable = await this.resolver.resolve(
            claim.entry.track,
            session.excluded,
            claim.nodeId,
            claim.controller.signal,
          );
        }
        this.validateLength(session, playable.durationMs, playable.isStream);
        claim.controller.signal.throwIfAborted();
        await this.locked(session, async () => {
          if (
            session.closed ||
            !session.online ||
            session.state.currentPlaybackId !== claim.id ||
            claim.controller.signal.aborted
          )
            return;
          const current = this.requireCurrent(session);
          current.playable = playable;
          await this.persist(session);
          await this.transport.play(session.state.guildId, playable, {
            playbackId: claim.id,
            positionMs:
              playable.isSeekable && !playable.isStream
                ? Math.min(session.state.positionMs, Math.max(0, playable.durationMs - 1))
                : 0,
            paused: session.state.paused,
            volume: session.state.volume,
            filters: session.state.filters,
          });
          session.playing = true;
          session.positionAt = Date.now();
          session.resolution = null;
          await this.repositories.history.record({
            id: claim.id,
            botId: this.botId,
            guildId: session.state.guildId,
            userId: current.requester.userId,
            track: current.track,
            startedAt: Date.now(),
          });
          this.changed(session);
        });
        this.prefetch(session);
        if (session.playing) return;
      } catch (error) {
        if (claim.controller.signal.aborted) continue;
        if (!(error instanceof MusicError)) throw error;
        await this.locked(session, async () => {
          if (session.closed || session.state.currentPlaybackId !== claim.id) return;
          if (error instanceof MusicError && error.code === 'NODE_UNAVAILABLE') {
            this.capturePosition(session);
            session.online = false;
            session.playing = false;
          } else {
            await this.retire(session, 'error');
            this.emit(
              'notice',
              session.state.guildId,
              'A full playable version was unavailable, so I skipped that track.',
            );
          }
          await this.persist(session);
        });
      }
    }
  }
  private async retire(
    session: Session,
    reason: HistoryEndReason,
    remember = true,
    stopAudio = true,
  ): Promise<void> {
    session.resolution?.abort();
    session.resolution = null;
    const current = session.state.current;
    const playbackId = session.state.currentPlaybackId;
    const ended = this.snapshot(session);
    session.playing = false;
    session.state.current = null;
    session.state.currentPlaybackId = null;
    session.state.positionMs = 0;
    session.state.paused = false;
    session.excluded.clear();
    session.retries = 0;
    session.queue.invalidateUndo();
    if (current && remember)
      session.state.previous = [structuredClone(current), ...session.state.previous].slice(0, 50);
    if (playbackId) await this.repositories.history.finish(playbackId, reason);
    if (stopAudio) await this.transport.stop(session.state.guildId).catch(() => undefined);
    if (current) this.emit('trackEnd', ended, reason);
  }
  private async retryOrAdvance(session: Session, encoded: string | null): Promise<void> {
    const current = this.requireCurrent(session);
    if (encoded) session.excluded.add(encoded);
    if (catalogSources.has(current.track.source) && session.retries < 2) {
      if (session.state.currentPlaybackId)
        await this.repositories.history.finish(session.state.currentPlaybackId, 'error');
      session.resolution?.abort();
      session.playing = false;
      session.retries++;
      current.playable = null;
      session.state.positionMs = 0;
      session.positionAt = Date.now();
      session.state.currentPlaybackId = randomUUID();
      await this.transport.stop(session.state.guildId).catch(() => undefined);
      this.emit(
        'notice',
        session.state.guildId,
        'The audio source failed. Trying another full-length mirror.',
      );
    } else {
      await this.retire(session, 'error');
      this.emit('notice', session.state.guildId, 'This track could not play, so I skipped it.');
    }
    await this.persist(session);
  }
  private async queueEnded(session: Session): Promise<void> {
    if (session.state.pendingImports.length) return; // The next page can still arrive.
    const last = session.state.previous[0];
    if (session.state.autoplay && last && !session.closed) {
      const generation = session.version?.generation;
      const entry = await this.autoplay
        .next(
          this.botId,
          session.state.guildId,
          last,
          session.queue.view(),
          session.settings.maxTrackLengthSeconds * 1000,
          session.state.nodeId,
          session.workAbort.signal,
        )
        .catch(() => null);
      if (entry) {
        await this.locked(session, async () => {
          if (
            session.closed ||
            !session.state.autoplay ||
            session.state.current ||
            session.queue.size ||
            session.version?.generation !== generation
          )
            return;
          this.assertCapacity(session, 1);
          session.queue.add([entry], 1, false);
          await this.persist(session);
          session.wake = true;
        });
        if (session.queue.size) return;
      }
    }
    this.emit('queueEnd', this.snapshot(session));
    this.scheduleIdle(session);
  }

  private startImport(session: Session, job: PendingImport): void {
    this.imports.start(
      structuredClone(job),
      {
        append: (id, items, processed, name, total) =>
          this.locked(session, async () => {
            if (session.closed) return false;
            const active = session.state.pendingImports.find((pending) => pending.id === id);
            if (!active) return false;
            const waiter = this.waiters.get(id);
            if (waiter) {
              waiter.name = name;
              waiter.total = total;
            }
            active.processedCount = processed;
            const valid = items.filter(
              (item) =>
                item.track.isStream ||
                (item.track.durationMs > 0 &&
                  item.track.durationMs <= session.settings.maxTrackLengthSeconds * 1000),
            );
            if (waiter?.replaceCurrent && valid.length) {
              waiter.replaceCurrent = false;
              await this.retire(session, 'replaced');
            }
            const available = Math.max(
              0,
              session.settings.maxQueueSize -
                session.queue.size -
                Number(Boolean(session.state.current)),
            );
            const accepted = valid.slice(0, available);
            let position = session.queue.size + 1;
            if (active.mode === 'next') {
              const lastKey = active.enqueuedKeys.at(-1);
              const entries = session.queue.view();
              const reverseIndex = [...entries]
                .reverse()
                .findIndex((entry) => entry.track.key === lastKey);
              const index = reverseIndex < 0 ? -1 : entries.length - reverseIndex - 1;
              position = index >= 0 ? index + 2 : 1;
            }
            if (accepted.length)
              session.queue.add(
                accepted.map((item) =>
                  createQueueEntry(item.track, active.requester, item.playable),
                ),
                position,
                false,
              );
            active.enqueuedKeys.push(...accepted.map((item) => item.track.key));
            if (waiter) {
              waiter.count += accepted.length;
              waiter.tracks.push(
                ...accepted
                  .slice(0, Math.max(0, 5 - waiter.tracks.length))
                  .map((item) => structuredClone(item.track)),
              );
            }
            await this.persist(session);
            if (waiter && waiter.count >= 5 && !waiter.settled) this.settleImport(id, waiter, true);
            this.emit(
              'importProgress',
              session.state.guildId,
              id,
              active.enqueuedKeys.length,
              total,
            );
            this.changed(session);
            this.kick(session);
            this.prefetch(session);
            return accepted.length === valid.length;
          }),
        complete: (id, failed) =>
          this.locked(session, async () => {
            if (session.closed) return;
            session.state.pendingImports = session.state.pendingImports.filter(
              (pending) => pending.id !== id,
            );
            await this.persist(session);
            const waiter = this.waiters.get(id);
            if (waiter && !waiter.settled) {
              if (waiter.count === 0) {
                waiter.settled = true;
                waiter.reject(
                  new MusicError(
                    failed ? 'UNAVAILABLE' : 'NOT_FOUND',
                    'No playable tracks could be imported.',
                  ),
                );
              } else this.settleImport(id, waiter, false);
            }
            this.waiters.delete(id);
            this.changed(session);
            this.kick(session);
          }),
      },
      () =>
        this.emit(
          'notice',
          session.state.guildId,
          'The playlist import stopped because its metadata source is unavailable. Tracks already queued are preserved.',
        ),
    );
  }
  private makeWaiter(replaceCurrent: boolean): ImportWaiter {
    let resolve!: ImportWaiter['resolve'];
    let reject!: ImportWaiter['reject'];
    const first = new Promise<ImportResult>((ready, fail) => {
      resolve = ready;
      reject = fail;
    });
    return {
      first,
      resolve,
      reject,
      name: 'Playlist',
      count: 0,
      total: null,
      settled: false,
      replaceCurrent,
      tracks: [],
    };
  }
  private settleImport(id: string, waiter: ImportWaiter, background: boolean): void {
    waiter.settled = true;
    waiter.resolve({
      id,
      name: waiter.name,
      enqueued: waiter.count,
      total: waiter.total,
      background,
      tracks: structuredClone(waiter.tracks),
    });
  }
  private cancelImports(session: Session): void {
    for (const job of session.state.pendingImports) {
      this.imports.cancel(job.id);
      const waiter = this.waiters.get(job.id);
      if (waiter && !waiter.settled) {
        waiter.settled = true;
        waiter.reject(new MusicError('UNAVAILABLE', 'The playlist import was cancelled.'));
      }
      this.waiters.delete(job.id);
    }
    session.state.pendingImports = [];
  }
  private prefetch(session: Session): void {
    if (session.closed || !session.online || !session.playing) return;
    const capacity = Math.max(0, this.env.IMPORT_CONCURRENCY - session.prefetching.size);
    if (!capacity) return;
    const excluded = new Set([...session.prefetching, ...session.prefetchFailed]);
    const entries = session.queue.unresolved(capacity, excluded);
    for (const entry of entries) {
      session.prefetching.add(entry.id);
      const task = this.resolver
        .resolve(entry.track, new Set(), session.state.nodeId, session.workAbort.signal)
        .then(async (playable) => {
          await this.locked(session, () => {
            if (session.closed || !session.queue.updatePlayable(entry.id, playable))
              return Promise.resolve();
            // Encodings are an expendable cache. Periodic checkpoints capture them in a batch;
            // a restart safely re-resolves them rather than losing catalog entries.
            return Promise.resolve();
          });
        })
        .catch(() => {
          session.prefetchFailed.add(entry.id);
        })
        .finally(() => {
          session.prefetching.delete(entry.id);
          // Failed entries wait for their turn; other songs still resolve in the background.
          this.prefetch(session);
        });
      this.watch(task);
    }
  }
  private scheduleIdle(session: Session): void {
    if (
      session.closed ||
      session.settings.stayInVoice ||
      (!session.emptyVoice &&
        (session.state.current || session.queue.size || session.state.pendingImports.length))
    ) {
      this.cancelIdle(session);
      return;
    }
    if (session.idleTimer) return;
    session.idleTimer = setTimeout(() => {
      session.idleTimer = null;
      if (
        !session.closed &&
        !session.settings.stayInVoice &&
        (session.emptyVoice ||
          (!session.state.current && !session.queue.size && !session.state.pendingImports.length))
      )
        this.watch(this.leave(session.state.guildId));
    }, session.settings.autoLeaveTimeoutSeconds * 1000);
    session.idleTimer.unref();
  }
  private cancelIdle(session: Session): void {
    if (session.idleTimer) clearTimeout(session.idleTimer);
    session.idleTimer = null;
  }
  private async configureSponsor(session: Session): Promise<void> {
    if (!this.env.SPONSORBLOCK_ENABLED && session.settings.sponsorBlockEnabled) return;
    await this.transport
      .sponsorBlock(
        session.state.guildId,
        this.env.SPONSORBLOCK_ENABLED && session.settings.sponsorBlockEnabled,
      )
      .catch(() =>
        this.emit(
          'notice',
          session.state.guildId,
          'SponsorBlock is unavailable on this audio server.',
        ),
      );
  }
  private watch(task: Promise<void>): void {
    const guarded = task.catch((error: unknown) =>
      this.logger.warn({ code: errorCode(error) }, 'Background music operation failed.'),
    );
    this.background.add(guarded);
    void guarded.finally(() => this.background.delete(guarded));
  }
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/QueueManager.ts

````typescript
import { randomInt, randomUUID } from 'node:crypto';
import { queueEntrySchema } from '../db/models.js';
import type { PlayableTrack, QueueEntry, Requester, StoredTrack } from '../db/models.js';
import { MusicError } from '../utils/errors.js';

export function createQueueEntry(
  track: StoredTrack,
  requester: Requester,
  playable: PlayableTrack | null = null,
): QueueEntry {
  return queueEntrySchema.parse({
    id: randomUUID(),
    track,
    requester,
    playable,
    addedAt: Date.now(),
  });
}

/** One-based user positions; internal storage is private and every outward view is copied. */
export class QueueManager {
  private entries: QueueEntry[];
  private undoState: { entries: QueueEntry[]; expiresAt: number } | null = null;
  constructor(
    entries: readonly QueueEntry[] = [],
    private maximum = 2000,
    private readonly now: () => number = Date.now,
  ) {
    this.entries = entries.map((entry) => queueEntrySchema.parse(entry));
    this.assertCapacity(this.entries.length);
    this.assertUnique(this.entries);
  }
  get size(): number {
    return this.entries.length;
  }
  get remaining(): number {
    return Math.max(0, this.maximum - this.size);
  }
  get totalDurationMs(): number {
    return this.entries.reduce((sum, entry) => sum + entry.track.durationMs, 0);
  }
  view(): QueueEntry[] {
    return structuredClone(this.entries);
  }
  peek(): QueueEntry | null {
    return structuredClone(this.entries[0] ?? null);
  }
  unresolved(limit: number, excluded: ReadonlySet<string>): QueueEntry[] {
    if (limit < 1) return [];
    const candidates: QueueEntry[] = [];
    for (const entry of this.entries) {
      if (!entry.playable && !excluded.has(entry.id)) candidates.push(structuredClone(entry));
      if (candidates.length >= limit) break;
    }
    return candidates;
  }
  setMaximum(maximum: number): void {
    if (!Number.isInteger(maximum) || maximum < 1 || maximum > 10_000)
      throw new MusicError('INVALID_INPUT', 'Invalid queue limit.');
    this.maximum = maximum; // Existing tracks survive a lowered server limit.
  }

  add(entries: readonly QueueEntry[], position = this.size + 1, undoable = true): void {
    this.position(position, true);
    this.assertCapacity(this.size + entries.length);
    const parsed = entries.map((entry) => queueEntrySchema.parse(entry));
    this.assertUnique([...this.entries, ...parsed]);
    if (undoable) this.remember();
    else this.invalidateUndo();
    this.entries.splice(position - 1, 0, ...parsed);
  }
  take(): QueueEntry | null {
    this.invalidateUndo();
    return this.entries.shift() ?? null;
  }
  remove(positions: readonly number[]): QueueEntry[] {
    const indexes = new Set(
      positions.map((position) => {
        this.position(position);
        return position - 1;
      }),
    );
    if (indexes.size === 0)
      throw new MusicError('INVALID_INPUT', 'Choose at least one queue position.');
    this.remember();
    const removed = this.entries.filter((_, index) => indexes.has(index));
    this.entries = this.entries.filter((_, index) => !indexes.has(index));
    return structuredClone(removed);
  }
  move(from: number, to: number): void {
    this.position(from);
    this.position(to);
    this.remember();
    const entry = this.entries.splice(from - 1, 1)[0];
    if (entry) this.entries.splice(to - 1, 0, entry);
  }
  swap(first: number, second: number): void {
    this.position(first);
    this.position(second);
    this.remember();
    const a = this.entries[first - 1];
    const b = this.entries[second - 1];
    if (a && b) {
      this.entries[first - 1] = b;
      this.entries[second - 1] = a;
    }
  }
  clear(undoable = true): number {
    if (undoable) this.remember();
    else this.invalidateUndo();
    const count = this.size;
    this.entries = [];
    return count;
  }
  shuffle(random: (upperExclusive: number) => number = randomInt): void {
    this.remember();
    for (let index = this.size - 1; index > 0; index--) {
      const target = random(index + 1);
      if (!Number.isInteger(target) || target < 0 || target > index)
        throw new RangeError('Invalid shuffle random value.');
      const a = this.entries[index];
      const b = this.entries[target];
      if (a && b) {
        this.entries[index] = b;
        this.entries[target] = a;
      }
    }
  }
  dedupe(currentKey?: string): number {
    this.remember();
    const keys = new Set(currentKey ? [currentKey] : []);
    const before = this.size;
    this.entries = this.entries.filter((entry) => {
      if (keys.has(entry.track.key)) return false;
      keys.add(entry.track.key);
      return true;
    });
    return before - this.size;
  }
  undo(): void {
    const state = this.undoState;
    if (!state || state.expiresAt < this.now())
      throw new MusicError('NOT_FOUND', 'There is no recent queue change to undo.');
    this.assertCapacity(state.entries.length);
    this.entries = structuredClone(state.entries);
    this.invalidateUndo();
  }
  updatePlayable(id: string, playable: PlayableTrack): boolean {
    const entry = this.entries.find((entry) => entry.id === id);
    if (!entry) return false;
    entry.playable = queueEntrySchema.shape.playable.parse(playable);
    return true;
  }
  invalidateUndo(): void {
    this.undoState = null;
  }
  private remember(): void {
    this.undoState = { entries: this.view(), expiresAt: this.now() + 20_000 };
  }
  private position(position: number, allowEnd = false): void {
    if (!Number.isInteger(position) || position < 1 || position > this.size + (allowEnd ? 1 : 0))
      throw new MusicError('INVALID_INPUT', 'That queue position does not exist.');
  }
  private assertCapacity(size: number): void {
    if (size > this.maximum)
      throw new MusicError('QUEUE_FULL', 'The server queue limit has been reached.');
  }
  private assertUnique(entries: readonly QueueEntry[]): void {
    if (new Set(entries.map((entry) => entry.id)).size !== entries.length)
      throw new MusicError('CONFLICT', 'Queue entry IDs must be unique.');
  }
}

export { parsePositions } from '../utils/positions.js';

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/TrackCodec.ts

````typescript
import { cleanText, safeWebUrl } from '../utils/text.js';
export { cleanText, safeWebUrl } from '../utils/text.js';
import { createHash } from 'node:crypto';
import type { Track } from 'lavalink-client';
import { playableTrackSchema, storedTrackSchema } from '../db/models.js';
import type { MusicSource, PlayableTrack, StoredTrack } from '../db/models.js';
import type { RawTrack, ResolvedItem } from './types.js';
import { MusicError } from '../utils/errors.js';

export const catalogSources = new Set<MusicSource>([
  'spotify',
  'applemusic',
  'deezer',
  'yandexmusic',
]);
export const mirrorSources = new Set<MusicSource>(['youtube', 'soundcloud']);

export function normalizeSource(value: string): MusicSource {
  const normalized = value.toLowerCase().replace(/[ _-]/g, '');
  if (['youtube', 'youtubemusic'].includes(normalized)) return 'youtube';
  if (
    [
      'spotify',
      'soundcloud',
      'deezer',
      'applemusic',
      'yandexmusic',
      'twitch',
      'bandcamp',
      'vimeo',
      'http',
      'attachment',
    ].includes(normalized)
  )
    return normalized as MusicSource;
  throw new MusicError('UNAVAILABLE', 'This audio source is not supported.');
}
export function normalizeIsrc(value: string | null | undefined): string | null {
  const isrc = value?.replace(/-/g, '').toUpperCase() ?? '';
  return /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(isrc) ? isrc : null;
}
export function fromClientTrack(track: Track): RawTrack {
  return {
    encoded: track.encoded ?? null,
    identifier: track.info.identifier,
    title: track.info.title,
    artist: track.info.author,
    source: track.info.sourceName,
    uri: track.info.uri,
    durationMs: track.info.duration,
    isStream: track.info.isStream,
    isSeekable: track.info.isSeekable,
    artworkUrl: track.info.artworkUrl,
    isrc: track.info.isrc,
    album: track.pluginInfo.albumName ?? null,
    // previewUrl alone is metadata, not evidence that this encoded track is a preview.
    isPreview: track.pluginInfo.isPreview === true,
  };
}
export function isPreview(track: RawTrack): boolean {
  return track.isPreview || isPreviewRequest(track.title, track.uri);
}
export function isPreviewRequest(title: string, uri: string | null): boolean {
  if (/(?:^|[\W_])(?:preview|sample clip|30[ -]second clip)(?:[\W_]|$)/i.test(title)) return true;
  try {
    const host = uri ? new URL(uri).hostname.toLowerCase() : '';
    return /^(?:p\.scdn\.co|audio-ssl\.itunes\.apple\.com|cdns-preview[^.]*\.dzcdn\.net)$/.test(
      host,
    );
  } catch {
    return false;
  }
}
export function toStoredTrack(raw: RawTrack): StoredTrack {
  const source = normalizeSource(raw.source);
  const identifier = cleanText(raw.identifier, 1024);
  return storedTrackSchema.parse({
    version: 1,
    key: `${source}:${createHash('sha256').update(identifier).digest('hex')}`,
    title: cleanText(raw.title),
    artist: cleanText(raw.artist),
    source,
    identifier,
    uri: safeWebUrl(raw.uri),
    durationMs: Math.round(raw.durationMs),
    isStream: raw.isStream,
    artworkUrl: safeWebUrl(raw.artworkUrl),
    isrc: normalizeIsrc(raw.isrc),
    album: raw.album ? cleanText(raw.album) : null,
    localFileId: null,
  });
}
export function toPlayableTrack(raw: RawTrack): PlayableTrack {
  const track = toStoredTrack(raw);
  if (catalogSources.has(track.source) || isPreview(raw) || !raw.encoded) {
    throw new MusicError('UNAVAILABLE', 'A full playable version could not be found.');
  }
  return playableTrackSchema.parse({
    encoded: raw.encoded,
    identifier: track.identifier,
    title: track.title,
    artist: track.artist,
    source: track.source,
    uri: track.uri,
    durationMs: track.durationMs,
    isStream: track.isStream,
    isSeekable: raw.isSeekable,
    artworkUrl: track.artworkUrl,
    isrc: track.isrc,
    isPreview: false,
  });
}
export function toResolvedItem(raw: RawTrack): ResolvedItem {
  if (isPreview(raw) && !catalogSources.has(normalizeSource(raw.source))) {
    throw new MusicError('UNAVAILABLE', 'Preview clips are not playable.');
  }
  const track = toStoredTrack(raw);
  return { track, playable: catalogSources.has(track.source) ? null : toPlayableTrack(raw) };
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/SourceResolver.ts

````typescript
import { createHash } from 'node:crypto';
import { playableTrackSchema, storedTrackSchema } from '../db/models.js';
import type { PlayableTrack, StoredTrack } from '../db/models.js';
import type { Cache } from '../cache/Cache.js';
import type { AudioTransport, CatalogPage, RawTrack, ResolvedItem } from './types.js';
import type { CatalogClient } from './CatalogClient.js';
import { MirrorMatcher } from './MirrorMatcher.js';
import {
  catalogSources,
  cleanText,
  isPreviewRequest,
  toPlayableTrack,
  toResolvedItem,
  toStoredTrack,
} from './TrackCodec.js';
import { UrlGuard } from '../security/UrlGuard.js';
import type { MediaBridge } from '../security/MediaBridge.js';
import { Semaphore } from '../utils/AsyncLock.js';
import { MusicError } from '../utils/errors.js';

const platforms = new Set([
  'ytsearch',
  'ytmsearch',
  'scsearch',
  'spsearch',
  'amsearch',
  'dzsearch',
  'ymsearch',
  'bcsearch',
]);
export class SourceResolver {
  private readonly work: Semaphore;
  constructor(
    private readonly transport: AudioTransport,
    private readonly cache: Cache,
    private readonly media: MediaBridge,
    private readonly catalog: CatalogClient,
    concurrency = 3,
    private readonly guard = new UrlGuard(),
    private readonly matcher = new MirrorMatcher(),
  ) {
    this.work = new Semaphore(concurrency);
  }

  async *pages(input: string, limit: number, signal?: AbortSignal): AsyncGenerator<CatalogPage> {
    const query = this.sanitizeQuery(input);
    signal?.throwIfAborted();
    let identifier = query;
    if (/^https?:\/\//i.test(query)) {
      const { url } = await this.guard.validate(query);
      const provider = canonicalProviderUrl(url);
      if (!provider) {
        if (isPreviewRequest(decodeFilename(url.pathname), url.href))
          throw new MusicError(
            'UNAVAILABLE',
            'Preview clips are not playable. Use a full song link or upload.',
          );
        const cached = await this.media.download(url.href, signal);
        const result = await this.transport.load(cached.url);
        const raw = result.tracks[0];
        if (!raw || raw.isStream)
          throw new MusicError('UNAVAILABLE', 'This file could not be decoded as complete audio.');
        const playable = toPlayableTrack({ ...raw, source: 'http' });
        const track = storedTrackSchema.parse({
          ...toStoredTrack({ ...raw, source: 'http' }),
          key: `http:${cached.id}`,
          uri: null,
          identifier: null,
          localFileId: cached.id,
          title: cleanText(decodeFilename(url.pathname)),
          artist: 'Uploaded audio',
        });
        yield { name: track.title, items: [{ track, playable }], total: 1 };
        return;
      }
      identifier = provider;
      const canonical = new URL(provider);
      if (this.catalog.supports(canonical)) {
        let yielded = false;
        try {
          for await (const page of this.catalog.pages(canonical, limit, signal)) {
            yielded = true;
            yield page;
          }
          return;
        } catch (error) {
          signal?.throwIfAborted();
          // Fall back only before the first page, so a partial failure cannot duplicate the import.
          if (yielded || !canonical.hostname.includes('spotify')) throw error;
        }
      }
    } else if (!/^[a-z]+search:/i.test(query)) identifier = `ytsearch:${query}`;
    signal?.throwIfAborted();
    const result = await this.transport.load(identifier);
    const items = result.tracks.slice(0, result.kind === 'search' ? 1 : limit).flatMap((raw) => {
      try {
        return [toResolvedItem(raw)];
      } catch {
        return [];
      }
    });
    if (!items.length)
      throw new MusicError('NOT_FOUND', 'No full tracks were found. Try another title or link.');
    // Lavalink's loadtracks endpoint returns aggregated metadata. Only mirror resolution is lazy here.
    for (let offset = 0; offset < items.length; offset += offset === 0 ? 5 : 50) {
      signal?.throwIfAborted();
      const size = offset === 0 ? 5 : 50;
      yield {
        name: cleanText(result.name),
        items: items.slice(offset, offset + size),
        total: items.length,
      };
    }
  }

  async search(
    input: string,
    count = 10,
    nodeId?: string | null,
    signal?: AbortSignal,
  ): Promise<ResolvedItem[]> {
    signal?.throwIfAborted();
    const query = this.sanitizeQuery(input);
    if (/^https?:\/\//i.test(query))
      throw new MusicError('INVALID_INPUT', 'Search with a title and artist. Use play for links.');
    const result = await this.transport.load(
      /^[a-z]+search:/i.test(query) ? query : `ytsearch:${query}`,
      nodeId,
    );
    signal?.throwIfAborted();
    return result.tracks.slice(0, Math.max(1, Math.min(10, count))).flatMap((raw) => {
      try {
        return [toResolvedItem(raw)];
      } catch {
        return [];
      }
    });
  }

  async resolve(
    track: StoredTrack,
    excluded: ReadonlySet<string> = new Set(),
    nodeId?: string | null,
    signal?: AbortSignal,
  ): Promise<PlayableTrack> {
    return this.work.run(async () => {
      storedTrackSchema.parse(track);
      signal?.throwIfAborted();
      if (track.localFileId) {
        const result = await this.transport.load(
          await this.media.urlFor(track.localFileId),
          nodeId,
        );
        const raw = result.tracks[0];
        if (!raw) throw unavailable();
        return toPlayableTrack({
          ...raw,
          source: track.source === 'attachment' ? 'attachment' : 'http',
        });
      }
      if (!catalogSources.has(track.source)) {
        if (!track.uri) throw unavailable();
        // Restore never hands an arbitrary saved HTTP URL or encoding to Lavalink.
        const { url } = await this.guard.validate(track.uri);
        const canonical = canonicalProviderUrl(url);
        if (!canonical) throw unavailable();
        const result = await this.transport.load(canonical, nodeId);
        const raw =
          result.tracks.find(
            (candidate) =>
              !excluded.has(candidate.encoded ?? '') && candidate.identifier === track.identifier,
          ) ?? result.tracks.find((candidate) => !excluded.has(candidate.encoded ?? ''));
        if (!raw) throw unavailable();
        return toPlayableTrack(raw);
      }
      const key = `mirror:v1:${createHash('sha256')
        .update(
          JSON.stringify([track.key, track.title, track.artist, track.durationMs, track.isrc]),
        )
        .digest('hex')}`;
      const cached = playableTrackSchema.safeParse(await this.cache.get(key));
      if (
        cached.success &&
        !excluded.has(cached.data.encoded) &&
        this.validMirror(track, cached.data)
      )
        return cached.data;
      const candidates: RawTrack[] = [];
      const query = `${track.artist} - ${track.title}`;
      const searches = [
        ...(track.isrc ? [`ytmsearch:"${track.isrc}"`, `ytsearch:"${track.isrc}"`] : []),
        `ytmsearch:${query}`,
        `ytsearch:${query}`,
        `scsearch:${query}`,
      ];
      for (const search of searches) {
        signal?.throwIfAborted();
        try {
          const result = await this.transport.load(search, nodeId);
          candidates.push(
            ...result.tracks.filter((candidate) => !excluded.has(candidate.encoded ?? '')),
          );
        } catch (error) {
          if (error instanceof MusicError && error.code === 'NODE_UNAVAILABLE') throw error;
        }
        const best = this.matcher.rank(track, candidates)[0];
        if (best && (best.exactIsrc || !search.includes(track.isrc ?? '\u0000'))) {
          const playable = toPlayableTrack(best.candidate);
          await this.cache.set(key, playable, 1800);
          return playable;
        }
      }
      const best = this.matcher.rank(track, candidates)[0];
      if (!best) throw unavailable();
      const playable = toPlayableTrack(best.candidate);
      await this.cache.set(key, playable, 1800);
      return playable;
    }, signal);
  }

  validMirror(track: StoredTrack, playable: PlayableTrack): boolean {
    return (
      this.matcher.score(track, {
        ...playable,
        encoded: playable.encoded,
        source: playable.source,
        album: null,
        isPreview: false,
      }) !== null
    );
  }

  async attachment(url: string, filename: string, signal?: AbortSignal): Promise<ResolvedItem> {
    if (isPreviewRequest(filename, url))
      throw new MusicError(
        'UNAVAILABLE',
        'Preview clips are not playable. Upload a complete song.',
      );
    const cached = await this.media.download(url, signal);
    const result = await this.transport.load(cached.url);
    const raw = result.tracks[0];
    if (!raw || raw.isStream) throw unavailable();
    return {
      track: storedTrackSchema.parse({
        ...toStoredTrack({ ...raw, source: 'attachment' }),
        key: `attachment:${cached.id}`,
        identifier: null,
        uri: null,
        localFileId: cached.id,
        title: cleanText(filename),
        artist: 'Uploaded audio',
      }),
      playable: toPlayableTrack({ ...raw, source: 'attachment' }),
    };
  }

  async related(
    track: StoredTrack,
    nodeId?: string | null,
    signal?: AbortSignal,
  ): Promise<ResolvedItem[]> {
    signal?.throwIfAborted();
    if (
      track.source === 'youtube' &&
      track.identifier &&
      /^[A-Za-z0-9_-]{11}$/.test(track.identifier)
    ) {
      try {
        const result = await this.transport.load(
          `https://www.youtube.com/watch?v=${track.identifier}&list=RD${track.identifier}`,
          nodeId,
        );
        signal?.throwIfAborted();
        const items = result.tracks.slice(0, 30).flatMap((raw) => {
          try {
            return [toResolvedItem(raw)];
          } catch {
            return [];
          }
        });
        if (items.length > 1) return items;
      } catch {
        /* Artist search remains available when mixes are restricted. */
      }
    }
    return this.search(`${track.artist} official audio`, 10, nodeId, signal);
  }

  private sanitizeQuery(input: string): string {
    const query = input.trim();
    if (
      !query ||
      query.length > 4096 ||
      [...query].some((c) => {
        const p = c.codePointAt(0) ?? 0;
        return p < 32 || p === 127;
      })
    )
      throw new MusicError(
        'INVALID_INPUT',
        'Provide a title or public music link up to 4096 characters.',
      );
    const prefix = /^([a-z][a-z0-9+.-]*):/i.exec(query)?.[1]?.toLowerCase();
    if (prefix && !['http', 'https'].includes(prefix) && !platforms.has(prefix))
      throw new MusicError('INVALID_INPUT', 'That URL scheme or search source is not supported.');
    if (platforms.has(prefix ?? '') && !query.slice((prefix?.length ?? 0) + 1).trim())
      throw new MusicError('INVALID_INPUT', 'Provide a search title after the source prefix.');
    return query;
  }
}

/** Strip arbitrary provider query parameters before a URL reaches the remote Lavalink machine. */
export function canonicalProviderUrl(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (
    ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(
      host,
    )
  ) {
    const id =
      host === 'youtu.be'
        ? url.pathname.slice(1)
        : (url.searchParams.get('v') ??
          /^\/(?:shorts|live)\/([A-Za-z0-9_-]{11})$/.exec(url.pathname)?.[1]);
    const list = url.searchParams.get('list');
    if ((id && !/^[A-Za-z0-9_-]{11}$/.test(id)) || (list && !/^[A-Za-z0-9_-]{10,200}$/.test(list)))
      throw invalidLink();
    if (id) return `https://www.youtube.com/watch?v=${id}${list ? `&list=${list}` : ''}`;
    if (list && url.pathname === '/playlist')
      return `https://www.youtube.com/playlist?list=${list}`;
    throw invalidLink();
  }
  if (
    host === 'open.spotify.com' &&
    /^\/(?:intl-[a-z]{2}\/)?(?:track|album|playlist|artist)\/[A-Za-z0-9]{22}\/?$/.test(url.pathname)
  )
    return `https://${host}${url.pathname}`;
  if (
    ['deezer.com', 'www.deezer.com'].includes(host) &&
    /^\/(?:[a-z]{2}\/)?(?:track|album|playlist|artist)\/\d+\/?$/.test(url.pathname)
  )
    return `https://www.deezer.com${url.pathname}`;
  if (
    host === 'music.apple.com' &&
    /^\/[a-z]{2}\/(?:album|playlist|artist|song)\/[A-Za-z0-9%._~-]+\/[A-Za-z0-9.-]+\/?$/.test(
      url.pathname,
    )
  ) {
    const id = url.searchParams.get('i');
    return `https://${host}${url.pathname}${id && /^\d+$/.test(id) ? `?i=${id}` : ''}`;
  }
  if (
    /^music\.yandex\.(?:ru|com|by|kz)$/.test(host) &&
    /^\/(?:album\/\d+(?:\/track\/\d+)?|artist\/\d+(?:\/tracks)?|users\/[A-Za-z0-9._-]+\/playlists\/\d+|track\/\d+)\/?$/.test(
      url.pathname,
    )
  )
    return `https://${host}${url.pathname}`;
  if (
    ['soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com'].includes(host) &&
    /^\/[A-Za-z0-9_-]+\/(?:sets\/)?[A-Za-z0-9_-]+\/?$/.test(url.pathname)
  )
    return `https://soundcloud.com${url.pathname}`;
  if (
    ['twitch.tv', 'www.twitch.tv'].includes(host) &&
    /^\/(?:videos\/\d+|[A-Za-z0-9_]+)\/?$/.test(url.pathname)
  )
    return `https://www.twitch.tv${url.pathname}`;
  if (
    /^(?:[a-z0-9-]+\.)?bandcamp\.com$/.test(host) &&
    /^\/(?:track|album)\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
  )
    return `https://${host}${url.pathname}`;
  if (['vimeo.com', 'www.vimeo.com'].includes(host) && /^\/\d+\/?$/.test(url.pathname))
    return `https://vimeo.com${url.pathname}`;
  return null;
}
function invalidLink(): MusicError {
  return new MusicError(
    'INVALID_INPUT',
    'Use a complete music track, artist, album, or playlist link.',
  );
}
function unavailable(): MusicError {
  return new MusicError('UNAVAILABLE', 'No full-length match is available for this track.');
}
function decodeFilename(pathname: string): string {
  try {
    return decodeURIComponent(pathname.split('/').at(-1) ?? 'Audio file');
  } catch {
    return 'Audio file';
  }
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/security/MediaBridge.ts

````typescript
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile, stat, readdir, unlink } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { Server, IncomingMessage, ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import type { Env } from '../../config/env.js';
import { SafeHttpClient } from './SafeHttpClient.js';
import { AsyncLock } from '../utils/AsyncLock.js';
import { MusicError } from '../utils/errors.js';
import { isPreviewRequest } from '../music/TrackCodec.js';

const idSchema = z.uuid();
export interface CachedMedia {
  id: string;
  url: string;
  size: number;
}

/** Lavalink sees only immutable, bounded files, never arbitrary user download URLs or manifests. */
export class MediaBridge {
  private server: Server | null = null;
  private key: Buffer | null = null;
  private readonly lock = new AsyncLock();
  private readonly directory: string;
  constructor(
    private readonly env: Pick<
      Env,
      | 'MEDIA_BRIDGE_PORT'
      | 'MEDIA_BRIDGE_BIND'
      | 'MEDIA_BRIDGE_PUBLIC_URL'
      | 'MEDIA_MAX_BYTES'
      | 'MEDIA_REQUEST_TIMEOUT_MS'
    >,
    private readonly http = new SafeHttpClient(),
    directory = './media-cache',
  ) {
    this.directory = resolve(directory);
  }

  async start(): Promise<void> {
    if (this.server) return;
    await mkdir(this.directory, { recursive: true });
    const keyPath = join(this.directory, '.bridge-key');
    try {
      await writeFile(keyPath, randomBytes(32), { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
    }
    this.key = await readFile(keyPath);
    if (this.key.length !== 32) throw new Error('Invalid media bridge key.');
    const server = createServer((request, response) => {
      void this.serve(request, response).catch(() => {
        response.destroy();
      });
    });
    server.requestTimeout = 30_000;
    server.headersTimeout = 10_000;
    await new Promise<void>((ready, reject) => {
      server.once('error', reject);
      server.listen(this.env.MEDIA_BRIDGE_PORT, this.env.MEDIA_BRIDGE_BIND, () => {
        server.off('error', reject);
        ready();
      });
    });
    server.on('error', () => {
      /* Socket-level failures must not crash the bot. */
    });
    this.server = server;
  }

  async download(url: string, signal?: AbortSignal): Promise<CachedMedia> {
    return this.lock.run(async () => {
      if (!this.key) throw new Error('Start the media bridge before downloading.');
      const response = await this.http.request(url, {
        maxBytes: this.env.MEDIA_MAX_BYTES,
        timeoutMs: this.env.MEDIA_REQUEST_TIMEOUT_MS,
        ...(signal ? { signal } : {}),
      });
      if (isPreviewRequest('', response.url))
        throw new MusicError(
          'UNAVAILABLE',
          'The download redirected to a preview clip. Use a full song link.',
        );
      if (response.status !== 200 || !isAudioContainer(response.body)) {
        throw new MusicError(
          'UNAVAILABLE',
          'Use a complete MP3, AAC, Ogg, FLAC, WAV, MP4, or WebM audio file.',
        );
      }
      const files = await readdir(this.directory);
      let used = 0;
      for (const file of files.filter((file) => /^[a-f0-9-]{36}\.media$/.test(file))) {
        used += (await stat(join(this.directory, file))).size;
      }
      if (used + response.body.length > this.env.MEDIA_MAX_BYTES * 20) {
        throw new MusicError(
          'MEDIA_TOO_LARGE',
          'The media cache is full. Ask the bot owner to clear unused files.',
        );
      }
      const id = randomUUID();
      await writeFile(this.filePath(id), response.body, { flag: 'wx', mode: 0o600 });
      return { id, url: await this.urlFor(id), size: response.body.length };
    });
  }

  async urlFor(id: string): Promise<string> {
    idSchema.parse(id);
    if (!this.key) throw new Error('Media bridge has not started.');
    try {
      await stat(this.filePath(id));
    } catch {
      throw new MusicError(
        'UNAVAILABLE',
        'This uploaded file is no longer available. Upload it again.',
      );
    }
    const signature = createHmac('sha256', this.key).update(id).digest('hex');
    return `${this.env.MEDIA_BRIDGE_PUBLIC_URL}/media/${id}/${signature}`;
  }

  /** Call with IDs referenced by ALL bot snapshots/favorites/playlists, never just one guild. */
  async pruneUnused(retained: ReadonlySet<string>, olderThanMs = 7 * 86_400_000): Promise<number> {
    return this.lock.run(async () => {
      let removed = 0;
      for (const file of await readdir(this.directory)) {
        const id = file.replace(/\.media$/, '');
        if (!idSchema.safeParse(id).success || retained.has(id)) continue;
        const path = this.filePath(id);
        if ((await stat(path)).mtimeMs > Date.now() - olderThanMs) continue;
        await unlink(path);
        removed++;
      }
      return removed;
    });
  }

  async close(): Promise<void> {
    const server = this.server;
    this.server = null;
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((ready) => server.close(() => ready()));
    }
  }

  private filePath(id: string): string {
    return join(this.directory, `${idSchema.parse(id)}.media`);
  }
  private async serve(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const match = /^\/media\/([a-f0-9-]{36})\/([a-f0-9]{64})$/.exec(request.url ?? '');
    if (!match || !this.key || !['GET', 'HEAD'].includes(request.method ?? '')) {
      response.writeHead(404).end();
      return;
    }
    const id = match[1] ?? '';
    if (!idSchema.safeParse(id).success) {
      response.writeHead(404).end();
      return;
    }
    const expected = createHmac('sha256', this.key).update(id).digest();
    if (!timingSafeEqual(expected, Buffer.from(match[2] ?? '', 'hex'))) {
      response.writeHead(404).end();
      return;
    }
    let size: number;
    try {
      size = (await stat(this.filePath(id))).size;
    } catch {
      response.writeHead(404).end();
      return;
    }
    let start = 0;
    let end = size - 1;
    let status = 200;
    const range = request.headers.range;
    if (range) {
      const parsed = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!parsed || (!parsed[1] && !parsed[2])) {
        response.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
        return;
      }
      if (!parsed[1]) start = Math.max(0, size - Number(parsed[2]));
      else {
        start = Number(parsed[1]);
        end = parsed[2] ? Math.min(Number(parsed[2]), end) : end;
      }
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start > end ||
        start >= size
      ) {
        response.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
        return;
      }
      status = 206;
    }
    response.writeHead(status, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': end - start + 1,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
      ...(status === 206 ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    await pipeline(createReadStream(this.filePath(id), { start, end }), response);
  }
}

export function isAudioContainer(body: Buffer): boolean {
  if (body.length < 12) return false;
  const header = body.subarray(0, 12);
  const ascii = header.toString('ascii');
  return (
    ascii.startsWith('ID3') ||
    ascii.startsWith('OggS') ||
    ascii.startsWith('fLaC') ||
    (ascii.startsWith('RIFF') && ascii.slice(8) === 'WAVE') ||
    ascii.slice(4, 8) === 'ftyp' ||
    header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) ||
    (header[0] === 0xff && ((header[1] ?? 0) & 0xe0) === 0xe0)
  );
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/scripts/register-commands.ts

````typescript
import { writeFile } from 'node:fs/promises';
import { REST, Routes } from 'discord.js';
import { z } from 'zod';
import { createCommandRegistry } from '../src/commands/index.js';
import { ConfigurationError, loadEnv } from '../src/config/env.js';

interface Options {
  dryRun: boolean;
  guildId: string | null;
  global: boolean;
  output: string | null;
}
function options(argv: readonly string[]): Options {
  const result: Options = { dryRun: false, guildId: null, global: false, output: null };
  for (let index = 0; index < argv.length; index++) {
    switch (argv[index]) {
      case '--dry-run':
        result.dryRun = true;
        break;
      case '--global':
        result.global = true;
        break;
      case '--guild': {
        const id = argv[++index];
        if (!id || !/^\d{17,20}$/.test(id)) throw new Error('Use --guild with a server ID.');
        result.guildId = id;
        break;
      }
      case '--output': {
        const path = argv[++index];
        if (!path) throw new Error('Use --output with a file path.');
        result.output = path;
        break;
      }
      default:
        throw new Error('Use --dry-run, --guild ID, --global, and optionally --output PATH.');
    }
  }
  if ((result.global && result.guildId) || (result.output && !result.dryRun))
    throw new Error('Choose one scope. --output requires --dry-run.');
  return result;
}

try {
  const arguments_ = options(process.argv.slice(2));
  const body = createCommandRegistry().toJSON();
  if (arguments_.dryRun) {
    const json = JSON.stringify(body, null, 2) + '\n';
    if (arguments_.output) {
      await writeFile(arguments_.output, json, 'utf8');
      console.info(`Validated ${body.length} slash commands; wrote the dry-run JSON.`);
    } else console.info(json);
  } else {
    const env = loadEnv();
    const guildId = arguments_.global ? null : (arguments_.guildId ?? env.DISCORD_GUILD_ID ?? null);
    const applicationSchema = z.object({ id: z.string().regex(/^\d{17,20}$/) });
    const accounts = [env.DISCORD_TOKEN, ...env.EXTRA_BOT_TOKENS];
    for (const [index, token] of accounts.entries()) {
      const rest = new REST({ version: '10', retries: 3, timeout: 30_000 }).setToken(token);
      const application = applicationSchema.parse(
        await rest.get(Routes.oauth2CurrentApplication()),
      );
      if (index === 0 && application.id !== env.DISCORD_CLIENT_ID)
        throw new Error('Application ID mismatch.');
      const route = guildId
        ? Routes.applicationGuildCommands(application.id, guildId)
        : Routes.applicationCommands(application.id);
      await rest.put(route, { body });
      console.info(
        `Registered ${body.length} ${guildId ? 'guild' : 'global'} commands for application ${application.id}.`,
      );
    }
  }
} catch (error) {
  console.error(
    error instanceof ConfigurationError
      ? error.message
      : 'Command registration failed. Check CLI flags, token/application IDs, and guild access. No secret values are logged.',
  );
  process.exitCode = 1;
}

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/tsup.config.ts

````typescript
import { defineConfig } from 'tsup';
import { cpSync } from 'node:fs';

export default defineConfig({
  // Bot, sharding, and registration entries arrive in their implementation phases.
  entry: {
    'config/env': 'src/config/env.ts',
    'scripts/check-env': 'scripts/check-env.ts',
    'scripts/healthcheck': 'scripts/healthcheck.ts',
    'scripts/migrate': 'scripts/migrate.ts',
    'lib/db/index': 'src/lib/db/index.ts',
    'lib/music/index': 'src/lib/music/index.ts',
    'framework/index': 'src/framework/index.ts',
    'scripts/register-commands': 'scripts/register-commands.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  dts: false,
  treeshake: true,
  external: ['better-sqlite3', 'pino-pretty'],
  noExternal: ['yaml'],
  onSuccess: () =>
    Promise.resolve().then(() => {
      cpSync('src/lib/db/migrations', 'dist/migrations', { recursive: true });
    }),
});

````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/docs/phase-5-commands.md

````markdown
# Phase 5 — Command framework and commands

Phase 5 of eight implements **68 canonical slash commands**, their prefix aliases,
and shared execution logic. Bootstrap, Discord/Lavalink event adapters, localized UI
labels, embed builders, search menus, controllers, and paginators arrive in Phase 6.
The commands already execute against the music engine and repositories; they return
typed views through `CommandUI` for that renderer. The production bot entry point is
still pending. The permanent test suite and full README follow in Phases 7 and 8.

## Shared execution

Each command file exports `slash`, `aliases`, `execute`, and its default command
definition. A single argument schema produces both the Discord slash builder and
the prefix parser. Slash, prefix, and controller invocations call the same executor.
Aliases are prefix shortcuts; slash commands use the canonical names in the table.

Prefix commands accept the configured prefix, `<@bot-id>`, or `<@!bot-id>`.
Commands and subcommands are case-insensitive; playlist names preserve their case
and use the repository's normalization rules. Quote names when more arguments
follow them, for example `!playlists add "Road Trip" queue:2`.

Boolean prefix values accept `on/off`, `true/false`, `yes/no`, `enable/disable`, and
`1/0`. Slash commands expose native booleans. Times accept seconds, `mm:ss`,
`hh:mm:ss`, or ordered units such as `1h2m3s`. Whole-number options reject decimal
values. Slash role/channel options use Discord pickers; prefix commands accept
mentions or IDs. `off` clears the role/channel through prefix commands; slash
commands use `clear:true`.

`play`, `playnext`, and `playnow` accept either a query/link or **one audio upload**.
Prefix uploads use the message's first attachment; slash commands use `attachment`.
The upload path uses the validated, bounded media bridge. Query and attachment
together are rejected. Playlist responses describe the first additions while the
engine continues importing. Saved favorites and playlists enqueue unresolved catalog
entries for the same full-track matching policy as ordinary playback.

## Permissions and controls

- Playback additions, queue changes, and audio controls require the DJ role when
  one is configured. Manage Server and configured bot owners satisfy DJ/admin
  checks. Admin settings require Manage Server or a configured owner.
- Music controls require the caller in the bot's voice channel. Join/play require
  the caller's voice channel and cannot take over a different active channel.
  `move` with no positions explicitly moves the bot to the caller's channel.
- The current requester can skip their own track with a one-track skip. With
  vote skip enabled, other human listeners may vote without a DJ role. DJs,
  Manage Server, and configured owners bypass the vote. Multi-track skips require
  one of those privileges while vote skip is enabled. `jump`/`skipto` use the same
  skip/vote service rather than providing a vote bypass.
- Vote thresholds round up from non-bot listeners who are not deafened. Duplicate
  votes do not increase the count, and departed listeners are pruned. A conditional
  engine skip checks the captured playback UUID so a late vote cannot skip a new song.
- The music-channel restriction applies to playback, queue, audio, and current-song
  views. Settings, help, library management, and account information can be used
  elsewhere so administrators can repair a restriction.
- Blacklisted users/servers cannot use commands. Only configured bot owners can
  manage blacklists; the owner blacklist command remains usable to remove a block.
- Bot text permissions check View Channel, Send Messages/Send Messages in Threads,
  Embed Links, and Use External Emojis. Voice joins check View Channel, Connect,
  Speak, and capacity. An already-connected bot does not need another free slot.
- Stage joins request speaking approval when needed. A stage moderator must approve
  the bot, or grant its account Mute Members so it can unsuppress itself. The default
  invite requests Request to Speak without granting moderator permissions.

Cooldowns are shared across a user's commands and aliases in each bot/guild, with
the configured 1.5-second default. An additional in-flight guard rejects a second
copy of the same command while it is still running. Long playlist requests do not
prevent a different authorized command after the cooldown. Queue mutations remain
serialized by the music engine.

## Privacy and interactions

Favorites, personal playlists, history, and owner blacklist responses are private.
Slash replies are ephemeral, including follow-up replies. Prefix responses go to
the invoking user's DMs; a closed DM produces a short public error without private
details. `grab` sends song details to the caller's DMs and confirms in the server.
Uploaded audio never exposes its media-bridge HMAC URL through `grab`.

Sharing issues an opaque **read-only token** privately. Anyone with that token may
view or play the collection, subject to normal music permissions for playback.
Deletion, appending, removing, importing, and changing sharing still require the
playlist owner. Turning sharing off revokes the token. No public web endpoint or
automatic external publication is created.

`InteractionRouter` binds controls to a random nonce, action, message, destination
channel, originating guild, and optionally an actor. Menus can be one-shot and have
explicit expiry. Copied IDs, unknown actions, other actors, and expired messages
are rejected ephemerally. A busy flag is acquired before acknowledgment so two
simultaneous clicks cannot enter together. DM menus retain their originating guild
and source text channel for authorization, while remaining bound to their DM
message and user. Phase 6 will use these sessions for search and pagination.

Search callbacks recheck current voice membership, role/settings, blacklist, and
bot permissions before joining or adding the selected item. Page callbacks also
receive a fresh context and retain repository ownership checks. User errors contain
authored messages, never provider stack traces, SQL diagnostics, or token values.

Clean mode deletes only the bot's own guild command replies. It leaves user messages
and DM library responses intact. Ephemeral cleanup is capped at 14 minutes to stay
within the interaction token lifetime; ordinary guild replies use the configured
delay. A renderer may mark a live controller response as persistent.

## Command reference

The slash and prefix argument names match. Optional arguments are shown in brackets.
Prefix aliases appear after the canonical name. For complex library subcommands,
use the examples below the table.

| Category | Command           | Prefix aliases     | Arguments                                                      |
| -------- | ----------------- | ------------------ | -------------------------------------------------------------- |
| admin    | `/announce`       | —                  | `[enabled]`                                                    |
| admin    | `/autoleave`      | —                  | `[seconds]`                                                    |
| admin    | `/blacklist`      | —                  | `add, remove, list`                                            |
| admin    | `/clean`          | —                  | `[enabled] [seconds]`                                          |
| admin    | `/defaultvolume`  | —                  | `[percent]`                                                    |
| admin    | `/djrole`         | —                  | `[role] [clear]`                                               |
| admin    | `/language`       | —                  | `[code]`                                                       |
| admin    | `/maxqueue`       | —                  | `[count]`                                                      |
| admin    | `/maxtracklength` | —                  | `[time]`                                                       |
| admin    | `/musicchannel`   | —                  | `[channel] [clear]`                                            |
| admin    | `/prefix`         | —                  | `[value]`                                                      |
| admin    | `/settings`       | —                  | —                                                              |
| admin    | `/sponsorblock`   | —                  | `[enabled]`                                                    |
| admin    | `/stay`           | —                  | `[enabled]`                                                    |
| admin    | `/voteskip`       | —                  | `[enabled] [threshold]`                                        |
| audio    | `/bassboost`      | —                  | `[enabled]`                                                    |
| audio    | `/8d`             | `eightd`           | `[enabled]`                                                    |
| audio    | `/equalizer`      | `eq`               | `<preset>`                                                     |
| audio    | `/filters`        | —                  | `show, reset`                                                  |
| audio    | `/karaoke`        | —                  | `[enabled]`                                                    |
| audio    | `/lowpass`        | —                  | `[enabled]`                                                    |
| audio    | `/nightcore`      | —                  | `[enabled]`                                                    |
| audio    | `/pitch`          | —                  | `<value>`                                                      |
| audio    | `/rate`           | —                  | `<value>`                                                      |
| audio    | `/rotation`       | —                  | `[enabled]`                                                    |
| audio    | `/speed`          | —                  | `<value>`                                                      |
| audio    | `/tremolo`        | —                  | `[enabled]`                                                    |
| audio    | `/vaporwave`      | —                  | `[enabled]`                                                    |
| audio    | `/vibrato`        | —                  | `[enabled]`                                                    |
| audio    | `/volume`         | `vol`              | `<percent>`                                                    |
| extras   | `/about`          | —                  | —                                                              |
| extras   | `/favorites`      | `favorite`, `fav`  | `add, remove, list, play`                                      |
| extras   | `/grab`           | `save`             | —                                                              |
| extras   | `/help`           | —                  | `[category]`                                                   |
| extras   | `/history`        | —                  | `[page]`                                                       |
| extras   | `/invite`         | —                  | —                                                              |
| extras   | `/lyrics`         | —                  | —                                                              |
| extras   | `/ping`           | —                  | —                                                              |
| extras   | `/playlists`      | `playlist`, `pl`   | `create, delete, add, remove, view, list, play, import, share` |
| extras   | `/stats`          | —                  | —                                                              |
| extras   | `/support`        | —                  | —                                                              |
| playback | `/forward`        | —                  | `<seconds>`                                                    |
| playback | `/join`           | —                  | —                                                              |
| playback | `/leave`          | `disconnect`, `dc` | —                                                              |
| playback | `/pause`          | —                  | —                                                              |
| playback | `/play`           | `p`                | `[query] [attachment]`                                         |
| playback | `/playnext`       | —                  | `[query] [attachment]`                                         |
| playback | `/playnow`        | `forceplay`        | `[query] [attachment]`                                         |
| playback | `/previous`       | `prev`             | —                                                              |
| playback | `/replay`         | —                  | —                                                              |
| playback | `/resume`         | —                  | —                                                              |
| playback | `/rewind`         | —                  | `<seconds>`                                                    |
| playback | `/search`         | —                  | `<query>`                                                      |
| playback | `/seek`           | —                  | `<time>`                                                       |
| playback | `/skip`           | —                  | `[count]`                                                      |
| playback | `/skipto`         | `jump`             | `<position>`                                                   |
| playback | `/stop`           | —                  | —                                                              |
| queue    | `/autoplay`       | —                  | `<enabled>`                                                    |
| queue    | `/clear`          | —                  | —                                                              |
| queue    | `/dedupe`         | —                  | —                                                              |
| queue    | `/loop`           | —                  | `<mode>`                                                       |
| queue    | `/move`           | —                  | `[from] [to]`                                                  |
| queue    | `/nowplaying`     | `np`               | —                                                              |
| queue    | `/queue`          | `q`                | `[page]`                                                       |
| queue    | `/remove`         | —                  | `<positions>`                                                  |
| queue    | `/shuffle`        | —                  | —                                                              |
| queue    | `/swap`           | —                  | `<first> <second>`                                             |
| queue    | `/undo`           | —                  | —                                                              |

## Examples

```text
!play artist - song
!play https://open.spotify.com/playlist/PLAYLIST_ID
!playnext song title
!forceplay song title
!search song title
!seek 1:23
!forward 15
!skip 2
!jump 3
!remove 2,4-6
!move 2 5
!move
!loop queue
!nightcore on
!speed 1.1
!equalizer vocal
!filters reset
!favorites add
!favorites remove 1
!favorites play
!playlists create "Road Trip"
!playlists add "Road Trip" current
!playlists add "Road Trip" queue:2
!playlists add "Road Trip" artist - song
!playlists import "Road Trip" https://www.youtube.com/playlist?list=PLAYLIST_ID
!playlists remove "Road Trip" 2-4
!playlists view "Road Trip" 2
!playlists play "Road Trip"
!playlists share "Road Trip" on
!playlists view READ_ONLY_SHARE_TOKEN
!playlists share "Road Trip" off
!djrole @DJ
!musicchannel #music
!voteskip on 60
!clean on 30
!maxtracklength 2h
!blacklist add user USER_ID Reason for the owner record
!blacklist remove user USER_ID
```

Placeholder IDs/tokens in these examples must be replaced with actual public links,
snowflakes, or an issued share token. Prefix changes affect the next message
immediately; the examples assume the default `!` prefix.

`clear` removes upcoming tracks and cancels pending imports while preserving the
current song. Undo restores the previous queue edit for twenty seconds; it does
not restart cancelled imports. `stop` clears playback and imports but retains a
connected player until the idle rule applies. `leave` removes the bot-scoped queue
snapshot and disconnects voice. `volume` updates playback and the stored default;
`defaultvolume` changes the starting volume of future players. Filter presets enable
by default and accept `off` to remove their effect. `filters` without a prefix
subcommand defaults to `show`; slash commands offer `show` and `reset`.

## Registration and Phase 6 integration

Generate/validate command JSON **without loading .env or contacting Discord**:

```powershell
npm run commands:register -- --dry-run
```

Use `--dry-run --output PATH` to save JSON into an existing directory. The compiled
entry supports the same flags:

```powershell
node dist/scripts/register-commands.js --dry-run --output data/commands.json
```

Once real configuration is available, register with:

```powershell
npm run commands:register
npm run commands:register -- --guild YOUR_SERVER_ID
npm run commands:register -- --global
```

Registration bulk-replaces this application's registered command set in the chosen
scope. `DISCORD_GUILD_ID` is the default development scope when configured; otherwise
registration is global. `--global` overrides that default. The script authenticates
the application ID, verifies it against `DISCORD_CLIENT_ID` for the primary token,
and registers the same definitions for configured extra bot accounts. Tokens and
API errors are never printed. No authenticated registration was performed here.

Phase 6 creates `CommandServices` with a ready Discord client, repositories, engine,
lyrics service, registry, view renderer, `VoteSkipService`, bounded catalog-work
semaphore, validated environment, and logger. Create `CommandHandler` and
`InteractionRouter`, connect the renderer to them, and then install events. Forward
chat-input interactions to `handleInteraction`, human guild messages to
`handleMessage`, and recognized components to `InteractionRouter.handle`.
Controller actions call `invokeComponent`, which reuses parsing, guards, cooldowns,
and the executor. Pagination may defer updates; controls/search choices defer private
replies. One-shot search sessions should set `once:true` and a 60-second lifetime.

During shutdown, call `handler.beginShutdown()` to stop accepting input and abort
catalog/attachment work, stop UI/router timers, close the player manager so pending
playback imports checkpoint and release their callers, then `await handler.close()`
before closing the database. Existing private playlists remain unchanged when a
metadata import is cancelled before its atomic append.

## Verification

The local registration dry run validates all 68 builders. The compiled ESM framework
and compiled registration entry also work without credentials. Strict TypeScript,
ESLint, Prettier, and the production build pass.

**92 temporary command checks** cover every executor through both actual handlers
against a real SQLite database and the real music engine with a fake audio transport.
They also cover schemas for every subcommand, aliases, quote/time/boolean parsing,
DJ/admin/voice policies, requester skip, vote thresholds, stale playback IDs,
blacklists, missing permissions, stages, private replies, opaque sessions,
simultaneous clicks, search reauthorization, favorites, playlist ownership/sharing,
all server settings, and shutdown cancellation. The **48 Phase 4 engine checks**
also pass after the command-driven engine changes.

These are local behavioral checks with stand-in Discord objects; they do not prove
live Discord interaction delivery, voice playback, or upstream account access.
Phase 6 supplies the actual renderer and bootstrap. Phase 7 promotes the regression
coverage into the permanent `tests/` suite. Temporary fixtures remain ignored under
`data/phase-5-verification`. No dependencies changed in Phase 5.

## API references

- [Discord application commands](https://docs.discord.com/developers/interactions/application-commands)
- [Discord permissions](https://docs.discord.com/developers/topics/permissions)
- [discord.js 14.27.0 interaction API](https://discord.js.org/docs/packages/discord.js/14.27.0/ChatInputCommandInteraction:Class)

````

