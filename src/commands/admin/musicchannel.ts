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
