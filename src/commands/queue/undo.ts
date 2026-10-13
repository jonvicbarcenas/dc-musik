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
