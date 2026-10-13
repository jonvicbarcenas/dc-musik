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
