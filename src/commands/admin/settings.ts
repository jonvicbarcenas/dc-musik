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
