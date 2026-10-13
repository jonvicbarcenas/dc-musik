import { arg, defineCommand } from '../../framework/Command.js';
import { parsePositions } from '../../lib/utils/positions.js';
import { controlPolicy } from '../common.js';
const command = defineCommand({
  name: 'remove',
  description: 'Remove upcoming positions or ranges such as 2,4-6',
  category: 'queue',
  policy: controlPolicy,
  arguments: [arg.text('positions', 'One-based positions or ranges', true, true, 1000)],
  execute: async (context) => {
    const removed = await context.services.players.mutateQueue(context.guildId, (queue) =>
      queue.remove(parsePositions(context.args.text('positions'), queue.size)),
    );
    await context.notice(`Removed ${removed.length} queued track(s).`);
  },
});
export const { slash, aliases, execute } = command;
export default command;
