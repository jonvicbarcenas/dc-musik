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
