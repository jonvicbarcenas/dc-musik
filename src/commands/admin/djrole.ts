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
