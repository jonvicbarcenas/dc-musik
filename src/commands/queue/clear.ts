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
