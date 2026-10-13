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
