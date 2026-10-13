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
