import { defineCommand } from '../../framework/Command.js';
import { controlPolicy } from '../common.js';
const command = defineCommand({
  name: 'shuffle',
  description: 'Shuffle upcoming tracks',
  category: 'queue',
  policy: controlPolicy,
  execute: async (context) => {
    await context.services.players.mutateQueue(
      context.guildId,
      (queue) => queue.shuffle(),
      context.expectedPlaybackId ?? undefined,
    );
    await context.notice('Queue shuffled.');
  },
});
export const { slash, aliases, execute } = command;
export default command;
