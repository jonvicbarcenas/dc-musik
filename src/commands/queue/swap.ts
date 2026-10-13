import { arg, defineCommand } from '../../framework/Command.js';
import { controlPolicy } from '../common.js';
const command = defineCommand({
  name: 'swap',
  description: 'Swap two upcoming queue positions',
  category: 'queue',
  policy: controlPolicy,
  arguments: [arg.integer('first', 'First position'), arg.integer('second', 'Second position')],
  execute: async (context) => {
    await context.services.players.mutateQueue(context.guildId, (queue) =>
      queue.swap(context.args.number('first'), context.args.number('second')),
    );
    await context.notice('Queue positions swapped.');
  },
});
export const { slash, aliases, execute } = command;
export default command;
